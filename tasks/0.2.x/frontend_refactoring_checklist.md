### フロントエンドリファクタリング 実施チェックリスト

このドキュメントは `frontend_refactoring_plan.md` に基づき、実際に行う作業をタスク単位でリスト化したものです。

### フェーズ1: 横断的基盤の整備 (APIクライアント / utils / 型集約)
- [x] **1. ライブラリのインストール**
    - [x] `npm install zustand`
    - [x] `npm install @tanstack/react-query`

- [x] **2. ディレクトリ構造の準備**
    - [x] `src/lib` ディレクトリを作成
    - [x] `src/stores` ディレクトリを作成
    - [x] `src/hooks` ディレクトリを作成
    - [x] `src/components/ui` ディレクトリを作成

- [x] **3. APIクライアントの集約 (`src/lib`)**
    - [x] `api.ts`: GraphQLクライアント(`generateClient`)を初期化し、各種クエリ/ミューテーションを呼び出す関数を定義する。
    - [x] `storage.ts`: `getUrl`, `uploadData`などS3関連の処理をまとめる。
    - [x] `difyApi.ts`: 既存の`src/utils/difyApi.ts`を`src/lib`に移動し、責務を明確化する。

- [x] **4. ユーティリティ関数の集約 (`src/utils`)**
    - [x] `formatters.ts`: `formatDuration` などのフォーマット用関数を移管する。
    - [x] `transcriptParser.ts`: `TranscriptionResult`で使われている話者タグ解析ロジックを移管する。
    - [x] `errorHandler.ts`: アプリケーション全体で利用する共通エラーハンドリング関数を定義する。

- [x] **5. 型定義の集約**
    - [x] `src/types/index.ts` を作成し、`ProcessingStatus` や `SpeakerMap` など、プロジェクト固有のカスタム型を集約する。

- [x] **6. 状態管理の雛形作成**
    - [x] `src/stores/sessionStore.ts`: Zustandを使い、ユーザー情報や組織情報を管理するストアの雛形を作成する。
    - [x] `src/stores/uiStore.ts`: Zustandを使い、UIの状態（プロセスステップ、モーダル開閉など）を管理するストアの雛形を作成する。
    - [x] `src/app/layout.tsx`: アプリケーションのルートをTanStack Queryの`QueryClientProvider`でラップする。

### フェーズ2: ロジックの分離 & コンポーネント再構築
- [x] **1. `page.tsx` の初期化ロジック分離**
    - [x] `src/hooks/useAuthInit.ts`: `page.tsx`内の認証確認、ユーザー・組織情報の取得・作成ロジックをこのフックに移管する。

- [x] **2. `MediaUploader.tsx` のロジック分離**
    - [x] `src/hooks/useMediaUpload.ts`: ファイル処理、S3アップロード、セッション作成、サブスクリプション管理のロジックを移管する。API呼び出しには`@tanstack/react-query`を使用する。

- [x] **3. `TranscriptionResult.tsx` の再実装**
    - [x] `useTranscriptionResult` フックを利用して、データ取得と表示ロジックを実装する。
    - [x] 話者編集、コンテンツ生成、ダウンロード機能は一時的に無効化し、後続のタスクで段階的に再実装する。

- [x] **4. `SpeakerNameEditor.tsx` のロジック分離**
    - [x] `src/hooks/useSpeakerEditing.ts`: 話者名編集に関する状態と、更新・保存処理のロジックを移管する。

### フェーズ3: UI共通化と機能再実装
- [x] **1. 共通UIコンポーネントの作成 (`src/components/ui`)**
    - [x] `Spinner.tsx` を作成
    - [x] `Button.tsx` を作成し、既存のボタンを置き換える。
    - [x] `Modal.tsx` を作成し、`VersionHistoryModal` をリファクタリングする。

- [x] **2. `TranscriptionResult.tsx` の機能再実装**
    - [x] 話者名編集の保存機能を実装する (`useSpeakerEditing` と `useMutation` を使用)。
    - [x] コンテンツ生成機能（箇条書き、議事録）を再実装する。
    - [x] ファイルダウンロード機能を再実装する。

- [x] **3. `page.tsx` のコンポーネント分割**
    - [x] `AppHeader.tsx` を作成し、ヘッダー部分を分離する。


### フェーズ4: グローバル状態の再編と最終クリーンアップ
- [x] **1. グローバル状態管理の完全移行**
    - [x] `page.tsx`から`MediaUploader`へのProps受け渡しを削除し、ストアを直接利用するように変更する。
- [x] **2. スタイリングの整理と最終クリーンアップ**
    - [x] `page.tsx`のグローバルスタイルを`globals.css`に移管する。
    - [x] 不要になったコードを削除する。 