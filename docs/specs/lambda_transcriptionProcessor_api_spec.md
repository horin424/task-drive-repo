# Lambda関数: transcriptionProcessor 仕様書

## 1. 概要

このLambda関数 (`transcriptionProcessor`) は、S3バケットに音声または動画ファイルがアップロードされたことをトリガーとして起動します。起動後、`ProcessingSession`テーブルからセッション情報を取得し、ステータスを「処理中」に更新します。その後、外部の文字起こしAPI (ElevenLabsまたはDify) を呼び出し、得られた結果を指定の出力用S3バケットに保存し、最後に`ProcessingSession` のステータスを更新します。

## 2. トリガー

- **サービス:** AWS S3
- **イベントタイプ:** `s3:ObjectCreated:*`
- **バケット:** Amplifyが管理するプライベートストレージ入力用バケット (例: `transcriptminutee59b87753a5a45619813e746bd1335d4d612-dev`)
- **プレフィックス:** `private/`

## 3. 入力 (S3イベントペイロード)

標準的なS3 `ObjectCreated` イベントのJSONを受け取ります。Lambda関数は主に以下の情報を使用します。

```json
{
  "Records": [
    {
      "s3": {
        "bucket": {
          "name": "transcriptminute...-dev" 
        },
        "object": {
          "key": "private/us-east-1:xxxx/yyyy-zzzz/audio.mp3" 
        }
      }
    }
  ]
}
```

- `Records[0].s3.bucket.name`: トリガーとなったS3バケット名。
- `Records[0].s3.object.key`: アップロードされたオブジェクトのキー。このキーから `identityId` と `sessionId` を抽出します。
    - キーのフォーマット: `private/<Cognito Identity ID>/<Session ID>/<Original Filename>`

## 4. 処理フロー

1.  **イベント受信と情報抽出:** S3イベントからバケット名とオブジェクトキー (`key`) を取得し、`key` から `sessionId` と `identityId` を抽出します。
2.  **セッション情報取得:** AppSyncクライアント (`lib/graphqlApi.js`) を使用し、`getProcessingSessionBySessionId` クエリで `sessionId` に紐づくセッション情報を取得します。この時、文字起こしに使用する `language` と、出力ファイル名生成に使う `fileName` を取得します。
3.  **ステータス更新 (処理開始):** `updateProcessingSession` ミューテーションを呼び出し、`ProcessingSession` のステータスを `'PROCESSING_TRANSCRIPTION'` に更新します。
4.  **署名付きURL生成:** S3クライアントを使用し、アップロードされたオブジェクトへの一時的な署名付きURLを生成します。これは外部APIがファイルにアクセスするために使用されます。
5.  **APIキー取得:** 環境変数 `SECRETS_MANAGER_SECRET_ARN` を使用し、Secrets Managerから外部APIのキーを取得します。
6.  **外部API呼び出し:** `lib/transcriptionApi.js` の `processTranscription` 関数を呼び出します。
    -   環境変数 `API_PROVIDER`（デフォルト: `elevenlabs`）の値に応じて処理を分岐し、ElevenLabsまたはDifyのAPIにリクエストを送信します。
    -   APIレスポンスから、音声長 (`audioLengthSeconds`) と、`words` 配列を中心とした中間JSON（タイムスタンプと話者IDを含む）を返します。
7.  **結果保存:** APIから得られた中間JSON（`schema_version`, `audio_duration`, `language`, `preprocessing_info`, `words`）をJSON形式で、出力用S3バケットに保存します。
    -   **バケット:** 環境変数 `S3_OUTPUT_BUCKET` で指定されたバケット。
    -   **キー:** `private/<identityId>/<sessionId>/文字起こし_{fileName}.json`
8.  **ステータス更新 (成功時):** `markTranscriptionComplete` 関数を呼び出し、`updateProcessingSession` ミューテーションで以下の情報を更新します（同関数内で`decreaseOrganizationRemainingMinutes`により残り時間をアトミックに減算）。
    -   `status`: `'PENDING_SPEAKER_EDIT'`
    -   `transcriptKey`: ステップ7で保存したS3キー
    -   `audioLengthSeconds`: ステップ6で取得した音声長 (秒)
    -   `transcriptFormat`: `'JSON'`
9.  **ステータス更新 (失敗時):** 処理中にエラーが発生した場合、`catch` ブロックで捕捉されます。`markTranscriptionFailed` 関数が呼び出され、`updateProcessingSession` ミューテーションでステータスを `'TRANSCRIPTION_FAILED'` に、`errorMessage` を設定して更新します。

## 5. 出力

- **S3:**
    - `private/<identityId>/<sessionId>/文字起こし_{fileName}.json` というキーで、指定の出力バケットに文字起こし結果 (JSON形式) が保存されます。
    ```json
    {
      "schema_version": "1.0",
      "audio_duration": 123.0,
      "language": "ja",
      "preprocessing_info": null,
      "words": [
        { "text": "こんにちは", "start": 0.5, "end": 1.2, "speaker_id": "speaker_1" }
      ]
    }
    ```
- **AppSync:**
    - `updateProcessingSession` ミューテーションが呼び出され、DynamoDB内の `ProcessingSession` テーブルの対応するレコードが更新されます。
- **Lambda戻り値:**
    - 処理結果（成功または失敗）を示すステータスコードとメッセージを含むJSONオブジェクトを返します。

## 6. 主要な環境変数

| 変数名 | 説明 |
| :--- | :--- |
| `ENV` | 現在のデプロイ環境 |
| `REGION` | AWSリージョン |
| `API_TRANSCRIPTMINUTE_GRAPHQLAPIENDPOINTOUTPUT` | AppSync APIのエンドポイントURL |
| `API_TRANSCRIPTMINUTE_GRAPHQLAPIIDOUTPUT` | AppSync APIのID |
| `S3_OUTPUT_BUCKET` | 文字起こし結果を保存する**出力用**S3バケット名 |
| `API_SECRET_ARN` | APIキーを保存しているSecrets ManagerのシークレットARN |
| `DIFY_API_URL` | Dify APIのエンドポイントURL |
| `API_PROVIDER` | 使用する文字起こしAPI (`elevenlabs` または `dify`) |
| `LOG_LEVEL` | ログレベル（`info`/`debug`） |

## 7. IAM権限 (主要なもの)

Lambda実行ロールには以下の権限が必要です。

- **AWS S3:**
    - `s3:GetObject`: トリガーとなった**入力バケット**からのオブジェクト読み取り
    - `s3:PutObject`: 文字起こし結果の**出力バケット**への書き込み
- **AWS Secrets Manager:**
    - `secretsmanager:GetSecretValue`: 指定されたシークレットの読み取り
- **AWS AppSync:**
    - `appsync:GraphQL`: `Query` (セッション情報取得) および `Mutation` (ステータス更新) の実行権限
- **AWS CloudWatch Logs:**
    - ログ出力のための標準的な権限

## 8. エラーハンドリング

- **リトライ:** 外部API呼び出しの自動リトライ処理は実装されていません。
- **ステータス更新:** `try...catch` ブロックで関数全体の実行時エラーを捕捉し、エラー発生時には`ProcessingSession` のステータスを `TRANSCRIPTION_FAILED` に更新します。
- **DLQ (Dead-Letter Queue):** Lambda関数にはDLQが設定されており、処理が完全に失敗したイベントは後から調査・再処理が可能です。 