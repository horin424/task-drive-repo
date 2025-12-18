# 月間リセット機能統合調査

## 概要
`release/cac` ブランチに実装された「組織の残り使用時間の月間リセット機能」を `feat/delete-files-with-lambda` ブランチに統合する調査結果。

## 対象Lambda関数
- `updateOrgMinutes`: 組織の残り時間を減少させるGraphQLミューテーション用
- `resetRemainingMinutesFunction`: 月間リセットを実行するスケジュール実行関数

## 関連ファイル・ディレクトリの調査

調査を進め、関連するファイルや変更点をここにリストアップします。

### 1. `amplify/backend/function/` ディレクトリ

`git ls-tree` コマンドで `release/cac` ブランチのファイル一覧を確認した結果、以下の2つのLambda関数関連ディレクトリが存在することを確認しました。これらを現在のブランチに取り込む必要があります。

- `amplify/backend/function/updateOrgMinutes/`
- `amplify/backend/function/resetRemainingMinutesFunction/`

### 2. `amplify/backend/backend-config.json`

`git diff` を使用して、現在の `feat/delete-files-with-lambda` ブランチと `release/cac` ブランチの `backend-config.json` を比較しました。

**主な変更点:**

- `release/cac` 側では、`function` オブジェクトに `resetRemainingMinutesFunction` と `updateOrgMinutes` の定義が追加されています。
- 同時に、`parameters` オブジェクトにも上記関数に関連する `AMPLIFY_function_*_deploymentBucketName` と `AMPLIFY_function_*_s3Key` が追加されています。
- 差分から、`feat/delete-files-with-lambda` ブランチに存在する `deleteGeneratedFiles` や `getAudioPresignedUrl` の定義が `release/cac` には含まれていないことが判明しました。これはコンフリクトの原因となるため、マージの際には手動での調整が必要です。

**アクションアイテム:**

- `release/cac` から `resetRemainingMinutesFunction` と `updateOrgMinutes` の定義をコピーする。
- 既存の関数の定義を消さないように、慎重にマージする。

### 3. `amplify/backend/api/transcriptminute/schema.graphql`

GraphQLスキーマにも複数の重要な変更が確認されました。

**主な変更点:**

- **Mutationの変更**:
    - `deleteGeneratedFiles(sessionId: String!): Boolean` がスキーマから削除されています。
    - 新しいミューテーション `decreaseOrganizationRemainingMinutes(input: DecreaseOrganizationRemainingMinutesInput!): Organization` が追加され、`updateOrgMinutes` Lambda関数に接続されています。
- **Queryの削除**:
    - `getAudioPresignedUrl(sessionId: ID!): String` がスキーマから削除されています。
- **新しいInput型の追加**:
    - `decreaseOrganizationRemainingMinutes` 用の `DecreaseOrganizationRemainingMinutesInput` が追加されています。
- **既存の型の変更**:
    - `ProcessingSession` から `transcriptFormat: TranscriptFormat` が削除されています。
    - `TranscriptFormat` enum 自体も削除されています。
    - `ProcessingSession` の `@auth` ディレクティブが `{ allow: private, provider: iam, operations: [read, update] }` から `{ allow: private, provider: iam }` に変更されています。

**アクションアイテム:**

- `decreaseOrganizationRemainingMinutes` ミューテーションとその関連Input `DecreaseOrganizationRemainingMinutesInput` を現在のスキーマに追加する。
- `deleteGeneratedFiles` と `getAudioPresignedUrl` の定義は、現在のブランチの機能を維持するため、削除せずにそのまま保持する。
- `ProcessingSession` と `TranscriptFormat` に関する変更は、今回は見送ります。これらは月間リセット機能とは直接関係がなく、フロントエンドの修正が必要になる可能性が高いためです。コンフリクトが発生した場合は、現在のブランチの実装を優先します。

### 4. `resetRemainingMinutesFunction` のトリガー設定

`resetRemainingMinutesFunction` がどのように定期実行されるかを調査しました。

**調査結果:**

- **CloudFormationテンプレート**: `amplify/backend/function/resetRemainingMinutesFunction/resetRemainingMinutesFunction-cloudformation-template.json` 内に、`AWS::Events::Rule` (CloudWatchEvent) リソースが定義されていました。これは、Lambda関数をスケジュールに従ってトリガーするためのものです。
- **スケジュール定義**: スケジュール（cron式）自体は、`function-parameters.json` や `parameters.json` には直接記述されていませんでした。これは、`amplify update function` を実行した際に、Amplifyが環境ごとの設定としてクラウド側またはローカルの `.amplify` ディレクトリ内に保存するためと考えられます。

**アクションアイテム:**

- `resetRemainingMinutesFunction` のCloudFormationテンプレートを取り込めば、`amplify push` のプロセスでスケジュール設定が適用されると期待されます。デプロイ時に設定が反映されているかを確認する必要があります。

## 統合計画の最終確認

以上の調査結果から、以下の手順でバックエンド機能の取り込みを行います。

1.  **ディレクトリのコピー**:
    - `git checkout release/cac -- amplify/backend/function/updateOrgMinutes/`
    - `git checkout release/cac -- amplify/backend/function/resetRemainingMinutesFunction/`
2.  **設定ファイルの手動マージ**:
    - `amplify/backend/backend-config.json`: 差分を確認しながら、`updateOrgMinutes` と `resetRemainingMinutesFunction` の定義を追加します。
    - `amplify/backend/api/transcriptminute/schema.graphql`: 差分を確認しながら、`decreaseOrganizationRemainingMinutes` ミューテーションと関連Inputを追加します。既存のミューテーションやクエリは削除しません。
3.  **Amplifyのステータス確認**:
    - `amplify status` を実行し、2つの新しい関数が「Create」として、APIが「Update」として認識されていることを確認します。
