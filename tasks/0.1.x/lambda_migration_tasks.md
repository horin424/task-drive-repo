# Lambda移行実装タスクリスト

このドキュメントは、外部API（文字起こし・コンテンツ生成）呼び出し処理をAWS Lambdaに移行するための詳細な実装タスクを管理します。当初、コンテンツ生成処理はAPI Gatewayからのリクエストに対し単一のLambdaで同期的に応答する計画でしたが、外部APIの応答遅延によるタイムアウト問題を解決するため、リクエストを受け付けるエンドポイント用Lambdaと、時間のかかる処理を実行するワーカーLambdaを非同期で連携させる**二段Lambda構成**に変更しました。

## 1. Amplify バックエンド設定

- [x] **Lambda関数の追加:**
    - [x] `amplify add function` を実行し、新しいLambda関数（例: `transcriptionProcessor`) を作成する。
    - [x] ランタイムを選択する (例: Node.js または Python)。
    - [x] 関数テンプレートを選択する (例: Hello World)。
- [x] **S3トリガーの設定:**
    - [x] 作成したLambda関数にS3トリガーを設定する (`amplify update function`)。
    - [x] トリガーとなるS3バケット（音声/動画ファイルがアップロードされるプライベートバケット）を指定する。
    - [x] イベントタイプを `s3:ObjectCreated:*` に設定する。
    - [x] 必要に応じてプレフィックス/サフィックスでトリガー対象を絞り込む。
    - [x] **再帰呼び出し防止のための出力用S3バケット作成 (Custom Resource):**
        - [x] `amplify custom add` を実行し、新しいCustom Resourceを追加する。
        - [x] リソース名 (例: `outputBucket`) と定義方法 (`AWS CDK`) を選択する。
        - [x] 自動生成された `amplify/backend/custom/outputBucket/cdk-stack.ts` を編集し、出力用S3バケットを定義する。
        ```typescript
        import * as cdk from '@aws-cdk/core';
        import * as AmplifyHelpers from '@aws-amplify/cli-extensibility-helper';
        import { AmplifyDependentResourcesAttributes } from '../../types/amplify-dependent-resources-ref';
        import * as s3 from "@aws-cdk/aws-s3";
        import * as iam from '@aws-cdk/aws-iam';

        export class cdkStack extends cdk.Stack {
          constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps, amplifyResourceProps?: AmplifyHelpers.AmplifyResourceProps) {
            super(scope, id, props);
            /* Do not remove - Amplify CLI automatically injects the current deployment environment in this input parameter */
            new cdk.CfnParameter(this, 'env', {
              type: 'String',
              description: 'Current Amplify CLI env name',
            });
            
            const stackName = cdk.Fn.ref("AWS::StackName");
            const stackNameToken = cdk.Fn.split("-", stackName, 6);
            // stackに自動で付与されるランダム文字列を取得する
            const stackID = cdk.Fn.select(3, stackNameToken);
            const amplifyProjectInfo = AmplifyHelpers.getProjectInfo();
            
            // 出力用バケットの名前を設定
            const bucketNamePrefix = `${amplifyProjectInfo.projectName}-output${stackID}`;
            const bucket = new s3.Bucket(this, "OutputBucket", {
              bucketName: `${bucketNamePrefix}-${cdk.Fn.ref('env')}`
            });
            
            // CORSの設定
            bucket.addCorsRule({
              allowedHeaders: ["*"],
              allowedMethods: [
                s3.HttpMethods.GET,
                s3.HttpMethods.HEAD,
                s3.HttpMethods.PUT,
                s3.HttpMethods.POST,
                s3.HttpMethods.DELETE
              ],
              allowedOrigins: ["*"],
              exposedHeaders: [
                "x-amz-server-side-encryption",
                "x-amz-request-id",
                "x-amz-id-2",
                "ETag"
              ],
              maxAge: 3000
            });
            
            // Lambda関数との依存関係を設定（必要に応じて）
            const retVal: AmplifyDependentResourcesAttributes = AmplifyHelpers.addResourceDependency(this, 
              amplifyResourceProps.category, 
              amplifyResourceProps.resourceName, 
              [
                {category: "function", resourceName: "transcriptminute4e1dd9de"}
              ]
            );
            
            // Lambda関数に出力バケットへのアクセス権限を付与
            const lambdaRoleArn = cdk.Fn.join(":", [
                "arn",
                "aws",
                "iam",
                "",
                this.account,
                `role/amplify-${amplifyProjectInfo.projectName}-${cdk.Fn.ref('env')}-${stackID}-functiontranscriptminute4e1dd9de-role`
            ]);
            const lambdaRole = iam.Role.fromRoleArn(this, 'lambdaRole', lambdaRoleArn);
            bucket.grantReadWrite(lambdaRole);
            
            // バケット名を出力として登録（環境変数設定などで使用）
            new cdk.CfnOutput(this, 'BucketName', {
              value: bucket.bucketName,
              description: "The name of output bucket"
            });
          }
        }
        ```
        - [x] `amplify push` を実行して、Custom Resourceをデプロイする。
        - [x] 出力バケット名を確認し、メモしておく。（バケット名: `transcriptminute-output-387724-dev`）
        - [x] Lambda関数の環境変数 `S3_OUTPUT_BUCKET` を出力バケット名で更新する。
