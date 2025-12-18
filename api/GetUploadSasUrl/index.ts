import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { BlobSASPermissions } from "@azure/storage-blob";
import {
  getContainerClient,
  buildPrivateBlobPath,
  sanitizeFileName,
} from "../shared/storage";
import {
  authenticateRequest,
  AuthorizationError,
} from "../shared/auth";
import {
  assertSessionAccess,
  ensureValidSessionId,
  fetchSessionOrThrow,
} from "../shared/sessionUtils";
import { patchItem, CONTAINERS } from "../shared/cosmosClient";
import { getCorrelationId } from "../shared/correlation";

export async function GetUploadSasUrl(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const correlationId = getCorrelationId(request);
  context.log("Generating upload SAS", correlationId);

  try {
    const auth = await authenticateRequest(request);
    const body =
      (request.method === "POST"
        ? ((await request.json().catch(() => ({}))) as Record<
            string,
            unknown
          >)
        : {}) || {};

    const sessionId = ensureValidSessionId(
      (body.sessionId as string) || request.query.get("sessionId") || ""
    );
    const fileName =
      (body.fileName as string) || request.query.get("fileName") || "";

    const session = await fetchSessionOrThrow(sessionId);
    await assertSessionAccess(session, auth);

    if (!session.organizationID) {
      throw new AuthorizationError("Session missing organization ID", 400);
    }

    // Basic quota gate: ensure organization exists
    const org = await patchItem(CONTAINERS.ORGANIZATIONS, session.organizationID, session.organizationID, [
      { op: "incr", path: "/remainingMinutes", value: 0 },
    ]).catch(() => null);
    if (!org) {
      throw new AuthorizationError("Organization not found for session", 404);
    }

    const normalizedFileName =
      session.inputBlobName && !fileName
        ? session.inputBlobName.split("/").pop() || sanitizeFileName()
        : sanitizeFileName(fileName || session.fileName);

    const blobName =
      session.inputBlobName ||
      buildPrivateBlobPath(auth.oid, sessionId, normalizedFileName);

    const containerClient = getContainerClient("transcripts");
    await containerClient.createIfNotExists();
    const blobClient = containerClient.getBlockBlobClient(blobName);

    if (!session.inputBlobName) {
      await patchItem(CONTAINERS.SESSIONS, sessionId, sessionId, [
        {
          op: "set",
          path: "/inputBlobName",
          value: blobName,
        },
        {
          op: "set",
          path: "/updatedAt",
          value: new Date().toISOString(),
        },
      ]);
    }

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
    const status =
      error instanceof AuthorizationError ? error.status : 500;
    context.error("Error generating upload SAS:", error);
    return {
      status,
      jsonBody: { error: error.message || "Internal server error", correlationId },
    };
  }
}

app.http("GetUploadSasUrl", {
  methods: ["POST", "GET"],
  authLevel: "anonymous",
  handler: GetUploadSasUrl,
});
