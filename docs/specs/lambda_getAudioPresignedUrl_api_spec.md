# GraphQL Query: getAudioPresignedUrl 仕様書

## 1. 概要

AppSyncのQueryリゾルバーにより起動するLambda（`getAudioPresignedUrl`）。指定の`ProcessingSession`に紐づく「元音声ファイル」のS3署名付きURL（15分有効）を返します。リクエストユーザーがセッション所有者であることを検証します。

## 2. トリガー/スキーマ

GraphQL Query（IAM/ユーザー認証前提）

```graphql
type Query {
  getAudioPresignedUrl(sessionId: ID!): String
}
```

## 3. 入力

- `sessionId` (ID!, AppSyncの`event.arguments.sessionId`)
- 認証情報: `event.identity.sub`（Cognito User Sub）

## 4. 処理フロー

1. `getProcessingSession(id: $sessionId)` をIAM署名で呼び出してセッション情報を取得。
2. `session.owner === event.identity.sub` を検証（不一致ならエラー）。
3. 入力S3キー `private/{identityId}/{sessionId}/{fileName}` を構築。
4. 入力バケットから15分有効の署名付きURLを生成して返却。

## 5. 出力

- 成功時: 署名付きURL（文字列）
- 失敗時: 例外（AppSync経由でエラー応答）

## 6. 環境変数

| 変数名 | 説明 |
| :--- | :--- |
| `API_TRANSCRIPTMINUTE_GRAPHQLAPIENDPOINTOUTPUT` | AppSyncエンドポイント |
| `REGION` | AWSリージョン |
| `STORAGE_S31D11B5D9_BUCKETNAME` | 入力（アップロード）S3バケット名 |

## 7. IAM権限

- AppSync（IAM署名でのQuery実行）
- S3: `s3:GetObject`（入力バケット）
- CloudWatch Logs

## 8. エラーハンドリング

- `Session not found`（存在しない/削除済み）
- `Unauthorized`（所有者不一致）
- 署名生成失敗（S3/環境変数不備）


