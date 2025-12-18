import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useMsal } from "@azure/msal-react";
import { v4 as uuidv4 } from "uuid";
import { BlockBlobClient } from "@azure/storage-blob";
import {
  createSessionAzure,
  subscribeToSessionUpdatesAzure,
} from "@/lib/api-azure";
import { getUploadSasUrl } from "@/lib/azureApi";
import {
  ProcessingStatusAzure,
  ProcessingSessionAzure,
} from "@/types/types-azure";
import { useSessionStore } from "@/stores/sessionStore";
import type { ProcessingSession } from "@/types";

/**
 * Azure version of useMediaUpload hook
 * Handles file upload to Azure Blob Storage and session management
 */

type UploadParams = {
  file: File;
  language: string;
};

export const useMediaUpload = () => {
  const { accounts } = useMsal();
  const {
    organization,
    currentSession,
    setCurrentSession,
    updateCurrentSession,
  } = useSessionStore();

  const [uploadProgress, setUploadProgress] = useState(0);

  // Reference to cleanup function for real-time updates
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async ({ file, language }: UploadParams) => {
      if (!accounts || accounts.length === 0) {
        throw new Error(
          "No authenticated account found. Please sign in again."
        );
      }

      const account = accounts[0];
      const idTokenClaims = account.idTokenClaims as
        | Record<string, unknown>
        | undefined;
      const azureAdObjectId =
        (idTokenClaims?.oid as string | undefined) ||
        account.localAccountId ||
        account.homeAccountId;

      if (!azureAdObjectId) {
        throw new Error("Azure AD Object ID is missing on the active account.");
      }

      if (!organization?.id) {
        throw new Error(
          "Organization is not set for this account. Please sign in again or ensure your user has an organization assigned."
        );
      }

      const effectiveOrgId = organization.id;

      setUploadProgress(0);

      // 1. Create Processing Session in Azure (via Azure Function)
      const sessionId = uuidv4();
      const uploadTime = new Date().toISOString();

      const createdSession = await createSessionAzure({
        owner: azureAdObjectId,
        sessionId,
        organizationID: effectiveOrgId,
        fileName: file.name,
        language,
        status: ProcessingStatusAzure.UPLOADED,
        uploadTime,
        processingTypes: [],
      });

      setCurrentSession(mapToProcessingSession(createdSession));

      // 2. Upload file to Azure Blob Storage via SAS issued by the server
      // FIX: Pass the required metadata so the Backend Trigger can read it
      await uploadWithShortLivedSas({
        file,
        sessionId,
        metadata: {
          organizationid: effectiveOrgId, // Keys must be lowercase for Azure Metadata
          owner: azureAdObjectId,
          sessionid: sessionId,
          language: language || "ja",
          filename: file.name,
        },
        onProgress: (percent) => setUploadProgress(percent),
      });

      return createdSession;
    },
    onError: (error) => {
      console.error("Upload failed:", error);
      setUploadProgress(0);
    },
  });

  // Real-time updates subscription
  useEffect(() => {
    if (!currentSession?.id) {
      // Cleanup existing subscription if session is cleared
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      return;
    }

    // Subscribe to session updates
    const unsubscribe = subscribeToSessionUpdatesAzure(
      currentSession.sessionId,
      (updatedSession: ProcessingSessionAzure) => {
        updateCurrentSession(mapToProcessingSession(updatedSession));
      }
    );

    unsubscribeRef.current = unsubscribe;

    // Cleanup on unmount or when session changes
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [currentSession?.id, currentSession?.sessionId, updateCurrentSession]);

  return {
    upload: uploadMutation.mutate,
    isLoading: uploadMutation.isPending,
    isError: uploadMutation.isError,
    error: uploadMutation.error,
    uploadProgress,
    currentSession,
  };
};

const mapToProcessingSession = (
  session: ProcessingSessionAzure
): ProcessingSession => {
  // Adapter until the store fully supports Azure-native session types.
  return session as unknown as ProcessingSession;
};

const shouldRetryWithFreshSas = (error: unknown): boolean => {
  const restError = error as { statusCode?: number; message?: string };
  const statusCode =
    typeof restError?.statusCode === "number"
      ? (restError.statusCode as number)
      : undefined;
  const message =
    typeof restError?.message === "string" ? restError.message : "";
  return (
    statusCode === 401 ||
    statusCode === 403 ||
    /AuthenticationFailed|AuthorizationPermissionMismatch|SAS token|Signature/i.test(
      message
    )
  );
};

// Updated Interface to accept Metadata
interface UploadHelperParams {
  file: File;
  sessionId: string;
  metadata: Record<string, string>;
  onProgress: (percent: number) => void;
}

const uploadWithShortLivedSas = async ({
  file,
  sessionId,
  metadata, // Received metadata here
  onProgress,
}: UploadHelperParams): Promise<void> => {
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt < 2) {
    try {
      const sasInfo = await getUploadSasUrl({
        sessionId,
        fileName: file.name,
        contentType: file.type,
      });
      const blobClient = new BlockBlobClient(sasInfo.sasUrl);

      // FIX: Passed metadata to the uploadData method
      await blobClient.uploadData(file, {
        blockSize: 4 * 1024 * 1024,
        concurrency: 2,
        metadata: metadata, // <--- Critical Fix
        onProgress: (progress) => {
          const percent = Math.round((progress.loadedBytes / file.size) * 100);
          onProgress(percent);
        },
      });
      // Ensure we end at 100% even if the last progress event is slightly below
      onProgress(100);
      onProgress(100);
      return;
    } catch (error) {
      lastError = error;
      if (!shouldRetryWithFreshSas(error) || attempt === 1) {
        throw new Error(
          `Failed to upload to Azure Blob Storage: ${String(error)}`
        );
      }
      attempt += 1;
    }
  }

  if (lastError) {
    throw lastError;
  }
};
