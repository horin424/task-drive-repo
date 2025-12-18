import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { BlobSASPermissions } from "@azure/storage-blob";
import { getContainerClient } from "../shared/storage";
import { authenticateRequest, AuthorizationError } from "../shared/auth";
import { assertSessionAccess, ensureValidSessionId, fetchSessionOrThrow } from "../shared/sessionUtils";
import { randomUUID } from "crypto";
import { getCorrelationId } from "../shared/correlation";

const OUTPUT_CONTAINER =
  process.env.AZURE_STORAGE_OUTPUT_CONTAINER || "outputs";

const isSafeBlobPath = (blobName: string, owner: string, sessionId: string): boolean => {
  const expectedPrefix = `private/${owner}/${sessionId}/`;
  return blobName.startsWith(expectedPrefix);
};

export async function getOutputUrl(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const correlationId = getCorrelationId(request);
  context.log("HTTP trigger function processed get-output-url request.", correlationId);

  try {
    const auth = await authenticateRequest(request);
    const sessionId = ensureValidSessionId(
      request.query.get("sessionId") || request.params.sessionId || ""
    );
    const blobKey = request.query.get("blobKey") || undefined;

    if (!blobKey) {
      throw new AuthorizationError("blobKey query parameter is required", 400);
    }

    const session = await fetchSessionOrThrow(sessionId);
    await assertSessionAccess(session, auth);

    const matchesSessionKey =
      blobKey === session.transcriptKey ||
      blobKey === session.bulletPointsKey ||
      blobKey === session.minutesKey ||
      blobKey === session.tasksKey ||
      blobKey === session.taskFileKey ||
      blobKey === session.informationFileKey;

    if (!matchesSessionKey && !isSafeBlobPath(blobKey, session.owner, session.sessionId)) {
      throw new AuthorizationError("Blob not found for session", 404);
    }

    const containerClient = getContainerClient(OUTPUT_CONTAINER);
    const blobClient = containerClient.getBlockBlobClient(blobKey);

    const exists = await blobClient.exists();
    if (!exists) {
      throw new AuthorizationError("Blob not found", 404);
    }

    const permissions = BlobSASPermissions.parse("r");
    const expiresOn = new Date(Date.now() + 10 * 60 * 1000);
    const startsOn = new Date(Date.now() - 60 * 1000);

    const sasUrl = await blobClient.generateSasUrl({
      permissions,
      expiresOn,
      startsOn,
    });
    const correlationId = randomUUID();

    return {
      status: 200,
      jsonBody: {
        url: sasUrl,
        blobKey,
        expiresIn: 600,
        correlationId,
      },
    };
  } catch (error: any) {
    const status =
      error instanceof AuthorizationError ? error.status : 500;
    context.error("Error generating output URL:", error);
    return {
      status,
      jsonBody: { error: error.message || "Internal server error", correlationId },
    };
  }
}

app.http("get-output-url", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "sessions/output-url/{sessionId?}",
  handler: getOutputUrl,
});
