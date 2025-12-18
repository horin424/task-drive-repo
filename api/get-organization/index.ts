import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { getItem, CONTAINERS } from "../shared/cosmosClient"; // Use Cosmos Client
import { Organization } from "../shared/models";
import { authenticateRequest, AuthorizationError } from "../shared/auth";

export async function getOrganization(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const auth = await authenticateRequest(request);
    const orgId =
      request.params.organizationId ||
      request.query.get("id") ||
      request.query.get("organizationId");

    if (!orgId) {
      throw new AuthorizationError("Missing organization id", 400);
    }

    // Fetch from Cosmos DB instead of Blob Storage
    const org = await getItem<Organization>(
      CONTAINERS.ORGANIZATIONS,
      orgId,
      orgId
    );

    if (!org) {
      context.warn(`Organization ${orgId} not found in Cosmos DB`);
      return { status: 404, jsonBody: { error: "Organization not found" } };
    }

    return { status: 200, jsonBody: org };
  } catch (e: any) {
    const status = e instanceof AuthorizationError ? e.status : 500;
    context.error("get-organization error", e);
    return {
      status,
      jsonBody: { error: e?.message || "Internal Server Error" },
    };
  }
}

app.http("get-organization", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "organizations/{organizationId?}",
  handler: getOrganization,
});
