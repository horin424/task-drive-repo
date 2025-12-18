/* tslint:disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedQuery<InputType, OutputType> = string & {
  __generatedQueryInput: InputType;
  __generatedQueryOutput: OutputType;
};

export const getAudioPresignedUrl = /* GraphQL */ `query GetAudioPresignedUrl($sessionId: ID!) {
  getAudioPresignedUrl(sessionId: $sessionId)
}
` as GeneratedQuery<
  APITypes.GetAudioPresignedUrlQueryVariables,
  APITypes.GetAudioPresignedUrlQuery
>;
export const getOrganization = /* GraphQL */ `query GetOrganization($id: ID!) {
  getOrganization(id: $id) {
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
` as GeneratedQuery<
  APITypes.GetOrganizationQueryVariables,
  APITypes.GetOrganizationQuery
>;
export const listOrganizations = /* GraphQL */ `query ListOrganizations(
  $id: ID
  $filter: ModelOrganizationFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listOrganizations(
    id: $id
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
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
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListOrganizationsQueryVariables,
  APITypes.ListOrganizationsQuery
>;
export const getUser = /* GraphQL */ `query GetUser($id: ID!) {
  getUser(id: $id) {
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
` as GeneratedQuery<APITypes.GetUserQueryVariables, APITypes.GetUserQuery>;
export const listUsers = /* GraphQL */ `query ListUsers(
  $id: ID
  $filter: ModelUserFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listUsers(
    id: $id
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
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
        createdAt
        updatedAt
        __typename
      }
      isAdmin
      createdAt
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<APITypes.ListUsersQueryVariables, APITypes.ListUsersQuery>;
export const usersByOrganizationID = /* GraphQL */ `query UsersByOrganizationID(
  $organizationID: ID!
  $sortDirection: ModelSortDirection
  $filter: ModelUserFilterInput
  $limit: Int
  $nextToken: String
) {
  usersByOrganizationID(
    organizationID: $organizationID
    sortDirection: $sortDirection
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
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
        createdAt
        updatedAt
        __typename
      }
      isAdmin
      createdAt
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.UsersByOrganizationIDQueryVariables,
  APITypes.UsersByOrganizationIDQuery
>;
export const userByCognitoSub = /* GraphQL */ `query UserByCognitoSub(
  $cognitoSub: String!
  $sortDirection: ModelSortDirection
  $filter: ModelUserFilterInput
  $limit: Int
  $nextToken: String
) {
  userByCognitoSub(
    cognitoSub: $cognitoSub
    sortDirection: $sortDirection
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
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
        createdAt
        updatedAt
        __typename
      }
      isAdmin
      createdAt
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.UserByCognitoSubQueryVariables,
  APITypes.UserByCognitoSubQuery
>;
export const getProcessingSession = /* GraphQL */ `query GetProcessingSession($id: ID!) {
  getProcessingSession(id: $id) {
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
` as GeneratedQuery<
  APITypes.GetProcessingSessionQueryVariables,
  APITypes.GetProcessingSessionQuery
>;
export const listProcessingSessions = /* GraphQL */ `query ListProcessingSessions(
  $id: ID
  $filter: ModelProcessingSessionFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listProcessingSessions(
    id: $id
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
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
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListProcessingSessionsQueryVariables,
  APITypes.ListProcessingSessionsQuery
>;
export const processingSessionsByIdentityId = /* GraphQL */ `query ProcessingSessionsByIdentityId(
  $identityId: String!
  $sortDirection: ModelSortDirection
  $filter: ModelProcessingSessionFilterInput
  $limit: Int
  $nextToken: String
) {
  processingSessionsByIdentityId(
    identityId: $identityId
    sortDirection: $sortDirection
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
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
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ProcessingSessionsByIdentityIdQueryVariables,
  APITypes.ProcessingSessionsByIdentityIdQuery
>;
export const processingSessionsBySessionId = /* GraphQL */ `query ProcessingSessionsBySessionId(
  $sessionId: String!
  $sortDirection: ModelSortDirection
  $filter: ModelProcessingSessionFilterInput
  $limit: Int
  $nextToken: String
) {
  processingSessionsBySessionId(
    sessionId: $sessionId
    sortDirection: $sortDirection
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
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
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ProcessingSessionsBySessionIdQueryVariables,
  APITypes.ProcessingSessionsBySessionIdQuery
>;
export const processingSessionsByOrganizationID = /* GraphQL */ `query ProcessingSessionsByOrganizationID(
  $organizationID: ID!
  $sortDirection: ModelSortDirection
  $filter: ModelProcessingSessionFilterInput
  $limit: Int
  $nextToken: String
) {
  processingSessionsByOrganizationID(
    organizationID: $organizationID
    sortDirection: $sortDirection
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
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
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ProcessingSessionsByOrganizationIDQueryVariables,
  APITypes.ProcessingSessionsByOrganizationIDQuery
>;
