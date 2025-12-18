# タスク一覧生成回数制限機能 実装チェックリスト

## 📋 概要
- **機能**: 組織ごとにタスク一覧生成の月間利用回数を制限
- **初期値**: タスク生成100回/月、使用時間6000分/月
- **既存データ対応**: Lambda関数でのデフォルト値処理による自動適用

---

## 🏗️ Phase 1: データモデル拡張

### GraphQL スキーマ更新
- [x] `amplify/backend/api/transcriptminute/schema.graphql` を編集
  - [x] `Organization` モデルに以下フィールドを追加:
    ```graphql
    remainingTaskGenerations: Int!           # 残りタスク生成回数
    monthlyMinutes: Int                      # 月間リセット用の使用時間値
    monthlyTaskGenerations: Int              # 月間リセット用のタスク生成回数値
    ```
  - [x] 新しいミューテーションを追加:
    ```graphql
    decreaseOrganizationTaskGenerations(input: DecreaseOrganizationTaskGenerationsInput!): Organization 
      @function(name: "decreaseOrgTaskGenerations-${env}")
    ```
  - [x] 入力型を追加:
    ```graphql
    input DecreaseOrganizationTaskGenerationsInput {
      id: ID!
      decreaseBy: Int!
    }
    ```

### 型定義更新
- [x] `amplify codegen` を実行して `src/API.ts` を自動生成
- [x] `src/types/index.ts` の確認完了（既存の再エクスポートで対応済み）
  - 新しいフィールドが自動生成された型に含まれることを確認:
    - `remainingTaskGenerations: number`
    - `monthlyMinutes?: number | null`
    - `monthlyTaskGenerations?: number | null`

### デプロイ確認
- [x] `amplify status` で変更を確認
- [x] `amplify push` でスキーマ変更をデプロイ
- [x] 型定義の自動生成完了

---

## 🔧 Phase 2: Lambda 関数実装

### 新しい Lambda 関数作成
- [x] `amplify add function` で `decreaseOrgTaskGenerations` を作成
  - [x] 関数名: `decreaseOrgTaskGenerations`
  - [x] ランタイム: `NodeJS`
  - [x] テンプレート: `Hello World`
  - [x] 高度な設定: `Yes`
  - [x] Storage権限: Organization テーブルへの読み書き権限を追加
  - [x] 権限設定の修正完了（API権限→Storage権限に変更）

- [x] `src/index.js` を実装:
  - [x] DynamoDB クライアントの設定
  - [x] 入力値検証（id, decreaseBy）
  - [x] アトミック減算処理の実装
  - [x] 条件チェック（remainingTaskGenerations >= decreaseBy）
  - [x] エラーハンドリング（ConditionalCheckFailedException対応）
  - [x] 適切なログ出力

- [x] `package.json` を更新:
  - [x] `"type": "module"` を追加（ES Modules対応）

- [x] `amplify push` でデプロイ
- [ ] 動作テスト（一旦スルー）

### 既存 Lambda 関数の拡張

#### `generationWorker` の修正
- [x] `amplify/backend/function/generationWorker/src/lib/graphqlClient.js` を編集
  - [x] `decreaseOrganizationTaskGenerationsMutation` を追加
  - [x] `decreaseTaskGenerations` 関数を実装
  - [x] エクスポートに新しい関数を追加

- [x] `amplify/backend/function/generationWorker/src/index.mjs` を編集
  - [x] `decreaseTaskGenerations` 関数をインポート
  - [x] タスク一覧生成完了時の処理に回数減算を追加:
    - [x] ProcessingSession から organizationID を取得
    - [x] タスク生成完了時に `decreaseTaskGenerations(organizationId, 1)` を呼び出し
    - [x] エラーハンドリング（エラーでも処理継続）
    - [x] 適切なログ出力

- [ ] テスト実行（一旦スルー）

#### `resetRemainingMinutesFunction` の改名・拡張
- [x] `amplify add function` で `monthlyReset` を新規作成
- [x] スケジュール設定: `0 15 L * ? *` (毎月最終日15:00 UTC)
- [x] 権限設定: Organization テーブルへの読み書き権限を追加
- [x] 既存コードを移植・拡張:
  - [x] 既存の `resetRemainingMinutesFunction` コードを移植
  - [x] デフォルト値を新しい値に変更（使用時間: 1000分、タスク生成: 50回）
  - [x] 組織データの正規化処理を実装
  - [x] タスク生成回数のリセット処理を追加
  - [x] 組織ごとのリセット値設定に対応
  - [x] 既存組織の null フィールド対応