- [x] **IAM権限の設定:**
    - [x] Lambda関数の実行ロールに必要な権限を追加する (`amplify update function`)。
        - [x] **S3アクセス権限:** トリガーとなったオブジェクトの読み取り権限、文字起こし結果 (`transcript.txt`) の書き込み権限。
        - [x] **AppSyncアクセス権限:** `ProcessingSession` の更新 (`updateProcessingSession`) および `Organization` の更新 (`updateOrganization`) を行うためのGraphQLミューテーション呼び出し権限。
        - [x] **Secrets Managerアクセス権限:** ElevenLabs/DifyのAPIキーを保存しているシークレットを読み取る権限 (`secretsmanager:GetSecretValue`)。
        - [x] **CloudWatch Logsアクセス権限:** ログ出力のための基本的な権限 (通常はデフォルトで付与される)。
- [x] **環境変数の設定:**
    - [x] Lambda関数に必要な環境変数を設定する (`amplify update function`)。
        - [x] `APPSYNC_API_URL`: AppSyncエンドポイントURL。
        - [x] `APPSYNC_API_KEY`: (もしAPIキー認証を使う場合) AppSync APIキー。
        - [x] `SECRETS_MANAGER_SECRET_ARN`: APIキーを保存しているSecrets ManagerのARN。
        - [x] `TRANSCRIPTION_API_PROVIDER`: 使用する文字起こしAPIプロバイダ (`elevenlabs` または `dify`)。
        - [x] `DIFY_API_URL`: (Dify使用時) Dify APIのエンドポイントURL。
        - [x] `S3_OUTPUT_BUCKET`: 文字起こし結果を保存するS3バケット名。出力バケットを作成した後に、CDK出力から取得した出力バケット名に更新する。
- [x] **DLQ (Dead-Letter Queue) の設定:**
    - [x] Lambda関数の設定でDLQを有効にする (`amplify update function` またはAWSコンソール)。
    - [x] 送信先として新しいSQSキューを作成または既存のキューを指定する。
- [x] **設定のデプロイ:**
    - [x] `amplify push` を実行して、上記の設定をAWSクラウドに反映させる。

## 2. Secrets Manager 設定

- [x] AWS Secrets Managerに新しいシークレットを作成する。
- [x] シークレット内にElevenLabs APIキーおよび/またはDify APIキーをキー/値ペアとして保存する。
- [x] 作成したシークレットのARNをメモしておく (Lambdaの環境変数設定で使用)。

