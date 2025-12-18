# API非同期処理パターンへの移行ガイドライン (二段Lambda構成・集約エンドポイント)

## 1. 背景と目的

現在、箇条書き生成 (`/generate/bullets`) および議事録生成 (`/generate/minutes`) APIは、API Gateway経由で単一のLambda関数 (`generationProcessor`) を同期的に呼び出しています。このLambda関数内の処理（特に外部APIであるDifyへの呼び出し）が長時間に及ぶため、API Gatewayのタイムアウト上限（29秒）を超過し、フロントエンドで504 Gateway Timeoutエラーが発生しています。また、将来的に生成対象のコンテンツが増える可能性も考慮し、拡張性の高い設計が求められます。

この問題を解決し、堅牢でスケーラブルなユーザー体験を提供するため、API呼び出しを非同期処理パターン（二段Lambda構成）に移行し、APIエンドポイントを集約します。

## 2. 設計方針

API Gatewayはリクエストを受け付け後、単一の処理開始エンドポイント（例: `/generate/process-all`）を通じて**エンドポイント用Lambda (Lambda A)** を同期的に呼び出します。エンドポイント用Lambdaはリクエストのバリデーション、処理対象の特定（例: 箇条書き、議事録、その他）を行い、実際の時間のかかる処理は**ワーカーLambda (Lambda B)** に委任します。エンドポイント用Lambdaは、ワーカーLambdaを**非同期で**呼び出し、クライアント（フロントエンド）には即座に応答（HTTP 202 Acceptedなど）を返します。

ワーカーLambdaはバックグラウンドで、ペイロードで指示された種類のコンテンツ生成処理を実行し、処理の進捗・結果はAppSyncを通じて `ProcessingSession` オブジェクトのステータスを更新することでフロントエンドに通知されます。フロントエンドはAppSyncサブスクリプションを利用してこのステータス変更を監視し、UIを適切に更新します。

この構成により、API Gatewayのタイムアウトを回避しつつ、Amplifyの既存のAPI Gatewayプロキシ統合やデプロイフローへの影響を最小限に抑え、将来的な機能拡張にも柔軟に対応できます。

## 3. 主な変更箇所と作業内容

### 3.1. バックエンド Lambda

#### 3.1.1. 新規ワーカーLambda (Lambda B) の作成

*   **名称(例):** `generationWorker`
*   **作成方法:** `amplify add function` コマンドで新しいLambda関数を作成します。
*   **主な処理内容:**
    *   エンドポイント用Lambdaから渡されるペイロード（`sessionId`, `transcript`, `processingTypes` [例: `["bullets", "minutes"]`] など）に基づいて、要求された種類のコンテンツ生成処理を実行します。
    *   現在の `generationProcessor` が行っている主要な処理ロジック（外部API (Dify) へのリクエスト、結果のS3への保存、AppSyncミューテーションによるステータス更新）を、処理タイプに応じて分岐実行できるように移植します。
*   **必要なIAM権限:**
    *   Dify APIへのアクセス権限（Secrets Manager経由でのAPIキー取得など）。
    *   S3バケットへの読み書き権限。
    *   AppSync API (`transcriptminute`) へのアクセス権限 (`appsync:GraphQL` など)。
    *   CloudWatch Logsへの書き込み権限。
*   **タイムアウト設定:** 各処理の最大時間を考慮し、十分なタイムアウト値（最大15分）を設定します。

#### 3.1.2. エンドポイント用Lambda (Lambda A - 現在の `generationProcessor` を改修または新規作成)

