import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { getItem, CONTAINERS } from "../shared/cosmosClient"; // Use Cosmos Client
import { User } from "../shared/models";
import { authenticateRequest, AuthorizationError } from "../shared/auth";

export async function getUser(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const auth = await authenticateRequest(request);

    // Determine target ID (Route param OR Query param OR Token OID)
    const targetId =
      request.params.userId ||
      request.query.get("id") ||
      request.query.get("userId") ||
      auth.oid;

    if (!targetId) {
      throw new AuthorizationError("Missing user identifier", 400);
    }

    // Fetch from Cosmos DB
    const user = await getItem<User>(CONTAINERS.USERS, targetId, targetId);

    if (!user) {
      return { status: 404, jsonBody: null };
    }

    return { status: 200, jsonBody: user };
  } catch (e: any) {
    const status = e instanceof AuthorizationError ? e.status : 500;
    context.error("get-user error", e);
    return {
      status,
      jsonBody: { error: e?.message || "Internal Server Error" },
    };
  }
}

app.http("get-user", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "users/{userId?}",
  handler: getUser,
});