## 3. GraphQL スキーマ変更

- [x] `amplify/backend/api/<YOUR_API_NAME>/schema.graphql` を編集する。
- [x] `ProcessingSession` の `status` フィールドの型定義 (おそらくEnum) に新しいステータスを追加する:
    - [x] `UPLOADED`
    - [x] `PROCESSING_TRANSCRIPTION`
    - [x] `TRANSCRIPTION_FAILED`
- [x] `ProcessingSession` の変更をサブスクライブするための定義を追加する。
    ```graphql
    type Subscription {
      onUpdateProcessingSession(id: ID!): ProcessingSession
        @aws_subscribe(mutations: ["updateProcessingSession"])
      # 他のサブスクリプションがあれば追記
    }
    ```
    (既存の `updateProcessingSession` ミューテーションをトリガーとする。引数は必要に応じて調整)
- [x] `amplify push` を実行してスキーマ変更を反映させる。

## 4. Lambda 関数 実装 (`amplify/backend/function/<functionName>/src/`)

- [x] **初期設定・依存関係:**
    - [x] 必要なライブラリを追加する (例: `aws-sdk` or `@aws-sdk/client-secrets-manager`, `@aws-sdk/client-s3`, `axios` or `node-fetch` for API calls, GraphQL client like `@aws-appsync/client` or a generic fetch based one)。
    - [x] 環境変数 (`APPSYNC_API_URL`, `SECRETS_MANAGER_SECRET_ARN`, etc.) をコード内で取得する。
- [x] **イベントハンドラ (`index.handler`):**
    - [x] S3イベントレコードからトリガーとなったオブジェクトのバケット名とキーを取得する。
    - [x] イベントレコード内の情報から `ProcessingSession` のIDを特定する方法を確立する (例: S3キーの命名規則に含める、または別の方法で連携)。
- [x] **ProcessingSession 更新 (初期):**
    - [x] AppSyncミューテーション (`updateProcessingSession`) を呼び出し、ステータスを `UPLOADED` に更新する。
- [x] **Secrets ManagerからのAPIキー取得:**
    - [x] 環境変数 `SECRETS_MANAGER_SECRET_ARN` を使用してSecrets ManagerからAPIキーを取得する。
    - [x] 取得失敗時のエラーハンドリングを追加する。
- [x] **ProcessingSession 更新 (処理開始):**
    - [x] AppSyncミューテーション (`updateProcessingSession`) を呼び出し、ステータスを `PROCESSING_TRANSCRIPTION` に更新する。
- [x] **外部文字起こしAPI呼び出し:**
    - [x] 環境変数 `TRANSCRIPTION_API_PROVIDER` に基づいて、ElevenLabsまたはDifyのAPIクライアントを初期化する。
    - [x] S3オブジェクト（音声/動画ファイル）を取得または署名付きURLを生成してAPIに渡す。
    - [x] 文字起こしリクエストを送信する。
    - [x] **リトライ処理:** API呼び出しが失敗した場合、1回だけリトライするロジックを実装する (Exponential backoffなど簡単な待機処理を入れると尚良い)。
- [x] **API成功時の処理:**
    - [x] APIレスポンスから文字起こし結果テキストを取得する。
    - [x] **出力先バケットの変更:** 文字起こし結果テキストを、環境変数 `S3_OUTPUT_BUCKET` で指定された出力用バケットに保存するよう変更する。サンプルコード:
      ```javascript
      // 出力用バケットに保存
      const transcriptKey = `${sessionId}/transcript.txt`;
      await s3.putObject({
        Bucket: process.env.S3_OUTPUT_BUCKET, // 出力用バケットを使用
        Key: transcriptKey,
        Body: text,
        ContentType: 'text/plain; charset=utf-8'
      }).promise();
      ```
    - [x] 処理した音声/動画ファイルの長さを特定する（API応答に含まれるか、別途メタデータから取得が必要）。
    - [x] 処理時間に基づいて、`updateOrganization` AppSyncミューテーションを呼び出し、組織の残り利用時間を更新する。
    - [x] `updateProcessingSession` AppSyncミューテーションを呼び出し、ステータスを `COMPLETED` に、`transcriptKey` を設定して更新する。
