# S3ファイル削除機能のLambda移管 実装方針書

## 1. 概要

本ドキュメントは、現在フロントエンド (`TranscriptionResult.tsx`) で直接実行されているS3オブジェクトの削除処理を、セキュリティと堅牢性の向上のため、専用のLambda関数に移行するための実装方針を定義する。

## 2. 背景と目的

### 現状の課題
- **セキュリティリスク:** フロントエンドのユーザーに紐づくIAMロールに `s3:DeleteObject` 権限が付与されており、最小権限の原則に反している。悪意のあるユーザーがAPIを不正利用し、意図しないファイルを削除する可能性がある。
- **CORS設定の複雑化:** フロントエンドから直接S3を操作するため、S3バケットのCORS設定が複雑になる可能性がある。
- **ビジネスロジジックの分散:** ファイル削除という重要なビジネスロジックがフロントエンドに存在しており、将来的な仕様変更への対応が困難。

### 目的
- **セキュリティの強化:** ファイル削除権限をバックエンドに集約し、フロントエンドからは削除権限を剥奪する。Lambda内で厳格な所有者検証を行うことで、不正な削除を防止する。
- **アーキテクチャの改善:** ビジネスロジックをバックエンドにカプセル化し、フロントエンドの責務を単純化する。
- **メンテナンス性の向上:** 削除処理の監視とエラーハンドリングをCloudWatchで一元管理する。

## 3. アーキテクチャ

1.  **フロントエンド (`TranscriptionResult.tsx`):**
    -   ユーザーが「すべてのファイルをダウンロード」ボタンをクリックすると、AppSyncのGraphQLミューテーションを呼び出す。
2.  **AWS AppSync:**
    -   `deleteGeneratedFiles(sessionId: String!): Boolean` のようなカスタムミューテーションをスキーマに追加する。
    -   このミューテーションが、新しく作成する `deleteGeneratedFiles` Lambda関数をリゾルバーとして呼び出すように設定する。
3.  **deleteGeneratedFiles (新規Lambda関数):**
    -   AppSyncからリゾルバーとして呼び出される。
    -   引数 (`event.arguments`) から `sessionId` を取得する。
    -   呼び出し元のユーザー情報 (`event.identity`) から `cognitoIdentityId` を取得する。
    -   `sessionId` に基づいて、削除対象のファイルキーを`ProcessingSession`テーブルから取得する。
    -   リクエスト元のユーザーIDと`ProcessingSession`の所有者が一致することを検証する。
    -   S3上の関連ファイル (**元の入力ファイル**、文字起こし、箇条書き、議事録、タスク一覧など) をすべて削除する。
    -   処理結果（成功/失敗）を返す。
4.  **AWS DynamoDB (via AppSync):**
    -   `ProcessingSession`テーブルから、削除対象となるファイルのS3キー群と、**元の入力ファイルのキーを構築するための情報 (`fileName`, `identityId`)** を取得するために利用する。
5.  **Amazon S3:**
    -   Lambda関数がオブジェクトを削除する対象のバケット。これには、**ユーザーの初期アップロード用バケット**と、**生成物の出力用バケット**の両方が含まれる。

## 4. 実装ステップ（案）

### ステップ1: バックエンド (Amplify)

1.  **新規Lambda関数の作成:**
    -   Amplify CLI (`amplify add function`) を使用して、`deleteGeneratedFiles` という名前の新しいLambda関数を作成する。
    -   言語は `Node.js` を選択し、基本的な権限でセットアップする。
2.  **GraphQLスキーマの更新:**
    -   `amplify/backend/api/transcriptminute/schema.graphql` を編集する。
    -   `type Mutation` 内に、新しいミューテーションを追加する。
        ```graphql
        type Mutation {
          # ... existing mutations
          deleteGeneratedFiles(sessionId: String!): Boolean @function(name: "deleteGeneratedFiles-${env}")
        }
        ```
    -   Amplify CLI (`amplify push` または `amplify api push`) を実行すると、Amplifyが自動的にAppSyncリゾルバーとLambda関数の間の接続、および必要なIAM権限（Lambda呼び出し権限）を設定する。
