export enum ProcessingStatus {
  UPLOADED = 'UPLOADED',
  PROCESSING_TRANSCRIPTION = 'PROCESSING_TRANSCRIPTION',
  TRANSCRIPTION_FAILED = 'TRANSCRIPTION_FAILED',
  PENDING_SPEAKER_EDIT = 'PENDING_SPEAKER_EDIT',
  SPEAKER_EDIT_COMPLETED = 'SPEAKER_EDIT_COMPLETED',
  PROCESSING_BULLETS = 'PROCESSING_BULLETS',
  BULLETS_COMPLETED = 'BULLETS_COMPLETED',
  BULLETS_FAILED = 'BULLETS_FAILED',
  PROCESSING_MINUTES = 'PROCESSING_MINUTES',
  MINUTES_COMPLETED = 'MINUTES_COMPLETED',
  MINUTES_FAILED = 'MINUTES_FAILED',
  PROCESSING_TASKS = 'PROCESSING_TASKS',
  TASKS_COMPLETED = 'TASKS_COMPLETED',
  TASKS_FAILED = 'TASKS_FAILED',
  ALL_COMPLETED = 'ALL_COMPLETED',
  ERROR = 'ERROR',
}

export interface Organization {
  id: string;
  name: string;
  remainingMinutes: number;
  remainingTaskGenerations: number;
  monthlyMinutes?: number;
  monthlyTaskGenerations?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  organizationID?: string;
  username: string;
  email?: string;
  azureAdObjectId: string;
  isAdmin?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProcessingSession {
  id: string;
  owner: string;
  sessionId: string;
  organizationID: string;
  fileName: string;
  inputBlobName?: string;
  language: string;
  status: ProcessingStatus;
  uploadTime: string;
  transcriptKey?: string;
  bulletPointsKey?: string;
  minutesKey?: string;
  tasksKey?: string;
  taskFileKey?: string;
  informationFileKey?: string;
  processingTypes?: string[];
  speakerMap?: Record<string, string>;
  audioLengthSeconds?: number;
  errorMessage?: string;
  transcriptFormat?: string;
  filesDeletionTime?: string;
  createdAt?: string;
  updatedAt?: string;
}