- [x] **API失敗時の処理 (リトライ後):**
    - [x] エラー情報をCloudWatch Logsに詳細に出力する (`console.error`)。
    - [x] `updateProcessingSession` AppSyncミューテーションを呼び出し、ステータスを `TRANSCRIPTION_FAILED` に更新する。
- [x] **全体的なエラーハンドリング:**
    - [x] try-catchブロックを使用して、予期せぬエラー（S3アクセスエラー、AppSync呼び出しエラーなど）を捕捉する。
    - [x] 捕捉したエラーはCloudWatch Logsに出力し、可能であれば `ProcessingSession` のステータスを `ERROR` に更新することを試みる。

## 5. フロントエンド実装 (Next.js)

- [x] **API呼び出しロジックの削除:**
    - [x] `src/utils/transcriptionApi.ts` などから、フロントエンドが直接ElevenLabs/Dify APIを呼び出す処理を削除する。
    - [x] 関連するAPIキー (`NEXT_PUBLIC_...`) を環境変数から削除する。
- [x] **AppSync Subscription の実装:**
    - [x] `@aws-amplify/api` または他のGraphQLクライアントライブラリを使用して、`onUpdateProcessingSession` サブスクリプションを設定する。
    - [x] ファイルアップロード後、対応する `ProcessingSession` のIDでサブスクリプションを開始する。
    - [x] サブスクリプションからのデータ受信をハンドリングするロジックを追加する。
- [x] **UIの更新:**
    - [x] `TranscriptionResult.tsx` や関連コンポーネントを修正する。
    - [x] サブスクリプション経由で受け取った `ProcessingSession` の `status` に基づいてUIを更新する。
        - [x] `UPLOADED`, `PROCESSING_TRANSCRIPTION`: 処理中であることを示すインジケーター（スピナー、メッセージ等）を表示する。
        - [x] `COMPLETED`: 文字起こし結果の表示処理を開始する（従来通りS3から取得）。
        - [x] `TRANSCRIPTION_FAILED`, `ERROR`: エラーメッセージを表示する。
    - [x] 既存のポーリング処理があれば削除する。
- [x] **初期状態の調整:**
    - [x] ファイルアップロード直後の `ProcessingSession` の状態とUI表示を、新しいフローに合わせて調整する（Lambdaが起動するまでの間など）。
- [x] **S3バケット取得先の変更:**
    - [x] 結果ファイル (`transcript.txt`, `bullet_points.txt`, `minutes.txt`) を新しい出力用バケットから取得するようコードを修正する。
    - [x] Amplify Storageの設定を更新して出力バケットへのアクセス権限を追加する。

## 6. フロントエンド実装 (Next.js) (追記)

- [x] **API呼び出しロジックの削除/変更:**
    - [x] `src/utils/difyApi.ts` などから、フロントエンドが直接Dify API (箇条書き・議事録) を呼び出す処理を削除する。
    - [x] 関連するAPIキー (`NEXT_PUBLIC_...`) を環境変数から削除する。
- [x] **API Gateway呼び出しの実装:**
    - [x] 話者編集完了後、ユーザーが「箇条書き・議事録を生成」ボタンをクリックした際に、集約されたAPI Gatewayエンドポイント (`POST /generate/process-all`) にリクエストを送信するよう変更する。
    - [x] リクエストボディには `sessionId`, `transcript`に加え、生成したいコンテンツの種類を示す `processingTypes: ["bullets", "minutes"]` を含める。