*   **名称(例):** `processRequestHandler` (現在の `generationProcessor` を改修する場合、役割が明確になるように名称変更も検討)
*   **主な処理内容:**
    1.  API Gatewayからリクエストペイロード（`sessionId`, `transcript`, 生成したいコンテンツの種類を示す `processingTypes` 配列など）を受け取ります。
    2.  必須パラメータの存在チェックなどの基本的なバリデーションを行います。
    3.  AWS SDKを使用し、**ワーカーLambda (`generationWorker`) を非同期 (`InvocationType: 'Event'`) で呼び出します。** ペイロードには `sessionId`, `transcript`, `identityId`, `fileName`, `processingTypes` などの情報を含めます。
        ```javascript
        // 例: ワーカーLambda呼び出し部分
        import { Lambda } from 'aws-sdk'; // または AWS SDK v3 の @aws-sdk/client-lambda
        const lambda = new Lambda();
        
        const workerPayload = {
          sessionId: receivedSessionId,
          transcript: receivedTranscript,
          identityId: receivedIdentityId,
          fileName: receivedFileName,
          processingTypes: receivedProcessingTypes // 例: ["bullets", "minutes"]
        };

        await lambda.invoke({
          FunctionName: process.env.FUNCTION_GENERATIONWORKER_NAME, // 環境変数でワーカーLambda名を設定
          InvocationType: 'Event',
          Payload: JSON.stringify(workerPayload),
        }).promise();
        ```
    4.  ワーカーLambdaの呼び出し後、API Gatewayに即座に応答（例: HTTP 202 Accepted）を返します。
        ```javascript
        return {
          statusCode: 202, // Accepted
          headers: { /* CORSヘッダーなど */ },
          body: JSON.stringify({ message: "Processing request accepted", sessionId: receivedSessionId })
        };
        ```
*   **必要なIAM権限:**
    *   ワーカーLambda (`generationWorker`) を非同期呼び出しする権限。
    *   AppSync API (`transcriptminute`) へのアクセス権限（`getProcessingSessionByCustomSessionId` で `fileName` 等を取得するため）。
    *   CloudWatch Logsへの書き込み権限。
*   **タイムアウト設定:** 短時間（数秒）で十分です。

### 3.2. API Gateway (`generateapi`)

*   **変更内容 (実施済み/要 `amplify push`):**
    *   既存の `/generate/bullets` と `/generate/minutes` パスは削除されました。
    *   新しい単一のパス `POST /generate/process-all` を作成し、これをエンドポイント用Lambda (`generationProcessor`) にプロキシ統合しました。
    *   新しいパス `/generate/process-all` の認証設定:
        *   アクセス制限: あり (IAM認証)
        *   Cognitoユーザーグループ `Admin` および `Users` に所属する認証済みユーザーに対し、`create` (POST) 操作を許可。
*   メソッドレスポンスとして `202 Accepted` を定義します (これはAmplify CLIの標準機能では直接設定できない場合があり、必要に応じてAPI GatewayコンソールまたはカスタムCloudFormationでの対応を検討)。

### 3.3. フロントエンド

#### 3.3.1. API呼び出しユーティリティ (`src/utils/difyApi.ts`)

*   **対象関数:** `generateBothContents` (または新しい汎用的な関数名に変更)
*   **変更内容:**
    *   この関数は、API Gatewayの新しい単一エンドポイント（例: `/generate/process-all`）を呼び出します。
    *   リクエストボディには、`transcript`, `sessionId` に加え、生成したいコンテンツの種類を示す配列（例: `processingTypes: ["bullets", "minutes"]`）を含めます。
    *   API Gatewayからの即時応答 (202 Acceptedなど) を受け取ります。
    *   関数は、リクエストが正常に受け付けられたことを示すPromiseを返します。
        ```typescript
        // 例: 修正後の generateBothContents
        export const generateContents = async (transcript: string, sessionId: string, processingTypes: string[]): Promise<{ success: boolean, message?: string }> => {
          try {
            console.log('コンテンツ一括生成リクエスト送信 (非同期)');
            const restOperation = post({
              apiName: "generateapi", 
              path: "/generate/process-all", // 新しい集約エンドポイント
              options: { body: { transcript, sessionId, processingTypes } }
            });
            const response = await restOperation.response;
            if (response.statusCode === 202) {
              console.log('コンテンツ生成リクエスト受付完了');
              return { success: true, message: (await response.body.json())?.message };
            } else {
              console.error('コンテンツ生成リクエスト受付失敗:', response);
              throw new Error(`API request failed with status ${response.statusCode}`);
            }
          } catch (error) { /* ... */ }
        };
        ```

#### 3.3.2. 結果表示コンポーネント (`src/components/TranscriptionResult.tsx`)

*   **変更内容 (実施済み/要テスト):**
    *   `src/utils/difyApi.ts` から新しい `generateContents` 関数をインポートするように修正しました。
    *   既存の `generateBothContents` 関数の呼び出し箇所 (主に `handleGenerateContents` イベントハンドラ内) を、`generateContents` 関数の呼び出しに置き換えました。この際、`processingTypes` 引数として `["bullets", "minutes"]` を渡すようにしています。
    *   `generateContents` の戻り値 (`{ success: boolean, message?: string }`) をハンドリングし、処理受付の成功/失敗に応じてユーザーにトースト通知を表示し、UIのローディング状態を制御するように修正しました。
    *   `currentSession` state を削除し、propsとして渡される `session` を直接参照するように変更し、Linterエラーを解消しました。
    *   UIは「処理受付完了」のメッセージを表示後、実際の処理結果はAppSyncサブスクリプション経由で非同期に反映されることを前提としたロジックになっています (この部分は既存ロジックを維持)。

