"use client";
import React from "react";
import Spinner from "./Spinner";
import UploadProgress from "./UploadProgress";
import styles from "./ProcessingIndicator.module.css";
import { useSessionStore } from "@/stores/sessionStore"; // Import the store

interface ProcessingIndicatorProps {
  isLoading: boolean; // True during file UPLOAD
  isServerProcessing: boolean; // True during backend processing
  uploadProgress: number;
}

const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({
  isLoading,
  isServerProcessing,
  uploadProgress,
}) => {
  // Get the real-time status text from the global store
  const processingStatus = useSessionStore((state) => state.processingStatus);

  let statusText = "Uploading file..."; // Default text during upload

  if (!isLoading && isServerProcessing) {
    // After upload, use the server status from the store
    statusText = processingStatus || "Processing... Please wait.";
  }

  // Map backend statuses to user-friendly text
  if (statusText === "UPLOADED")
    statusText = "File uploaded. Waiting for processing to start...";
  if (statusText === "PROCESSING") statusText = "Processing... Please wait.";
  if (statusText === "TRANSCRIBING") statusText = "Transcribing audio...";
  if (statusText === "GENERATING")
    statusText = "Generating summary and tasks...";
  if (statusText === "SAVING") statusText = "Saving results...";

  return (
    <div className={styles.processingIndicator}>
      <Spinner />
      <h3 className={styles.statusTitle}>{statusText}</h3>

      {/* Show upload progress bar ONLY during upload */}
      {isLoading && <UploadProgress progress={uploadProgress} />}

      {/* Show a helpful message during server processing */}
      {!isLoading && isServerProcessing && (
        <p className={styles.statusMessage}>
          This may take several minutes. You can safely leave this page.
        </p>
      )}

      {/* Show error message if it exists in the status */}
      {processingStatus && processingStatus.startsWith("Error") && (
        <p className={styles.error}>{processingStatus}</p>
      )}
    </div>
  );
};

export default ProcessingIndicator;