- [x] **UIの更新 (生成処理中):**
    - [x] API Gateway呼び出し後、Lambdaがリクエストを受理したことを示す `202 Accepted` レスポンスをハンドリングし、UIをローディング状態に移行させる。
    - [x] 処理受付が成功した旨をユーザーに通知する。
- [x] **UIの更新 (Subscription):**
    - [x] AppSync Subscriptionで `ProcessingSession` の `status` 変更を監視する。
    - [x] 新しいステータス (`SPEAKER_EDIT_COMPLETED`, `PROCESSING_BULLETS`, `BULLETS_COMPLETED`, `BULLETS_FAILED`, `PROCESSING_MINUTES`, `MINUTES_COMPLETED`, `MINUTES_FAILED`, `ALL_COMPLETED`) に応じて、ボタンの活性/非活性、進捗表示、結果表示エリアの制御などを行う。

## 7. Amplify バックエンド設定 (非同期生成処理)

- [x] **API Gateway の設定変更:**
    - [x] 既存のAPI (`generateapi`) のパスを再構成する (`amplify update api`)。
        - [x] 個別のエンドポイント (`/generate/bullets`, `/generate/minutes`) を削除する。
        - [x] 新しい集約エンドポイント `POST /generate/process-all` を作成する。
- [x] **エンドポイント用Lambda関数の追加/改修 (`generationProcessor`):**
    - [x] `amplify add function` または既存の関数を改修し、API Gatewayからのリクエストを受け付けるLambdaを作成する。
    - [x] 作成したLambda関数を、上記API Gatewayの `/generate/process-all` パスに紐付ける。
- [x] **ワーカー用Lambda関数の追加 (`generationWorker`):**
    - [x] `amplify add function` を実行し、時間のかかるコンテンツ生成処理を実行する新しいLambda関数を作成する。
- [x] **IAM権限の設定:**
    - [x] **`generationProcessor` (エンドポイント用):**
        - [x] ワーカーLambda (`generationWorker`) を非同期で呼び出す (`lambda:InvokeFunction`) 権限。
        - [x] AppSync API (`transcriptminute`) への読み取り権限 (`Query`)。セッション情報を取得するために使用。
        - [x] CloudWatch Logsへの基本的な書き込み権限。
    - [x] **`generationWorker` (ワーカー用):**
        - [x] S3出力バケットへの読み書き権限。
        - [x] AppSync API (`transcriptminute`) への更新権限 (`Mutation`)。処理ステータスを更新するために使用。
        - [x] Secrets ManagerからDify APIキーを読み取る権限 (`secretsmanager:GetSecretValue`)。
        - [x] CloudWatch Logsへの基本的な書き込み権限。
- [x] **環境変数の設定:**
    - [x] **`generationProcessor` (エンドポイント用):**
        - [x] `FUNCTION_GENERATIONWORKER_NAME`: 呼び出すワーカーLambdaの関数名。
        - [x] `API_TRANSCRIPTMINUTE_GRAPHQLAPIENDPOINTOUTPUT`: AppSyncエンドポイントURL。
    - [x] **`generationWorker` (ワーカー用):**
        - [x] `API_TRANSCRIPTMINUTE_GRAPHQLAPIENDPOINTOUTPUT`: AppSyncエンドポイントURL。
        - [x] `SECRETS_MANAGER_SECRET_ARN`: Dify APIキーを保存しているSecrets ManagerのARN。
        - [x] `DIFY_API_URL`: Dify APIのエンドポイントURL。
        - [x] `STORAGE_OUTPUTBUCKET_BUCKETNAME`: S3出力バケット名。
- [x] **設定のデプロイ:**
    - [x] `amplify push` を実行して、新しいLambda関数、API Gateway設定などを反映させる。

## 8. Secrets Manager 設定 (追記)

- [x] (既存のシークレットに追記または新規作成) Difyの箇条書き生成用APIキー、議事録生成用APIキーを保存する。

## 9. GraphQL スキーマ変更 (追記)

