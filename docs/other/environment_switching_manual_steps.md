# Amplify 環境切り替え時の手動作業リスト

このドキュメントは、Amplify環境を切り替えた際 (例: `dev` から `staging` へ) に、Amplify CLIだけでは自動的に反映されないため、手動で設定が必要な作業を記録します。

## 1. Lambda関数のDLQ (Dead-Letter Queue) 設定

**対象Lambda:** `transcriptionProcessor` (または該当する環境のLambda関数)

**理由:** Amplify CLIはLambda関数のDLQ設定を環境間で自動的にコピーしません。

**手順:**

1.  **新しい環境用のSQSキューを作成:**
    *   Amazon SQSコンソールを開く。
    *   「キューの作成」をクリック。
    *   タイプ: 標準キュー。
    *   名前: 新しい環境に合わせた名前（例: `transcriptminute-dlq-staging`）。
    *   その他の設定はデフォルトまたは必要に応じて調整。
    *   「キューの作成」をクリック。
2.  **Lambda関数のDLQ設定:**
    *   Lambda管理コンソールを開く。
    *   対象環境の `transcriptionProcessor` 関数を選択。
    *   「設定」タブ -> 「非同期呼び出し」セクション -> 「編集」。
    *   「デッドレターキュー」を有効にする。
    *   「デッドレターキューのターゲット」でSQSを選択。
    *   手順1で作成した新しいSQSキューを選択。
    *   「保存」をクリック。
3.  **IAM権限の確認と追加:**
    *   Lambda関数の「設定」タブ -> 「アクセス権限」 -> 実行ロールのリンクをクリック。
    *   IAMコンソールで「アクセス権限の追加」 -> 「インラインポリシーを作成」。
    *   以下のポリシーを追加（`Resource`のARNは手順1で作成したキューのARNに置き換える）：
        ```json
        {
          "Version": "2012-10-17",
          "Statement": [
            {
              "Effect": "Allow",
              "Action": [
                "sqs:SendMessage"
              ],
              "Resource": "arn:aws:sqs:リージョン:アカウントID:キュー名"
            }
          ]
        }
        ```
    *   ポリシー名（例: `SQSDLQAccess-Staging`）を入力し、「ポリシーの作成」をクリック。

## 2. Lambda 関数の環境変数設定

**対象Lambda:** `transcriptionProcessor` (または環境変数を必要とする他の関数)

**理由:** Lambda関数の環境変数は、`amplify update function` コマンドで設定した場合、その環境に固有のものとなります。特に、カスタムリソースの出力やSecrets ManagerのARNなど、環境ごとに異なる値を持つ変数は手動での更新が必要です。

**手順:**

1.  `amplify env checkout <新しい環境名>` で環境を切り替える。
2.  `amplify push` を実行して、基本的なリソースをデプロイ・更新する。
3.  新しい環境に必要な情報（例: カスタムS3バケット名、Secrets Manager ARN）を確認・準備する。
4.  `amplify update function` コマンドを実行し、該当するLambda関数を選択する。
5.  「Environment variables configuration」を選択する。
6.  環境ごとに更新が必要な変数（例: `S3_OUTPUT_BUCKET`, `SECRETS_MANAGER_SECRET_ARN`）を選択し、新しい環境の値で更新する。
7.  更新が完了したら「I'm done」を選択し、プロンプトに従う。
8.  再度 `amplify push` を実行して、環境変数の変更をクラウドに反映させる。

**generateapi Lambda関数の環境変数設定:**

生成API用のLambda関数 (`generationProcessor`) には、以下の環境変数の設定が必要です：

1. `APPSYNC_API_URL`: GraphQL APIのエンドポイントURL（環境ごとに異なる）
   - 新環境での値は `amplify status` コマンドで確認できる `GraphQL endpoint` から取得
   
2. `SECRETS_MANAGER_SECRET_ARN`: APIキーを保存しているシークレットのARN（環境ごとに異なる）
   - 新環境用に作成したシークレットのARNを設定（例: `arn:aws:secretsmanager:リージョン:アカウントID:secret:transcription-api-keys-環境名`）

