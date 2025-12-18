/* tslint:disable */
//  This file was automatically generated and should not be edited.

export type CreateOrganizationInput = {
  id?: string | null,
  name: string,
  remainingMinutes: number,
  remainingTaskGenerations?: number | null,
  monthlyMinutes?: number | null,
  monthlyTaskGenerations?: number | null,
};

export type ModelOrganizationConditionInput = {
  name?: ModelStringInput | null,
  remainingMinutes?: ModelIntInput | null,
  remainingTaskGenerations?: ModelIntInput | null,
  monthlyMinutes?: ModelIntInput | null,
  monthlyTaskGenerations?: ModelIntInput | null,
  and?: Array< ModelOrganizationConditionInput | null > | null,
  or?: Array< ModelOrganizationConditionInput | null > | null,
  not?: ModelOrganizationConditionInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelStringInput = {
  ne?: string | null,
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  size?: ModelSizeInput | null,
};

export enum ModelAttributeTypes {
  binary = "binary",
  binarySet = "binarySet",
  bool = "bool",
  list = "list",
  map = "map",
  number = "number",
  numberSet = "numberSet",
  string = "string",
  stringSet = "stringSet",
  _null = "_null",
}


export type ModelSizeInput = {
  ne?: number | null,
  eq?: number | null,
  le?: number | null,
  lt?: number | null,
  ge?: number | null,
  gt?: number | null,
  between?: Array< number | null > | null,
};

export type ModelIntInput = {
  ne?: number | null,
  eq?: number | null,
  le?: number | null,
  lt?: number | null,
  ge?: number | null,
  gt?: number | null,
  between?: Array< number | null > | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
};

export type Organization = {
  __typename: "Organization",
  id: string,
  name: string,
  remainingMinutes: number,
  remainingTaskGenerations?: number | null,
  monthlyMinutes?: number | null,
  monthlyTaskGenerations?: number | null,
  users?: ModelUserConnection | null,
  createdAt: string,
  updatedAt: string,
};

export type ModelUserConnection = {
  __typename: "ModelUserConnection",
  items:  Array<User | null >,
  nextToken?: string | null,
};

export type User = {
  __typename: "User",
  id: string,
  organizationID?: string | null,
  username: string,
  email?: string | null,
  cognitoSub?: string | null,
  organization?: Organization | null,
  isAdmin?: boolean | null,
  createdAt: string,
  updatedAt: string,
};

export type UpdateOrganizationInput = {
  id: string,
  name?: string | null,
  remainingMinutes?: number | null,
  remainingTaskGenerations?: number | null,
  monthlyMinutes?: number | null,
  monthlyTaskGenerations?: number | null,
};

export type DeleteOrganizationInput = {
  id: string,
};

export type CreateUserInput = {
  id?: string | null,
  organizationID?: string | null,
  username: string,
  email?: string | null,
  cognitoSub?: string | null,
  isAdmin?: boolean | null,
};

export type ModelUserConditionInput = {
  organizationID?: ModelIDInput | null,
  username?: ModelStringInput | null,
  email?: ModelStringInput | null,
  cognitoSub?: ModelStringInput | null,
  isAdmin?: ModelBooleanInput | null,
  and?: Array< ModelUserConditionInput | null > | null,
  or?: Array< ModelUserConditionInput | null > | null,
  not?: ModelUserConditionInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelIDInput = {
  ne?: string | null,
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  size?: ModelSizeInput | null,
};

export type ModelBooleanInput = {
  ne?: boolean | null,
  eq?: boolean | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
};

export type UpdateUserInput = {
  id: string,
  organizationID?: string | null,
  username?: string | null,
  email?: string | null,
  cognitoSub?: string | null,
  isAdmin?: boolean | null,
};

export type DeleteUserInput = {
  id: string,
};

export type CreateProcessingSessionInput = {
  owner?: string | null,
  identityId: string,
  sessionId: string,
  organizationID: string,
  fileName: string,
  language: string,
  status: ProcessingStatus,
  uploadTime: string,
  processingTypes?: Array< string | null > | null,
};

export enum ProcessingStatus {
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


export type ModelProcessingSessionConditionInput = {
  owner?: ModelStringInput | null,
  identityId?: ModelStringInput | null,
  sessionId?: ModelStringInput | null,
  organizationID?: ModelIDInput | null,
  fileName?: ModelStringInput | null,
  language?: ModelStringInput | null,
  status?: ModelProcessingStatusInput | null,
  uploadTime?: ModelStringInput | null,
  transcriptKey?: ModelStringInput | null,
  bulletPointsKey?: ModelStringInput | null,
  minutesKey?: ModelStringInput | null,
  bulletPointsStatus?: ModelStringInput | null,
  minutesStatus?: ModelStringInput | null,
  taskFileKey?: ModelStringInput | null,
  informationFileKey?: ModelStringInput | null,
  tasksKey?: ModelStringInput | null,
  tasksStatus?: ModelStringInput | null,
  processingTypes?: ModelStringInput | null,
  audioLengthSeconds?: ModelIntInput | null,
  errorMessage?: ModelStringInput | null,
  transcriptFormat?: ModelTranscriptFormatInput | null,
  filesDeletionTime?: ModelStringInput | null,
  and?: Array< ModelProcessingSessionConditionInput | null > | null,
  or?: Array< ModelProcessingSessionConditionInput | null > | null,
  not?: ModelProcessingSessionConditionInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelProcessingStatusInput = {
  eq?: ProcessingStatus | null,
  ne?: ProcessingStatus | null,
};

export type ModelTranscriptFormatInput = {
  eq?: TranscriptFormat | null,
  ne?: TranscriptFormat | null,
};

export enum TranscriptFormat {
  JSON = "JSON",
  TEXT = "TEXT",
}


export type ProcessingSession = {
  __typename: "ProcessingSession",
  id: string,
  owner?: string | null,
  identityId: string,
  sessionId: string,
  organizationID: string,
  fileName: string,
  language: string,
  status: ProcessingStatus,
  uploadTime: string,
  transcriptKey?: string | null,
  bulletPointsKey?: string | null,
  minutesKey?: string | null,
  bulletPointsStatus?: string | null,
  minutesStatus?: string | null,
  taskFileKey?: string | null,
  informationFileKey?: string | null,
  tasksKey?: string | null,
  tasksStatus?: string | null,
  processingTypes?: Array< string | null > | null,
  audioLengthSeconds?: number | null,
  errorMessage?: string | null,
  transcriptFormat?: TranscriptFormat | null,
  filesDeletionTime?: string | null,
  createdAt: string,
  updatedAt: string,
};

export type UpdateProcessingSessionInput = {
  id: string,
  owner?: string | null,
  identityId?: string | null,
  sessionId?: string | null,
  organizationID?: string | null,
  fileName?: string | null,
  language?: string | null,
  status?: ProcessingStatus | null,
  uploadTime?: string | null,
  transcriptKey?: string | null,
  bulletPointsKey?: string | null,
  minutesKey?: string | null,
  bulletPointsStatus?: string | null,
  minutesStatus?: string | null,
  taskFileKey?: string | null,
  informationFileKey?: string | null,
  tasksKey?: string | null,
  tasksStatus?: string | null,
  processingTypes?: Array< string | null > | null,
  audioLengthSeconds?: number | null,
  errorMessage?: string | null,
  transcriptFormat?: TranscriptFormat | null,
  filesDeletionTime?: string | null,
};

export type DeleteProcessingSessionInput = {
  id: string,
};

export type CreateUserCustomInput = {
  username: string,
  email?: string | null,
  organizationID?: string | null,
  isAdmin?: boolean | null,
};

export type DecreaseOrganizationRemainingMinutesInput = {
  id: string,
  decreaseBy: number,
};

export type DecreaseOrganizationTaskGenerationsInput = {
  id: string,
  decreaseBy: number,
};

export type ModelOrganizationFilterInput = {
  id?: ModelIDInput | null,
  name?: ModelStringInput | null,
  remainingMinutes?: ModelIntInput | null,
  remainingTaskGenerations?: ModelIntInput | null,
  monthlyMinutes?: ModelIntInput | null,
  monthlyTaskGenerations?: ModelIntInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelOrganizationFilterInput | null > | null,
  or?: Array< ModelOrganizationFilterInput | null > | null,
  not?: ModelOrganizationFilterInput | null,
};

export enum ModelSortDirection {
  ASC = "ASC",
  DESC = "DESC",
}


export type ModelOrganizationConnection = {
  __typename: "ModelOrganizationConnection",
  items:  Array<Organization | null >,
  nextToken?: string | null,
};

export type ModelUserFilterInput = {
  id?: ModelIDInput | null,
  organizationID?: ModelIDInput | null,
  username?: ModelStringInput | null,
  email?: ModelStringInput | null,
  cognitoSub?: ModelStringInput | null,
  isAdmin?: ModelBooleanInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelUserFilterInput | null > | null,
  or?: Array< ModelUserFilterInput | null > | null,
  not?: ModelUserFilterInput | null,
};

export type ModelProcessingSessionFilterInput = {
  id?: ModelIDInput | null,
  owner?: ModelStringInput | null,
  identityId?: ModelStringInput | null,
  sessionId?: ModelStringInput | null,
  organizationID?: ModelIDInput | null,
  fileName?: ModelStringInput | null,
  language?: ModelStringInput | null,
  status?: ModelProcessingStatusInput | null,
  uploadTime?: ModelStringInput | null,
  transcriptKey?: ModelStringInput | null,
  bulletPointsKey?: ModelStringInput | null,
  minutesKey?: ModelStringInput | null,
  bulletPointsStatus?: ModelStringInput | null,
  minutesStatus?: ModelStringInput | null,
  taskFileKey?: ModelStringInput | null,
  informationFileKey?: ModelStringInput | null,
  tasksKey?: ModelStringInput | null,
  tasksStatus?: ModelStringInput | null,
  processingTypes?: ModelStringInput | null,
  audioLengthSeconds?: ModelIntInput | null,
  errorMessage?: ModelStringInput | null,
  transcriptFormat?: ModelTranscriptFormatInput | null,
  filesDeletionTime?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelProcessingSessionFilterInput | null > | null,
  or?: Array< ModelProcessingSessionFilterInput | null > | null,
  not?: ModelProcessingSessionFilterInput | null,
};

export type ModelProcessingSessionConnection = {
  __typename: "ModelProcessingSessionConnection",
  items:  Array<ProcessingSession | null >,
  nextToken?: string | null,
};

export type ModelSubscriptionOrganizationFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  name?: ModelSubscriptionStringInput | null,
  remainingMinutes?: ModelSubscriptionIntInput | null,
  remainingTaskGenerations?: ModelSubscriptionIntInput | null,
  monthlyMinutes?: ModelSubscriptionIntInput | null,
  monthlyTaskGenerations?: ModelSubscriptionIntInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionOrganizationFilterInput | null > | null,
  or?: Array< ModelSubscriptionOrganizationFilterInput | null > | null,
};

export type ModelSubscriptionIDInput = {
  ne?: string | null,
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
  in?: Array< string | null > | null,
  notIn?: Array< string | null > | null,
};

export type ModelSubscriptionStringInput = {
  ne?: string | null,
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
  in?: Array< string | null > | null,
  notIn?: Array< string | null > | null,
};

export type ModelSubscriptionIntInput = {
  ne?: number | null,
  eq?: number | null,
  le?: number | null,
  lt?: number | null,
  ge?: number | null,
  gt?: number | null,
  between?: Array< number | null > | null,
  in?: Array< number | null > | null,
  notIn?: Array< number | null > | null,
};

export type ModelSubscriptionUserFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  organizationID?: ModelSubscriptionIDInput | null,
  username?: ModelSubscriptionStringInput | null,
  email?: ModelSubscriptionStringInput | null,
  cognitoSub?: ModelSubscriptionStringInput | null,
  isAdmin?: ModelSubscriptionBooleanInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionUserFilterInput | null > | null,
  or?: Array< ModelSubscriptionUserFilterInput | null > | null,
};

export type ModelSubscriptionBooleanInput = {
  ne?: boolean | null,
  eq?: boolean | null,
};

export type ModelSubscriptionProcessingSessionFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  identityId?: ModelSubscriptionStringInput | null,
  sessionId?: ModelSubscriptionStringInput | null,
  organizationID?: ModelSubscriptionIDInput | null,
  fileName?: ModelSubscriptionStringInput | null,
  language?: ModelSubscriptionStringInput | null,
  status?: ModelSubscriptionStringInput | null,
  uploadTime?: ModelSubscriptionStringInput | null,
  transcriptKey?: ModelSubscriptionStringInput | null,
  bulletPointsKey?: ModelSubscriptionStringInput | null,
  minutesKey?: ModelSubscriptionStringInput | null,
  bulletPointsStatus?: ModelSubscriptionStringInput | null,
  minutesStatus?: ModelSubscriptionStringInput | null,
  taskFileKey?: ModelSubscriptionStringInput | null,
  informationFileKey?: ModelSubscriptionStringInput | null,
  tasksKey?: ModelSubscriptionStringInput | null,
  tasksStatus?: ModelSubscriptionStringInput | null,
  processingTypes?: ModelSubscriptionStringInput | null,
  audioLengthSeconds?: ModelSubscriptionIntInput | null,
  errorMessage?: ModelSubscriptionStringInput | null,
  transcriptFormat?: ModelSubscriptionStringInput | null,
  filesDeletionTime?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionProcessingSessionFilterInput | null > | null,
  or?: Array< ModelSubscriptionProcessingSessionFilterInput | null > | null,
  owner?: ModelStringInput | null,
};

export type DeleteGeneratedFilesMutationVariables = {
  sessionId: string,
};

export type DeleteGeneratedFilesMutation = {
  deleteGeneratedFiles?: boolean | null,
};

export type CreateOrganizationMutationVariables = {
  input: CreateOrganizationInput,
  condition?: ModelOrganizationConditionInput | null,
};

export type CreateOrganizationMutation = {
  createOrganization?:  {
    __typename: "Organization",
    id: string,
    name: string,
    remainingMinutes: number,
    remainingTaskGenerations?: number | null,
    monthlyMinutes?: number | null,
    monthlyTaskGenerations?: number | null,
    users?:  {
      __typename: "ModelUserConnection",
      items:  Array< {
        __typename: "User",
        id: string,
        organizationID?: string | null,
        username: string,
        email?: string | null,
        cognitoSub?: string | null,
        isAdmin?: boolean | null,
        createdAt: string,
        updatedAt: string,
      } | null >,
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type UpdateOrganizationMutationVariables = {
  input: UpdateOrganizationInput,
  condition?: ModelOrganizationConditionInput | null,
};

export type UpdateOrganizationMutation = {
  updateOrganization?:  {
    __typename: "Organization",
    id: string,
    name: string,
    remainingMinutes: number,
    remainingTaskGenerations?: number | null,
    monthlyMinutes?: number | null,
    monthlyTaskGenerations?: number | null,
    users?:  {
      __typename: "ModelUserConnection",
      items:  Array< {
        __typename: "User",
        id: string,
        organizationID?: string | null,
        username: string,
        email?: string | null,
        cognitoSub?: string | null,
        isAdmin?: boolean | null,
        createdAt: string,
        updatedAt: string,
      } | null >,
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type DeleteOrganizationMutationVariables = {
  input: DeleteOrganizationInput,
  condition?: ModelOrganizationConditionInput | null,
};

export type DeleteOrganizationMutation = {
  deleteOrganization?:  {
    __typename: "Organization",
    id: string,
    name: string,
    remainingMinutes: number,
    remainingTaskGenerations?: number | null,
    monthlyMinutes?: number | null,
    monthlyTaskGenerations?: number | null,
    users?:  {
      __typename: "ModelUserConnection",
      items:  Array< {
        __typename: "User",
        id: string,
        organizationID?: string | null,
        username: string,
        email?: string | null,
        cognitoSub?: string | null,
        isAdmin?: boolean | null,
        createdAt: string,
        updatedAt: string,
      } | null >,
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type CreateUserMutationVariables = {
  input: CreateUserInput,
  condition?: ModelUserConditionInput | null,
};

export type CreateUserMutation = {
  createUser?:  {
    __typename: "User",
    id: string,
    organizationID?: string | null,
    username: string,
    email?: string | null,
    cognitoSub?: string | null,
    organization?:  {
      __typename: "Organization",
      id: string,
      name: string,
      remainingMinutes: number,
      remainingTaskGenerations?: number | null,
      monthlyMinutes?: number | null,
      monthlyTaskGenerations?: number | null,
      users?:  {
        __typename: "ModelUserConnection",
        nextToken?: string | null,
      } | null,
      createdAt: string,
      updatedAt: string,
    } | null,
    isAdmin?: boolean | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type UpdateUserMutationVariables = {
  input: UpdateUserInput,
  condition?: ModelUserConditionInput | null,
};

export type UpdateUserMutation = {
  updateUser?:  {
    __typename: "User",
    id: string,
    organizationID?: string | null,
    username: string,
    email?: string | null,
    cognitoSub?: string | null,
    organization?:  {
      __typename: "Organization",
      id: string,
      name: string,
      remainingMinutes: number,
      remainingTaskGenerations?: number | null,
      monthlyMinutes?: number | null,
      monthlyTaskGenerations?: number | null,
      users?:  {
        __typename: "ModelUserConnection",
        nextToken?: string | null,
      } | null,
      createdAt: string,
      updatedAt: string,
    } | null,
    isAdmin?: boolean | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type DeleteUserMutationVariables = {
  input: DeleteUserInput,
  condition?: ModelUserConditionInput | null,
};

export type DeleteUserMutation = {
  deleteUser?:  {
    __typename: "User",
    id: string,
    organizationID?: string | null,
    username: string,
    email?: string | null,
    cognitoSub?: string | null,
    organization?:  {
      __typename: "Organization",
      id: string,
      name: string,
      remainingMinutes: number,
      remainingTaskGenerations?: number | null,
      monthlyMinutes?: number | null,
      monthlyTaskGenerations?: number | null,
      users?:  {
        __typename: "ModelUserConnection",
        nextToken?: string | null,
      } | null,
      createdAt: string,
      updatedAt: string,
    } | null,
    isAdmin?: boolean | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type CreateProcessingSessionMutationVariables = {
  input: CreateProcessingSessionInput,
  condition?: ModelProcessingSessionConditionInput | null,
};

export type CreateProcessingSessionMutation = {
  createProcessingSession?:  {
    __typename: "ProcessingSession",
    id: string,
    owner?: string | null,
    identityId: string,
    sessionId: string,
    organizationID: string,
    fileName: string,
    language: string,
    status: ProcessingStatus,
    uploadTime: string,
    transcriptKey?: string | null,
    bulletPointsKey?: string | null,
    minutesKey?: string | null,
    bulletPointsStatus?: string | null,
    minutesStatus?: string | null,
    taskFileKey?: string | null,
    informationFileKey?: string | null,
    tasksKey?: string | null,
    tasksStatus?: string | null,
    processingTypes?: Array< string | null > | null,
    audioLengthSeconds?: number | null,
    errorMessage?: string | null,
    transcriptFormat?: TranscriptFormat | null,
    filesDeletionTime?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type UpdateProcessingSessionMutationVariables = {
  input: UpdateProcessingSessionInput,
  condition?: ModelProcessingSessionConditionInput | null,
};

export type UpdateProcessingSessionMutation = {
  updateProcessingSession?:  {
    __typename: "ProcessingSession",
    id: string,
    owner?: string | null,
    identityId: string,
    sessionId: string,
    organizationID: string,
    fileName: string,
    language: string,
    status: ProcessingStatus,
    uploadTime: string,
    transcriptKey?: string | null,
    bulletPointsKey?: string | null,
    minutesKey?: string | null,
    bulletPointsStatus?: string | null,
    minutesStatus?: string | null,
    taskFileKey?: string | null,
    informationFileKey?: string | null,
    tasksKey?: string | null,
    tasksStatus?: string | null,
    processingTypes?: Array< string | null > | null,
    audioLengthSeconds?: number | null,
    errorMessage?: string | null,
    transcriptFormat?: TranscriptFormat | null,
    filesDeletionTime?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type DeleteProcessingSessionMutationVariables = {
  input: DeleteProcessingSessionInput,
  condition?: ModelProcessingSessionConditionInput | null,
};

export type DeleteProcessingSessionMutation = {
  deleteProcessingSession?:  {
    __typename: "ProcessingSession",
    id: string,
    owner?: string | null,
    identityId: string,
    sessionId: string,
    organizationID: string,
    fileName: string,
    language: string,
    status: ProcessingStatus,
    uploadTime: string,
    transcriptKey?: string | null,
    bulletPointsKey?: string | null,
    minutesKey?: string | null,
    bulletPointsStatus?: string | null,
    minutesStatus?: string | null,
    taskFileKey?: string | null,
    informationFileKey?: string | null,
    tasksKey?: string | null,
    tasksStatus?: string | null,
    processingTypes?: Array< string | null > | null,
    audioLengthSeconds?: number | null,
    errorMessage?: string | null,
    transcriptFormat?: TranscriptFormat | null,
    filesDeletionTime?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type CreateUserCustomMutationVariables = {
  input: CreateUserCustomInput,
};

export type CreateUserCustomMutation = {
  createUserCustom?:  {
    __typename: "User",
    id: string,
    organizationID?: string | null,
    username: string,
    email?: string | null,
    cognitoSub?: string | null,
    organization?:  {
      __typename: "Organization",
      id: string,
      name: string,
      remainingMinutes: number,
      remainingTaskGenerations?: number | null,
      monthlyMinutes?: number | null,
      monthlyTaskGenerations?: number | null,
      users?:  {
        __typename: "ModelUserConnection",
        nextToken?: string | null,
      } | null,
      createdAt: string,
      updatedAt: string,
    } | null,
    isAdmin?: boolean | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type DecreaseOrganizationRemainingMinutesMutationVariables = {
  input: DecreaseOrganizationRemainingMinutesInput,
};

export type DecreaseOrganizationRemainingMinutesMutation = {
  decreaseOrganizationRemainingMinutes?:  {
    __typename: "Organization",
    id: string,
    name: string,
    remainingMinutes: number,
    remainingTaskGenerations?: number | null,
    monthlyMinutes?: number | null,
    monthlyTaskGenerations?: number | null,
    users?:  {
      __typename: "ModelUserConnection",
      items:  Array< {
        __typename: "User",
        id: string,
        organizationID?: string | null,
        username: string,
        email?: string | null,
        cognitoSub?: string | null,
        isAdmin?: boolean | null,
        createdAt: string,
        updatedAt: string,
      } | null >,
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type DecreaseOrganizationTaskGenerationsMutationVariables = {
  input: DecreaseOrganizationTaskGenerationsInput,
};

export type DecreaseOrganizationTaskGenerationsMutation = {
  decreaseOrganizationTaskGenerations?:  {
    __typename: "Organization",
    id: string,
    name: string,
    remainingMinutes: number,
    remainingTaskGenerations?: number | null,
    monthlyMinutes?: number | null,
    monthlyTaskGenerations?: number | null,
    users?:  {
      __typename: "ModelUserConnection",
      items:  Array< {
        __typename: "User",
        id: string,
        organizationID?: string | null,
        username: string,
        email?: string | null,
        cognitoSub?: string | null,
        isAdmin?: boolean | null,
        createdAt: string,
        updatedAt: string,
      } | null >,
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type GetAudioPresignedUrlQueryVariables = {
  sessionId: string,
};

export type GetAudioPresignedUrlQuery = {
  getAudioPresignedUrl?: string | null,
};

export type GetOrganizationQueryVariables = {
  id: string,
};

export type GetOrganizationQuery = {
  getOrganization?:  {
    __typename: "Organization",
    id: string,
    name: string,
    remainingMinutes: number,
    remainingTaskGenerations?: number | null,
    monthlyMinutes?: number | null,
    monthlyTaskGenerations?: number | null,
    users?:  {
      __typename: "ModelUserConnection",
      items:  Array< {
        __typename: "User",
        id: string,
        organizationID?: string | null,
        username: string,
        email?: string | null,
        cognitoSub?: string | null,
        isAdmin?: boolean | null,
        createdAt: string,
        updatedAt: string,
      } | null >,
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type ListOrganizationsQueryVariables = {
  id?: string | null,
  filter?: ModelOrganizationFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListOrganizationsQuery = {
  listOrganizations?:  {
    __typename: "ModelOrganizationConnection",
    items:  Array< {
      __typename: "Organization",
      id: string,
      name: string,
      remainingMinutes: number,
      remainingTaskGenerations?: number | null,
      monthlyMinutes?: number | null,
      monthlyTaskGenerations?: number | null,
      users?:  {
        __typename: "ModelUserConnection",
        nextToken?: string | null,
      } | null,
      createdAt: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type GetUserQueryVariables = {
  id: string,
};

export type GetUserQuery = {
  getUser?:  {
    __typename: "User",
    id: string,
    organizationID?: string | null,
    username: string,
    email?: string | null,
    cognitoSub?: string | null,
    organization?:  {
      __typename: "Organization",
      id: string,
      name: string,
      remainingMinutes: number,
      remainingTaskGenerations?: number | null,
      monthlyMinutes?: number | null,
      monthlyTaskGenerations?: number | null,
      users?:  {
        __typename: "ModelUserConnection",
        nextToken?: string | null,
      } | null,
      createdAt: string,
      updatedAt: string,
    } | null,
    isAdmin?: boolean | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type ListUsersQueryVariables = {
  id?: string | null,
  filter?: ModelUserFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListUsersQuery = {
  listUsers?:  {
    __typename: "ModelUserConnection",
    items:  Array< {
      __typename: "User",
      id: string,
      organizationID?: string | null,
      username: string,
      email?: string | null,
      cognitoSub?: string | null,
      organization?:  {
        __typename: "Organization",
        id: string,
        name: string,
        remainingMinutes: number,
        remainingTaskGenerations?: number | null,
        monthlyMinutes?: number | null,
        monthlyTaskGenerations?: number | null,
        createdAt: string,
        updatedAt: string,
      } | null,
      isAdmin?: boolean | null,
      createdAt: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type UsersByOrganizationIDQueryVariables = {
  organizationID: string,
  sortDirection?: ModelSortDirection | null,
  filter?: ModelUserFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type UsersByOrganizationIDQuery = {
  usersByOrganizationID?:  {
    __typename: "ModelUserConnection",
    items:  Array< {
      __typename: "User",
      id: string,
      organizationID?: string | null,
      username: string,
      email?: string | null,
      cognitoSub?: string | null,
      organization?:  {
        __typename: "Organization",
        id: string,
        name: string,
        remainingMinutes: number,
        remainingTaskGenerations?: number | null,
        monthlyMinutes?: number | null,
        monthlyTaskGenerations?: number | null,
        createdAt: string,
        updatedAt: string,
      } | null,
      isAdmin?: boolean | null,
      createdAt: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type UserByCognitoSubQueryVariables = {
  cognitoSub: string,
  sortDirection?: ModelSortDirection | null,
  filter?: ModelUserFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type UserByCognitoSubQuery = {
  userByCognitoSub?:  {
    __typename: "ModelUserConnection",
    items:  Array< {
      __typename: "User",
      id: string,
      organizationID?: string | null,
      username: string,
      email?: string | null,
      cognitoSub?: string | null,
      organization?:  {
        __typename: "Organization",
        id: string,
        name: string,
        remainingMinutes: number,
        remainingTaskGenerations?: number | null,
        monthlyMinutes?: number | null,
        monthlyTaskGenerations?: number | null,
        createdAt: string,
        updatedAt: string,
      } | null,
      isAdmin?: boolean | null,
      createdAt: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type GetProcessingSessionQueryVariables = {
  id: string,
};

export type GetProcessingSessionQuery = {
  getProcessingSession?:  {
    __typename: "ProcessingSession",
    id: string,
    owner?: string | null,
    identityId: string,
    sessionId: string,
    organizationID: string,
    fileName: string,
    language: string,
    status: ProcessingStatus,
    uploadTime: string,
    transcriptKey?: string | null,
    bulletPointsKey?: string | null,
    minutesKey?: string | null,
    bulletPointsStatus?: string | null,
    minutesStatus?: string | null,
    taskFileKey?: string | null,
    informationFileKey?: string | null,
    tasksKey?: string | null,
    tasksStatus?: string | null,
    processingTypes?: Array< string | null > | null,
    audioLengthSeconds?: number | null,
    errorMessage?: string | null,
    transcriptFormat?: TranscriptFormat | null,
    filesDeletionTime?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type ListProcessingSessionsQueryVariables = {
  id?: string | null,
  filter?: ModelProcessingSessionFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListProcessingSessionsQuery = {
  listProcessingSessions?:  {
    __typename: "ModelProcessingSessionConnection",
    items:  Array< {
      __typename: "ProcessingSession",
      id: string,
      owner?: string | null,
      identityId: string,
      sessionId: string,
      organizationID: string,
      fileName: string,
      language: string,
      status: ProcessingStatus,
      uploadTime: string,
      transcriptKey?: string | null,
      bulletPointsKey?: string | null,
      minutesKey?: string | null,
      bulletPointsStatus?: string | null,
      minutesStatus?: string | null,
      taskFileKey?: string | null,
      informationFileKey?: string | null,
      tasksKey?: string | null,
      tasksStatus?: string | null,
      processingTypes?: Array< string | null > | null,
      audioLengthSeconds?: number | null,
      errorMessage?: string | null,
      transcriptFormat?: TranscriptFormat | null,
      filesDeletionTime?: string | null,
      createdAt: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ProcessingSessionsByIdentityIdQueryVariables = {
  identityId: string,
  sortDirection?: ModelSortDirection | null,
  filter?: ModelProcessingSessionFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ProcessingSessionsByIdentityIdQuery = {
  processingSessionsByIdentityId?:  {
    __typename: "ModelProcessingSessionConnection",
    items:  Array< {
      __typename: "ProcessingSession",
      id: string,
      owner?: string | null,
      identityId: string,
      sessionId: string,
      organizationID: string,
      fileName: string,
      language: string,
      status: ProcessingStatus,
      uploadTime: string,
      transcriptKey?: string | null,
      bulletPointsKey?: string | null,
      minutesKey?: string | null,
      bulletPointsStatus?: string | null,
      minutesStatus?: string | null,
      taskFileKey?: string | null,
      informationFileKey?: string | null,
      tasksKey?: string | null,
      tasksStatus?: string | null,
      processingTypes?: Array< string | null > | null,
      audioLengthSeconds?: number | null,
      errorMessage?: string | null,
      transcriptFormat?: TranscriptFormat | null,
      filesDeletionTime?: string | null,
      createdAt: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ProcessingSessionsBySessionIdQueryVariables = {
  sessionId: string,
  sortDirection?: ModelSortDirection | null,
  filter?: ModelProcessingSessionFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ProcessingSessionsBySessionIdQuery = {
  processingSessionsBySessionId?:  {
    __typename: "ModelProcessingSessionConnection",
    items:  Array< {
      __typename: "ProcessingSession",
      id: string,
      owner?: string | null,
      identityId: string,
      sessionId: string,
      organizationID: string,
      fileName: string,
      language: string,
      status: ProcessingStatus,
      uploadTime: string,
      transcriptKey?: string | null,
      bulletPointsKey?: string | null,
      minutesKey?: string | null,
      bulletPointsStatus?: string | null,
      minutesStatus?: string | null,
      taskFileKey?: string | null,
      informationFileKey?: string | null,
      tasksKey?: string | null,
      tasksStatus?: string | null,
      processingTypes?: Array< string | null > | null,
      audioLengthSeconds?: number | null,
      errorMessage?: string | null,
      transcriptFormat?: TranscriptFormat | null,
      filesDeletionTime?: string | null,
      createdAt: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ProcessingSessionsByOrganizationIDQueryVariables = {
  organizationID: string,
  sortDirection?: ModelSortDirection | null,
  filter?: ModelProcessingSessionFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ProcessingSessionsByOrganizationIDQuery = {
  processingSessionsByOrganizationID?:  {
    __typename: "ModelProcessingSessionConnection",
    items:  Array< {
      __typename: "ProcessingSession",
      id: string,
      owner?: string | null,
      identityId: string,
      sessionId: string,
      organizationID: string,
      fileName: string,
      language: string,
      status: ProcessingStatus,
      uploadTime: string,
      transcriptKey?: string | null,
      bulletPointsKey?: string | null,
      minutesKey?: string | null,
      bulletPointsStatus?: string | null,
      minutesStatus?: string | null,
      taskFileKey?: string | null,
      informationFileKey?: string | null,
      tasksKey?: string | null,
      tasksStatus?: string | null,
      processingTypes?: Array< string | null > | null,
      audioLengthSeconds?: number | null,
      errorMessage?: string | null,
      transcriptFormat?: TranscriptFormat | null,
      filesDeletionTime?: string | null,
      createdAt: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type OnCreateOrganizationSubscriptionVariables = {
  filter?: ModelSubscriptionOrganizationFilterInput | null,
};

export type OnCreateOrganizationSubscription = {
  onCreateOrganization?:  {
    __typename: "Organization",
    id: string,
    name: string,
    remainingMinutes: number,
    remainingTaskGenerations?: number | null,
    monthlyMinutes?: number | null,
    monthlyTaskGenerations?: number | null,
    users?:  {
      __typename: "ModelUserConnection",
      items:  Array< {
        __typename: "User",
        id: string,
        organizationID?: string | null,
        username: string,
        email?: string | null,
        cognitoSub?: string | null,
        isAdmin?: boolean | null,
        createdAt: string,
        updatedAt: string,
      } | null >,
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type OnUpdateOrganizationSubscriptionVariables = {
  filter?: ModelSubscriptionOrganizationFilterInput | null,
};

export type OnUpdateOrganizationSubscription = {
  onUpdateOrganization?:  {
    __typename: "Organization",
    id: string,
    name: string,
    remainingMinutes: number,
    remainingTaskGenerations?: number | null,
    monthlyMinutes?: number | null,
    monthlyTaskGenerations?: number | null,
    users?:  {
      __typename: "ModelUserConnection",
      items:  Array< {
        __typename: "User",
        id: string,
        organizationID?: string | null,
        username: string,
        email?: string | null,
        cognitoSub?: string | null,
        isAdmin?: boolean | null,
        createdAt: string,
        updatedAt: string,
      } | null >,
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type OnDeleteOrganizationSubscriptionVariables = {
  filter?: ModelSubscriptionOrganizationFilterInput | null,
};

export type OnDeleteOrganizationSubscription = {
  onDeleteOrganization?:  {
    __typename: "Organization",
    id: string,
    name: string,
    remainingMinutes: number,
    remainingTaskGenerations?: number | null,
    monthlyMinutes?: number | null,
    monthlyTaskGenerations?: number | null,
    users?:  {
      __typename: "ModelUserConnection",
      items:  Array< {
        __typename: "User",
        id: string,
        organizationID?: string | null,
        username: string,
        email?: string | null,
        cognitoSub?: string | null,
        isAdmin?: boolean | null,
        createdAt: string,
        updatedAt: string,
      } | null >,
      nextToken?: string | null,
    } | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type OnCreateUserSubscriptionVariables = {
  filter?: ModelSubscriptionUserFilterInput | null,
};

export type OnCreateUserSubscription = {
  onCreateUser?:  {
    __typename: "User",
    id: string,
    organizationID?: string | null,
    username: string,
    email?: string | null,
    cognitoSub?: string | null,
    organization?:  {
      __typename: "Organization",
      id: string,
      name: string,
      remainingMinutes: number,
      remainingTaskGenerations?: number | null,
      monthlyMinutes?: number | null,
      monthlyTaskGenerations?: number | null,
      users?:  {
        __typename: "ModelUserConnection",
        nextToken?: string | null,
      } | null,
      createdAt: string,
      updatedAt: string,
    } | null,
    isAdmin?: boolean | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type OnUpdateUserSubscriptionVariables = {
  filter?: ModelSubscriptionUserFilterInput | null,
};

export type OnUpdateUserSubscription = {
  onUpdateUser?:  {
    __typename: "User",
    id: string,
    organizationID?: string | null,
    username: string,
    email?: string | null,
    cognitoSub?: string | null,
    organization?:  {
      __typename: "Organization",
      id: string,
      name: string,
      remainingMinutes: number,
      remainingTaskGenerations?: number | null,
      monthlyMinutes?: number | null,
      monthlyTaskGenerations?: number | null,
      users?:  {
        __typename: "ModelUserConnection",
        nextToken?: string | null,
      } | null,
      createdAt: string,
      updatedAt: string,
    } | null,
    isAdmin?: boolean | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type OnDeleteUserSubscriptionVariables = {
  filter?: ModelSubscriptionUserFilterInput | null,
};

export type OnDeleteUserSubscription = {
  onDeleteUser?:  {
    __typename: "User",
    id: string,
    organizationID?: string | null,
    username: string,
    email?: string | null,
    cognitoSub?: string | null,
    organization?:  {
      __typename: "Organization",
      id: string,
      name: string,
      remainingMinutes: number,
      remainingTaskGenerations?: number | null,
      monthlyMinutes?: number | null,
      monthlyTaskGenerations?: number | null,
      users?:  {
        __typename: "ModelUserConnection",
        nextToken?: string | null,
      } | null,
      createdAt: string,
      updatedAt: string,
    } | null,
    isAdmin?: boolean | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type OnCreateProcessingSessionSubscriptionVariables = {
  filter?: ModelSubscriptionProcessingSessionFilterInput | null,
  owner?: string | null,
};

export type OnCreateProcessingSessionSubscription = {
  onCreateProcessingSession?:  {
    __typename: "ProcessingSession",
    id: string,
    owner?: string | null,
    identityId: string,
    sessionId: string,
    organizationID: string,
    fileName: string,
    language: string,
    status: ProcessingStatus,
    uploadTime: string,
    transcriptKey?: string | null,
    bulletPointsKey?: string | null,
    minutesKey?: string | null,
    bulletPointsStatus?: string | null,
    minutesStatus?: string | null,
    taskFileKey?: string | null,
    informationFileKey?: string | null,
    tasksKey?: string | null,
    tasksStatus?: string | null,
    processingTypes?: Array< string | null > | null,
    audioLengthSeconds?: number | null,
    errorMessage?: string | null,
    transcriptFormat?: TranscriptFormat | null,
    filesDeletionTime?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type OnUpdateProcessingSessionSubscriptionVariables = {
  filter?: ModelSubscriptionProcessingSessionFilterInput | null,
  owner?: string | null,
};

export type OnUpdateProcessingSessionSubscription = {
  onUpdateProcessingSession?:  {
    __typename: "ProcessingSession",
    id: string,
    owner?: string | null,
    identityId: string,
    sessionId: string,
    organizationID: string,
    fileName: string,
    language: string,
    status: ProcessingStatus,
    uploadTime: string,
    transcriptKey?: string | null,
    bulletPointsKey?: string | null,
    minutesKey?: string | null,
    bulletPointsStatus?: string | null,
    minutesStatus?: string | null,
    taskFileKey?: string | null,
    informationFileKey?: string | null,
    tasksKey?: string | null,
    tasksStatus?: string | null,
    processingTypes?: Array< string | null > | null,
    audioLengthSeconds?: number | null,
    errorMessage?: string | null,
    transcriptFormat?: TranscriptFormat | null,
    filesDeletionTime?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type OnDeleteProcessingSessionSubscriptionVariables = {
  filter?: ModelSubscriptionProcessingSessionFilterInput | null,
  owner?: string | null,
};

export type OnDeleteProcessingSessionSubscription = {
  onDeleteProcessingSession?:  {
    __typename: "ProcessingSession",
    id: string,
    owner?: string | null,
    identityId: string,
    sessionId: string,
    organizationID: string,
    fileName: string,
    language: string,
    status: ProcessingStatus,
    uploadTime: string,
    transcriptKey?: string | null,
    bulletPointsKey?: string | null,
    minutesKey?: string | null,
    bulletPointsStatus?: string | null,
    minutesStatus?: string | null,
    taskFileKey?: string | null,
    informationFileKey?: string | null,
    tasksKey?: string | null,
    tasksStatus?: string | null,
    processingTypes?: Array< string | null > | null,
    audioLengthSeconds?: number | null,
    errorMessage?: string | null,
    transcriptFormat?: TranscriptFormat | null,
    filesDeletionTime?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};