- [x] `amplify/backend/api/<YOUR_API_NAME>/schema.graphql` を編集する。
- [x] `ProcessingSession` の `status` Enumに新しいステータスを追加する:
    - [x] `PENDING_SPEAKER_EDIT`
    - [x] `SPEAKER_EDIT_COMPLETED`
    - [x] `PROCESSING_BULLETS`
    - [x] `BULLETS_COMPLETED`
    - [x] `BULLETS_FAILED`
    - [x] `PROCESSING_MINUTES`
    - [x] `MINUTES_COMPLETED`
    - [x] `MINUTES_FAILED`
    - [x] `ALL_COMPLETED`
- [x] `amplify push` を実行してスキーマ変更を反映させる。

## 10. Lambda 関数 実装 (二段構成)

### 10.1. エンドポイント用Lambda実装 (`generationProcessor`)

- [x] **初期設定・依存関係:**
    - [x] 必要なライブラリを追加する (AWS SDK for Lambda invocation, GraphQL client)。
    - [x] 環境変数を取得する。
- [x] **API Gatewayイベントハンドラ:**
    - [x] API Gatewayからリクエストボディ (`sessionId`, `transcript`, `processingTypes`) とユーザーID (`identityId`) を受け取る。
    - [x] 必須パラメータのバリデーションを行う。
- [x] **ワーカーLambdaの非同期呼び出し:**
    - [x] AppSyncからセッション情報を取得する。
    - [x] ワーカーLambdaに渡すペイロードを作成する。
    - [x] AWS SDKを使い、`generationWorker` を `InvocationType: 'Event'` (非同期) で呼び出す。
- [x] **即時レスポンス:**
    - [x] ワーカーの呼び出し後、API Gatewayに成功レスポンス (`202 Accepted`) を即座に返す。
- [x] **全体的なエラーハンドリング:**
    - [x] try-catchで予期せぬエラーを捕捉し、API Gatewayにエラーステータスコードを返す。

### 10.2. ワーカーLambda実装 (`generationWorker`)

- [x] **初期設定・依存関係:**
    - [x] 必要なライブラリを追加する (Secrets Manager, S3, GraphQLクライアント, HTTPクライアント)。
    - [x] 環境変数を取得する。
- [x] **イベントハンドラ:**
    - [x] `generationProcessor` から渡されたペイロード (`sessionId`, `transcript`, `identityId`, `processingTypes` など) を受け取る。
- [x] **Secrets ManagerからのAPIキー取得:**
    - [x] Difyの対応するAPIキーを取得する。
- [x] **反復処理の実行:**
    - [x] `processingTypes` 配列 (`["bullets", "minutes"]`) の各要素に対してループ処理を行う。
    - [x] **ProcessingSession 更新 (処理開始):** AppSyncミューテーションでステータスを `PROCESSING_BULLETS` または `PROCESSING_MINUTES` に更新する。
    - [x] **外部API (Dify) 呼び出し:** 対応する生成APIを呼び出す。
    - [x] **API成功時の処理:**
        - [x] APIレスポンスから生成結果テキストを取得する。
        - [x] 生成結果テキストを対応するS3キー (`bulletPointsKey` or `minutesKey`) でS3に保存する。
        - [x] AppSyncミューテーションでステータスを `BULLETS_COMPLETED` または `MINUTES_COMPLETED` に更新し、対応するS3キーを設定する。
    - [x] **API失敗時の処理:** エラーをログに記録し、AppSyncミューテーションでステータスを `BULLETS_FAILED` または `MINUTES_FAILED` に更新する。
- [x] **最終処理:**
    - [x] ループ完了後、`ProcessingSession` の最新状態を確認し、箇条書きと議事録の両方が完了していれば、ステータスを `ALL_COMPLETED` に更新する。
- [x] **全体的なエラーハンドリング:**
    - [x] try-catchで予期せぬエラーを捕捉し、ログ出力とステータスの更新を試みる。

