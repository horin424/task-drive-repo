# Lambda関数の環境変数一覧

このドキュメントでは、本アプリケーションのLambda関数で使用されている環境変数の一覧と説明を提供します。環境変数の一部はAmplifyによって自動的に設定され、一部は手動で設定が必要です。

## アーキテクチャ概要

本システムのバックエンドは、役割の異なる複数のLambda関数で構成されています。

-   **`transcriptionProcessor`**: S3へのファイルアップロードをトリガーに起動し、外部APIを利用して文字起こし処理を実行します。
-   **`generationProcessor`** (エンドポイント用Lambda): API Gatewayからのリクエストを受け付け、リクエスト内容を検証した後、`generationWorker`を非同期で呼び出します。
-   **`generationWorker`** (ワーカー用Lambda): `generationProcessor`から呼び出され、時間のかかるコンテンツ生成（箇条書き、議事録、タスク一覧）を実行します。

## `transcriptionProcessor` Lambda

S3トリガーで文字起こしを実行するLambdaです。

| 環境変数名 | 説明 | 設定方法 |
| :--- | :--- | :--- |
| `ENV` | 現在のデプロイ環境 (e.g., `dev`) | Amplify 自動設定 |
| `REGION` | AWSリージョン (e.g., `us-east-1`) | Amplify 自動設定 |
| `API_TRANSCRIPTMINUTE_GRAPHQLAPIENDPOINTOUTPUT` | AppSync GraphQL APIのエンドポイントURL | Amplify 自動設定 |
| `API_TRANSCRIPTMINUTE_GRAPHQLAPIIDOUTPUT` | AppSync GraphQL APIのID | Amplify 自動設定 |
| `API_TRANSCRIPTMINUTE_ORGANIZATIONTABLE_NAME` | Organizationテーブル名 | Amplify 自動設定 |
| `API_TRANSCRIPTMINUTE_PROCESSINGSESSIONTABLE_NAME` | ProcessingSessionテーブル名 | Amplify 自動設定 |
| `STORAGE_S31D11B5D9_BUCKETNAME` | 入力ファイル用S3バケット名 | Amplify 自動設定 |
| `S3_OUTPUT_BUCKET` | 出力結果用S3バケット名 | 手動設定 (`amplify update function`) |
| `API_SECRET_ARN` | APIキーを保存しているSecrets ManagerのARN | 手動設定 (`amplify update function`) |
| `DIFY_API_URL` | Dify APIのエンドポイントURL | 手動設定 (`amplify update function`) |
| `API_PROVIDER` | 使用する文字起こしAPI (`elevenlabs` or `dify`) | 手動設定 (`amplify update function`) |
| `LOG_LEVEL` | ログレベル（`info`/`debug`） | 手動設定 |

---

## `generationProcessor` Lambda (エンドポイント用)

API Gatewayからのリクエストを処理し、`generationWorker`を呼び出すLambdaです。

| 環境変数名 | 説明 | 設定方法 |
| :--- | :--- | :--- |
| `ENV` | 現在のデプロイ環境 | Amplify 自動設定 |
| `REGION` | AWSリージョン | Amplify 自動設定 |
| `FUNCTION_GENERATIONWORKER_NAME` | 呼び出すワーカーLambda (`generationWorker`) の関数名 | 手動設定 (CloudFormationテンプレート) |
| `LOG_LEVEL` | ログレベル（`info`/`debug`） | 手動設定 |

**注:** このLambdaは外部APIを直接呼び出さないため、APIキーや関連URLの環境変数は不要です。

---

## `generationWorker` Lambda (ワーカー用)

時間のかかるコンテンツ生成をバックグラウンドで実行するLambdaです。

| 環境変数名 | 説明 | 設定方法 |
| :--- | :--- | :--- |
| `ENV` | 現在のデプロイ環境 | Amplify 自動設定 |
| `REGION` | AWSリージョン | Amplify 自動設定 |
| `API_TRANSCRIPTMINUTE_GRAPHQLAPIENDPOINTOUTPUT` | AppSync GraphQL APIのエンドポイントURL | Amplify 自動設定 |
| `API_TRANSCRIPTMINUTE_GRAPHQLAPIIDOUTPUT` | AppSync GraphQL APIのID | Amplify 自動設定 |
| `STORAGE_OUTPUTBUCKET_BUCKETNAME` | 出力結果用S3バケット名 | Amplify 自動設定 (Custom Resourceより) |
| `SECRETS_MANAGER_SECRET_ARN` | APIキーを保存しているSecrets ManagerのARN | 手動設定 (`amplify update function`) |
| `DIFY_API_URL` | Dify APIのエンドポイントURL | 手動設定 (`amplify update function`) |
| `LOG_LEVEL` | ログレベル（`info`/`debug`） | 手動設定 |

---

## 環境変数の設定・管理

### Amplify CLIによる設定

`amplify update function` コマンドを使用することで、対話形式でLambda関数の環境変数を設定できます。

```bash
amplify update function

# 1. 更新したい関数 (例: transcriptionProcessor) を選択
# 2. "Environment variables configuration" を選択
# 3. 変数を追加・編集
# 4. 完了後、変更をデプロイ
amplify push
```

### 環境ごとの注意点

-   **Secrets Manager:** 本番環境と開発環境では、異なるシークレットARNを使用することを強く推奨します。シークレットは `transcription-api-keys-{env}` のような命名規則で管理すると良いでしょう。
-   **S3バケット:** 各バケット名 (`STORAGE_...`, `S3_OUTPUT_BUCKET`) は環境ごとにAmplifyが自動でユニークな名前を付与します。

### シークレットに保存するキー

Secrets Managerには、以下のキーと対応するAPIキーの値を保存します。

-   `elevenlabs_api_key`: ElevenLabs の API キー
-   `dify_api_key`: Dify の文字起こし用 API キー
-   `dify_bullet_points_api_key`: Dify の箇条書き生成用 API キー
-   `dify_minutes_api_key`: Dify の議事録生成用 API キー
 -   `dify_tasks_api_key`: Dify のタスク生成用 API キー

## 既知の問題

1. `SECRETS_MANAGER_SECRET_ARN` と `API_SECRET_ARN` の表記ゆれ：
   - transcriptionProcessor は `API_SECRET_ARN` を参照し、generationWorker は `SECRETS_MANAGER_SECRET_ARN` を参照します
   - 運用上は同一のシークレットARNを両方に設定してください（将来的に `SECRETS_MANAGER_SECRET_ARN` に統一予定）