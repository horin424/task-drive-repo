# フロントエンド UI/UX 仕様書

## 1. 目的と範囲

本仕様は、フロントエンド（Next.js/TypeScript）実装に準拠したUI/UX要件を定義する。画面フロー、主要コンポーネント、状態遷移、バリデーション、アクセシビリティ、エラーハンドリングを対象とする。

## 2. 画面フローとUIステップ

- ステップは `src/providers/SessionMonitor.tsx` によりセッション状態から自動制御される。
  - `upload`: セッション未作成時（初期）
  - `transcribe`: `UPLOADED` / `PROCESSING_TRANSCRIPTION`
  - `edit`: `PENDING_SPEAKER_EDIT`
  - `generate`: `SPEAKER_EDIT_COMPLETED` 以降（各PROCESSING/COMPLETED含む）
  - `results`: `ALL_COMPLETED`
- 画面構成（`src/app/page.tsx`）
  - 認証ラッパ（Amplify Authenticator）
  - `AppHeader`（ユーザー/組織/バージョン/更新履歴）
  - メンテナンス告知（非Adminのみ）
  - メイン領域：`ProgressIndicator` + `MediaUploader`（内部で結果表示/生成操作へ遷移）

## 3. ヘッダー（`src/components/AppHeader.tsx`）

- 表示項目
  - ユーザー名、組織名
  - 残り使用時間（分）
  - 残りタスク一覧生成回数（回）
- 操作
  - 更新履歴モーダル起動
  - サインアウト

## 4. メディアアップロード（`src/components/MediaUploader.tsx`）

- 要件
  - 音声/動画アップロード後に `ProcessingSession` を作成し、ステータスを `UPLOADED` に設定
  - S3配置は `private/{identityId}/{sessionId}/{fileName}`
- バリデーション
  - 対応拡張子/最大サイズ（実装既定に準拠）
  - エラー時のトースト表示

## 5. 文字起こし結果/編集（`src/components/TranscriptionResult.tsx`）

- データ取得
  - `useTranscriptionResult`: テキスト、箇条書き、議事録、JSON(`words`) を読み込み
- 話者編集
  - JSON形式（`transcriptFormat=JSON`）のみ編集可（TEXTは再編集不可）
  - `SpeakerNameEditor` でブロック単位編集/音声プレビュー（`getAudioPresignedUrl`）
  - 保存時にプレーンテキスト生成しS3へ上書き、`transcriptFormat=TEXT` に更新
- 結果表示
  - 文字起こしテキストは話者タグ/色分け表示（`utils/transcriptParser` + `utils/speakerColors`）
  - 箇条書き（リスト）、議事録（段落）、タスク（生成済みメッセージ）
- エラー表示
  - `TRANSCRIPTION_FAILED`/`BULLETS_FAILED`/`MINUTES_FAILED`/`TASKS_FAILED` をセクションごとに明示

## 6. コンテンツ生成（選択式）

- UI（`src/components/GenerationOptions.tsx`）
  - チェックボックス: 箇条書き/議事録/タスク一覧
  - `localStorage` に選択状態を保存・復元（`src/hooks/useGenerationOptions.ts`）
  - 残回数=`0` でタスク一覧は自動無効化/説明表示（`sessionStore.organization.remainingTaskGenerations`）
- 生成操作（`TranscriptionResult` 内）
  - ステータスが `SPEAKER_EDIT_COMPLETED` のとき操作表示
  - 選択状態から `processingTypes` を構築（空は禁止）
  - タスク一覧選択時は 2 ファイル（`task.xlsx`/`information.xlsx`）のアップロード必須（S3へ配置後キーを渡す）
  - 実行時は `generationProcessor` へ送信（`202 Accepted`）、以後の進捗はSubscriptionで反映
  - 生成中はスピナー/メッセージ（種別別）を表示し、ボタンを無効化

## 7. ダウンロード/削除

- 一括ダウンロード（`src/hooks/useFileDownload.ts`）
  - 生成済み成果のみZIPに含める（テキスト/議事録/タスクxlsx）
  - ダウンロード後に `deleteGeneratedFiles` を呼び出す（失敗時はトースト）
- ダウンロード済み状態
  - ボタン非表示/「ダウンロード済み」表示

## 8. 状態管理（Zustand）

- `src/stores/sessionStore.ts`: user, organization, currentSession など
- `src/stores/uiStore.ts`: currentStep, changelogモーダル状態
- `src/providers/SessionMonitor.tsx`: `currentSession.status` に基づき `currentStep` を自動更新

## 9. アクセシビリティ/UX原則

- フォーカス可視化、`disabled` 時の視覚状態、トーストでの明確な失敗/成功通知
- 主要操作はボタン提供（キーボード操作可）
- 長処理はスピナーと進捗文言を表示、成功/失敗はセクション単位で反映

## 10. エラーハンドリング

- 文字起こし失敗: 明細メッセージ/リトライ導線
- 生成失敗: セクション別に失敗表示、他セクションは継続
- アップロード失敗: 明確なトースト

## 11. 国際化

- 対応言語: ja/en（言語はセッションの `language` に準拠）
- UI文言は日本語を既定（将来i18n化予定）

## 12. パフォーマンス

- 非同期二段LambdaによりAPI Gatewayタイムアウト回避
- 生成中はポーリングせずSubscription反映

## 13. 将来拡張

- 選択式生成の環境別既定ON/OFF
- 話者編集のUNDO/REDO、部分保存
- タスク一覧のプレビュー/再生成