#### 3.3.3. アップローダーコンポーネント (`src/components/MediaUploader.tsx`)

*   **変更内容:** サブスクリプション処理は現状維持。`currentSession` の更新を通じて `TranscriptionResult` に状態を伝播します。

## 4. ユーザー体験 (UX) の変更点

*   「生成」ボタンクリック後、UIはすぐに「処理を受け付けました。完了までお待ちください」といったメッセージと共にローディング状態に変わります。
*   処理の進捗や最終的な結果は、バックグラウンド処理の完了に伴い、AppSyncサブスクリプションを通じて非同期にUIに反映されます。

## 5. テスト項目

*   API Gatewayの新しいエンドポイント (`/generate/process-all`) がエンドポイント用Lambdaに正しくルーティングされること。
*   エンドポイント用LambdaがワーカーLambdaを非同期で正しく呼び出し、適切なペイロード（`processingTypes` を含む）を渡せること。
*   エンドポイント用LambdaがAPI Gatewayに即座に `202 Accepted` を返すこと。
*   ワーカーLambdaがペイロードの `processingTypes` に基づいて、要求された処理（箇条書き、議事録など）を実行し、`ProcessingSession` のステータスを期待通り更新すること。
*   フロントエンドがAppSyncサブスクリプション経由で全てのステータス変更を検知し、UIを適切に更新すること。
*   エラーハンドリング（ワーカーLambdaでの処理失敗、エンドポイント用Lambdaでの呼び出し失敗など）。
*   各Lambdaのタイムアウト設定が適切であること。

## 付録: Lambda関数 `generationWorker` の設定詳細 (計画と実施)

このセクションは、`generationWorker` Lambda関数の設計と実装に関する詳細な設定と方針をまとめたものです。

### 1. 基本情報

*   **関数名:** `generationWorker`
*   **役割:** エンドポイント用Lambdaから非同期で呼び出され、実際の時間のかかるコンテンツ生成処理（Dify API呼び出し、S3への保存、AppSyncでのステータス更新）を実行するワーカーLambda。
*   **ランタイム:** NodeJS (CloudFormationテンプレート上は `nodejs18.x`、ユーザー確認済み)
*   **テンプレート:** Hello World
*   **パッケージマネージャー:** NPM
*   **依存ライブラリ (実装済み):**
    *   `axios`: Dify API呼び出し用。
    *   `node-fetch`: AppSync API呼び出し用。

### 2. `amplify add function` 時の主な設定値 (実施済み)

*   **高度な設定:** Yes
*   **他リソースへのアクセス:** Yes
    *   **API (`transcriptminute`):**
        *   許可オペレーション: `Mutation` (処理結果をAppSyncに通知するため)
    *   **Custom (`outputBucket` - S3バケットを想定):**
        *   許可オペレーション: `create`, `read` (生成物のS3保存と読み込みのため)
*   **定期的な呼び出し:** No
*   **Lambdaレイヤー:** No (現時点)
*   **環境変数 (CLI初期設定時):** No (現時点)
*   **シークレット値 (CLI初期設定時):** No (現時点)
*   **ローカルでの関数編集:** Yes

### 3. IAM権限 (設定済み/要 `amplify push`)

*   **Dify APIへのアクセス権限 (Secrets Manager経由):**
    *   **Secrets ManagerシークレットARN:** `arn:aws:secretsmanager:us-east-1:006985033268:secret:transcription-api-keys-dev-DIH7Cu`
    *   **必要な権限:** `secretsmanager:GetSecretValue` を上記ARNに対して許可。
    *   **設定方法:** `amplify/backend/function/generationWorker/custom-policies.json` にポリシーを記述済み。
*   **S3バケットへの読み書き権限:**
    *   **対象バケット:** `outputBucket` (環境変数 `STORAGE_OUTPUTBUCKET_BUCKETNAME` で参照)
    *   **現状:** `create`, `read` 権限を設定済み (CLI初期設定時)。