## 11. テスト

> **注: 今回は時間の制約のため、単体テストと結合テストのみを実施し、以下のテスト項目（エラーケーステスト、パフォーマンステスト、セキュリティテスト、回帰テスト、モニタリング体制）については次のフェーズで実施します。**

- [x] **Lambda単体テスト:**
    - [x] **`transcriptionProcessor` Lambda:**
        - [x] AWSコンソール上で、S3のObjectCreatedイベントを模したテストイベントJSONを使用してLambda関数をテスト実行した。
        - [x] CloudWatch Logsで実行結果を確認し、外部API呼び出し、S3への結果保存、AppSyncでのステータス更新が正常に行われることを確認した。
    
    - [x] **`generationProcessor` (エンドポイント用) Lambda:**
        - [x] AWSコンソール上で、API Gatewayプロキシ統合を模したテストイベントJSONを作成した。
        - [x] テストイベントの例 (`/generate/process-all` パスの場合):
          ```json
          {
            "resource": "/generate/process-all",
            "path": "/generate/process-all",
            "httpMethod": "POST",
            "headers": { "Content-Type": "application/json" },
            "body": "{\"sessionId\":\"YOUR_TEST_SESSION_ID\", \"transcript\":\"...\", \"processingTypes\":[\"bullets\", \"minutes\"]}",
            "requestContext": { "identity": { "cognitoIdentityId": "YOUR_TEST_IDENTITY_ID" } }
          }
          ```
        - [x] Lambdaコンソールからテストを実行し、`generationWorker` が非同期で呼び出されること、および `202 Accepted` レスポンスが返ることを確認した。

    - [x] **`generationWorker` (ワーカー用) Lambda:**
        - [x] `generationProcessor` から渡されるペイロードを模したテストイベントJSONを作成した。
        - [x] Lambdaコンソールからテストを実行し、Secrets Managerからのキー取得、外部API(Dify)呼び出し、S3への結果保存、AppSyncでのステータス更新 (`PROCESSING_BULLETS`, `BULLETS_COMPLETED`, etc.)が正常に行われることを確認した。
        - [x] AppSyncコンソールで `ProcessingSession` のステータスが期待通りに `ALL_COMPLETED` まで遷移することを確認した。
        - [x] S3出力バケットに結果ファイルが保存されていることを確認した。

- [x] **結合テスト:**
    - [x] **文字起こしフロー:**
        - [x] テスト用の音声ファイルをS3にアップロードし、`transcriptionProcessor` がトリガーされ、フロントエンドでステータス更新が通知されることを確認した。
    
    - [x] **生成フロー (エンドツーエンド):**
        - [x] フロントエンドから「箇条書き・議事録を生成」ボタンをクリックする。
        - [x] API Gateway (`/generate/process-all`) 経由で `generationProcessor` が呼び出され、即時レスポンスが返ってくることを確認した。
        - [x] バックグラウンドで `generationWorker` が実行され、AppSync Subscriptionを通じてフロントエンドのUIに進捗 (`PROCESSING_...`, `..._COMPLETED`) がリアルタイムで反映されることを確認した。
        - [x] 最終的にステータスが `ALL_COMPLETED` となり、生成されたコンテンツがS3から取得・表示できることを確認した。

- [x] **エンドツーエンド:**
    - [x] 実際のユーザーフローを模擬し、ファイルアップロードから結果取得までの全工程をテストした。
    - [x] スマートフォンなど異なるデバイスからの動作確認も行った。

## リファクタリング: AWS リソース名の整理

