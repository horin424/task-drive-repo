import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { BlobSASPermissions } from "@azure/storage-blob";
import { authenticateRequest, AuthorizationError } from "../shared/auth";
import {
  assertSessionAccess,
  ensureValidSessionId,
  fetchSessionOrThrow,
} from "../shared/sessionUtils";
import { getContainerClient, sanitizeFileName } from "../shared/storage";
import { getCorrelationId } from "../shared/correlation";

type UploadPurpose = "transcript" | "tasks" | "information" | "custom";

const OUTPUT_CONTAINER =
  process.env.AZURE_STORAGE_OUTPUT_CONTAINER || "outputs";

const isSafeBlobPath = (
  blobName: string,
  owner: string,
  sessionId: string
): boolean => {
  const expectedPrefix = `private/${owner}/${sessionId}/`;
  return blobName.startsWith(expectedPrefix);
};

const resolveBlobName = (
  purpose: UploadPurpose,
  sessionOwner: string,
  sessionId: string,
  fileName?: string,
  existing?: string
): string => {
  const basePath = `private/${sessionOwner}/${sessionId}/`;
  const safeFileName = fileName ? sanitizeFileName(fileName) : "";

  switch (purpose) {
    case "transcript":
      return existing && existing.length > 0
        ? existing
        : `${basePath}transcript.txt`;
    case "tasks":
      return `${basePath}${safeFileName || "tasks.xlsx"}`;
    case "information":
      return `${basePath}${safeFileName || "information.xlsx"}`;
    default:
      if (!safeFileName) {
        throw new AuthorizationError("fileName is required for custom upload", 400);
      }
      return `${basePath}${safeFileName}`;
  }
};

export async function getOutputUploadSas(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const correlationId = getCorrelationId(request);
  context.log("Generating output upload SAS", correlationId);

  try {
    const auth = await authenticateRequest(request);
    const body =
      (request.method === "POST"
        ? ((await request.json().catch(() => ({}))) as Record<string, unknown>)
        : {}) || {};

    const sessionId = ensureValidSessionId(
      (body.sessionId as string) ||
        request.query.get("sessionId") ||
        request.params.sessionId ||
        ""
    );

    const session = await fetchSessionOrThrow(sessionId);
    await assertSessionAccess(session, auth);

    const allowedPurposes: UploadPurpose[] = [
      "transcript",
      "tasks",
      "information",
      "custom",
    ];
    const purposeRaw =
      ((body.purpose as string) || request.query.get("purpose") || "custom").toString();
    const normalizedPurpose = purposeRaw.toLowerCase() as UploadPurpose;
    const purpose = allowedPurposes.includes(normalizedPurpose)
      ? normalizedPurpose
      : "custom";
    const fileName =
      (body.fileName as string) || request.query.get("fileName") || "";
    const requestedBlobName =
      (body.blobName as string) || request.query.get("blobName") || "";

    let blobName = requestedBlobName;

    if (blobName) {
      const matchesTranscriptKey =
        blobName === session.transcriptKey ||
        blobName === session.bulletPointsKey ||
        blobName === session.minutesKey ||
        blobName === session.tasksKey;

      if (
        !matchesTranscriptKey &&
        !isSafeBlobPath(blobName, session.owner, session.sessionId)
      ) {
        throw new AuthorizationError("Invalid blobName for session", 400);
      }
    } else {
      blobName = resolveBlobName(
        purpose,
        session.owner,
        session.sessionId,
        fileName,
        session.transcriptKey
      );
    }

    const containerClient = getContainerClient(OUTPUT_CONTAINER);
    await containerClient.createIfNotExists();
    const blobClient = containerClient.getBlockBlobClient(blobName);

    const permissions = BlobSASPermissions.parse("acw");
    const expiresOn = new Date(Date.now() + 10 * 60 * 1000);
    const startsOn = new Date(Date.now() - 60 * 1000);

    const sasUrl = await blobClient.generateSasUrl({
      permissions,
      expiresOn,
      startsOn,
    });

    return {
      status: 200,
      jsonBody: {
        sasUrl,
        blobName,
        expiresOn: expiresOn.toISOString(),
        correlationId,
      },
    };
  } catch (error: any) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    context.error("Error generating output upload SAS:", error);
    return {
      status,
      jsonBody: {
        error: error.message || "Internal server error",
        correlationId,
      },
    };
  }
}

app.http("get-output-upload-sas", {
  methods: ["POST", "GET"],
  authLevel: "anonymous",
  route: "sessions/output-upload-sas/{sessionId?}",
  handler: getOutputUploadSas,
});
