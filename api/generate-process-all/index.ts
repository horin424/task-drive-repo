import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { getContainerClient } from "../shared/storage";
import { authenticateRequest, AuthorizationError } from "../shared/auth";
import {
  assertSessionAccess,
  ensureValidSessionId,
  fetchSessionOrThrow,
} from "../shared/sessionUtils";
import { patchItem, CONTAINERS, getItem } from "../shared/cosmosClient";
import type { PatchOperation } from "@azure/cosmos";
import { ProcessingStatus, Organization } from "../shared/models";
import { sendSessionUpdate } from "../shared/webPubSubClient";
import { OpenAIClient, AzureKeyCredential } from "@azure/openai";
import { getCorrelationId } from "../shared/correlation";

// --- Configuration ---
const openAiEndpoint = process.env.AZURE_OPENAI_ENDPOINT || "";
const openAiKey = process.env.AZURE_OPENAI_API_KEY || "";
const openAiDeployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini"; // Ensure this matches your Foundry deployment name

type GenerateRequest = {
  transcript: string;
  sessionId: string;
  processingTypes: string[];
  taskFileKey?: string;
  informationFileKey?: string;
};

const CONTENT_TYPES: Record<string, string> = {
  bullets: "text/plain",
  minutes: "text/plain",
  tasks: "text/plain",
};

// --- Direct Azure OpenAI Client ---
let openAiClient: OpenAIClient | null = null;

const getOpenAiClient = (): OpenAIClient => {
  if (openAiClient) return openAiClient;
  if (!openAiEndpoint || !openAiKey) {
    throw new Error(
      "Azure OpenAI endpoint/key not configured in local.settings.json."
    );
  }
  openAiClient = new OpenAIClient(
    openAiEndpoint,
    new AzureKeyCredential(openAiKey)
  );
  return openAiClient;
};

// --- Prompts (Logic formerly in Dify) ---
const buildPrompt = (type: string, transcript: string): string => {
  // Truncate if too long to avoid token limits (adjust based on model)
  const trimmed =
    transcript.length > 15000
      ? transcript.slice(0, 15000) + "...(truncated)"
      : transcript;

  switch (type) {
    case "bullets":
      return `
      You are an expert meeting assistant. Summarize the following transcript into concise bullet points.
      Focus on key decisions, important statements, and the overall flow.
      
      Transcript:
      ${trimmed}`;

    case "minutes":
      return `
      You are an expert secretary. Create formal meeting minutes from the transcript.
      Include:
      1. Summary
      2. Key Decisions
      3. Action Items (Who, What, When)
      4. Risks or Issues raised
      
      Transcript:
      ${trimmed}`;

    case "tasks":
      return `
      Extract all actionable tasks from this transcript.
      Output a JSON list of objects with fields: "task", "owner", "due_date" (if mentioned), "priority".
      If no owner/date is mentioned, infer or leave null.
      
      Transcript:
      ${trimmed}`;

    default:
      return `Summarize this: ${trimmed}`;
  }
};

const generateContent = async (
  type: string,
  transcript: string,
  context: InvocationContext
): Promise<string> => {
  const client = getOpenAiClient();
  const prompt = buildPrompt(type, transcript);

  context.log(`[OpenAI] Generating ${type} using ${openAiDeployment}...`);

  try {
    const messages = [
      { role: "system", content: "You are a helpful AI assistant." },
      { role: "user", content: prompt },
    ];

    const response = await client.getChatCompletions(
      openAiDeployment,
      messages,
      {
        maxTokens: 2000,
        temperature: 0.5,
      }
    );

    const content: any = response.choices?.[0]?.message?.content;
    let choice = "";
    if (typeof content === "string") {
      choice = content.trim();
    } else if (Array.isArray(content)) {
      choice = content
        .map((p: any) => (typeof p === "string" ? p : p?.text || ""))
        .join("")
        .trim();
    }

    if (!choice) {
      throw new Error("No content returned from Azure OpenAI.");
    }
    return choice;
  } catch (err: any) {
    context.error(`[OpenAI] Error generating ${type}:`, err);
    throw new Error(`OpenAI generation failed: ${err.message}`);
  }
};

