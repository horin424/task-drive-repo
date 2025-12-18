import { azureConfig } from "@/azure-config";
import {
  callAzureApi,
  createProcessingSession,
  updateProcessingSession,
  getProcessingSession,
  deleteGeneratedFiles,
  getAudioPresignedUrl,
  createCustomUserAzure as createCustomUserAzureHttp,
  getUserByIdAzure as getUserByIdAzureHttp,
  getOrganizationByIdAzure as getOrganizationByIdAzureHttp,
} from "@/lib/azureApi";
import type {
  ProcessingSessionAzure,
  SignalRConnectionInfo,
} from "@/types/types-azure";

export {
  createProcessingSession as createSessionAzure,
  updateProcessingSession as updateSessionAzure,
  getProcessingSession as getSessionAzure,
  deleteGeneratedFiles as deleteGeneratedFilesAzure,
  getAudioPresignedUrl as getAudioUrlAzure,
  createCustomUserAzureHttp as createCustomUserAzure,
  getUserByIdAzureHttp as getUserByIdAzure,
  getOrganizationByIdAzureHttp as getOrganizationByIdAzure,
};

export interface SessionUpdateCallback {
  (session: ProcessingSessionAzure): void;
}

/**
 * Retrieves the WebSocket connection URL and Access Token from the backend.
 * Used for Azure Web PubSub connections.
 */
export const getWebPubSubConnectionInfo = async (
  userId?: string
): Promise<SignalRConnectionInfo | null> => {
  const baseEndpoint = azureConfig.functions.endpoints.getWebPubSubConnection;
  // Note: The backend gets userId from the Auth Token, but we pass it here if needed for logging/debug
  const userQuery = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  const endpointWithQuery = `${baseEndpoint}${userQuery}`;

  try {
    return await callAzureApi<SignalRConnectionInfo>(endpointWithQuery, {
      method: "GET",
    });
  } catch (error) {
    console.error("Failed to get Web PubSub connection info:", error);
    return null;
  }
};

/**
 * Alias for backward compatibility with existing components/hooks
 * that still refer to "SignalR".
 */
export const getSignalRConnectionInfo = getWebPubSubConnectionInfo;

export const subscribeToSessionUpdatesAzure = (
  sessionId: string,
  callback: SessionUpdateCallback
): (() => void) => {
  // This polling is a fallback mechanism.
  // The primary updates should come via useRealtimeUpdates (Web PubSub).
  const intervalId = setInterval(async () => {
    try {
      const session = await getProcessingSession(sessionId);
      callback(session);
    } catch (error) {
      console.error("Failed to poll session updates:", error);
    }
  }, 3000);

  return () => clearInterval(intervalId);
};

export const isAzureConfigured = (): boolean => {
  return !!(
    (azureConfig.functions.baseUrl || azureConfig.apiManagement.baseUrl) &&
    azureConfig.storage.accountName
  );
};

export const getAzureConfigStatus = () => {
  return {
    functionsConfigured:
      !!azureConfig.functions.baseUrl || !!azureConfig.apiManagement.baseUrl,
    storageConfigured: !!azureConfig.storage.accountName,
    authConfigured: !!azureConfig.auth.clientId,
  };
};
