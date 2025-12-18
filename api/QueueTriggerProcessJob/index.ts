import { app, InvocationContext } from "@azure/functions";
import { OpenAIClient, AzureKeyCredential } from "@azure/openai";
import { getItem, patchItem, CONTAINERS } from "../shared/cosmosClient";
import { getContainerClient } from "../shared/storage";
import type { PatchOperation } from "@azure/cosmos";
import {
  sendSessionUpdate,
  sendProgressUpdate,
  sendErrorNotification,
} from "../shared/webPubSubClient";
import {
  ProcessingStatus,
  Organization,
  ProcessingSession,
} from "../shared/models";
import { getAzureOpenAICredentials } from "../shared/keyVaultClient";

// --- Interfaces ---
interface ProcessingJob {
  sessionId: string;
  owner: string;
  organizationID: string;
  language?: string;
  blobName: string;
}

function isProcessingJob(data: unknown): data is ProcessingJob {
  if (!data || typeof data !== "object") {
    return false;
  }
  const candidate = data as Partial<ProcessingJob>;
  return (
    typeof candidate.sessionId === "string" &&
    typeof candidate.organizationID === "string" &&
    typeof candidate.blobName === "string"
  );
}

// --- Config ---
const whisperDeploymentName =
  process.env.WHISPER_DEPLOYMENT_NAME || "whisper-deployment";

const OUTPUT_CONTAINER =
  process.env.AZURE_STORAGE_OUTPUT_CONTAINER || "outputs";

// --- Clients ---
let openAIClient: OpenAIClient | null = null;

async function initializeOpenAIClient(
  context: InvocationContext
): Promise<OpenAIClient> {
  if (openAIClient) return openAIClient;

  context.log("Initializing OpenAI client...");
  const { endpoint, key } = await getAzureOpenAICredentials();
  openAIClient = new OpenAIClient(endpoint, new AzureKeyCredential(key));
  context.log("OpenAI client initialized.");
  return openAIClient;
}

// --- Helper Functions ---
async function updateSessionStatus(
  sessionId: string,
  status: string,
  additionalData: Record<string, any> = {},
  context: InvocationContext
): Promise<void> {
  try {
    const operations: PatchOperation[] = [
      { op: "set", path: "/status", value: status },
      { op: "set", path: "/updatedAt", value: new Date().toISOString() },
    ];

    Object.keys(additionalData).forEach((key) => {
      operations.push({
        op: "set",
        path: `/${key}`,
        value: additionalData[key],
      });
    });

    await patchItem(CONTAINERS.SESSIONS, sessionId, sessionId, operations);
  } catch (error: any) {
    context.error(`Failed to update session ${sessionId} status:`, error);
  }
}

async function getOrgAndCheckLimits(
  organizationID: string,
  context: InvocationContext
): Promise<{ limitsOK: boolean; org: Organization }> {
  const org = await getItem<Organization>(
    CONTAINERS.ORGANIZATIONS,
    organizationID,
    organizationID
  );

  if (!org) {
    throw new Error(`Organization ${organizationID} not found.`);
  }

  // Check limits
  const limitsOK = (org.remainingMinutes || 0) > 0;
  if (!limitsOK) {
    context.warn(`Limits exceeded for org ${organizationID}.`);
  }

  return { limitsOK, org };
}

async function downloadBlob(
  blobName: string,
  context: InvocationContext
): Promise<Buffer> {
  context.log(`Downloading blob: ${blobName}`);
  const containerClient = getContainerClient("transcripts");
  const blobClient = containerClient.getBlockBlobClient(blobName);
  const buffer = await blobClient.downloadToBuffer();
  context.log(`Downloaded ${buffer.length} bytes`);
  return buffer;
}

