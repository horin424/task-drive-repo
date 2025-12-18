import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { upsertItem, CONTAINERS, getItem } from "../shared/cosmosClient";
import {
  ProcessingSession,
  ProcessingStatus,
} from "../shared/models";
import {
  authenticateRequest,
  AuthorizationError,
} from "../shared/auth";
import {
  buildPrivateBlobPath,
  sanitizeFileName,
} from "../shared/storage";
import { ensureValidSessionId } from "../shared/sessionUtils";

export async function createSession(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("create-session request received");

  try {
    const auth = await authenticateRequest(request);
    const body = (await request.json()) as Partial<ProcessingSession>;

    const sessionId = ensureValidSessionId(body.sessionId || "");
    // Resolve organizationID from body or user record to avoid missing org on sessions
    let organizationID = body.organizationID;
    if (!organizationID) {
      const user = await getItem(CONTAINERS.USERS, auth.oid, auth.oid).catch(
        () => null
      );
      organizationID = (user as any)?.organizationID;
    }
    if (!organizationID) {
      throw new AuthorizationError("organizationID is required", 400);
    }

    const fileName = sanitizeFileName(body.fileName || "upload");
    const language = body.language || "ja";
    const now = new Date().toISOString();

    const session: ProcessingSession = {
      id: sessionId,
      sessionId,
      owner: auth.oid,
      organizationID,
      fileName,
      inputBlobName:
        body.inputBlobName ||
        buildPrivateBlobPath(auth.oid, sessionId, fileName),
      language,
      status: (body.status as ProcessingStatus) || ProcessingStatus.UPLOADED,
      uploadTime: body.uploadTime || now,
      processingTypes: body.processingTypes || [],
      createdAt: now,
      updatedAt: now,
    };

    await upsertItem(CONTAINERS.SESSIONS, session);

    return {
      status: 200,
      jsonBody: session,
    };
  } catch (error: any) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    context.error("Error creating session:", error);
    return {
      status,
      jsonBody: { error: error.message || "Internal server error" },
    };
  }
}

app.http("create-session", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "sessions",
  handler: createSession,
});
