/* tslint:disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedSubscription<InputType, OutputType> = string & {
  __generatedSubscriptionInput: InputType;
  __generatedSubscriptionOutput: OutputType;
};

export const onCreateOrganization = /* GraphQL */ `subscription OnCreateOrganization(
  $filter: ModelSubscriptionOrganizationFilterInput
) {
  onCreateOrganization(filter: $filter) {
    id
    name
    remainingMinutes
    remainingTaskGenerations
    monthlyMinutes
    monthlyTaskGenerations
    users {
      items {
        id
        organizationID
        username
        email
        cognitoSub
        isAdmin
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnCreateOrganizationSubscriptionVariables,
  APITypes.OnCreateOrganizationSubscription
>;
export const onUpdateOrganization = /* GraphQL */ `subscription OnUpdateOrganization(
  $filter: ModelSubscriptionOrganizationFilterInput
) {
  onUpdateOrganization(filter: $filter) {
    id
    name
    remainingMinutes
    remainingTaskGenerations
    monthlyMinutes
    monthlyTaskGenerations
    users {
      items {
        id
        organizationID
        username
        email
        cognitoSub
        isAdmin
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnUpdateOrganizationSubscriptionVariables,
  APITypes.OnUpdateOrganizationSubscription
>;
export const onDeleteOrganization = /* GraphQL */ `subscription OnDeleteOrganization(
  $filter: ModelSubscriptionOrganizationFilterInput
) {
  onDeleteOrganization(filter: $filter) {
    id
    name
    remainingMinutes
    remainingTaskGenerations
    monthlyMinutes
    monthlyTaskGenerations
    users {
      items {
        id
        organizationID
        username
        email
        cognitoSub
        isAdmin
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnDeleteOrganizationSubscriptionVariables,
  APITypes.OnDeleteOrganizationSubscription
>;
export const onCreateUser = /* GraphQL */ `subscription OnCreateUser($filter: ModelSubscriptionUserFilterInput) {
  onCreateUser(filter: $filter) {
    id
    organizationID
    username
    email
    cognitoSub
    organization {
      id
      name
      remainingMinutes
      remainingTaskGenerations
      monthlyMinutes
      monthlyTaskGenerations
      users {
        nextToken
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
    isAdmin
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnCreateUserSubscriptionVariables,
  APITypes.OnCreateUserSubscription
>;
export const onUpdateUser = /* GraphQL */ `subscription OnUpdateUser($filter: ModelSubscriptionUserFilterInput) {
  onUpdateUser(filter: $filter) {
    id
    organizationID
    username
    email
    cognitoSub
    organization {
      id
      name
      remainingMinutes
      remainingTaskGenerations
      monthlyMinutes
      monthlyTaskGenerations
      users {
        nextToken
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
    isAdmin
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnUpdateUserSubscriptionVariables,
  APITypes.OnUpdateUserSubscription
>;
export const onDeleteUser = /* GraphQL */ `subscription OnDeleteUser($filter: ModelSubscriptionUserFilterInput) {
  onDeleteUser(filter: $filter) {
    id
    organizationID
    username
    email
    cognitoSub
    organization {
      id
      name
      remainingMinutes
      remainingTaskGenerations
      monthlyMinutes
      monthlyTaskGenerations
      users {
        nextToken
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
    isAdmin
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnDeleteUserSubscriptionVariables,
  APITypes.OnDeleteUserSubscription
>;
export const onCreateProcessingSession = /* GraphQL */ `subscription OnCreateProcessingSession(
  $filter: ModelSubscriptionProcessingSessionFilterInput
  $owner: String
) {
  onCreateProcessingSession(filter: $filter, owner: $owner) {
    id
    owner
    identityId
    sessionId
    organizationID
    fileName
    language
    status
    uploadTime
    transcriptKey
    bulletPointsKey
    minutesKey
    bulletPointsStatus
    minutesStatus
    taskFileKey
    informationFileKey
    tasksKey
    tasksStatus
    processingTypes
    audioLengthSeconds
    errorMessage
    transcriptFormat
    filesDeletionTime
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnCreateProcessingSessionSubscriptionVariables,
  APITypes.OnCreateProcessingSessionSubscription
>;
export const onUpdateProcessingSession = /* GraphQL */ `subscription OnUpdateProcessingSession(
  $filter: ModelSubscriptionProcessingSessionFilterInput
  $owner: String
) {
  onUpdateProcessingSession(filter: $filter, owner: $owner) {
    id
    owner
    identityId
    sessionId
    organizationID
    fileName
    language
    status
    uploadTime
    transcriptKey
    bulletPointsKey
    minutesKey
    bulletPointsStatus
    minutesStatus
    taskFileKey
    informationFileKey
    tasksKey
    tasksStatus
    processingTypes
    audioLengthSeconds
    errorMessage
    transcriptFormat
    filesDeletionTime
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnUpdateProcessingSessionSubscriptionVariables,
  APITypes.OnUpdateProcessingSessionSubscription
>;
export const onDeleteProcessingSession = /* GraphQL */ `subscription OnDeleteProcessingSession(
  $filter: ModelSubscriptionProcessingSessionFilterInput
  $owner: String
) {
  onDeleteProcessingSession(filter: $filter, owner: $owner) {
    id
    owner
    identityId
    sessionId
    organizationID
    fileName
    language
    status
    uploadTime
    transcriptKey
    bulletPointsKey
    minutesKey
    bulletPointsStatus
    minutesStatus
    taskFileKey
    informationFileKey
    tasksKey
    tasksStatus
    processingTypes
    audioLengthSeconds
    errorMessage
    transcriptFormat
    filesDeletionTime
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnDeleteProcessingSessionSubscriptionVariables,
  APITypes.OnDeleteProcessingSessionSubscription
>;
