# Lambda関数: generationWorker 仕様書

## 1. 概要

このLambda関数 (`generationWorker`) は、エンドポイント用Lambda (`generationProcessor`) から非同期で呼び出されるワーカーです。主な責務は、ペイロードで指定された種類のコンテンツ（箇条書き、議事録、タスク一覧）を、外部のDify APIを使用して生成し、結果をS3に保存することです。処理の進捗は、AppSyncミューテーションを通じて`ProcessingSession`のステータスを更新し、フロントエンドへ反映します。

## 2. トリガー

- **サービス:** AWS Lambda
- **呼び出し元:** `generationProcessor` Lambda関数
- **呼び出しタイプ:** 非同期 (`Event`)

## 3. 入力 (Lambdaイベントペイロード)

`generationProcessor`から渡されるJSONオブジェクトを受け取ります。

**入力ペイロードの例:**
```json
{
  "sessionId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "transcript": "会議の文字起こしテキストです...",
  "identityId": "us-east-1:xxxx-yyyy-zzzz",
  "fileName": "original-audio.mp3",
  "processingTypes": ["bullets", "minutes", "tasks"],
  "taskFileKey": "private/us-east-1:xxxx/a1b2c3d4/task.xlsx",
  "informationFileKey": "private/us-east-1:xxxx/a1b2c3d4/information.xlsx"
}
```

- `sessionId` (string): 処理対象のセッションID。
- `transcript` (string): コンテンツ生成の元となる文字起こしテキスト。
- `identityId` (string): ユーザーを識別するCognito Identity ID。S3のパス構築に使用。
- `fileName` (string): 出力ファイル名を生成するための元のファイル名。
- `processingTypes` (string[]): 生成するコンテンツの種類 (`"bullets"`, `"minutes"`, `"tasks"`) の配列。
- `taskFileKey` (string, optional): タスク一覧生成に使用するタスク定義ファイルのS3キー。
- `informationFileKey` (string, optional): タスク一覧生成に使用する関連情報ファイルのS3キー。

## 4. 処理フロー

1.  **初期化処理:**
    1.  `generationProcessor` からペイロードを受け取ります。必須パラメータが不足している場合は処理を中断します。
    2.  `lib/graphqlClient.js` を使用し、AppSyncから`sessionId`に紐づくセッション情報（特に`id` (レコードID) と `fileName`）を取得します。
    3.  環境変数 `SECRETS_MANAGER_SECRET_ARN` を使用し、`lib/difyClient.js` 経由でSecrets ManagerからDifyのAPIキー群 (`dify_bullet_points_api_key`, `dify_minutes_api_key`, `dify_tasks_api_key`など) を取得します。
    4.  初期化処理（セッション情報やAPIキーの取得）に失敗した場合、可能であれば`ProcessingSession`のステータスをエラー系（例: `INITIALIZATION_FAILED`）に更新し、処理を終了します。