async function transcribe(
  client: OpenAIClient,
  buffer: Buffer,
  language: string | undefined,
  context: InvocationContext
): Promise<{
  text: string;
  duration: number;
  words: Array<{
    text: string;
    start: number;
    end: number;
    speaker_id: string;
    segment_id?: string;
  }>;
}> {
  context.log(`Starting transcription with language: ${language || "auto"}`);

  const result = (await client.getAudioTranscription(
    whisperDeploymentName,
    buffer,
    "verbose_json",
    {
      language: language || undefined,
    }
  )) as unknown as Record<string, unknown>;

  const duration =
    typeof result["duration"] === "number" ? (result["duration"] as number) : 0;
  const text = typeof result["text"] === "string" ? (result["text"] as string) : "";

  const segmentsRaw = result["segments"];
  const segments = Array.isArray(segmentsRaw) ? (segmentsRaw as Record<string, unknown>[]) : [];

  const words =
    segments.length > 0
      ? segments.map((seg, index) => {
          const segText = typeof seg["text"] === "string" ? (seg["text"] as string) : "";
          const start = typeof seg["start"] === "number" ? (seg["start"] as number) : 0;
          const end = typeof seg["end"] === "number" ? (seg["end"] as number) : start;
          return {
            text: segText,
            start,
            end,
            speaker_id: "speaker_0",
            segment_id: `seg_${index}`,
          };
        })
      : [
          {
            text,
            start: 0,
            end: duration || 0,
            speaker_id: "speaker_0",
            segment_id: "seg_0",
          },
        ];
  context.log(
    `Transcription complete. Duration: ${duration}s, Text length: ${text.length}`
  );

  return { text, duration, words };
}

async function saveResults(
  session: ProcessingSession,
  transcriptJson: Record<string, unknown>,
  bullets: string | null,
  minutes: string | null,
  tasks: any[] | null,
  context: InvocationContext
): Promise<Record<string, string>> {
  context.log("Saving results to blob storage...");
  const containerClient = getContainerClient(OUTPUT_CONTAINER);
  await containerClient.createIfNotExists();

  const results: Record<string, string> = {};
  const basePath = `private/${session.owner}/${session.sessionId}/`;

  // Save transcript
  const transcriptBlobName = `${basePath}transcript.json`;
  const transcriptBlob = containerClient.getBlockBlobClient(transcriptBlobName);
  const transcriptPayload = Buffer.from(JSON.stringify(transcriptJson, null, 2), "utf-8");
  await transcriptBlob.upload(transcriptPayload, transcriptPayload.length, {
    blobHTTPHeaders: { blobContentType: "application/json" },
  });
  results.transcriptKey = transcriptBlobName;

  // Save bullet points if available
  if (bullets) {
    const bulletsBlobName = `${basePath}bulletPoints.txt`;
    const bulletsBlob = containerClient.getBlockBlobClient(bulletsBlobName);
    await bulletsBlob.upload(bullets, Buffer.byteLength(bullets), {
      blobHTTPHeaders: { blobContentType: "text/plain" },
    });
    results.bulletPointsKey = bulletsBlobName;
  }

  // Save minutes if available
  if (minutes) {
    const minutesBlobName = `${basePath}minutes.txt`;
    const minutesBlob = containerClient.getBlockBlobClient(minutesBlobName);
    await minutesBlob.upload(minutes, Buffer.byteLength(minutes), {
      blobHTTPHeaders: { blobContentType: "text/plain" },
    });
    results.minutesKey = minutesBlobName;
  }

  // Save tasks if available
  if (tasks && tasks.length > 0) {
    const tasksBlobName = `${basePath}tasks.json`;
    const tasksBlob = containerClient.getBlockBlobClient(tasksBlobName);
    const tasksJson = JSON.stringify(tasks, null, 2);
    const buf = Buffer.from(tasksJson, "utf-8");
    await tasksBlob.upload(buf, buf.length, {
      blobHTTPHeaders: { blobContentType: "application/json" },
    });
    results.tasksKey = tasksBlobName;
  }

  context.log(`Saved ${Object.keys(results).length} result files`);
  return results;
}

async function decrementMinutes(
  organizationID: string,
  minutesUsed: number,
  context: InvocationContext
): Promise<void> {
  const operations: PatchOperation[] = [
    { op: "incr", path: "/remainingMinutes", value: -Math.ceil(minutesUsed) },
    { op: "set", path: "/updatedAt", value: new Date().toISOString() },
  ];

  await patchItem(
    CONTAINERS.ORGANIZATIONS,
    organizationID,
    organizationID,
    operations
  );
  context.log(`Decremented ${minutesUsed} minutes for org ${organizationID}`);
}

