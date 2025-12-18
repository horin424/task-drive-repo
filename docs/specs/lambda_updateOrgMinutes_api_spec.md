# GraphQL Mutation: decreaseOrganizationRemainingMinutes 仕様書

## 1. 概要

`Organization.remainingMinutes` をアトミックに減算するMutationリゾルバー。主に `transcriptionProcessor` の `markTranscriptionComplete` から呼び出され、使用時間（分）を一括で減算します。

## 2. トリガー/スキーマ

```graphql
type Mutation {
  decreaseOrganizationRemainingMinutes(input: DecreaseOrganizationRemainingMinutesInput!): Organization
}

input DecreaseOrganizationRemainingMinutesInput {
  id: ID!
  decreaseBy: Int!
}
```

## 3. 入力

- `id` (ID!): 組織ID
- `decreaseBy` (Int!): 減算する分数（正の整数）

## 4. 処理フロー

1. 入力検証（必須・型・正数）。
2. DynamoDB `UpdateCommand` で `remainingMinutes = remainingMinutes - :val` を実行。
3. `ConditionExpression: remainingMinutes >= :val` により不足時に `ConditionalCheckFailedException`。
4. 更新後の `Organization` を返却。

## 5. 出力

- 成功時: 更新後の `Organization` オブジェクト
- 失敗時: 例外（不足/リソース未存在/その他）

## 6. 環境変数・権限

| 変数名 | 説明 |
| :--- | :--- |
| `API_TRANSCRIPTMINUTE_ORGANIZATIONTABLE_NAME` | Organizationテーブル名 |
| `LOG_LEVEL` | ログレベル（`info`/`debug`） |

権限: DynamoDB `UpdateItem`, CloudWatch Logs


