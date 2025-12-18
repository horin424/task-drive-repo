# GraphQL スキーマ仕様（全体）

## 1. 目的

本ドキュメントは、本システムのGraphQLスキーマ全体像、データモデル、認可、クエリ/ミューテーション、GSI（インデックス）、関連Lambda連携、および運用方針を定義する。

## 2. データモデル

### 2.1 Organization
- フィールド
  - `id: ID!`（PK）
  - `name: String!`
  - `remainingMinutes: Int!`
  - `remainingTaskGenerations: Int`（nullable）
  - `monthlyMinutes: Int`
  - `monthlyTaskGenerations: Int`
  - `users: [User] @hasMany(indexName: "byOrganization", fields: ["id"])`
- 認可
  - `@auth(rules: [{ allow: private }, { allow: groups, groups: ["Admin"] }])`

### 2.2 User
- フィールド
  - `id: ID!`（PK）
  - `organizationID: ID @index(name: "byOrganization")`
  - `username: String!`
  - `email: String`
  - `cognitoSub: String @index(name: "byCognitoSub", queryField: "userByCognitoSub")`
  - `organization: Organization @belongsTo(fields: ["organizationID"])`
  - `isAdmin: Boolean`
- 認可
  - `@auth(rules: [{ allow: private }, { allow: groups, groups: ["Admin"] }])`

### 2.3 ProcessingSession
- フィールド
  - `id: ID!`（PK）
  - `owner: String`（Cognito user sub）
  - `identityId: String! @index(name: "byIdentityId", queryField: "processingSessionsByIdentityId")`
  - `sessionId: String! @index(name: "bySessionId", queryField: "processingSessionsBySessionId")`
  - `organizationID: ID! @index(name: "byOrganization")`
  - `fileName: String!`
  - `language: String!`
  - `status: ProcessingStatus!`
  - `uploadTime: AWSDateTime!`
  - `transcriptKey: String`
  - `bulletPointsKey: String`
  - `minutesKey: String`
  - `bulletPointsStatus: String`
  - `minutesStatus: String`
  - `taskFileKey: String`
  - `informationFileKey: String`
  - `tasksKey: String`
  - `tasksStatus: String`
  - `processingTypes: [String]`
  - `audioLengthSeconds: Int`
  - `errorMessage: String`
  - `transcriptFormat: TranscriptFormat`
  - `filesDeletionTime: AWSDateTime`
- 認可
  - `@auth(rules: [
      { allow: owner, ownerField: "owner", identityClaim: "sub" },
      { allow: private, provider: iam, operations: [read, update] },
      { allow: groups, groups: ["Admin"] }
    ])`

### 2.4 列挙型
- `enum ProcessingStatus`: ワークフロー全体のステータス（UPLOADED, PROCESSING_*, *_COMPLETED, *_FAILED, ALL_COMPLETED, ERROR）
- `enum TranscriptFormat`: `JSON` | `TEXT`

## 3. 入出力型

- `CreateProcessingSessionInput`
- `DecreaseOrganizationRemainingMinutesInput`
- `DecreaseOrganizationTaskGenerationsInput`
- `CreateUserCustomInput`

## 4. クエリ/ミューテーション

### 4.1 Query
- `getAudioPresignedUrl(sessionId: ID!): String`
  - リゾルバー: `getAudioPresignedUrl-${env}`（Lambda）
  - 所有者検証（sub==owner）、入力バケットの署名URL生成

### 4.2 Mutation
- `createUserCustom(input: CreateUserCustomInput!): User`
  - Private/Admin
- `deleteGeneratedFiles(sessionId: String!): Boolean`
  - リゾルバー: `deleteGeneratedFiles-${env}`（Lambda）
  - 所有者検証後、入力/出力バケットの関連ファイル一括削除、`filesDeletionTime` 更新
- `decreaseOrganizationRemainingMinutes(input: DecreaseOrganizationRemainingMinutesInput!): Organization`
  - リゾルバー: `updateOrgMinutes-${env}`（Lambda）
  - IAM Private（バックエンドからのみ）。DynamoDB条件付き更新（アトミック減算）。
- `decreaseOrganizationTaskGenerations(input: DecreaseOrganizationTaskGenerationsInput!): Organization`
  - リゾルバー: `decreaseOrgTaskGenerations-${env}`（Lambda）
  - IAM Private（バックエンドからのみ）。DynamoDB条件付き更新（アトミック減算）。

## 5. GSI/インデックス設計

- `User.byOrganization`（`organizationID`）
- `User.userByCognitoSub`（`cognitoSub`、Query公開名）
- `ProcessingSession.byIdentityId`（`identityId`）
- `ProcessingSession.bySessionId`（`sessionId`、Query公開名）
- `ProcessingSession.byOrganization`（`organizationID`）

## 6. 認可/セキュリティ方針

- フロントエンド（ユーザー）は、`ProcessingSession` に対し `owner` ベースのアクセス。
- バックエンドLambda（IAM）は、`ProcessingSession` への `read/update` を許可。
- `Organization`/`User` は Private + Admin グループに限定。
- 署名URL取得や削除などは、所有者一致検証をLambda内で再確認。

## 7. Lambda連携一覧

- `getAudioPresignedUrl`（Query）
- `deleteGeneratedFiles`（Mutation）
- `updateOrgMinutes`（Mutation: decreaseOrganizationRemainingMinutes）
- `decreaseOrgTaskGenerations`（Mutation: decreaseOrganizationTaskGenerations）

## 8. ステータス遷移方針（要約）

- 文字起こし成功時: `PENDING_SPEAKER_EDIT` へ、`transcriptFormat=JSON`。
- 生成完了判定: リクエスト種別に応じて必要キーが揃えば `ALL_COMPLETED`。
- 失敗時: `*_FAILED` を個別に設定。詳細は `processing_session_status.md` を参照。

## 9. 運用/変更管理

- 変更時は `amplify push` で適用後、`amplify codegen` により型再生成。
- スキーマのBreaking Changeはフロント実装の調整が必要。
- 認可ルール変更は影響が大きいため、事前に権限・Lambda実行ロールの整合性を確認。

## 10. 既知の注意事項

- `remainingTaskGenerations` は nullable。既存組織はLambda側でデフォルト正規化（将来統一予定）。
- `filesDeletionTime` は削除済みフラグとして運用（実ファイルの削除はLambdaで実施）。
- Query/Mutation名は環境サフィックス `${env}` を伴うLambdaと接続される。
