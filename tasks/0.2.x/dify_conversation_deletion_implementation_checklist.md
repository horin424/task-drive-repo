# Dify会話ログ削除機能 実装チェックリスト

## Step 1: difyClient.js の修正 ❌取り消し完了

### 実装取り消し理由
- **Dify APIはソフトデリート（論理削除）のみ対応**
- **完全削除の要件を満たさないため実装を取り消し**

### 1.1 deleteConversation関数の追加
- [x] ~~`amplify/backend/function/generationWorker/src/lib/difyClient.js` を開く~~
- [x] ~~290行目付近（export文の前）に`deleteConversation`関数を追加~~
- [x] ~~axios.deleteを使用してDELETE /conversations/:conversation_id を実装~~
- [x] ~~エラーハンドリングを追加（ログ出力のみ、例外は投げない）~~
- [x] **🗑️ deleteConversation関数を完全削除**

### 1.2 generateBulletPoints関数の修正
- [x] ~~116行目の`generateBulletPoints`関数を修正~~
- [x] ~~`conversationIds`配列を追加して各チャンクのconversation_idを保存~~
- [x] ~~140行目付近で`response.data.conversation_id`を取得・保存~~
- [x] ~~146行目のreturn前に削除処理を追加~~
- [x] ~~環境変数`DIFY_DELETE_CONVERSATIONS`をチェック~~
- [x] ~~Promise.allで並列削除実行~~
- [x] **🔄 元の状態に復元完了**

### 1.3 generateMinutes関数の修正
- [x] ~~154行目の`generateMinutes`関数を修正~~
- [x] ~~170行目付近で`response.data.conversation_id`を取得~~
- [x] ~~172行目のreturn前に削除処理を追加~~
- [x] ~~環境変数チェックと削除処理を実装~~
- [x] **🔄 元の状態に復元完了**

### 1.4 generateTasks関数の修正
- [x] ~~180行目の`generateTasks`関数を修正~~
- [x] ~~`conversationId`変数を追加（202行目付近）~~
- [x] ~~ストリーム処理部分（226-268行目）でconversation_id抽出を追加~~
- [x] ~~281行目のreturn前に削除処理を追加~~
- [x] **🔄 元の状態に復元完了**

### 1.5 exportの更新
- [x] ~~284行目のexport文に`deleteConversation`を追加~~
- [x] **🔄 元の状態に復元完了**

## Step 2: 環境変数設定

### 2.1 generationWorker CloudFormationテンプレート更新
- [x] `amplify/backend/function/generationWorker/generationWorker-cloudformation-template.json` を開く（amplify update function で実施済）
- [x] Parameters section に`difyDeleteConversations`パラメータを追加
- [x] Environment Variables section に`DIFY_DELETE_CONVERSATIONS`を追加

### 2.2 generationWorker parameters.json更新
- [x] `amplify/backend/function/generationWorker/parameters.json` を更新（amplify update function で自動反映）
- [x] `"difyDeleteConversations": "true"`を追加

### 2.3 backend-config.json更新
- [x] `amplify/backend/backend-config.json` を更新（CLI により自動反映）
- [x] generationWorker section に`difyDeleteConversations`参照を追加

### 2.4 team-provider-info.json更新
- [x] `amplify/team-provider-info.json` を更新（CLI により自動反映）
- [x] 各環境のgenerationWorker sectionsに`"difyDeleteConversations": "true"`を追加

---

## Step 3: テスト

### 3.1 ローカルテスト
- [ ] `amplify mock function generationWorker` でローカル実行（スキップ）

### 3.2 デプロイ前確認
- [x] コード構文エラーがないことを確認
- [x] eslintエラーがないことを確認
- [x] 全ての必要なファイルが更新されていることを確認

### 3.3 dev環境デプロイ・テスト
- [x] `amplify push` でdev環境にデプロイ
- [x] 実機テスト（箇条書き/議事録/タスク）
- [ ] CloudWatch Logsで削除成功ログを確認（実行済み）

### 3.4 環境変数OFF テスト
- [ ] team-provider-info.jsonで`"difyDeleteConversations": "false"`に変更してテスト

### 3.5 エラーハンドリングテスト
- [ ] 無効なconversation_idで削除処理をテストし、ログを確認

### 3.6 調査用ログ追加（TODO解消後削除予定）
- [x] deleteConversation関数にDELETEレスポンス詳細ログを追加
- [x] deleteConversation関数にDELETE後の会話存在確認ログを追加（405エラーで無効と判明）
- [x] 各生成関数にconversation_id取得状況ログを追加
- [x] 各生成関数にuserパラメータ確認ログを追加
- [x] 調査結果: DELETE APIは成功するが実際に削除されない（Dify側の問題）
- [x] GET確認ログを削除し、削除前1分待機に変更（会話完了から時間を置いて削除）
- [ ] 次回テスト実行してDify管理画面で会話削除を確認
- [ ] 調査完了後、追加ログを削除

## Step 4: 本番適用

### 4.1 staging環境テスト
- [ ] staging環境にデプロイ
- [ ] 全機能テスト実行
- [ ] 削除動作確認

### 4.2 prod環境デプロイ
- [ ] prod環境にデプロイ
- [ ] 動作確認

## 🛑 機能取り消し完了確認

### ✅ 削除確認済み項目
- [x] **deleteConversation関数**: 完全削除済み
- [x] **conversation_id関連コード**: 全て削除済み
- [x] **削除処理ロジック**: 全て削除済み
- [x] **調査用ログ**: 全て削除済み
- [x] **export更新**: 元の状態に復元済み

### ✅ 動作確認項目
- [x] **generateBulletPoints**: 元の動作に戻っている
- [x] **generateMinutes**: 元の動作に戻っている  
- [x] **generateTasks**: 元の動作に戻っている
- [x] **既存機能**: 影響なし

### 📋 取り消し理由記録
- **Dify API仕様**: ソフトデリート（論理削除）のみ対応
- **要件不適合**: 完全削除が不可能
- **実装判断**: 要件を満たさないため機能取り消し

## ~~注意事項~~ ❌削除済み

~~削除機能が取り消されたため、注意事項は不要~~ 