// --- Main Queue Trigger ---
export async function QueueTriggerProcessJob(
  queueItem: unknown,
  context: InvocationContext
): Promise<void> {
  if (!isProcessingJob(queueItem)) {
    context.error(
      "Queue item is missing required fields or has invalid format.",
      queueItem
    );
    return;
  }

  const { sessionId, organizationID, blobName, language } = queueItem;
  context.log(`Queue function triggered for sessionId: ${sessionId}`);

  let actualMinutesUsed = 0;

  try {
    // 1. Initialize client
    const client = await initializeOpenAIClient(context);

    const session = await getItem<ProcessingSession>(
      CONTAINERS.SESSIONS,
      sessionId,
      sessionId
    );
    if (!session) {
      throw new Error(`Session ${sessionId} not found.`);
    }

    // Update status: Processing transcription
    await updateSessionStatus(
      sessionId,
      ProcessingStatus.PROCESSING_TRANSCRIPTION,
      {},
      context
    );
    await sendSessionUpdate(
      sessionId,
      ProcessingStatus.PROCESSING_TRANSCRIPTION
    );
    await sendProgressUpdate(
      sessionId,
      "transcription",
      10,
      "Starting transcription..."
    );

    // 2. Get Organization and Check Limits
    const { limitsOK, org } = await getOrgAndCheckLimits(
      organizationID,
      context
    );
    if (!limitsOK) {
      throw new Error(
        `Organization ${organizationID} has exceeded usage limits.`
      );
    }

    // 3. Download audio file
    await sendProgressUpdate(
      sessionId,
      "transcription",
      20,
      "Downloading audio file..."
    );
    const audioBuffer = await downloadBlob(blobName, context);

    // 4. Transcribe with Azure OpenAI Whisper
    await sendProgressUpdate(
      sessionId,
      "transcription",
      30,
      "Transcribing audio..."
    );
    const { text: transcript, duration: durationInSeconds, words } = await transcribe(
      client,
      audioBuffer,
      language,
      context
    );

    actualMinutesUsed = durationInSeconds / 60;

    // 5. Check actual duration against limits
    if (org.remainingMinutes < actualMinutesUsed) {
      throw new Error(
        `File duration (${actualMinutesUsed.toFixed(
          2
        )} min) exceeds remaining time (${org.remainingMinutes} min).`
      );
    }

    // 6. Save transcript and move to PENDING_SPEAKER_EDIT (content generation handled separately)
    const transcriptJson = {
      schema_version: "1.0",
      audio_duration: durationInSeconds,
      language: language || "ja",
      preprocessing_info: null,
      words,
      text: transcript,
    };

    const results = await saveResults(session, transcriptJson, null, null, null, context);
    await updateSessionStatus(
      sessionId,
      ProcessingStatus.PENDING_SPEAKER_EDIT,
      {
        audioLengthSeconds: Math.round(durationInSeconds),
        transcriptKey: results.transcriptKey,
        transcriptFormat: "JSON",
      },
      context
    );
    await sendSessionUpdate(sessionId, ProcessingStatus.PENDING_SPEAKER_EDIT);
    await sendProgressUpdate(
      sessionId,
      "transcription",
      70,
      "Transcription complete"
    );

    // 7. Decrement usage limits
    await decrementMinutes(organizationID, actualMinutesUsed, context);

    context.log(`Transcription complete for sessionId: ${sessionId}`);
  } catch (error: any) {
    const errorMessage = error.message || "Unknown processing error";
    context.error(`Processing failed for sessionId ${sessionId}:`, error);

    // Decrement minutes even on failure if transcription completed
    if (actualMinutesUsed > 0) {
      context.warn(
        `Processing failed, but decrementing transcription minutes (${actualMinutesUsed.toFixed(
          2
        )}) for org ${organizationID}.`
      );
      await decrementMinutes(organizationID, actualMinutesUsed, context).catch(
        (err) => context.error("Failed to decrement minutes:", err)
      );
    }

    // Update session with error
    await updateSessionStatus(
      sessionId,
      ProcessingStatus.ERROR,
      { errorMessage },
      context
    ).catch((err) =>
      context.error("Failed to update session with error:", err)
    );

    await sendErrorNotification(sessionId, errorMessage).catch((err) =>
      context.warn("Failed to send error notification:", err)
    );
  }
}

app.storageQueue("QueueTriggerProcessJob", {
  queueName: "processing-queue",
  connection: "AzureWebJobsStorage",
  handler: QueueTriggerProcessJob,
});