4.  **デプロイと動作確認**:
    - `amplify push` を実行して変更をデプロイします。
    - デプロイ後、AWSコンソールで `resetRemainingMinutesFunction` にEventBridgeのトリガーが正しく設定されているかを確認します。

## 実装結果

### ✅ Phase 1: updateOrgMinutes 関数の統合 (完了)

**日時**: 2024年7月23日  
**ステータス**: **成功** - CREATE_COMPLETE

#### 実装手順
1. **クリーンアップ**: 不整合状態の `backend-config.json` をクリーンアップ
2. **関数追加**: `amplify add function` で `updateOrgMinutes` を追加
3. **ソース取得**: `release/cac` ブランチから `index.js` と `package.json` を取得
4. **スキーマ更新**: `decreaseOrganizationRemainingMinutes` ミューテーション追加済み
5. **デプロイ**: `amplify push` で正常にデプロイ完了

#### 成功要因
- 段階的アプローチ（1つの関数ずつ）
- 既存実装の活用
- 不整合状態の事前解消
- 適切な依存関係の自動設定

#### 確認済み事項
- ✅ Lambda関数が正常に作成された
- ✅ GraphQLスキーマが更新された
- ✅ 既存のリソースに影響なし
- ✅ 前回発生した CloudFormation エクスポートエラーが解決された

### ✅ Phase 2: resetRemainingMinutesFunction 関数の統合 (完了)

**日時**: 2024年7月23日  
**ステータス**: **成功** - CREATE_COMPLETE

#### 実装手順
1. **関数追加**: `amplify add function` で `resetRemainingMinutesFunction` を追加
   - スケジュール設定: `0 15 L * ? *` (毎月最終日の15:00 UTC)
2. **ソース取得**: `release/cac` ブランチから `index.js`, `package.json`, `function-parameters.json` を取得
3. **デプロイ**: `amplify push` で正常にデプロイ完了

#### 成功したリソース
- ✅ **`resetRemainingMinutesFunction`**: Lambda関数が正常に作成
- ✅ **`CloudWatchEvent`**: スケジュール実行設定が正常に作成
- ✅ **`PermissionForEventsToInvokeLambda`**: EventBridge→Lambda権限が正常に設定
- ✅ Organization テーブルへのアクセス権限が正常に設定

## 🎉 統合完了サマリー

### 統合された機能
1. **`updateOrgMinutes`**: GraphQLミューテーション `decreaseOrganizationRemainingMinutes` 
2. **`resetRemainingMinutesFunction`**: 毎月最終日15:00 UTC に全組織の残り時間をリセット

### 確認済み事項
- ✅ 両Lambda関数が正常にデプロイされた
- ✅ GraphQLスキーマが正しく更新された
- ✅ スケジュール実行設定（EventBridge）が正常に作成された
- ✅ Organization テーブルへのアクセス権限が正しく設定された
- ✅ 既存のすべてのリソースに影響なし
- ✅ 前回発生したCloudFormationエクスポートエラーが解決された

### 成功要因
- **段階的アプローチ**: 1つずつ関数を追加することで問題を最小化
- **既存実装の活用**: `release/cac` ブランチから実装済みコードを取得
- **クリーンアップファースト**: 不整合状態を事前に解消
- **適切な権限設定**: 自動的に適切な依存関係と権限が設定された

## 次のステップ

バックエンドの月間リセット機能統合は **完了** しました。フロントエンドの対応は別途実装予定です。

### 注意事項
- スケジュール: 毎月最終日の15:00 UTC (日本時間では翌日0:00)
- リセット値: 6000分（100時間）にハードコード済み
- 対象: すべての組織の `remainingMinutes` フィールド

## 🔧 推奨される追加改善

### transcriptionProcessor の改善提案

現在の `transcriptionProcessor` は組織の残り時間を **直接的な方法** で更新していますが、これには以下の問題があります：

#### 現在の問題点
1. **競合状態のリスク**: 取得→計算→更新の間に他の処理が残り時間を変更する可能性
2. **残高不足チェックなし**: 実際の残高不足が検出されない
3. **複数ステップ**: 3つのステップ（取得→計算→更新）が必要

#### 推奨される改善方法

`transcriptionProcessor` の `markTranscriptionComplete` 関数で、新しく統合した `decreaseOrganizationRemainingMinutes` ミューテーションを使用することを推奨します：

**改善前（現在）**:
```javascript
// 複数ステップの更新処理
const orgData = await appsyncClient.graphql({ query: GET_ORGANIZATION_QUERY, ... });
const newRemainingMinutes = Math.max(0, currentRemainingMinutes - usedMinutes);
await appsyncClient.graphql({ query: UPDATE_ORGANIZATION_MUTATION, ... });
```

**改善後（推奨）**:
```javascript
// アトミックな減算処理
const DECREASE_ORG_MINUTES_MUTATION = `
  mutation DecreaseOrganizationRemainingMinutes($input: DecreaseOrganizationRemainingMinutesInput!) {
    decreaseOrganizationRemainingMinutes(input: $input) {
      id
      remainingMinutes
    }
  }
`;

await appsyncClient.graphql({
  query: DECREASE_ORG_MINUTES_MUTATION,
  variables: {
    input: {
      id: organizationId,
      decreaseBy: usedMinutes
    }
  }
});
```

#### 改善による利点
- ✅ **アトミック操作**: 競合状態の回避
- ✅ **残高不足検出**: `ConditionalCheckFailedException` で明確なエラー
- ✅ **シンプルな実装**: 1ステップで完了
- ✅ **一貫性**: `resetRemainingMinutesFunction` と同じ更新メカニズム

#### 実装優先度
**高**: この改善により、システム全体の整合性と信頼性が大幅に向上します。 