2.  **メイン処理ループ:**
    1.  ペイロードの `processingTypes` 配列をループし、種類ごと（`"bullets"`, `"minutes"`, `"tasks"`）に処理を実行します。
    2.  **ステータス更新 (処理中):** `updateProcessingSession`ミューテーションを呼び出し、現在の処理タイプに応じたステータス（`'PROCESSING_BULLETS'`, `'PROCESSING_MINUTES'`, `'PROCESSING_TASKS'`）に更新します。
    3.  **Dify API連携:**
        -   **箇条書き/議事録:** `lib/difyClient.js` の `generateBulletPoints` または `generateMinutes` 関数を呼び出し、コンテンツを生成します。
        -   **タスク一覧:**
            1.  S3から `taskFileKey` と `informationFileKey` のファイルをダウンロードします。
     2.  `lib/difyClient.js` の `generateTasks` 関数を呼び出します。この関数は内部で、ダウンロードした2つのファイルと文字起こしテキストの計3ファイルをDifyにアップロードし、タスク生成APIを呼び出します。
    4.  **S3への保存:** 生成されたコンテンツをS3の出力バケットに保存します。
        -   **バケット:** 環境変数 `STORAGE_OUTPUTBUCKET_BUCKETNAME`
        -   **キー (テキスト):** `private/<identityId>/<sessionId>/<"箇条書き" or "議事録">_{baseFilename}.txt`
        -   **キー (XLSX):** `private/<identityId>/<sessionId>/tasks_{baseFilename}.xlsx`
    5.  **ステータス更新 (完了):** `updateProcessingSession`ミューテーションを呼び出し、処理タイプに応じた完了ステータス（`'BULLETS_COMPLETED'`, `'MINUTES_COMPLETED'`, `'TASKS_COMPLETED'`）と、保存したS3のキー (`bulletPointsKey`, `minutesKey`, `tasksKey`) を設定します。
     6.  **エラーハンドリング (ループ内):** ループ内の処理でエラーが発生した場合、対応する失敗ステータス（`'BULLETS_FAILED'`, `'MINUTES_FAILED'`, `'TASKS_FAILED'`）を記録し、次の処理タイプのループは継続します。
3.  **最終確認:**
    1.  すべてのループが完了した後、再度AppSyncからセッション情報を取得します。
     2.  リクエストされた種類（`processingTypes`）に応じ、必要なキー（`bulletPointsKey`, `minutesKey`, `tasksKey`）が揃っている場合に `ALL_COMPLETED` に更新します（要求されていない種類は判定対象外）。

## 5. 出力 (副作用)

このLambdaは非同期で呼び出されるため、直接の戻り値は重要ではありません。主な出力は以下の副作用です。

-   **S3:**
    -   `private/<identityId>/<sessionId>/箇条書き_{baseFilename}.txt`
    -   `private/<identityId>/<sessionId>/議事録_{baseFilename}.txt`
    -   `private/<identityId>/<sessionId>/tasks_{baseFilename}.xlsx`
-   **AppSync:**
    -   `updateProcessingSession`ミューテーションが処理の各段階で複数回呼び出され、`ProcessingSession`テーブルのレコード（`bulletPointsStatus`, `minutesStatus`, `tasksStatus`, `bulletPointsKey`, `minutesKey`, `tasksKey` など）が更新されます。

## 6. 主要な環境変数

| 変数名 | 説明 |
| :--- | :--- |
| `ENV` | 現在のデプロイ環境 |
| `REGION` | AWSリージョン |
| `API_TRANSCRIPTMINUTE_GRAPHQLAPIENDPOINTOUTPUT` | AppSync APIのエンドポイントURL |
| `STORAGE_OUTPUTBUCKET_BUCKETNAME` | 生成結果を保存するS3出力バケット名 |
| `SECRETS_MANAGER_SECRET_ARN` | DifyのAPIキーを保存しているSecrets ManagerのARN |
| `DIFY_API_URL` | Dify APIのエンドポイントURL |
| `LOG_LEVEL` | ログレベル（`info`/`debug`） |

## 7. IAM権限 (主要なもの)

Lambda実行ロールには以下の権限が必要です。

-   **AWS S3:**
    -   `s3:PutObject`: 生成されたコンテンツファイル（テキスト、XLSX）の出力バケットへの書き込み権限。
    -   `s3:GetObject`: タスク一覧生成時に、ユーザーがアップロードした関連ファイル（`task.xlsx`, `information.xlsx`）を出力バケットから読み取るための権限。
-   **AWS Secrets Manager:**
    -   `secretsmanager:GetSecretValue`: DifyのAPIキーを取得するための権限。
-   **AWS AppSync:**
    -   `appsync:GraphQL`: `Query` (セッション情報取得) および `Mutation` (ステータス更新) の実行権限。
-   **AWS CloudWatch Logs:**
    -   ログ出力のための標準的な権限。 