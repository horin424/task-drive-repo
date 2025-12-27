import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { getItem, patchItem, CONTAINERS } from "../shared/cosmosClient";
import type { PatchOperation } from "@azure/cosmos";
import { authenticateRequest, AuthorizationError, userIsAdmin } from "../shared/auth";
import type { User } from "../shared/models";

type UpdateUserRequest = Partial<Pick<User, "username" | "email" | "organizationID" | "isAdmin">> & {
  userId?: string;
};

export async function updateUser(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("update-user request received");

  try {
    const auth = await authenticateRequest(request);
    const isAdmin = userIsAdmin(auth);

    const body = (await request.json().catch(() => ({}))) as UpdateUserRequest;

    const targetId =
      request.params.userId ||
      request.query.get("id") ||
      request.query.get("userId") ||
      body.userId ||
      auth.oid;

    if (!targetId || typeof targetId !== "string") {
      throw new AuthorizationError("Missing user identifier", 400);
    }

    if (!isAdmin && targetId !== auth.oid) {
      throw new AuthorizationError("Forbidden", 403);
    }

    const user = await getItem<User>(CONTAINERS.USERS, targetId, targetId);
    if (!user) {
      return { status: 404, jsonBody: { error: "User not found" } };
    }

    const operations: PatchOperation[] = [];

    if (typeof body.username === "string") {
      operations.push({ op: "set", path: "/username", value: body.username });
    }
    if (typeof body.email === "string") {
      operations.push({ op: "set", path: "/email", value: body.email });
    }

    if (isAdmin) {
      if (typeof body.organizationID === "string") {
        operations.push({
          op: "set",
          path: "/organizationID",
          value: body.organizationID,
        });
      }
      if (typeof body.isAdmin === "boolean") {
        operations.push({ op: "set", path: "/isAdmin", value: body.isAdmin });
      }
    }

    if (operations.length === 0) {
      return { status: 200, jsonBody: user };
    }

    operations.push({
      op: "set",
      path: "/updatedAt",
      value: new Date().toISOString(),
    });

    const updatedUser = await patchItem<User>(
      CONTAINERS.USERS,
      targetId,
      targetId,
      operations
    );

    return { status: 200, jsonBody: updatedUser };
  } catch (e: any) {
    const status = e instanceof AuthorizationError ? e.status : 500;
    context.error("update-user error", e);
    return {
      status,
      jsonBody: { error: e?.message || "Internal Server Error" },
    };
  }
}

app.http("update-user", {
  methods: ["PUT", "PATCH"],
  authLevel: "anonymous",
  route: "users/{userId?}",
  handler: updateUser,
});

