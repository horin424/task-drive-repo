/**
 * Azure-specific type definitions
 * These mirror the AWS types but are adapted for Azure services
 */

// =================================================================
// Processing Status Enum (same as AWS)
// =================================================================

export enum ProcessingStatusAzure {
  UPLOADED = "UPLOADED",
  PROCESSING_TRANSCRIPTION = "PROCESSING_TRANSCRIPTION",
  TRANSCRIPTION_FAILED = "TRANSCRIPTION_FAILED",
  PENDING_SPEAKER_EDIT = "PENDING_SPEAKER_EDIT",
  SPEAKER_EDIT_COMPLETED = "SPEAKER_EDIT_COMPLETED",
  PROCESSING_BULLETS = "PROCESSING_BULLETS",
  BULLETS_COMPLETED = "BULLETS_COMPLETED",
  BULLETS_FAILED = "BULLETS_FAILED",
  PROCESSING_MINUTES = "PROCESSING_MINUTES",
  MINUTES_COMPLETED = "MINUTES_COMPLETED",
  MINUTES_FAILED = "MINUTES_FAILED",
  PROCESSING_TASKS = "PROCESSING_TASKS",
  TASKS_COMPLETED = "TASKS_COMPLETED",
  TASKS_FAILED = "TASKS_FAILED",
  ALL_COMPLETED = "ALL_COMPLETED",
  ERROR = "ERROR",
}

// =================================================================
// Transcript Format Enum
// =================================================================

export enum TranscriptFormatAzure {
  JSON = "JSON",
  TEXT = "TEXT",
}

// =================================================================
// Organization Type
// =================================================================

export interface OrganizationAzure {
  id: string;
  name: string;
  remainingMinutes: number;
  remainingTaskGenerations: number;
  monthlyMinutes?: number;
  monthlyTaskGenerations?: number;
  createdAt?: string;
  updatedAt?: string;
}

// =================================================================
// User Type
// =================================================================

export interface UserAzure {
  id: string; // Azure AD Object ID
  organizationID?: string;
  username: string;
  email?: string;
  azureAdObjectId: string; // Equivalent to cognitoSub
  isAdmin?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// =================================================================
// Processing Session Type
// =================================================================

export interface ProcessingSessionAzure {
  id: string; // Unique session ID
  owner: string; // Azure AD Object ID
  sessionId: string; // UUID for this session
  organizationID: string;
  fileName: string;
  inputBlobName?: string;
  language: string;
  status: ProcessingStatusAzure;
  uploadTime: string; // ISO 8601 datetime
  transcriptKey?: string; // Blob name in Azure Storage
  bulletPointsKey?: string;
  minutesKey?: string;
  bulletPointsStatus?: string;
  minutesStatus?: string;
  taskFileKey?: string;
  informationFileKey?: string;
  tasksKey?: string;
  tasksStatus?: string;
  processingTypes?: string[];
  speakerMap?: Record<string, string>;
  audioLengthSeconds?: number;
  errorMessage?: string;
  transcriptFormat?: TranscriptFormatAzure;
  filesDeletionTime?: string; // ISO 8601 datetime
  createdAt?: string;
  updatedAt?: string;
}

// =================================================================
// Input Types for API Calls
// =================================================================

export interface CreateProcessingSessionInputAzure {
  owner: string; // Azure AD Object ID
  sessionId: string;
  organizationID: string;
  fileName: string;
  inputBlobName?: string;
  language: string;
  status: ProcessingStatusAzure;
  uploadTime: string;
  processingTypes?: string[];
}

export interface UpdateProcessingSessionInputAzure {
  id: string;
  status?: ProcessingStatusAzure;
  transcriptKey?: string;
  bulletPointsKey?: string;
  minutesKey?: string;
  bulletPointsStatus?: string;
  minutesStatus?: string;
  taskFileKey?: string;
  informationFileKey?: string;
  tasksKey?: string;
  tasksStatus?: string;
  processingTypes?: string[];
  speakerMap?: Record<string, string>;
  audioLengthSeconds?: number;
  errorMessage?: string;
  transcriptFormat?: TranscriptFormatAzure;
  filesDeletionTime?: string;
}

export interface CreateUserInputAzure {
  username: string;
  email?: string;
  azureAdObjectId: string;
  organizationID?: string;
  isAdmin?: boolean;
}

export interface UpdateUserInputAzure {
  id: string;
  username?: string;
  email?: string;
  organizationID?: string;
  isAdmin?: boolean;
}

// =================================================================
// API Response Types
// =================================================================

export interface AzureApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface DeleteFilesResponseAzure {
  success: boolean;
  deletedFiles: string[];
}

export interface GetAudioUrlResponseAzure {
  url: string;
  expiresAt: string;
}

// =================================================================
// Real-time Update Types
// =================================================================

export interface SessionUpdateMessageAzure {
  type: "SESSION_UPDATE";
  sessionId: string;
  session: ProcessingSessionAzure;
  timestamp: string;
}

// =================================================================
// Speaker Map Types (same as AWS)
// =================================================================

export interface SpeakerMapAzure {
  [speakerId: string]: string; // Map speaker ID to speaker name
}

// =================================================================
// Transcript Word Type (for JSON format)
// =================================================================

export interface TranscriptWordAzure {
  text: string;
  start: number; // Start time in seconds
  end: number; // End time in seconds
  speaker_id: string;
}

export interface TranscriptDataAzure {
  words: TranscriptWordAzure[];
  metadata?: {
    language: string;
    duration: number;
    speakers: string[];
  };
}

// =================================================================
// Authentication Types
// =================================================================

export interface AzureAuthUser {
  userId: string; // Azure AD Object ID
  username: string;
  email?: string;
  displayName?: string;
}

// =================================================================
// Storage Types
// =================================================================

export interface AzureBlobMetadata {
  containerName: string;
  blobName: string;
  contentType: string;
  size: number;
  lastModified: Date;
  url: string;
}

// =================================================================
// Error Types
// =================================================================

export interface AzureApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

// =================================================================
// Generation Request Types
// =================================================================

export interface GenerationRequestAzure {
  sessionId: string;
  transcript: string;
  processingTypes: ("bullets" | "minutes" | "tasks")[];
  taskFileKey?: string;
  informationFileKey?: string;
  fileName: string;
}

// =================================================================
// Quota Management Types
// =================================================================

export interface QuotaInfoAzure {
  organizationId: string;
  remainingMinutes: number;
  remainingTaskGenerations: number;
  monthlyMinutes: number;
  monthlyTaskGenerations: number;
  lastResetDate: string;
  nextResetDate: string;
}

// =================================================================
// Type Guards
// =================================================================

export const isProcessingSessionAzure = (
  obj: unknown
): obj is ProcessingSessionAzure => {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    "sessionId" in obj &&
    "status" in obj
  );
};

export const isOrganizationAzure = (obj: unknown): obj is OrganizationAzure => {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    "name" in obj &&
    "remainingMinutes" in obj
  );
};

export const isUserAzure = (obj: unknown): obj is UserAzure => {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    "username" in obj &&
    "azureAdObjectId" in obj
  );
};

// =================================================================
// Web PubSub / SignalR Types
// =================================================================

export interface SignalRConnectionInfo {
  url: string;
  accessToken: string;
  userId?: string;
  correlationId?: string;
}