- [x] **Lambda関数名の標準化:**
    - [x] **現状の名前とターゲット名のマッピング:**
        - [x] `transcriptminute4e1dd9de` → `transcriptionProcessor`
        - [x] 他の自動生成名のLambda関数があれば同様にマッピングを作成する。
    
    - [x] **CloudFormationテンプレートの更新:**
        - [x] `amplify/backend/function/transcriptminute4e1dd9de/transcriptminute4e1dd9de-cloudformation-template.json` ファイルをバックアップする。
        - [x] Amplify CLIで新しい関数（`transcriptionProcessor`）を作成する：`amplify add function`
        - [x] 元のコードと設定を新しい関数にコピーする。
        - [x] 古い関数を削除する：`amplify remove function transcriptminute4e1dd9de`

- [x] **IAMロールの更新:**
    - [x] 新しいLambda関数用のIAMロールの権限を確認し、必要な権限をすべて付与する。
    - [x] S3バケットポリシー、AppSync API権限など関連するリソースポリシーで参照を更新する。

- [x] **環境変数の更新:**
    - [x] 新しいLambda関数に必要な環境変数を設定する。
    - [x] 特に出力バケット名（`S3_OUTPUT_BUCKET`）などの重要な設定を確認する。

- [x] **トリガーとイベントソースの再設定:**
    - [x] S3トリガーを新しいLambda関数に再設定する。
    - [x] DLQ (Dead-Letter Queue) の設定を行う。

- [x] **依存関係グラフの更新:**
    - [x] カスタムリソース（出力バケットなど）が古いLambda名を参照している場合、更新する。
    - [x] `amplify/backend/custom/outputBucket/cdk-stack.ts` 内の参照を新しい関数名に更新する。

- [x] **コード内での参照更新:**
    - [x] フロントエンドコードが特定のLambda関数名を直接参照している箇所があれば更新する。
    - [x] Lambda関数内部からほかのLambda関数を参照している場合、それらの参照を更新する。

- [x] **デプロイと動作確認:**
    - [x] `amplify push` を実行して変更をデプロイする。
    - [x] AWS Management ConsoleでLambda関数、IAMロール、S3トリガーなどが正しく設定されていることを確認する。
    - [x] 基本的な機能（ファイルアップロード→文字起こし→議事録生成）が正常に動作することを確認する。

## 12. ドキュメント更新

- [ ] **アーキテクチャドキュメント更新:**
    - [ ] `システム説明資料.md` のアーキテクチャ図を更新し、Lambda関数フローを反映させる。
    - [ ] データフロー図を更新し、S3トリガーやAPI Gateway連携の流れを明確にする。
    - [ ] 技術スタック一覧に新たに導入したAWSサービス（Lambda, API Gateway, SQS, Secrets Manager）を追加する。

- [ ] **運用手順書の作成:**
    - [ ] Lambda関数のモニタリングとトラブルシューティング手順を文書化する。
    - [ ] CloudWatch Logsの確認方法とログの解釈ガイドを作成する。
    - [ ] DLQからのメッセージ再処理手順を記載する。
    - [ ] 環境切り替え時（dev→staging→production）の注意点と手順を文書化する。

- [ ] **開発者向けドキュメント更新:**
    - [ ] `README.md` にローカル開発環境のセットアップ方法（Lambda関連）を追記する。
    - [ ] Lambda関数のテスト方法と、Amplify CLIを使ったデプロイ手順を詳細に記載する。
    - [ ] 新しいLambda関数を追加する場合の手順とベストプラクティスを文書化する。
    - [ ] APIエンドポイントの仕様とリクエスト/レスポンスの形式を記載する。

- [ ] **ユーザー向け変更点のまとめ:**
    - [ ] 以前の実装と比較して変更された動作や新機能を文書化する。
    - [ ] 新しいUI/UXフローの説明とスクリーンショットを追加する。
    - [ ] 発生する可能性のあるエラーメッセージとその対応方法を記載する。

- [ ] **セキュリティ関連ドキュメント:**
    - [ ] APIキーや認証情報の安全な管理方法を文書化する。
    - [ ] IAMロールとポリシーの設定内容と目的を記録する。
    - [ ] データプライバシーとユーザーデータの取り扱いについて記載する。