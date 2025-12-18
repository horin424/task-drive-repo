# スケジューリングされたファイルクリーンアップ機能 実装チェックリスト

## 📋 概要
- **機能**: S3バケット内のファイルを定期的に削除するLambda関数
- **実行間隔**: 毎時0分（`cron(0 * * * ? *)`）
- **削除基準**: ProcessingSessionの最終更新から2時間経過
- **工数見積**: 3-4時間

---

## 🏗️ Phase 1: 基本機能実装

### 1.1 GraphQLスキーマ更新
- [x] `amplify/backend/api/transcriptminute/schema.graphql` を編集
  - [x] `ProcessingSession` モデルに `filesDeletionTime` フィールドを追加:
    ```graphql
    type ProcessingSession {
      # 既存フィールド...
      filesDeletionTime: AWSDateTime  # ファイル削除日時（null = 未削除）
    }
    ```
- [x] `amplify codegen` を実行して型定義を更新
- [x] `src/API.ts` に新しいフィールドが追加されていることを確認
  - **TODO解消**: `amplify push` により `filesDeletionTime` フィールドが正常に追加された

### 1.2 Lambda関数作成
- [x] `amplify add function` を実行
  - [x] 関数名: `cleanupExpiredFiles`
  - [x] ランタイム: `NodeJS`
  - [x] テンプレート: `Hello World`
  - [x] 高度な設定: `Yes`
  - [x] スケジュール設定: `Yes`
    - [x] cron式: `cron(0 * * * ? *)`
  - [x] Lambda レイヤー: `No`
  - [x] Storage権限: `Yes`
    - [x] ProcessingSession テーブルへの読み取り・更新権限を追加
    - [x] Organization テーブルへの読み取り権限を追加

### 1.3 IAM権限設定
- [x] `amplify/backend/function/cleanupExpiredFiles/custom-policies.json` を作成
  - [x] S3バケット（入力・出力）への削除権限
  - [x] ProcessingSession テーブルへの読み取り・更新権限（amplify add functionで設定済み）
  - [x] CloudWatch Logs への書き込み権限（Amplify自動設定）

### 1.4 環境変数設定
- [x] `amplify update function` で環境変数を設定完了
  - [x] `CLEANUP_THRESHOLD_HOURS`: `2`
  - [x] `MAX_SESSIONS_PER_RUN`: `1000`
  - [x] `LOG_LEVEL`: `info`
  - [x] `STORAGE_S31D11B5D9_BUCKETNAME`: 入力バケット名（Amplify自動設定）
  - [x] `STORAGE_OUTPUTBUCKET_BUCKETNAME`: 出力バケット名（Amplify自動設定）

### 1.5 基本実装
- [x] `amplify/backend/function/cleanupExpiredFiles/src/index.js` を実装
  - [x] 環境変数の取得処理
  - [x] DynamoDBクライアントの初期化
  - [x] S3クライアントの初期化
  - [x] ProcessingSession取得関数の実装（FilterExpression使用）
  - [x] S3ファイル削除関数の実装（バッチ削除対応）
  - [x] メイン処理ロジックの実装（基本エラーハンドリング含む）

---

## 🔧 Phase 2: 堅牢性向上

### 2.1 削除対象セッション取得ロジック
- [x] `getExpiredSessions` 関数を実装（**Phase 1.5で完了**）
  - [x] FilterExpressionによる効率的なDynamoDBクエリ
  - [x] 削除基準: updatedAtから2時間経過

### 2.2 S3ファイル削除ロジック
- [x] `deleteSessionFiles` 関数を実装（**Phase 1.5で完了**）
  - [x] 入力ファイルキーの構築: `private/${identityId}/${sessionId}/${fileName}`
  - [x] 出力ファイルキーの取得: `transcriptKey`, `bulletPointsKey`, `minutesKey`, `tasksKey`
  - [x] バケット別のオブジェクト一括削除処理
  - [x] エラーハンドリング

### 2.3 リトライ機能実装
- [x] `deleteSessionFilesWithRetry` 関数を実装
  - [x] 最大3回リトライ
  - [x] 指数バックオフ（1秒、2秒、3秒）
  - [x] リトライ回数の詳細ログ出力

### 2.4 バッチ処理制限
- [x] 1000セッション制限の実装
- [x] 継続処理ロジック（Lambda制限時間内まで）
- [x] 並行処理（Promise.all使用）
- [x] Lambda制限時間チェック（14分で早期終了）

### 2.5 ProcessingSession更新
- [x] `updateProcessingSessionDeletionTime` 関数を実装（**Phase 1.5で完了**）
  ```javascript
  const updateProcessingSessionDeletionTime = async (sessionId) => {
    const params = {
      TableName: PROCESSING_SESSION_TABLE,
      Key: { id: sessionId },
      UpdateExpression: 'SET filesDeletionTime = :deletionTime',
      ExpressionAttributeValues: {
        ':deletionTime': new Date().toISOString()
      }
    };
    // 実装詳細...
  };
  ```

---

## 📊 Phase 3: ログ・監視機能

### 3.1 ログ出力強化
- [x] 実行開始・終了ログ（**Phase 1.5で実装済み**）
- [x] 処理セッション数のカウント（**Phase 2で実装済み**）
- [x] 成功・失敗数の集計（**Phase 2で実装済み**）
- [x] 実行時間の計測（**Phase 1.5で実装済み**）
- [x] エラー詳細の記録（**Phase 1.5で実装済み**）