3. `DIFY_API_URL`: Dify APIのエンドポイント
   - 環境に合わせたエンドポイントを設定（例: 本番環境は `https://api.dify.ai/v1` など）

4. `S3_OUTPUT_BUCKET`: 出力用バケット名（環境ごとに異なる）
   - 新環境用のカスタムリソース出力値を設定（例: `transcriptminute-output-XXXX-環境名`）

5. `APPSYNC_API_KEY`: （IAM認証を使用している場合は不要）
   - API Key認証を使用する場合のみ設定が必要

## 3. カスタムリソースのデプロイ時の注意点 (主に初回デプロイ時)

**対象リソース:** `outputBucket` (または他のカスタムリソース)

**理由:** 新しい環境への *初回* `amplify push` が失敗した場合、S3バケットなどのリソースが中途半端に残ることがあります。これにより、次回の `amplify push` でリソース名の衝突エラーが発生する可能性があります。

**対応策:**

*   初回デプロイが失敗した場合は、CloudFormationコンソールでスタックの状態を確認し、関連リソース（例: S3バケット）が残存していないか確認する。もし残存していれば、手動で削除してから `amplify push` を再試行する。
*   CDKスタックでリソース名にタイムスタンプやランダム文字列を含める実装（現在の`outputBucket`の実装）は、このリスクを軽減するのに役立ちます。

## 4. Secrets Managerのシークレット作成と更新

**対象リソース:** AWS Secrets Manager シークレット

**理由:** Amplify CLIはSecrets Managerを直接管理していないため、環境ごとにシークレットを作成し、Lambda関数の環境変数を更新する必要があります。

**手順:**

1. **新しい環境用のシークレットを作成:**
   * AWS Management Consoleで「Secrets Manager」サービスに移動。
   * 「新しいシークレットを保存」をクリック。
   * 「その他のタイプのシークレット」を選択。
   * キーと値のペアとして以下を追加:
     - `elevenlabs_api_key`: "YOUR_ELEVENLABS_API_KEY"  # 文字起こし(transcriptionProcessor)用
     - `dify_bullet_points_api_key`: "YOUR_DIFY_BULLET_POINTS_API_KEY" # 箇条書き生成(generationProcessor)用
     - `dify_minutes_api_key`: "YOUR_DIFY_MINUTES_API_KEY"       # 議事録生成(generationProcessor)用
   * デフォルトの暗号化キーを使用（または必要に応じてカスタムKMSキーを選択）。
   * シークレット名: `transcription-api-keys-{環境名}`（例：`transcription-api-keys-staging`）
   * タグを追加（推奨）: `Environment` = `staging`（または該当する環境名）
   * 自動ローテーションは無効のままでOK。
   * 「シークレットを保存」をクリック。

2. **シークレットARNをLambda環境変数に設定:**
   * 作成したシークレットの詳細ページでARNを確認・コピー。
   * 「Lambda 関数の環境変数設定」の手順（セクション2参照）に従い、`SECRETS_MANAGER_SECRET_ARN`環境変数を更新。

3. **Lambda実行ロールにシークレットアクセス権限を追加:**
   * Lambda関数の「設定」→「アクセス権限」から実行ロールを確認。
   * IAMコンソールでそのロールにインラインポリシーを追加:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": "secretsmanager:GetSecretValue",
         "Resource": "arn:aws:secretsmanager:リージョン:アカウントID:secret:transcription-api-keys-環境名-*"
       }
     ]
   }
   ```
   * ポリシー名（例：`SecretsManagerAccess-Staging`）を入力し、作成。

4. **`amplify push`を実行して変更を反映:**
   * コマンドラインで `amplify push` を実行し、Lambda関数の更新を反映させる。

**注意点:** セキュリティ上の理由から、本番環境のAPIキーを開発環境やテスト環境と共有しないことを推奨します。環境ごとに別々のAPIキーを用意するか、開発/テスト環境では機能制限付きのキーを使用するとよいでしょう。

---
*(他の手動作業があれば追記)* 