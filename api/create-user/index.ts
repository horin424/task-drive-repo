import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { upsertItem, CONTAINERS } from "../shared/cosmosClient";
import { User } from "../shared/models";
import { authenticateRequest, AuthorizationError } from "../shared/auth";

export async function createUser(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const auth = await authenticateRequest(request);
    const body = (await request.json()) as Partial<User>;

    if (!body?.username) {
      throw new AuthorizationError("Missing username", 400);
    }

    const targetObjectId = body.azureAdObjectId || auth.oid;

    const now = new Date().toISOString();
    const user: User = {
      id: targetObjectId,
      azureAdObjectId: targetObjectId,
      username: body.username,
      email: body.email,
      organizationID: body.organizationID || "default-org",
      isAdmin: !!body.isAdmin,
      createdAt: now,
      updatedAt: now,
    };

    await upsertItem(CONTAINERS.USERS, user);

    return { status: 200, jsonBody: user };
  } catch (e: any) {
    const status = e instanceof AuthorizationError ? e.status : 500;
    context.error("create-user error", e);
    return {
      status,
      jsonBody: { error: e?.message || "Internal Server Error" },
    };
  }
}

app.http("create-user", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "users",
  handler: createUser,
});