### 3.2 ログレベル対応
- [x] `LOG_LEVEL=info` の標準ログ実装（**Phase 1.5で実装済み**）
  ```javascript
  {
    totalSessions: 150,
    processedSessions: 150,
    successCount: 148,
    failedCount: 2,
    executionTimeMs: 12340,
    partialProcessing: false,
    errors: [
      { sessionId: "xxx", error: "S3 delete failed" }
    ]
  }
  ```
- [x] `LOG_LEVEL=debug` の詳細ログ実装（**Phase 1.5で実装済み**）
  - [x] 各セッション処理の詳細
  - [x] リトライ回数と結果
  - [x] バッチ処理の詳細

### 3.3 エラーハンドリング強化
- [x] バッチ失敗時の個別処理切り替え（**Phase 2で実装済み**）
- [x] 部分失敗時の処理継続（**Phase 2で実装済み**）
- [x] クリティカルエラー時の早期終了（**Phase 2で実装済み**）

---

## 🚀 Phase 4: デプロイ・テスト

### 4.1 デプロイ前確認
- [x] `amplify status` で変更内容を確認
  - [x] Function: `cleanupExpiredFiles` (Create)
  - [x] Api: `transcriptminute` (schema.graphql変更は既に適用済み)
- [x] CloudFormationテンプレートの内容確認
- [x] IAM権限の確認

### 4.2 デプロイ実行
- [x] `amplify push` を実行（**初回失敗**）
  - **問題**: CloudFormationテンプレートでリソース参照エラー発生
  - **対策**: `custom-policies.json`を一時的に空に設定
- [ ] **再デプロイ実行中** - `amplify push --yes`
- [ ] デプロイ成功を確認
- [ ] CloudWatchでスケジュール設定を確認
- [ ] EventBridge Ruleの作成確認
- [x] **S3削除権限の問題解決済み**
  - [x] 既存関数 (`deleteGeneratedFiles`) の権限設定パターンを調査
  - [x] `function-parameters.json` に s31d11b5d9 delete権限を追加
  - [x] 出力バケット名を特定: `transcriptminute-output-0148238a949-internal`
  - [ ] **最終デプロイ実行待ち**

### 4.3 動作テスト
- [ ] **デプロイ確認（コンソール）**
  - [ ] Lambda関数 `cleanupExpiredFiles-internal` の存在確認
  - [ ] 環境変数の設定確認（特にSTORAGE_OUTPUTBUCKET_BUCKETNAME）
  - [ ] EventBridge Rule `cron(0 * * * ? *)` の確認
  - [ ] IAM権限（S3削除、DynamoDB読み書き）の確認
- [ ] **手動実行テスト**
  - [ ] AWS Lambdaコンソールでテスト実行
  - [ ] CloudWatchログの確認
  - [ ] ProcessingSessionテーブルの状態確認
- [ ] **スケジュール実行テスト**
  - [ ] 1時間待機してスケジュール実行を確認
  - [ ] 処理結果の確認
- [ ] **エラーケーステスト**
  - [ ] 存在しないファイルの削除試行
  - [ ] S3権限エラーの動作確認

---

## 📋 完了後の確認項目

### デプロイ確認
- [ ] Lambda関数が正常に作成されている
- [ ] EventBridge Ruleが `cron(0 * * * ? *)` で設定されている
- [ ] IAM権限が適切に設定されている
- [ ] 環境変数が正しく設定されている

### 機能確認
- [ ] 2時間以上古いProcessingSessionが正常に検出される
- [ ] S3ファイルが正常に削除される
- [ ] `filesDeletionTime` が正常に更新される
- [ ] エラー時にログが適切に出力される

### 監視設定
- [ ] CloudWatchアラーム設定（オプション）
  - [ ] Lambda実行エラー監視
  - [ ] 実行時間超過監視
- [ ] ログ保存期間の設定（デフォルト: 無期限 → 30日推奨）

---

## 🔧 実装時の注意事項

### コード品質
- [ ] エラーハンドリングを各段階で適切に実装
- [ ] ログ出力は構造化されたJSON形式を使用
- [ ] 環境変数は全て検証してから使用
- [ ] 非同期処理は適切にawaitする

### セキュリティ
- [ ] S3オブジェクトキーのパス検証
- [ ] DynamoDBクエリのインジェクション対策
- [ ] 権限は最小限の範囲に限定

### パフォーマンス
- [ ] DynamoDBスキャンのページネーション対応
- [ ] S3削除のバッチ処理（最大1000オブジェクト/回）
- [ ] メモリ使用量の最適化

---

## ⚠️ リスク事項

### 実装上のリスク
- [ ] **データ削除の不可逆性**: テスト環境での十分な検証が必要
- [ ] **実行時間超過**: 大量データ時のLambda timeout（15分制限）
- [ ] **権限エラー**: S3バケットへのアクセス権限不備

### 運用上のリスク
- [ ] **スケジュール重複**: 前回実行が完了前に次回実行開始
- [ ] **部分失敗**: 一部ファイル削除失敗時の整合性
- [ ] **監視不足**: 削除失敗の検知遅れ

---

## 📚 参考資料

- **既存実装**: `amplify/backend/function/deleteGeneratedFiles/src/index.js`
- **スケジュール設定**: `amplify/backend/function/monthlyReset/parameters.json`
- **IAM権限**: `amplify/backend/function/generationWorker/custom-policies.json`
- **実装方針書**: `tasks/0.2.x/scheduled_file_cleanup_implementation_plan.md` 