*   **AppSync API (`transcriptminute`) へのアクセス権限:**
    *   **現状:** `transcriptminute` APIに対して `Mutation` 権限を設定済み (CLI初期設定時)。Lambda実行ロールに `appsync:GraphQL` 権限が付与される。
*   **CloudWatch Logsへの書き込み権限:**
    *   **現状:** Lambdaの基本的な実行ロールにデフォルトで含まれる。

### 4. 環境変数 (設定済み/要 `amplify push`)

*   **Amplify自動設定:**
    *   `API_TRANSCRIPTMINUTE_GRAPHQLAPIENDPOINTOUTPUT` (AppSyncエンドポイントURL)
    *   `API_TRANSCRIPTMINUTE_GRAPHQLAPIIDOUTPUT` (AppSync API ID)
    *   `ENV`
    *   `REGION`
    *   `STORAGE_OUTPUTBUCKET_BUCKETNAME` (S3出力バケット名)
*   **`amplify update function` で手動設定済み:**
    *   `SECRETS_MANAGER_SECRET_ARN`: `arn:aws:secretsmanager:us-east-1:006985033268:secret:transcription-api-keys-dev-DIH7Cu`
    *   `DIFY_API_URL`: `https://dev.gpt-incbot.com/v1` (ユーザー指定の開発用エンドポイント)

### 5. タイムアウト設定 (設定済み/要 `amplify push`)

*   **設定値:** 900秒 (15分)
*   **設定方法:** `amplify/backend/function/generationWorker/generationWorker-cloudformation-template.json` の `Timeout` プロパティを `900` に編集済み。

### 6. ヘルパーファイルの利用方針 (実装済み)

*   `generationProcessor` の `src/lib/difyClient.js` と `src/lib/graphqlClient.js` を `generationWorker/src/lib/` にコピーし、一部修正して利用済み。
    *   `graphqlClient.js` 内の `APPSYNC_API_URL` の参照は `process.env.API_TRANSCRIPTMINUTE_GRAPHQLAPIENDPOINTOUTPUT` に修正済み。

### 7. `generationWorker` の処理フロー概要 (実装済み)

1.  **入力ペイロード:** エンドポイントLambdaから `sessionId`, `transcript`, `identityId`, `processingTypes` を受け取ります。
2.  **初期処理:**
    *   `graphqlClient.getProcessingSessionByCustomSessionId(sessionId)` を使用して、AppSyncから現在のセッション情報（特に `id` as `appSyncRecordId`, `fileName`）を取得します。
    *   `difyClient.getApiKeys()` を使用して、`SECRETS_MANAGER_SECRET_ARN` からDify APIキー群を取得します。
3.  **各処理タイプの実行 (processingTypes配列をループ):**
    *   現在の処理タイプ (`type`: "bullets" または "minutes") に応じたステータス (`PROCESSING_BULLETS` / `PROCESSING_MINUTES`) で `graphqlClient.updateProcessingSession()` を呼び出し、処理中であることを記録します。
    *   **Dify API呼び出し:**
        *   `bullets` の場合: `difyClient.generateBulletPoints(transcript, apiKeys.dify_bullet_points_api_key, DIFY_API_URL, identityId)`
        *   `minutes` の場合: `difyClient.generateMinutes(transcript, apiKeys.dify_minutes_api_key, DIFY_API_URL, identityId)`
    *   **S3への保存:**
        *   `baseFilename`: AppSyncから取得した `fileName` の拡張子を除いた部分。
        *   S3キー (例): `private/${identityId}/${sessionId}/箇条書き_${baseFilename}.txt`
        *   S3バケット: `STORAGE_OUTPUTBUCKET_BUCKETNAME`
    *   **AppSyncステータス更新 (完了):** 処理タイプに応じた完了ステータス (`BULLETS_COMPLETED` / `MINUTES_COMPLETED`) とS3キーで `graphqlClient.updateProcessingSession()` を呼び出します。
    *   **エラーハンドリング:** 各ステップでエラーが発生した場合、適切な失敗ステータス (`BULLETS_FAILED` / `MINUTES_FAILED`) で `graphqlClient.updateProcessingSession()` を呼び出し、エラーをログに記録します。
4.  **全処理タイプ完了後の処理:**
    *   再度 `graphqlClient.getProcessingSessionByCustomSessionId(sessionId)` を呼び出し、両方の成果物 (bulletsKey, minutesKey) が存在するか確認します。
    *   両方存在しかつエラーが発生していなければ、ステータスを `ALL_COMPLETED` として `graphqlClient.updateProcessingSession()` を呼び出します。

