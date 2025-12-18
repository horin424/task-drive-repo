# CloudWatch RUM 実装チェックリスト

## 概要・参照
- **対象**: transcript-minute アプリケーション  
- **実装範囲**: 認証済みユーザーのみのRUM監視  
- **詳細実装内容**: [cloudwatch_rum_implementation_plan.md](./cloudwatch_rum_implementation_plan.md) を参照

---

## Phase 1: 環境準備

### 🔧 AWS設定確認
- [ ] AWSアカウント・リージョン確認済み (us-east-1)

### 📋 既存リソース確認  
- [ ] Cognito Identity Pool ID確認
  - Pool ID: `___________________________`
- [ ] IAMロール名確認
  - Auth Role: `___________________________`
  - Unauth Role: `___________________________`

### 🔧 Identity Pool設定変更
- [ ] `allowUnauthenticatedIdentities: true` に変更完了
- [ ] 設定変更方法: □ CLI □ コンソール

---

## Phase 2: CDKカスタムリソース作成

### 📦 Amplify CDKカスタムリソース作成
- [ ] `amplify add custom` 実行 (リソース名: cloudwatchrum)
- [ ] CDK v2依存関係追加完了
- [ ] `npm install` 実行完了

### 🏗️ CDK Stack実装
- [ ] `cdk-stack.ts` 実装完了 ※詳細は実装方針書参照
- [ ] Amplifyドメイン確認・設定更新
- [ ] 重要修正点確認: □CDK v2 □実ARN取得 □Identity Pool ID

### 🪝 Amplify Hooks設定
- [ ] `amplify/hooks/post-push.js` 作成完了 ※詳細は実装方針書参照

### 🚀 CDKデプロイ
- [ ] `amplify build` 成功
- [ ] `amplify push -y` 成功
- [ ] **記録**: デプロイ後のOutput
  - AppMonitorId: `_________________________`
  - IdentityPoolId: `_________________________`
  - GuestRoleArn: `_________________________`
- [ ] CloudFormationスタック正常完了確認
- [ ] Amplify Hooks正常実行確認

---

## Phase 3: IAM権限設定

### 🔐 Auth Role権限追加
- [ ] IAMコンソールでAuth Role開く
- [ ] インラインポリシー作成: `CloudWatchRUMAccess`
- [ ] ポリシー内容設定 ※詳細は実装方針書参照
- [ ] ポリシー保存・適用完了

### 🔐 Unauth Role権限追加
- [ ] IAMコンソールでUnauth Role開く  
- [ ] インラインポリシー作成: `CloudWatchRUMAccess`
- [ ] ポリシー内容設定 ※詳細は実装方針書参照
- [ ] ポリシー保存・適用完了
- [ ] **確認**: Conditionは使用していない（403エラー回避）

---

## Phase 4: 環境変数設定

### 📝 環境変数型定義追加
- [ ] `src/types/environment.d.ts` 更新完了 ※詳細は実装方針書参照

### 🌍 環境変数設定
- [ ] Amplify Hooks出力値確認完了
- [ ] `.env.local.rum` ファイル確認
- [ ] 本番環境変数設定（Amplify Console）
  - [ ] RUM関連環境変数5つ設定完了

---

## Phase 5: 依存関係追加

### 📦 npm パッケージインストール
- [ ] `npm install aws-rum-web` 実行完了
- [ ] 型定義確認・追加（必要に応じて）

---

## Phase 6: フロントエンド実装

### 🎯 RUM Provider作成
- [ ] `src/providers/RumProvider.tsx` 作成完了 ※詳細は実装方針書参照
- [ ] 認証状態監視ロジック実装
- [ ] Dynamic Import + エラーハンドリング実装

### 🔗 Layout統合
- [ ] `src/app/layout.tsx` 更新完了 ※詳細は実装方針書参照
- [ ] RumProvider配置確認（QueryProviderの外側）

---

## Phase 7: テスト・検証

### 🧪 開発環境テスト
- [ ] `npm run dev` 起動
- [ ] ブラウザコンソール確認: RUM初期化ログ
- [ ] 認証フロー確認: ログイン前後のRUM動作
- [ ] ネットワークタブ確認: RUMエンドポイントへのPOST

### 📊 機能確認
- [ ] ページナビゲーション記録確認
- [ ] エラー監視動作確認
- [ ] パフォーマンス監視動作確認

---

## Phase 8: AWS側確認

### 📈 CloudWatch RUM コンソール
- [ ] App Monitor確認: `app-monitor-transcript-minute-dev`
- [ ] データ受信確認: Page loads, Performance, Errors
- [ ] User journey確認

### 🔍 インフラ確認
- [ ] CloudFormationスタック正常完了確認
- [ ] Amplify Meta出力値確認

---

## Phase 9: 本番デプロイ

### 🚀 本番環境準備
- [ ] `npm run build` 成功
- [ ] 本番環境変数設定完了
- [ ] `amplify push -y` 本番デプロイ成功
- [ ] 本番環境動作確認

---

## Phase 10: 運用開始

### 📊 運用設定
- [ ] 定期監視スケジュール設定
- [ ] 月次課金確認計画
- [ ] RUMデータ活用手順文書化

### 📝 完了記録
- [ ] 実装完了報告
- [ ] チーム共有完了
- [ ] 将来拡張計画検討

---

## トラブルシューティング（問題発生時）

### ❌ 主要エラーパターン
- [ ] RUM初期化失敗 → コンソール・IAM・環境変数確認
- [ ] データ送信失敗 → ネットワーク・認証・サンプリング確認  
- [ ] CDKデプロイ失敗 → 依存関係・ARN・パラメータ確認
- [ ] Hooks失敗 → スタック状態・Output値確認

※詳細な対処法は実装方針書を参照

---

## 📋 完了記録

- **実装開始日**: _______________
- **実装完了日**: _______________  
- **実装者**: _______________
- **レビュー者**: _______________
- **本番デプロイ日**: _______________

## 📚 参考資料

- [実装方針書（詳細コード・設定）](./cloudwatch_rum_implementation_plan.md)
- [AWS CloudWatch RUM公式ドキュメント](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-RUM.html) 