- [x] `package.json` に `"type": "module"` を追加
- [x] `amplify push` でデプロイ
- [x] 既存関数のバックアップ作成（`backup/resetRemainingMinutesFunction/`）
- [x] 旧関数の削除（`amplify remove function resetRemainingMinutesFunction`）

---

## 🎨 Phase 3: フロントエンド実装

### AppHeader コンポーネント拡張
- [x] `src/components/AppHeader.tsx` を編集
- [x] 残りタスク生成回数の表示を追加:
  ```tsx
  <span className={styles.label}>残りタスク生成回数：</span>
  <span>
      {organization?.remainingTaskGenerations !== undefined 
          ? `${organization.remainingTaskGenerations} 回` 
          : '未設定'}
  </span>
  ```

### GenerationOptions コンポーネント拡張
- [x] `src/components/GenerationOptions.tsx` を編集
- [x] タスク生成チェックボックスの無効化処理:
  - [x] `useSessionStore` から組織情報を取得
  - [x] `isTaskGenerationDisabled` による無効化判定
  - [x] チェックボックスの `disabled` 属性設定
  - [x] 無効化時の表示メッセージ追加
- [x] CSS スタイル追加:
  - [x] `.disabled` クラス（透明度とカーソル変更）
  - [x] `.disabledNote` クラス（エラーメッセージ用）

### データフェッチング更新
- [x] `src/graphql/queries.ts` の `getOrganization` クエリを確認
- [x] 新しいフィールドが含まれていることを確認:
  ```graphql
  remainingTaskGenerations
  monthlyMinutes
  monthlyTaskGenerations
  ```
- [x] `src/stores/sessionStore.ts` の型定義を更新
  - [x] `OrganizationState` 型に新しいフィールドを追加
  - [x] `refreshOrganization` でのデフォルト値処理追加
- [x] `src/hooks/useAuthInit.ts` でのデフォルト値処理を追加

### エラーハンドリング
- [x] `src/hooks/useContentGeneration.ts` を編集
- [x] タスク生成回数不足エラーのハンドリング追加:
  - [x] 生成リクエスト前の残り回数チェック
  - [x] 回数不足時の専用エラーメッセージ
  - [x] エラー時の組織情報更新処理
- [x] ユーザーフレンドリーなエラーメッセージ表示:
  - [x] 回数不足時の詳細メッセージ（月末リセット案内含む）
  - [x] 特別なトーストスタイル（警告アイコン、長時間表示）

---

## 🔧 Phase 4: デフォルト値更新・Lambda関数拡張 ✅ **完了**

### デフォルト値の変更（50回→100回、1000分→6000分）
- [x] `monthlyReset` Lambda関数のデフォルト値を更新
- [x] フロントエンド（`sessionStore.ts`, `useAuthInit.ts`）のデフォルト値を更新
- [x] `useContentGeneration.ts` のデフォルト値更新（0→100回）

### 組織データ正規化モジュールの作成
- [x] `lib/organizationDataNormalizer.js` ファイルを作成:
  - [x] **⚠️ 将来削除予定の機能として実装**
  - [x] `normalizeAndEnsureOrganizationDefaults` 関数（DB更新あり）
  - [x] `normalizeOrganizationDataInMemory` 関数（メモリ上のみ）
  - [x] デフォルト値定数の定義（6000分/100回）
  - [x] 初期値チェック・設定機能の実装
  - [x] 2つのLambda関数に同じモジュールをコピー配置完了（generationWorkerは不要と判断）

### Lambda関数での呼び出し実装
- [x] `transcriptionProcessor` に正規化モジュール呼び出しを追加:
  - [x] import文の追加（⚠️将来削除予定コメント付き）
  - [x] `markTranscriptionComplete` 関数での呼び出し
  - [x] 使用時間不足チェックの追加
- [x] `generationWorker` にシンプルな回数チェックを追加:
  - [x] タスク生成前の回数チェック処理を追加
  - [x] DynamoDB直接取得 + デフォルト値適用（`?? 100`）
  - [x] 過剰な正規化モジュールを削除して簡素化
- [x] `decreaseOrgTaskGenerations` をシンプル化:
  - [x] 不要な正規化モジュールを削除
  - [x] DynamoDB条件付き更新のみで十分と判断
  - [x] ConditionalCheckFailedException で残高不足を検出