## 付録: Lambda関数 `generationProcessor` (エンドポイント用) の設定詳細 (計画と実施)

このセクションは、`generationProcessor` Lambda関数 (エンドポイント用Lambdaとして改修) の設計と実装に関する詳細な設定と方針をまとめたものです。

### 1. 基本情報 (改修後)

*   **関数名:** `generationProcessor`
*   **役割:** API Gatewayからのリクエストを受け付け、入力ペイロードを検証し、必要な情報を付加して `generationWorker` Lambdaを非同期で呼び出す。
*   **ランタイム:** NodeJS (既存のものを流用)

### 2. IAM権限 (設定済み/要 `amplify push`)

*   **`generationWorker` Lambda関数への `lambda:InvokeFunction` 権限:**
    *   **設定方法:** `amplify/backend/function/generationProcessor/custom-policies.json` にポリシーを記述済み。
    *   **対象リソース:** `generationWorker-<env>` (CloudFormationパラメータ `pGenerationWorkerName` を経由して動的に解決)。
*   **AppSync API (`transcriptminute`) への `appsync:GraphQL` (Query) 権限:**
    *   **目的:** `fileName` を含むセッション情報を `getProcessingSessionByCustomSessionId` で取得するため。
    *   **設定方法:** 既存の権限設定でカバーされている想定 (Amplifyが付与した `AmplifyResourcesPolicy` 内)。もし不足していれば `custom-policies.json` に追加が必要。
*   **CloudWatch Logsへの書き込み権限:**
    *   **現状:** Lambdaの基本的な実行ロールにデフォルトで含まれる。
*   **不要になった権限 (注意点):**
    *   Secrets Managerへのアクセス権限 (Dify APIキー取得は `generationWorker` が担当)。
    *   S3バケットへの直接の読み書き権限 (S3操作は `generationWorker` が担当)。
    *   AppSync APIへの `Mutation` 権限 (ステータス更新は `generationWorker` が担当)。
    *   これらは `amplify update function` の対話で可能な範囲で解除、またはCloudFormationテンプレート (`generationProcessor-cloudformation-template.json`) の `AmplifyResourcesPolicy` から手動で関連記述を削除することを推奨 (ただし慎重に)。

### 3. 環境変数 (設定済み/要 `amplify push`)

*   **Amplify自動設定:**
    *   `API_TRANSCRIPTMINUTE_GRAPHQLAPIENDPOINTOUTPUT`
    *   `API_TRANSCRIPTMINUTE_GRAPHQLAPIIDOUTPUT`
    *   `ENV`
    *   `REGION`
    *   (その他、既存で `generationProcessor` が利用していたものがあればそれらも継続)
*   **手動設定 (CloudFormationテンプレート編集経由):**
    *   `FUNCTION_GENERATIONWORKER_NAME`: 呼び出す `generationWorker` Lambda関数の名前 (`generationWorker-<env>`)。
        *   **設定方法:** `generationProcessor-cloudformation-template.json` の `Parameters` に `pGenerationWorkerName` を追加し、`Environment.Variables` でこれを参照。`parameters.json` で `pGenerationWorkerName` の値を `Fn::Join` で動的に設定済み。
*   **不要になった環境変数:**
    *   `SECRETS_MANAGER_SECRET_ARN`
    *   `DIFY_API_URL`
    *   `S3_OUTPUT_BUCKET` (直接S3を操作しないため)
    *   これらは `generationProcessor-cloudformation-template.json` の `Environment.Variables` から削除することを推奨。

### 4. `generationProcessor` の処理フロー概要 (改修済み)

1.  API Gatewayからリクエスト (`sessionId`, `transcript`, `processingTypes` 等) を受信。
2.  `identityId` を取得。
3.  必須パラメータを検証。
4.  `getProcessingSessionByCustomSessionId(sessionId)` でAppSyncから `fileName` を取得。
5.  `generationWorker` Lambdaに渡すペイロード (`sessionId`, `transcript`, `identityId`, `fileName`, `processingTypes`) を作成。
6.  `lambda.invoke()` を使用して `generationWorker` を非同期 (`InvocationType: 'Event'`) で呼び出す。
7.  クライアントに `202 Accepted` を返す。

---