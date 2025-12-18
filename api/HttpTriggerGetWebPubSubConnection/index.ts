import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { WebPubSubServiceClient } from "@azure/web-pubsub";
import { authenticateRequest, AuthorizationError } from "../shared/auth";
import { getCorrelationId } from "../shared/correlation";

// FIX: Check BOTH naming conventions for Connection String
const webPubSubConnectionString =
  process.env.WebPubSubConnectionString ||
  process.env.WEB_PUBSUB_CONNECTION_STRING ||
  "";

// FIX: Check BOTH naming conventions for Hub Name
const hubName =
  process.env.WEB_PUBSUB_HUB_NAME ||
  process.env.WEBPUBSUB_HUB_NAME ||
  "realtimepubsub";

let webPubSubClient: WebPubSubServiceClient;

function initializeClient(context: InvocationContext) {
  if (webPubSubClient) return;
  if (!webPubSubConnectionString) {
    throw new Error(
      "WebPubSubConnectionString is not set in Environment Variables."
    );
  }
  try {
    webPubSubClient = new WebPubSubServiceClient(
      webPubSubConnectionString,
      hubName
    );
    context.log(`Web PubSub client initialized for hub: ${hubName}`);
  } catch (err) {
    throw new Error(
      `Failed to create WebPubSubServiceClient: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

export async function HttpTriggerGetWebPubSubConnection(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const correlationId = getCorrelationId(request);
  context.log("Requesting Web PubSub connection info...", correlationId);

  try {
    const auth = await authenticateRequest(request);

    // Initialize client
    initializeClient(context);

    const userId = auth.oid;

    // Generate Token
    const token = await webPubSubClient.getClientAccessToken({
      userId,
      roles: ["webpubsub.sendToGroup", "webpubsub.joinLeaveGroup"],
    });

    return {
      jsonBody: {
        url: token.url,
        accessToken: token.token, // Ensure frontend gets this if using custom flow
        userId,
        correlationId,
      },
    };
  } catch (error: any) {
    const status = error instanceof AuthorizationError ? error.status : 500;

    // Log the REAL error message so we can debug
    context.error(
      `Failed to get Web PubSub connection info. Status: ${status}`,
      error
    );

    return {
      status,
      // Return the actual error message in dev/test to help debugging (remove in prod if sensitive)
      body: `Error generating connection: ${error.message || "Unknown error"}`,
      headers: { "x-correlation-id": correlationId },
    };
  }
}

app.http("HttpTriggerGetWebPubSubConnection", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: HttpTriggerGetWebPubSubConnection,
});