### Phase 4 完了サマリー ✅
- [x] **デフォルト値更新**: 全ファイルで 50回→100回、1000分→6000分 に更新完了
- [x] **正規化モジュール作成**: 将来削除予定機能として独立実装完了
- [x] **Lambda関数統合**: transcriptionProcessor と decreaseOrgTaskGenerations に統合完了
- [x] **既存組織対応**: 初期値がない組織への自動デフォルト値設定機能完了
- [x] **残高チェック強化**: 使用時間・タスク生成回数の事前チェック機能追加完了

### 🐛 テスト中に発見された問題と修正
- [x] **GraphQLスキーマエラー修正**: `remainingTaskGenerations: Int!` → `Int` に変更
  - **問題**: 既存組織の `null` 値が非null制約に違反
  - **解決**: nullable に変更してフロントエンドでデフォルト値処理
- [x] **GraphQL認証エラー修正**: `decreaseOrganizationTaskGenerations` にIAM認証を追加
  - **問題**: `generationWorker` から新しいミューテーションへのアクセス拒否
  - **解決**: `@auth(rules: [{ allow: private, provider: iam }])` を追加
- [x] **セキュリティ強化**: `generationWorker` にタスク生成前チェックを追加
  - **問題**: フロントエンドチェックのみでは回避される可能性
  - **解決**: バックエンドでもタスク生成前に残り回数をチェック
- [x] **実装簡素化**: 過剰な正規化モジュールを削除
  - **問題**: 正規化モジュールが過剰で不要
  - **解決**: シンプルな `?? 100` デフォルト値適用に変更

---

## 🧪 Phase 5: 既存データ対応・テスト

### 既存データ対応の確認
- [x] `monthlyReset` での既存データ対応（既に実装済み）
- [ ] Lambda関数でのデフォルト値処理による既存組織対応を確認
- [ ] フロントエンドでの null チェック処理の動作確認

### テスト項目
#### 新規組織での動作確認
- [ ] 新規組織作成時にデフォルト値が適用されることを確認
- [ ] タスク生成回数が正常に減算されることを確認
- [ ] 月間リセットが正常に動作することを確認

#### 既存組織での動作確認
- [x] 既存組織でデフォルト値が適用されることを確認
- [x] `null` フィールドが正常に処理されることを確認
- [x] 既存機能に影響がないことを確認

#### エラーケースのテスト
- [ ] タスク生成回数が0の場合のUI無効化を確認
- [ ] 回数不足時のエラーメッセージを確認
- [ ] 同時実行時の競合状態テスト

### パフォーマンステスト
- [ ] 大量の組織データでの月間リセット処理時間を確認
- [ ] DynamoDB の読み書き性能を確認
- [ ] フロントエンドの表示速度を確認

---

## 🚀 デプロイ・運用

### 本番環境デプロイ
- [ ] 開発環境での完全テスト完了
- [ ] `amplify env checkout prod` で本番環境に切り替え
- [ ] `amplify push` で本番環境にデプロイ
- [ ] 本番環境での動作確認

### 監視・ログ設定
- [ ] CloudWatch での Lambda 関数ログ確認
- [ ] エラー率・実行時間の監視設定
- [ ] 月間リセット処理の成功/失敗アラート設定

### ドキュメント更新
- [ ] README.md の機能説明を更新
- [ ] システム説明資料の更新
- [ ] 運用手順書の作成

---

## 📊 完了確認

### 機能確認チェックリスト
- [ ] 残りタスク生成回数がAppHeaderに表示される
- [ ] 回数不足時にタスク生成チェックボックスが無効化される
- [ ] タスク生成完了時に回数が1減る
- [ ] 月間リセット時に回数と使用時間が復活する
- [ ] 既存組織でもデフォルト値が適用される
- [ ] エラー時に適切なメッセージが表示される

### 最終確認
- [ ] 全ての変更がGitにコミットされている
- [ ] 本番環境での動作確認完了
- [ ] ユーザー向け案内の準備完了
- [ ] 機能のリリースノート作成完了

### 🧹 最終クリーンアップ（機能が安定稼働後）
- [ ] バックアップファイルの削除（`rm -rf backup/resetRemainingMinutesFunction/`）
- [ ] 不要になったドキュメントの整理
- [ ] 開発用コメントやログの最終調整

---

**作成日**: 2024年7月23日  
**更新日**: 2024年7月23日  
**ステータス**: 実装準備完了

## 🎯 実装優先度
1. **高優先度**: Phase 1 (データモデル) → Phase 2-新規Lambda → Phase 3-UI表示
2. **中優先度**: Phase 2-既存Lambda拡張 → Phase 3-エラーハンドリング
3. **低優先度**: Phase 4-テスト → デプロイ・運用

各チェックボックスにチェックを入れながら、段階的に実装を進めてください！ 