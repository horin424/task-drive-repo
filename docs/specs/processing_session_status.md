# ProcessingSession ステータス定義とライフサイクル

このドキュメントでは、`ProcessingSession` GraphQLオブジェクトの `status` フィールドが取りうる値と、その状態遷移がどのコンポーネント（フロントエンド、各Lambda関数）によって、どのタイミングで引き起こされるかを定義します。

## ステータス定義一覧

| ステータス                 | 説明                                                                                                | 更新主体             |
| :----------------------- | :-------------------------------------------------------------------------------------------------- | :------------------- |
| `UPLOADED`               | フロントエンドでファイルアップロードと`ProcessingSession`レコード作成が完了した初期状態。             | フロントエンド         |
| `PROCESSING_TRANSCRIPTION` | `transcriptionProcessor`が文字起こし処理を開始した状態。                                            | `transcriptionProcessor` |
| `PENDING_SPEAKER_EDIT`   | 文字起こしが完了し、ユーザーによる話者編集を待っている状態。                                        | `transcriptionProcessor` |
| `TRANSCRIPTION_FAILED`   | 文字起こし処理中に回復不能なエラーが発生した状態。                                                  | `transcriptionProcessor` |
| `SPEAKER_EDIT_COMPLETED` | フロントエンドでユーザーが話者編集を完了した状態。コンテンツ生成を開始できる。                        | フロントエンド         |
| `PROCESSING_BULLETS`     | `generationWorker`が箇条書き生成処理を開始した状態。                                                | `generationWorker`     |
| `BULLETS_COMPLETED`      | 箇条書きの生成が成功し、結果がS3に保存された状態。                                                  | `generationWorker`     |
| `BULLETS_FAILED`         | 箇条書きの生成処理中にエラーが発生した状態。                                                        | `generationWorker`     |
| `PROCESSING_MINUTES`     | `generationWorker`が議事録生成処理を開始した状態。                                                  | `generationWorker`     |
| `MINUTES_COMPLETED`      | 議事録の生成が成功し、結果がS3に保存された状態。                                                    | `generationWorker`     |
| `MINUTES_FAILED`         | 議事録の生成処理中にエラーが発生した状態。                                                          | `generationWorker`     |
| `PROCESSING_TASKS`       | `generationWorker`がタスク一覧生成処理を開始した状態。                                              | `generationWorker`     |
| `TASKS_COMPLETED`        | タスク一覧の生成が成功し、結果(xlsx)がS3に保存された状態。                                          | `generationWorker`     |
| `TASKS_FAILED`           | タスク一覧の生成処理中にエラーが発生した状態。                                                      | `generationWorker`     |
| `ALL_COMPLETED`          | `processingTypes`で要求された全てのコンテンツのS3キーが揃った最終状態。                                | `generationWorker`     |
| `ERROR`                  | 予期せぬエラーや設定不備など、特定の処理に分類されないエラー状態。                                  | 各コンポーネント     |

## ステータス遷移のトリガーとタイミング

### 1. フロントエンド (`MediaUploader.tsx`, `TranscriptionResult.tsx`)

1.  **ファイルアップロード完了時 (`MediaUploader.tsx`):**
    *   S3へのファイルアップロードと `createProcessingSession` ミューテーションが成功した直後。
    *   ステータスを **`UPLOADED`** に設定して `ProcessingSession` レコードを作成します。
2.  **話者編集完了時 (`TranscriptionResult.tsx`):**
    *   ユーザーが話者編集を完了し、「保存」ボタンを押した際。
    *   `updateProcessingSession` ミューテーションを呼び出し、ステータスを **`SPEAKER_EDIT_COMPLETED`** に更新します。

### 2. 文字起こしLambda (`transcriptionProcessor`)

*   **前提:** S3へのファイルアップロード完了（`UPLOADED` ステータス）をトリガーとして起動します。

1.  **処理開始時:**
    *   `getProcessingSession` でセッション情報を取得後、外部API呼び出し前にステータスを **`PROCESSING_TRANSCRIPTION`** に更新します。
2.  **処理成功時 (`markTranscriptionComplete`):**
    *   文字起こし結果をS3に保存し、`decreaseOrganizationRemainingMinutes` により利用時間をアトミックに減算した後、ステータスを **`PENDING_SPEAKER_EDIT`** に更新します。
3.  **処理失敗時 (`markTranscriptionFailed`):**
    *   処理中にエラーが発生した場合、ステータスを **`TRANSCRIPTION_FAILED`** に更新します。

### 3. コンテンツ生成Lambda (二段構成)

*   **前提:** フロントエンドからAPI Gateway (`/generate/process-all`) 経由で `generationProcessor` が呼び出され、それが `generationWorker` を非同期で起動します。ステータス更新の責務は**`generationWorker`**が持ちます。

#### `generationProcessor` (エンドポイント用)
*   このLambdaはリクエストの受付と`generationWorker`の呼び出しのみを行い、**`ProcessingSession`のステータスを更新しません。**

#### `generationWorker` (ワーカー用)
*   ペイロード内の`processingTypes`配列 (`["bullets", "minutes", "tasks"]`) に従ってループ処理を行います。

1.  **箇条書き生成プロセス:**
    *   **処理開始時:** `updateProcessingSession`でステータスを **`PROCESSING_BULLETS`** に更新します。
    *   **成功時:** 結果をS3に保存後、`updateProcessingSession`でステータスを **`BULLETS_COMPLETED`** に、`bulletPointsKey`を設定して更新します。
    *   **失敗時:** `updateProcessingSession`でステータスを **`BULLETS_FAILED`** に更新します。

2.  **議事録生成プロセス:**
    *   **処理開始時:** `updateProcessingSession`でステータスを **`PROCESSING_MINUTES`** に更新します。
    *   **成功時:** 結果をS3に保存後、`updateProcessingSession`でステータスを **`MINUTES_COMPLETED`** に、`minutesKey`を設定して更新します。
    *   **失敗時:** `updateProcessingSession`でステータスを **`MINUTES_FAILED`** に更新します。

3.  **タスク一覧生成プロセス:**
    *   **処理開始時:** `updateProcessingSession`でステータスを **`PROCESSING_TASKS`** に更新します。
    *   **成功時:** 結果(xlsx)をS3に保存後、`updateProcessingSession`でステータスを **`TASKS_COMPLETED`** に、`tasksKey`を設定して更新します。
    *   **失敗時:** `updateProcessingSession`でステータスを **`TASKS_FAILED`** に更新します。

4.  **最終完了チェック:**
    *   `processingTypes`のすべての処理が完了した後、`getProcessingSession`で最新の状態を確認します。
    *   リクエストされた種類（`processingTypes`）に応じたキー（`bulletPointsKey`, `minutesKey`, `tasksKey`）が存在し、かつ途中で失敗していなければ、ステータスを **`ALL_COMPLETED`** に更新します。
