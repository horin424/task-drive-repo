import { WebPubSubServiceClient } from "@azure/web-pubsub";

const connectionString = process.env.WEB_PUBSUB_CONNECTION_STRING || "";
// const hubName = process.env.WEB_PUBSUB_HUB_NAME || 'sessionUpdates';
const hubName =
  process.env.WEB_PUBSUB_HUB_NAME ||
  process.env.WEBPUBSUB_HUB_NAME ||
  "updates";

let serviceClient: WebPubSubServiceClient | null = null;

/**
 * Initialize and return the Web PubSub service client
 */
export const getWebPubSubClient = (): WebPubSubServiceClient => {
  if (!serviceClient) {
    if (!connectionString) {
      throw new Error(
        "WEB_PUBSUB_CONNECTION_STRING environment variable must be set"
      );
    }
    serviceClient = new WebPubSubServiceClient(connectionString, hubName);
  }
  return serviceClient;
};

/**
 * Send a message to all connected clients
 */
export const sendToAll = async (message: any): Promise<void> => {
  const client = getWebPubSubClient();
  await client.sendToAll({ type: "json", data: message });
};

/**
 * Send a message to a specific user
 */
export const sendToUser = async (
  userId: string,
  message: any
): Promise<void> => {
  const client = getWebPubSubClient();
  await client.sendToUser(userId, { type: "json", data: message });
};

/**
 * Send a message to a specific group
 */
export const sendToGroup = async (
  groupName: string,
  message: any
): Promise<void> => {
  const client = getWebPubSubClient();
  await client.group(groupName).sendToAll({ type: "json", data: message });
};

/**
 * Generate a client access URL for connecting to Web PubSub
 */
export const getClientAccessUrl = async (
  userId?: string,
  roles?: string[]
): Promise<string> => {
  const client = getWebPubSubClient();
  const token = await client.getClientAccessToken({
    userId,
    roles,
    expirationTimeInMinutes: 60,
  });
  return token.url;
};

/**
 * Add a user to a group
 */
export const addUserToGroup = async (
  groupName: string,
  userId: string
): Promise<void> => {
  const client = getWebPubSubClient();
  await client.group(groupName).addUser(userId);
};

/**
 * Remove a user from a group
 */
export const removeUserFromGroup = async (
  groupName: string,
  userId: string
): Promise<void> => {
  const client = getWebPubSubClient();
  await client.group(groupName).removeUser(userId);
};

/**
 * Send a session status update notification
 */
export const sendSessionUpdate = async (
  sessionId: string,
  status: string,
  data?: any
): Promise<void> => {
  const message = {
    type: "SESSION_UPDATE",
    sessionId,
    status,
    timestamp: new Date().toISOString(),
    ...data,
  };

  await sendToAll(message);
};

/**
 * Send a processing progress update
 */
export const sendProgressUpdate = async (
  sessionId: string,
  stage: string,
  progress: number,
  message?: string
): Promise<void> => {
  const update = {
    type: "PROGRESS_UPDATE",
    sessionId,
    stage,
    progress,
    message,
    timestamp: new Date().toISOString(),
  };

  await sendToAll(update);
};

/**
 * Send an error notification
 */
export const sendErrorNotification = async (
  sessionId: string,
  error: string,
  details?: any
): Promise<void> => {
  const notification = {
    type: "ERROR",
    sessionId,
    error,
    details,
    timestamp: new Date().toISOString(),
  };

  await sendToAll(notification);
};
