# タスク一覧生成機能 実装方針書

## 1. 概要

本ドキュメントは、既存の「transcript-minute」アプリケーションに「タスク一覧生成」機能を追加するための実装方針を定義する。

この機能は、ユーザーがアップロードした会議の文字起こしテキスト、関連情報ファイル(xlsx)、タスク定義ファイル(xlsx)を基に、Dify APIを活用して具体的なタスク一覧(xlsx)を生成し、ユーザーがダウンロードできるようにするものである。

## 2. アーキテクチャ

既存の非同期処理アーキテクチャを踏襲し、`generationProcessor` (API Gateway Lambda) と `generationWorker` (ワーカーLambda) を拡張して実装する。

- **フロントエンド**: ユーザーからのファイルアップロードと処理開始リクエストを担当。
- **Amazon S3**: ユーザーがアップロードしたファイル、およびDifyが生成した結果ファイルを保存する。
- **generationProcessor (Lambda)**: フロントエンドからのリクエストを受け付け、検証し、`generationWorker`を非同期で呼び出す。
- **generationWorker (Lambda)**: 実際のDify APIとの連携、ファイルのダウンロード・アップロード、AppSyncでのステータス更新など、時間のかかる処理を実行する。
- **AWS AppSync**: 処理ステータスをリアルタイムでフロントエンドに通知するために使用する。
- **Dify API**: 3つの入力ファイルからタスク一覧(xlsx)を生成する。

## 3. 実装ステップ

### ステップ1: データモデルの拡張 (GraphQL Schema)

`amplify/backend/api/transcriptminute/schema.graphql` の `ProcessingSession` モデルに、タスク一覧生成機能のためのフィールドを追加する。

```graphql
type ProcessingSession @model @auth(rules: [
  { allow: owner, ownerField: "owner", operations: [create, update, delete, read] },
  { allow: private, operations: [read] }
]) {
  # ... 既存のフィールド ...
  
  # 追加フィールド
  taskFileKey: String          # ユーザーがアップロードしたタスク定義ファイル(task.xlsx)のS3キー
  informationFileKey: String   # ユーザーがアップロードした関連情報ファイル(information.xlsx)のS3キー
  tasksKey: String             # Difyが生成したタスク一覧ファイル(xlsx)のS3キー
  tasksStatus: String          # タスク生成処理のステータス (例: PENDING, PROCESSING_TASKS, TASKS_COMPLETED, TASKS_FAILED)
}
```

### ステップ2: フロントエンドの改修 (`TranscriptionResult.tsx`)

1.  **UIの追加**:
    -   `TranscriptionResult.tsx` コンポーネント内の、既存の「箇条書き・議事録生成」ボタンの近くに、「タスク定義ファイル(task.xlsx)」と「関連情報ファイル(information.xlsx)」をアップロードするためのファイル選択UIを追加する。
2.  **状態管理**:
    -   `TranscriptionResult.tsx` に、`taskFile` と `informationFile` の状態を管理するための `useState` フックを追加する。
3.  **ファイルアップロードとAPI呼び出し処理**:
    -   「タスク一覧生成」ボタン（または既存ボタンの拡張）がクリックされた際のハンドラ関数を実装する。この関数は以下の処理を行う。
        1.  `taskFile` と `informationFile` が選択されていることを確認する。
        2.  Amplifyの `uploadData` を使用して、これら2つのファイルを **`outputBucket`** にアップロードする。この際、Lambdaトリガーの誤作動を防ぐため、**バケット名を明示的に指定する**。キーには、他のファイルと競合しないよう `private/{identityId}/{sessionId}/` プレフィックスを付与する。
            ```typescript
            // 例: uploadDataの呼び出し
            await uploadData({
              key: `private/${identityId}/${sessionId}/task.xlsx`, // 完全なS3キー
              data: taskFile,
              options: {
                bucket: process.env.NEXT_PUBLIC_OUTPUT_BUCKET, // outputBucketを明示
                contentType: taskFile.type,
              }
            }).result;
            ```
        3.  アップロード成功後、返されたS3オブジェクトキー (`taskFileKey`, `informationFileKey`) を取得する。
        4.  `updateProcessingSession` GraphQLミューテーションを呼び出し、`ProcessingSession`テーブルに `taskFileKey` と `informationFileKey` を保存する。
        5.  最後に、`generationProcessor`のエンドポイント (`/generate/process-all`) を呼び出す。リクエストボディに以下を含める。
            ```json
            {
              "sessionId": "...",
              "transcript": "...", // 編集済みの文字起こしテキスト
              "processingTypes": ["tasks"], 
              "taskFileKey": "s3-key-for-task.xlsx", // ステップ3で取得したキー
              "informationFileKey": "s3-key-for-information.xlsx" // ステップ3で取得したキー
            }
            ```
