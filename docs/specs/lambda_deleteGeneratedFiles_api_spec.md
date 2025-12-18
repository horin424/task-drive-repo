# GraphQL Mutation: deleteGeneratedFiles 仕様書

## 1. 概要

AppSyncのMutationリゾルバーで起動するLambda（`deleteGeneratedFiles`）。指定セッションに関連するS3ファイル（入力ファイル、文字起こし、箇条書き、議事録、タスク一覧、タスク定義・情報ファイル）を一括削除します。削除後に`ProcessingSession.filesDeletionTime`を更新します。

## 2. トリガー/スキーマ

GraphQL Mutation（IAM/ユーザー認証前提）

```graphql
type Mutation {
  deleteGeneratedFiles(sessionId: String!): Boolean
}
```

## 3. 入力

- `sessionId` (String!, AppSyncの`event.arguments.sessionId`)
- 認証情報: `event.identity.sub`（Cognito User Sub）

## 4. 処理フロー

1. `processingSessionsBySessionId(sessionId: $sessionId)` をIAM署名で呼び出し、セッション情報を取得。
2. 所有者検証（`session.owner === event.identity.sub`）。
3. 削除対象キーの収集：
   - 入力: `private/{identityId}/{sessionId}/{fileName}`（入力バケット）
   - 出力: `transcriptKey`, `bulletPointsKey`, `minutesKey`, `tasksKey`（出力バケット）
   - 追加: `taskFileKey`, `informationFileKey` は相対キーのため `private/{identityId}/` を付与して出力バケットに対して削除
4. バケットごとにグルーピングして `DeleteObjects` を実行（いずれか失敗でエラー伝播）。
5. 成功時にDynamoDBの`ProcessingSession.filesDeletionTime` を現在時刻に更新。

## 5. 出力

- 成功時: `true`
- 失敗時: 例外（AppSync経由でエラー応答）

## 6. 環境変数

| 変数名 | 説明 |
| :--- | :--- |
| `API_TRANSCRIPTMINUTE_GRAPHQLAPIENDPOINTOUTPUT` | AppSyncエンドポイント |
| `REGION` | AWSリージョン |
| `STORAGE_INPUT_BUCKETNAME` | 入力S3バケット名 |
| `STORAGE_OUTPUTBUCKET_BUCKETNAME` | 出力S3バケット名 |
| `API_TRANSCRIPTMINUTE_PROCESSINGSESSIONTABLE_NAME` | ProcessingSessionテーブル名 |
| `LOG_LEVEL` | ログレベル（`info`/`debug`） |

## 7. IAM権限

- S3: 入力・出力バケットの `s3:DeleteObject`/`s3:DeleteObjects`/`s3:ListBucket`
- DynamoDB: `UpdateItem`（`filesDeletionTime`更新）
- AppSync: IAM署名でのQuery実行
- CloudWatch Logs

## 8. エラーハンドリング

- 所有者不一致（`Unauthorized`）
- S3削除エラー（部分失敗も全体失敗として扱う）
- DynamoDB更新エラー