const decrementTaskQuota = async (
  organizationID: string,
  correlationId: string
) => {
  const org = await getItem<Organization>(
    CONTAINERS.ORGANIZATIONS,
    organizationID,
    organizationID
  );
  if (!org) throw new AuthorizationError("Organization not found", 404);
  if ((org.remainingTaskGenerations ?? 0) <= 0)
    throw new AuthorizationError("Task quota exceeded", 403);

  const etag = (org as any)?._etag;
  await patchItem(
    CONTAINERS.ORGANIZATIONS,
    organizationID,
    organizationID,
    [
      { op: "incr", path: "/remainingTaskGenerations", value: -1 },
      { op: "set", path: "/updatedAt", value: new Date().toISOString() },
    ],
    etag ? { accessCondition: { type: "IfMatch", condition: etag } } : undefined
  );
};

export async function generateProcessAll(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const correlationId = getCorrelationId(request);
  context.log("generate-process-all invoked", correlationId);

  try {
    const auth = await authenticateRequest(request);
    const body = (await request.json()) as GenerateRequest;

    if (!body.transcript || !body.sessionId || !body.processingTypes?.length) {
      throw new AuthorizationError("Missing required fields", 400);
    }

    const sessionId = ensureValidSessionId(body.sessionId);
    const session = await fetchSessionOrThrow(sessionId);
    await assertSessionAccess(session, auth);

    if (!session.organizationID) {
      throw new AuthorizationError("Session is missing organizationID. Recreate the session via upload.", 400);
    }
    if (!session.transcriptKey) {
      throw new AuthorizationError("Transcript not available. Complete transcription/speaker edit before generation.", 400);
    }

    // =========================================================
    // 1. UPDATE STATUS IMMEDIATELY (Fixes Progress Bar)
    // =========================================================
    const firstType = body.processingTypes[0] || "minutes";
    let initialStatus = ProcessingStatus.PROCESSING_MINUTES;
    if (firstType === "bullets")
      initialStatus = ProcessingStatus.PROCESSING_BULLETS;
    if (firstType === "tasks")
      initialStatus = ProcessingStatus.PROCESSING_TASKS;

    const now = new Date().toISOString();

    await patchItem(CONTAINERS.SESSIONS, sessionId, sessionId, [
      { op: "set", path: "/status", value: initialStatus },
      { op: "set", path: "/updatedAt", value: now },
    ]);
    // Notify Frontend
    await sendSessionUpdate(sessionId, initialStatus);

    // =========================================================
    // 2. GENERATE CONTENT (Using Azure OpenAI Direct)
    // =========================================================
    if (body.processingTypes.includes("tasks")) {
      await decrementTaskQuota(session.organizationID, correlationId);
    }

    const basePath = `private/${session.owner}/${session.sessionId}/`;
    const outputContainer = getContainerClient("outputs");
    await outputContainer.createIfNotExists();

    const operations: PatchOperation[] = [
      { op: "set", path: "/updatedAt", value: new Date().toISOString() },
    ];

    for (const type of body.processingTypes) {
      const content = await generateContent(type, body.transcript, context);

      const blobName = `${basePath}${type}.txt`;
      const buffer = Buffer.from(content, "utf-8");
      await outputContainer
        .getBlockBlobClient(blobName)
        .upload(buffer, buffer.length, {
          blobHTTPHeaders: {
            blobContentType: CONTENT_TYPES[type] || "text/plain",
          },
        });

      if (type === "bullets") {
        operations.push({
          op: "set",
          path: "/bulletPointsKey",
          value: blobName,
        });
        operations.push({
          op: "set",
          path: "/bulletPointsStatus",
          value: "COMPLETED",
        });
      } else if (type === "minutes") {
        operations.push({ op: "set", path: "/minutesKey", value: blobName });
        operations.push({
          op: "set",
          path: "/minutesStatus",
          value: "COMPLETED",
        });
      } else if (type === "tasks") {
        operations.push({ op: "set", path: "/tasksKey", value: blobName });
        operations.push({
          op: "set",
          path: "/tasksStatus",
          value: "COMPLETED",
        });
      }
    }

    // 3. FINISH
    operations.push({
      op: "set",
      path: "/status",
      value: ProcessingStatus.ALL_COMPLETED,
    });

    const updated = await patchItem(
      CONTAINERS.SESSIONS,
      sessionId,
      sessionId,
      operations
    );
    await sendSessionUpdate(
      sessionId,
      updated.status ?? ProcessingStatus.ALL_COMPLETED,
      updated
    );

    return { status: 202, jsonBody: { message: "Completed", sessionId } };
  } catch (error: any) {
    context.error("generate-process-all error", error);
    return { status: 500, jsonBody: { error: error.message } };
  }
}

app.http("generate-process-all", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "generate/process-all",
  handler: generateProcessAll,
});
