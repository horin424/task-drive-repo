# Amplify環境へのmainブランチマージとデプロイ修正の記録

## 1. 初期目的

`release/takewa` 環境に `main` ブランチの最新機能を統合する。
安全なマージとデプロイ検証のため、以下の手順を計画した。

1.  作業用ブランチ `feature/merge-main-to-takewa` を作成する。
2.  `main` ブランチを `feature/merge-main-to-takewa` にマージする。
3.  発生したコンフリクトを解消する。
4.  `amplify push` を実行し、デプロイと動作確認を行う。
5.  問題がなければ `feature/merge-main-to-takewa` を `release/takewa` にマージする。

## 2. マージとコンフリクト解消

`git merge origin/main` を実行したところ、多数のファイルでコンフリクトが発生した。
`git status` で表示されたファイルを一つずつ確認し、`git checkout --theirs` や手動での編集によりコンフリクトを解消した。

## 3. デプロイ試行と問題の変遷

コンフリクト解消後、`amplify push` を試みたが、複数の問題が段階的に発生した。

### 3.1. `override.ts` での実行時エラー

-   **現象**: `amplify push` を実行すると、GraphQLスキーマのコンパイル中にエラーで停止した。
-   **エラーメッセージ**: `Executing overrides failed. Cannot read properties of undefined (reading 'Organization')`
-   **原因**: `amplify/backend/api/transcriptminute/override.ts` 内で `resources.stacks.Organization` を参照していた。GraphQL Transformer v2 の実行ライフサイクルでは、`override.ts` が実行される時点でネストされたスタック（モデルごとのテーブルなど）がまだ初期化されておらず、`resources.stacks` オブジェクト内に存在しないため `undefined` となりエラーが発生していた。
-   **一次対応**: `override.ts` の処理を一時的にコメントアウトし、このエラーを回避した。

### 3.2. GraphQL Transformer V1 vs V2 の混乱

`override.ts` のエラーを回避した後もデプロイに失敗。ここから根本原因の特定に時間を要した。

-   **当初の仮説**: このプロジェクトは古いGraphQL Transformer v1で構築されており、`main`ブランチからマージしたv2の機能との間に互換性の問題が発生していると推測。v1にバージョンを固定する方針で調査を進めた。
-   **試行したこと**:
    1.  `amplify/cli.json` と `amplify/backend/api/transcriptminute/transform.conf.json` のバージョンを `1` に手動で修正。
    2.  `amplify push` を実行すると、CLIが自動的にバージョンを `2` に書き換えてしまう問題が発生。
    3.  Amplify CLIのバージョンがv12以降はv2がデフォルトであるとの調査結果に基づき、CLIのグローバルバージョンをv11系にダウングレード。
-   **仮説の誤りが判明**:
    -   CLIをv11に下げて`push`しても、今度はスキーマ定義に関するエラーが発生した。
    -   **エラーメッセージ**: `Your GraphQL Schema is using "@primaryKey", "@hasMany", "@index", "@belongsTo" directives from the newer version of the GraphQL Transformer.`
    -   **結論**: このエラーメッセージにより、**マージ後のGraphQLスキーマ(`schema.graphql`)が、最初からTransformer v2専用のディレクティブで記述されていたことが確定**。v1へ戻そうとしていたアプローチ自体が根本的に誤りであったことが判明した。

### 3.3. Lambda環境変数のプロンプト問題

-   **現象**: Transformerのバージョン問題を認識しつつ `amplify push` を実行すると、毎回多数のLambda関数の環境変数（シークレット値や他のリソース名など）の入力を求められる。
-   **原因**: `main`ブランチからマージされた新しいLambda関数群の定義ファイル (`function-parameters.json`) に、環境変数の値が設定されていなかったため。

## 4. 最終的な解決方針 (Transformer v2 前提)

プロジェクトがTransformer v2で構成されていることを前提として、以下の修正を行う方針を固めた。

1.  **Amplify CLIバージョン**: 最新版（v12以降）を使用する。
2.  **GraphQL Transformerバージョン**: v2を正式に採用する。
    -   `amplify/cli.json` で `transformerversion` を `2` に設定。
    -   `amplify/backend/api/transcriptminute/transform.conf.json` で `Version` を `5` (v2) に設定。
3.  **スキーマの修正**:
    -   v2専用ディレクティブ(`@primaryKey`, `@index`など)が正しく使われていることを確認。v1時代の古いディレクティブ(`@key`, `@connection`)が混在している場合はv2の構文に修正する。
4.  **Lambda環境変数の定義**:
    -   `amplify push`時に毎回尋ねられる環境変数を、各関数の`amplify/backend/function/<関数名>/function-parameters.json`ファイルに定義する。
    -   これにより、手動入力が不要になり、CI/CDでの自動デプロイも可能になる。
    -   他のAWSリソース（S3バケット名やAppSyncのエンドポイントなど）を参照する場合は、ハードコーディングではなく `Ref` や `Fn::GetAtt` といったCloudFormationの参照を使用する。
5.  **v1時代の依存関係の排除**:
    -   （推測される潜在的な問題として）各Lambda関数のCloudFormationテンプレート(`cloudformation-template.json`)内に、v1時代の名残である`Fn::ImportValue`によるDynamoDBテーブル名の参照などが残っている場合、デプロイに失敗する可能性がある。
    -   これらの参照を、環境変数経由でのテーブル名受け渡しか、同一スタック内での`Ref` / `Fn::GetAtt`による直接参照に修正する。 