4.  **ステータス監視と結果の表示・ダウンロード**:
    -   AppSync Subscriptionを利用して、`ProcessingSession`の`tasksStatus`フィールドの変更を監視する。
    -   `TranscriptionResult.tsx`内に、「タスク一覧」という新しいセクションを追加する。箇条書きや議事録と異なり、ファイル内容のプレビューは表示しない。
    -   `tasksStatus`が`TASKS_COMPLETED`になったら、「タスク一覧」セクション内に、生成されたxlsxファイルをダウンロードするためのボタンを有効化する。
    -   ダウンロードボタンがクリックされたら、`tasksKey`を元にS3から署名付きURLを取得し、生成されたタスク一覧(xlsx)をダウンロードさせる。

5.  **一括ダウンロード機能への統合**:
    -   既存の「一括ダウンロード」機能を修正する。
    -   `tasksKey`が存在し、ダウンロード可能な状態の場合、生成されたタスク一覧(xlsx)もZIPファイルに含めるように処理を追加する。

### ステップ3: バックエンドの改修 (`generationProcessor`)

1.  **リクエストの検証**:
    -   `processingTypes`に`"tasks"`が含まれている場合、リクエストボディに`taskFileKey`と`informationFileKey`が存在することを検証する。
2.  **ペイロードの構築**:
    -   検証後、`generationWorker`を呼び出すためのペイロードに`taskFileKey`と`informationFileKey`を追加する。

### ステップ4: バックエンドの改修 (`generationWorker` と `difyClient`)

1.  **処理分岐**:
    -   ワーカーのメイン処理で、ペイロードの`processingTypes`に`"tasks"`が含まれている場合のロジックを追加する。
2.  **ステータス更新 (処理開始)**:
    -   `updateProcessingSession`ミューテーションを呼び出し、`tasksStatus`を`PROCESSING_TASKS`に更新する。
3.  **Dify連携クライアント (`lib/difyClient.js`) の新規実装**:
    -   Dify APIとの複雑な連携を担う新しい関数 `generateTasks` を実装する。この関数は以下の内部ステップを実行する。
        1.  **入力ファイルの準備**:
            -   S3から`taskFileKey`と`informationFileKey`で指定されたxlsxファイルをダウンロードする。
            -   ペイロードから受け取った`transcript`テキストを、`transcription.txt`としてメモリ上にファイルオブジェクトとして準備する。
        2.  **Difyへのファイルアップロード**:
            -   準備した3つのファイル (`task.xlsx`, `information.xlsx`, `transcription.txt`) を、DifyのファイルアップロードAPI (`/v1/files/upload`) を使って個別にアップロードする。
            -   各アップロードから返却される`upload_file_id`を保持する。
        3.  **DifyのメインAPI呼び出し**:
            -   3つの`upload_file_id`を入力として、Difyのメイン処理（チャット補完など）を実行するAPIを呼び出す。
            -   この際、`stream: true`を指定し、レスポンスをストリーミングで受け取る。
        4.  **ストリーミングレスポンスの処理**:
            -   レスポンスストリームを一行ずつ処理する。
            -   `event: message_end` または `event: node_finished` のJSONデータを待ち受ける。
            -   該当イベントデータ内の`files[0].url`から、生成された結果ファイル(xlsx)のダウンロード用URLを抽出する。
        5.  **結果ファイルのダウンロード**:
            -   抽出したURLにHTTP GETリクエストを送信し、xlsxファイルのバイナリデータを取得する。
4.  **結果の保存とステータス更新**:
    -   `difyClient`から受け取ったxlsxファイルのバイナリデータを、S3の出力バケットにアップロードする。
    -   `updateProcessingSession`ミューテーションを呼び出し、`tasksStatus`を`TASKS_COMPLETED`に、`tasksKey`にアップロードしたS3オブジェクトキーを設定する。
5.  **エラーハンドリング**:
    -   上記プロセスのいずれかの段階でエラーが発生した場合は、`tasksStatus`を`TASKS_FAILED`に更新し、エラー内容をCloudWatch Logsに記録する。

## 4. Dify API レスポンスに関する注記

-   Difyからの応答は、複数のJSONオブジェクトが連続するストリーミング形式で返却される。
-   最終的な成果物であるxlsxファイルのダウンロードURLは、`event: message_end`または`event: node_finished`に含まれる`files`配列内の`url`プロパティから取得するのが最も確実である。
-   `answer`フィールドに含まれるMarkdownリンク(`[...]()`)をパースする方法も考えられるが、専用の`files`フィールドを利用する方が安定性が高い。

## 5. その他

-   `generationWorker`のLambda実行ロールに、ユーザーがアップロードしたファイル（入力）と生成されたタスク一覧（出力）をS3バケットから読み書きするためのIAM権限 (`s3:GetObject`, `s3:PutObject`) を追加する必要がある。 