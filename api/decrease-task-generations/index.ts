import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getItem, patchItem, CONTAINERS } from "../shared/cosmosClient";
import type { Organization, User } from "../shared/models";
import { authenticateRequest, AuthorizationError, userIsAdmin } from "../shared/auth";

type DecreaseTaskGenerationsRequest = {
  organizationId?: string;
  amount?: number;
};

export async function decreaseTaskGenerations(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("decrease-task-generations request received");

  try {
    const auth = await authenticateRequest(request);
    const isAdmin = userIsAdmin(auth);
    const body = (await request.json().catch(() => ({}))) as DecreaseTaskGenerationsRequest;

    const requestedOrgId = body.organizationId?.trim();
    const amountRaw = body.amount ?? 1;
    if (typeof amountRaw !== "number" || !Number.isFinite(amountRaw) || amountRaw <= 0) {
      throw new AuthorizationError("amount must be a positive number", 400);
    }
    const amount = Math.ceil(amountRaw);

    const caller = await getItem<User>(CONTAINERS.USERS, auth.oid, auth.oid);
    const callerOrgId = caller?.organizationID;
    if (!callerOrgId) {
      throw new AuthorizationError("User is missing organizationID", 403);
    }

    const targetOrgId = requestedOrgId || callerOrgId;
    if (!isAdmin && targetOrgId !== callerOrgId) {
      throw new AuthorizationError("Forbidden", 403);
    }

    const org = await getItem<Organization>(CONTAINERS.ORGANIZATIONS, targetOrgId, targetOrgId);
    if (!org) {
      throw new AuthorizationError("Organization not found", 404);
    }
    if ((org.remainingTaskGenerations ?? 0) < amount) {
      throw new AuthorizationError("Task generation quota exceeded", 403);
    }

    const etag = (org as any)?._etag as string | undefined;
    const updated = await patchItem<Organization>(
      CONTAINERS.ORGANIZATIONS,
      targetOrgId,
      targetOrgId,
      [
        { op: "incr", path: "/remainingTaskGenerations", value: -amount },
        { op: "set", path: "/updatedAt", value: new Date().toISOString() },
      ],
      etag ? { accessCondition: { type: "IfMatch", condition: etag } } : undefined
    );

    return { status: 200, jsonBody: updated };
  } catch (e: any) {
    const status = e instanceof AuthorizationError ? e.status : 500;
    context.error("decrease-task-generations error", e);
    return {
      status,
      jsonBody: { error: e?.message || "Internal Server Error" },
    };
  }
}

app.http("decrease-task-generations", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "organizations/decrease-task-generations",
  handler: decreaseTaskGenerations,
});

