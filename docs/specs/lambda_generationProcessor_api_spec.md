# Lambda関数: generationProcessor 仕様書

## 1. 概要

このLambda関数 (`generationProcessor`) は、API Gatewayからのリクエストを受け付けるエンドポイントとしての役割を担います。主な責務は、リクエストの検証、`generationWorker` Lambdaを非同期で呼び出すためのペイロード作成、そして`generationWorker`の呼び出しです。時間のかかるAIによるコンテンツ生成処理は行わず、リクエストを受理したことを示す応答を即座にクライアントに返します。

## 2. トリガー

- **サービス:** AWS API Gateway
- **エンドポイント:** `POST /generate/process-all`
- **認証:** IAM認証 (認証済みCognitoユーザーのみ)

注: 本関数は処理受付のみを行い、ProcessingSessionのステータス更新は行いません。

## 3. 入力 (API Gatewayイベントペイロード)

API Gateway (Lambdaプロキシ統合) からの標準的なイベントJSONを受け取ります。

### 3.1. `requestContext`

-   `event.requestContext.identity.cognitoIdentityId`: リクエスト元のユーザーを特定するためのCognito Identity ID。

### 3.2. `body` (JSON文字列)

リクエストボディには以下のプロパティを含むJSONオブジェクトが必要です。

-   `sessionId` (string): 処理対象のセッションID。
-   `transcript` (string): 箇条書き・議事録・タスク一覧生成の元となる、編集済みの文字起こしテキスト。
-   `processingTypes` (string[]): 生成したいコンテンツの種類を示す文字列の配列。例: `["bullets", "minutes"]`, `["tasks"]`
-   `taskFileKey` (string, optional): タスク一覧生成時に使用するタスク定義ファイル (`task.xlsx`) のS3オブジェクトキー。`processingTypes`に`"tasks"`が含まれる場合は必須。
-   `informationFileKey` (string, optional): タスク一覧生成時に使用する関連情報ファイル (`information.xlsx`) のS3オブジェクトキー。`processingTypes`に`"tasks"`が含まれる場合は必須。

**リクエストボディの例 (箇条書き・議事録):**

```json
{
  "sessionId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "transcript": "会議の文字起こしテキストです...",
  "processingTypes": ["bullets", "minutes"]
}
```

**リクエストボディの例 (タスク一覧):**

```json
{
  "sessionId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "transcript": "会議の文字起こしテキストです...",
  "processingTypes": ["tasks"],
  "taskFileKey": "private/us-east-1:xxxx/a1b2c3d4/task.xlsx",
  "informationFileKey": "private/us-east-1:xxxx/a1b2c3d4/information.xlsx"
}
```

## 4. 処理フロー

1.  **リクエスト受信と検証:**
    1.  API Gatewayからイベントを受信します。
    2.  `requestContext` から `cognitoIdentityId` を取得し、ユーザー認証情報を確認します。
    3.  リクエストボディをパースし、必須パラメータ (`sessionId`, `transcript`, `processingTypes`) がすべて存在するか検証します。不足している場合は `400 Bad Request` を返します。
    4.  `processingTypes` に `"tasks"` が含まれる場合、`taskFileKey` と `informationFileKey` が存在することを追加で検証します。不足している場合は `400 Bad Request` を返します。
2.  **セッション情報取得:**
    1.  `lib/graphqlClient.js` の `getProcessingSessionByCustomSessionId` を使用し、AppSync経由で`sessionId`に対応するセッション情報を取得します。
    2.  `generationWorker`に渡す `fileName` をセッション情報から取得します。情報が取得できない場合は `404 Not Found` を返します。
3.  **ワーカー呼び出し:**
    1.  `generationWorker` Lambdaに渡すペイロードを構築します。ペイロードには `sessionId`, `transcript`, `identityId`, `fileName`, `processingTypes` および、タスク生成時は `taskFileKey`, `informationFileKey` が含まれます。
    2.  AWS SDKを使用し、環境変数 `FUNCTION_GENERATIONWORKER_NAME` で指定されたワーカーLambdaを**非同期 (`InvocationType: 'Event'`)**で呼び出します。
4.  **応答:**
    1.  `generationWorker`の呼び出しリクエストが正常に送信された後、クライアントに `202 Accepted` ステータスコードと成功メッセージを即座に返します。

## 5. 出力

### 5.1. Lambdaの戻り値 (クライアントへのレスポンス)

-   **成功時 (202 Accepted):** リクエストが正常に受理されたことを示します。
    ```json
    {
      "statusCode": 202,
      "headers": {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*"
      },
      "body": "{\"success\":true,\"message\":\"リクエストに成功しました。\",\"sessionId\":\"...\"}"
    }
    ```
-   **失敗時 (4xx/5xx):** パラメータ不足、認証失敗、サーバー内部エラーなどを示します。
    ```json
    {
      "statusCode": 400,
      "body": "{\"success\":false,\"error\":\"sessionId, transcript, processingTypes は必須です\"}"
    }
    ```

### 5.2. `generationWorker` への出力 (ペイロード)

非同期呼び出しで `generationWorker` に渡されるペイロードです。

```json
{
  "sessionId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "transcript": "会議の文字起こしテキストです...",
  "identityId": "us-east-1:xxxx-yyyy-zzzz",
  "fileName": "original-audio.mp3",
  "processingTypes": ["tasks"],
  "taskFileKey": "private/us-east-1:xxxx/a1b2c3d4/task.xlsx",
  "informationFileKey": "private/us-east-1:xxxx/a1b2c3d4/information.xlsx"
}
```

## 6. 主要な環境変数

| 変数名 | 説明 |
| :--- | :--- |
| `ENV` | 現在のデプロイ環境 |
| `REGION` | AWSリージョン |
| `FUNCTION_GENERATIONWORKER_NAME` | 非同期で呼び出すワーカーLambda (`generationWorker`) の関数名 |
| `LOG_LEVEL` | ログレベル（`info`/`debug`） |

## 7. IAM権限 (主要なもの)

Lambda実行ロールには以下の権限が必要です。

-   **AWS Lambda:**
    -   `lambda:InvokeFunction`: `generationWorker` Lambdaを非同期で呼び出すための権限。
-   **AWS AppSync:**
    -   `appsync:GraphQL`: `Query` (セッション情報取得) の実行権限。
-   **AWS CloudWatch Logs:**
    -   ログ出力のための標準的な権限。

**注:** このLambdaはS3やSecrets Managerに直接アクセスする必要はありません。 