import { app, InvocationContext, output } from "@azure/functions";
import { patchItem, upsertItem, CONTAINERS, getItem } from "../shared/cosmosClient";
import type { PatchOperation } from "@azure/cosmos";
import {
  sendSessionUpdate,
  sendProgressUpdate,
} from "../shared/webPubSubClient";
import { ProcessingStatus } from "../shared/models";

type BlobTriggerMetadata = {
  name?: string;
  uri?: string;
  metadata?: FrontendMetadata;
};

type FrontendMetadata = {
  sessionid?: string;
  owner?: string;
  organizationid?: string;
  filename?: string;
  language?: string;
};

const parseBlobPath = (
  blobName: string
): { owner?: string; sessionId?: string; fileName?: string } => {
  // Expected: private/<owner>/<sessionId>/<file>
  const parts = blobName.split("/").filter(Boolean);
  if (parts.length < 4) {
    return {};
  }
  if (parts[0] !== "private") {
    return {};
  }
  return {
    owner: parts[1],
    sessionId: parts[2],
    fileName: parts.slice(3).join("/"),
  };
};

// Queue Output
const queueOutput = output.storageQueue({
  queueName: "processing-queue",
  connection: "AzureWebJobsStorage",
});

export async function BlobTriggerProcessUpload(
  _blob: unknown,
  context: InvocationContext
): Promise<void> {
  const triggerMetadata = (context.triggerMetadata ??
    {}) as BlobTriggerMetadata;
  const blobName = triggerMetadata.name ?? "unknown";
  const blobUri = triggerMetadata.uri ?? "";

  context.log(`Blob trigger processed blob: ${blobName}`);

  // Get metadata from frontend
  const blobMetadata = triggerMetadata.metadata ?? {};
  const parsed = parseBlobPath(blobName);
  const sessionId = blobMetadata.sessionid || parsed.sessionId;
  const owner = blobMetadata.owner || parsed.owner;
  const organizationID = blobMetadata.organizationid || null;
  const fileName = blobMetadata.filename || parsed.fileName || blobName;
  const language = blobMetadata.language || "ja";

  if (!sessionId) {
    context.error(
      `Missing 'sessionid' in blob metadata and unable to infer from path for ${blobName}. Aborting.`
    );
    return;
  }

  if (!organizationID) {
    context.error(
      `Missing 'organizationid' in blob metadata for ${blobName}. Aborting.`
    );
    return;
  }

  const now = new Date().toISOString();

  // 1. Ensure the ProcessingSession exists and has inputBlobName set.
  try {
    const existing = await getItem(CONTAINERS.SESSIONS, sessionId, sessionId);

    if (existing) {
      const operations: PatchOperation[] = [
        { op: "set", path: "/updatedAt", value: now },
      ];

      if (!existing.inputBlobName) {
        operations.push({ op: "set", path: "/inputBlobName", value: blobName });
      }

      // Preserve previously created sessions, but ensure core fields exist.
      if (!existing.organizationID) {
        operations.push({ op: "set", path: "/organizationID", value: organizationID });
      }
      if (!existing.owner && owner) {
        operations.push({ op: "set", path: "/owner", value: owner });
      }
      if (!existing.fileName && fileName) {
        operations.push({ op: "set", path: "/fileName", value: fileName });
      }
      if (!existing.language && language) {
        operations.push({ op: "set", path: "/language", value: language });
      }

      if (operations.length > 1) {
        await patchItem(CONTAINERS.SESSIONS, sessionId, sessionId, operations);
      }

      context.log(`Updated processing session (existing): ${sessionId}`);
    } else {
      const newSession = {
        id: sessionId,
        sessionId,
        owner: owner || "unknown",
        organizationID,
        fileName,
        inputBlobName: blobName,
        language,
        status: ProcessingStatus.UPLOADED,
        uploadTime: now,
        createdAt: now,
        updatedAt: now,
      };

      await upsertItem(CONTAINERS.SESSIONS, newSession);
      context.log(`Created processing session: ${sessionId}`);
    }

    // Send real-time update
    await sendSessionUpdate(
      sessionId,
      ProcessingStatus.UPLOADED
    ).catch((err) => context.warn("Failed to send Web PubSub update:", err));

    await sendProgressUpdate(
      sessionId,
      "upload",
      100,
      "File uploaded successfully"
    ).catch((err) => context.warn("Failed to send progress update:", err));
  } catch (e) {
    context.error(`Failed to create session ${sessionId}:`, e);
    return; // Don't queue if session creation fails
  }

  // 2. Send message to the queue for processing
  const queueMessage = {
    sessionId: sessionId,
    owner: owner || "unknown",
    organizationID: organizationID,
    language: language,
    blobName: blobName,
  };
  context.extraOutputs.set(queueOutput, queueMessage);
  context.log(`Enqueued job for sessionId: ${sessionId}`);
}

app.storageBlob("BlobTriggerProcessUpload", {
  path: "transcripts/{name}",
  connection: "AzureWebJobsStorage",
  extraOutputs: [queueOutput],
  handler: BlobTriggerProcessUpload,
});