3.  **LambdaのIAM権限の追加設定:**
    -   `amplify function update` コマンドを使用し、Lambda関数にAmplifyが管理するリソースへのアクセス権限を付与します。
        -   `api` -> `transcriptminute`: `Query` 権限を許可。
        -   `storage` -> `s31d11b5d9` (入力バケット): `Delete` 権限を許可。
    -   **【重要】** `outputBucket` はAmplifyのカスタムリソースとして作成されているため、`amplify function update` の対話プロンプトには表示されません。そのため、`outputBucket` への削除権限は `custom-policies.json` に手動で追加する必要があります。
    -   `amplify/backend/function/deleteGeneratedFiles/custom-policies.json` に以下のポリシーを追記します。
        ```json
        [
          {
            "Action": [
              "s3:DeleteObject"
            ],
            "Resource": [
              {
                "Fn::Join": [
                  "",
                  [
                    "arn:aws:s3:::",
                    {
                      "Ref": "storage-outputBucket-BucketName"
                    },
                    "/*"
                  ]
                ]
              }
            ]
          }
        ]
        ```
4.  **Lambda関数の実装:**
    -   AppSyncリゾルバーイベントから `event.arguments.sessionId` と `event.identity.cognitoIdentityId` を取得する。
    -   AppSyncのGraphQLクライアントをLambda内で使用し、`getProcessingSession`クエリでセッション情報を取得する。
    -   **【重要】** 取得したセッションの`owner`が、`event.identity.cognitoIdentityId`と一致するかを検証する。一致しない場合は `throw new Error("Unauthorized")` で処理を中断する。
    -   **元の入力ファイルの削除:**
        -   セッション情報から `identityId`, `sessionId`, `fileName` を取得する。
        -   入力ファイルが保存されているS3バケット名を取得する（環境変数経由）。
        -   S3キー `private/${identityId}/${sessionId}/${fileName}` を構築し、入力バケットからファイルを削除する。
    -   **生成ファイルの削除:**
        -   セッション情報から `transcriptKey`, `bulletPointsKey`, `minutesKey`, `tasksKey` などのファイルキーを取得する。
        -   取得したキーのリストをループし、出力バケットから各ファイルを削除する。
    -   すべての削除が成功したら `true` を返す。一部でも失敗した場合は `false` を返すか、エラーを投げる（後述の検討事項を参照）。

### ステップ2: フロントエンド (`TranscriptionResult.tsx`)

1.  **既存のS3削除ロジックの削除:**
    -   `handleDownloadAll` 関数内にある `S3Client` の初期化と `deleteS3Object` の呼び出し処理をすべて削除する。
2.  **GraphQLミューテーションの呼び出し:**
    -   ZIPファイルのダウンロード処理が成功した後、AmplifyのAPIライブラリ (`generateClient`) を使って、新しく作成した `deleteGeneratedFiles` ミューテーションを呼び出す。
    -   ミューテーションが成功したことをユーザーに通知する (`toast.success`)。
    -   ミューテーションが失敗した場合は、エラーメッセージを表示する (`toast.error`)。

## 5. 検討事項

-   **エラーハンドリング:** 一部のファイル削除に失敗した場合の挙動（リトライ、エラーログの詳細化など）をどうするか。
-   **状態管理:** ファイル削除後、フロントエンドの状態（`filesDeleted`フラグなど）をどのように更新し、UIに反映させるか。
-   **ミューテーションの戻り値:** `Boolean`が最適か、あるいは削除に成功/失敗したファイルキーのリストなど、より詳細な情報を含むオブジェクトを返す方が良いか。

## 6. 設計決定事項

### Lambdaのエラーハンドリングと戻り値
- **方針:** シンプルな成功/失敗
- **詳細:** 1つでもファイルの削除に失敗した場合、Lambdaはエラーを返し、ミューテーション全体が失敗として扱われます。全てのファイルが正常に削除できた場合のみ、成功として `true` を返します。

### フロントエンドのUX（失敗時の対応）
- **方針:** ユーザーに再操作を委ねる（トーストメッセージのみ）
- **詳細:** ファイル削除に失敗した場合、フロントエンドは「一時ファイルの削除に失敗しました」という趣旨のトーストメッセージを表示するのみとします。ユーザーに対する再試行ボタンの提供は行いません。

---
*このドキュメントは初期案です。詳細は今後の検討を経て変更される可能性があります。* 