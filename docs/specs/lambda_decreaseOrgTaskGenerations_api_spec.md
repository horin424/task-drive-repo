# GraphQL Mutation: decreaseOrganizationTaskGenerations 仕様書

## 1. 概要

`Organization.remainingTaskGenerations` をアトミックに減算するMutationリゾルバー。主に `generationWorker` がタスク一覧生成完了時（`TASKS_COMPLETED`）に 1 回呼び出します。条件付き更新で回数不足を検出します。

## 2. トリガー/スキーマ

```graphql
type Mutation {
  decreaseOrganizationTaskGenerations(input: DecreaseOrganizationTaskGenerationsInput!): Organization
}

input DecreaseOrganizationTaskGenerationsInput {
  id: ID!
  decreaseBy: Int!
}
```

## 3. 入力

- `id` (ID!): 組織ID
- `decreaseBy` (Int!): 減算する回数（正の整数）

## 4. 処理フロー

1. 入力検証（必須・型・正数）。
2. DynamoDB `UpdateCommand` で `remainingTaskGenerations = remainingTaskGenerations - :val` を実行。
3. `ConditionExpression: remainingTaskGenerations >= :val` により不足時に `ConditionalCheckFailedException`。
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


