/* tslint:disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedMutation<InputType, OutputType> = string & {
  __generatedMutationInput: InputType;
  __generatedMutationOutput: OutputType;
};

export const deleteGeneratedFiles = /* GraphQL */ `mutation DeleteGeneratedFiles($sessionId: String!) {
  deleteGeneratedFiles(sessionId: $sessionId)
}
` as GeneratedMutation<
  APITypes.DeleteGeneratedFilesMutationVariables,
  APITypes.DeleteGeneratedFilesMutation
>;
export const createOrganization = /* GraphQL */ `mutation CreateOrganization(
  $input: CreateOrganizationInput!
  $condition: ModelOrganizationConditionInput
) {
  createOrganization(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.CreateOrganizationMutationVariables,
  APITypes.CreateOrganizationMutation
>;
export const updateOrganization = /* GraphQL */ `mutation UpdateOrganization(
  $input: UpdateOrganizationInput!
  $condition: ModelOrganizationConditionInput
) {
  updateOrganization(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.UpdateOrganizationMutationVariables,
  APITypes.UpdateOrganizationMutation
>;
export const deleteOrganization = /* GraphQL */ `mutation DeleteOrganization(
  $input: DeleteOrganizationInput!
  $condition: ModelOrganizationConditionInput
) {
  deleteOrganization(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.DeleteOrganizationMutationVariables,
  APITypes.DeleteOrganizationMutation
>;
export const createUser = /* GraphQL */ `mutation CreateUser(
  $input: CreateUserInput!
  $condition: ModelUserConditionInput
) {
  createUser(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.CreateUserMutationVariables,
  APITypes.CreateUserMutation
>;
export const updateUser = /* GraphQL */ `mutation UpdateUser(
  $input: UpdateUserInput!
  $condition: ModelUserConditionInput
) {
  updateUser(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.UpdateUserMutationVariables,
  APITypes.UpdateUserMutation
>;
export const deleteUser = /* GraphQL */ `mutation DeleteUser(
  $input: DeleteUserInput!
  $condition: ModelUserConditionInput
) {
  deleteUser(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.DeleteUserMutationVariables,
  APITypes.DeleteUserMutation
>;
export const createProcessingSession = /* GraphQL */ `mutation CreateProcessingSession(
  $input: CreateProcessingSessionInput!
  $condition: ModelProcessingSessionConditionInput
) {
  createProcessingSession(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.CreateProcessingSessionMutationVariables,
  APITypes.CreateProcessingSessionMutation
>;
export const updateProcessingSession = /* GraphQL */ `mutation UpdateProcessingSession(
  $input: UpdateProcessingSessionInput!
  $condition: ModelProcessingSessionConditionInput
) {
  updateProcessingSession(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.UpdateProcessingSessionMutationVariables,
  APITypes.UpdateProcessingSessionMutation
>;
export const deleteProcessingSession = /* GraphQL */ `mutation DeleteProcessingSession(
  $input: DeleteProcessingSessionInput!
  $condition: ModelProcessingSessionConditionInput
) {
  deleteProcessingSession(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.DeleteProcessingSessionMutationVariables,
  APITypes.DeleteProcessingSessionMutation
>;
export const createUserCustom = /* GraphQL */ `mutation CreateUserCustom($input: CreateUserCustomInput!) {
  createUserCustom(input: $input) {
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
` as GeneratedMutation<
  APITypes.CreateUserCustomMutationVariables,
  APITypes.CreateUserCustomMutation
>;
export const decreaseOrganizationRemainingMinutes = /* GraphQL */ `mutation DecreaseOrganizationRemainingMinutes(
  $input: DecreaseOrganizationRemainingMinutesInput!
) {
  decreaseOrganizationRemainingMinutes(input: $input) {
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
` as GeneratedMutation<
  APITypes.DecreaseOrganizationRemainingMinutesMutationVariables,
  APITypes.DecreaseOrganizationRemainingMinutesMutation
>;
export const decreaseOrganizationTaskGenerations = /* GraphQL */ `mutation DecreaseOrganizationTaskGenerations(
  $input: DecreaseOrganizationTaskGenerationsInput!
) {
  decreaseOrganizationTaskGenerations(input: $input) {
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
` as GeneratedMutation<
  APITypes.DecreaseOrganizationTaskGenerationsMutationVariables,
  APITypes.DecreaseOrganizationTaskGenerationsMutation
>;
