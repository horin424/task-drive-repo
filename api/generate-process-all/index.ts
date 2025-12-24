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
import axios from "axios";
import { getAzureOpenAICredentials, getDifyCredentials } from "../shared/keyVaultClient";

// --- Configuration ---
const openAiDeployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini"; // Ensure this matches your Foundry deployment name
const outputContainerName = process.env.AZURE_STORAGE_OUTPUT_CONTAINER || "outputs";

const enableDifyGeneration = (process.env.ENABLE_DIFY_GENERATION || "").toLowerCase() === "true";
const difyResponseMode = process.env.DIFY_RESPONSE_MODE || "blocking";
const difyInputTranscriptKey = process.env.DIFY_INPUT_TRANSCRIPT_KEY || "transcript";
const difyInputProcessingTypeKey = process.env.DIFY_INPUT_PROCESSING_TYPE_KEY || "processingType";
const difyInputTaskFileKey = process.env.DIFY_INPUT_TASK_FILE_KEY || "taskFileKey";
const difyInputInformationFileKey = process.env.DIFY_INPUT_INFORMATION_FILE_KEY || "informationFileKey";

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

const getOpenAiClient = async (context: InvocationContext): Promise<OpenAIClient> => {
  if (openAiClient) return openAiClient;

  const { endpoint, key } = await getAzureOpenAICredentials();
  if (!endpoint || !key) {
    throw new Error(
      "Azure OpenAI endpoint/key not configured. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY (or Key Vault secrets)."
    );
  }

  openAiClient = new OpenAIClient(endpoint, new AzureKeyCredential(key));
  context.log("Azure OpenAI client initialized");
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
  const client = await getOpenAiClient(context);
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

type DifyWorkflowRunResponse = {
  data?: {
    outputs?: Record<string, unknown>;
    error?: string;
    status?: string;
  };
  outputs?: Record<string, unknown>;
  message?: string;
  code?: string;
};

const getDifyRunUrl = (workflowUrl: string): string => {
  const base = (workflowUrl || "").trim().replace(/\/+$/, "");
  if (!base) {
    throw new Error("Dify workflow URL is not configured (DIFY_WORKFLOW_URL).");
  }
  if (base.endsWith("/workflows/run")) return base;
  return `${base}/workflows/run`;
};

const extractDifyTextOutput = (outputs: unknown): string | null => {
  if (!outputs) return null;
  if (typeof outputs === "string") return outputs.trim();
  if (typeof outputs !== "object") return null;

  const record = outputs as Record<string, unknown>;
  const preferredKeys = ["text", "result", "output", "answer", "content"];
  for (const key of preferredKeys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  const stringValues = Object.values(record).filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0
  );
  if (stringValues.length === 1) return stringValues[0].trim();
  return null;
};

const generateContentWithDify = async (
  type: string,
  transcript: string,
  context: InvocationContext,
  userId: string,
  taskFileKey?: string,
  informationFileKey?: string
): Promise<string> => {
  if (difyResponseMode !== "blocking") {
    throw new Error(
      `Unsupported Dify response mode '${difyResponseMode}'. Use DIFY_RESPONSE_MODE=blocking.`
    );
  }

  const { apiKey, workflowUrl } = await getDifyCredentials();
  if (!apiKey || !workflowUrl) {
    throw new Error(
      "Dify API key/workflow URL not configured. Set DIFY_API_KEY and DIFY_WORKFLOW_URL (or Key Vault secrets)."
    );
  }

  const url = getDifyRunUrl(workflowUrl);
  const inputs: Record<string, unknown> = {
    [difyInputTranscriptKey]: transcript,
    [difyInputProcessingTypeKey]: type,
  };
  if (taskFileKey) inputs[difyInputTaskFileKey] = taskFileKey;
  if (informationFileKey) inputs[difyInputInformationFileKey] = informationFileKey;

  context.log(`[Dify] Generating ${type} via workflow...`);

  const response = await axios.post<DifyWorkflowRunResponse>(
    url,
    {
      inputs,
      response_mode: "blocking",
      user: userId,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 5 * 60 * 1000,
      validateStatus: () => true,
    }
  );

  if (response.status < 200 || response.status >= 300) {
    const details =
      typeof response.data === "object" && response.data
        ? JSON.stringify(response.data)
        : String(response.data);
    throw new Error(`Dify API error ${response.status}: ${details}`);
  }

  const text =
    extractDifyTextOutput(response.data?.data?.outputs) ||
    extractDifyTextOutput(response.data?.outputs);

  if (!text) {
    throw new Error(
      "No usable text output returned from Dify workflow. Ensure your workflow outputs a text field (e.g., 'text' or 'result')."
    );
  }

  return text;
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

  const defaultMonthlyTasks = org.monthlyTaskGenerations ?? 100;
  const hasRemaining = typeof org.remainingTaskGenerations === "number";
  const remaining = hasRemaining
    ? org.remainingTaskGenerations
    : defaultMonthlyTasks;

  if (!Number.isFinite(remaining) || remaining <= 0) {
    throw new AuthorizationError("Task quota exceeded", 403);
  }

  const operations: PatchOperation[] = [
    { op: "set", path: "/updatedAt", value: new Date().toISOString() },
  ];

  if (!hasRemaining) {
    if (org.monthlyTaskGenerations == null) {
      operations.push({
        op: "set",
        path: "/monthlyTaskGenerations",
        value: defaultMonthlyTasks,
      });
    }
    operations.push({
      op: "set",
      path: "/remainingTaskGenerations",
      value: remaining - 1,
    });
  } else {
    operations.push({
      op: "incr",
      path: "/remainingTaskGenerations",
      value: -1,
    });
  }

  const etag = (org as any)?._etag;
  await patchItem(
    CONTAINERS.ORGANIZATIONS,
    organizationID,
    organizationID,
    operations,
    etag ? { accessCondition: { type: "IfMatch", condition: etag } } : undefined
  );
};

export async function generateProcessAll(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const correlationId = getCorrelationId(request);
  context.log("generate-process-all invoked", correlationId);

  let sessionIdForError: string | null = null;

  try {
    const auth = await authenticateRequest(request);
    const body = (await request.json()) as GenerateRequest;

    if (!body.transcript || !body.sessionId || !body.processingTypes?.length) {
      throw new AuthorizationError("Missing required fields", 400);
    }

    const sessionId = ensureValidSessionId(body.sessionId);
    sessionIdForError = sessionId;
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
    const outputContainer = getContainerClient(outputContainerName);
    await outputContainer.createIfNotExists();

    const operations: PatchOperation[] = [
      { op: "set", path: "/updatedAt", value: new Date().toISOString() },
    ];

    for (const type of body.processingTypes) {
      const content = enableDifyGeneration
        ? await generateContentWithDify(
            type,
            body.transcript,
            context,
            auth.oid,
            body.taskFileKey,
            body.informationFileKey
          )
        : await generateContent(type, body.transcript, context);

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

    const status =
      error instanceof AuthorizationError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : "Internal server error";

    if (sessionIdForError) {
      const now = new Date().toISOString();
      await patchItem(CONTAINERS.SESSIONS, sessionIdForError, sessionIdForError, [
        { op: "set", path: "/status", value: ProcessingStatus.ERROR },
        { op: "set", path: "/errorMessage", value: message },
        { op: "set", path: "/updatedAt", value: now },
      ]).catch(() => undefined);
      await sendSessionUpdate(sessionIdForError, ProcessingStatus.ERROR, {
        errorMessage: message,
      }).catch(() => undefined);
    }

    return { status, jsonBody: { error: message, correlationId } };
  }
}

app.http("generate-process-all", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "generate/process-all",
  handler: generateProcessAll,
});
