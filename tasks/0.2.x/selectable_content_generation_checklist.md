### 選択式コンテンツ生成機能 実装チェックリスト

このドキュメントは `selectable_content_generation_guide.md` に基づき、実際に行う作業をタスク単位でリスト化したものです。

### フェーズ1: 状態管理ロジックの実装

- [x] **1. カスタムフックの作成 (`hooks/useGenerationOptions.ts`)**
    - [x] `src/hooks/useGenerationOptions.ts` ファイルを新規作成する。
    - [x] `useState` を使用して、`generationOptions` の状態を管理する。
    - [x] `useEffect` を使用して、マウント時に `localStorage` から設定を読み込む。
    - [x] `useEffect` を使用して、状態変更時に `localStorage` へ保存する。
    - [x] 状態と更新関数をフックの返り値としてエクスポートする。

### フェーズ2: UIコンポーネントの実装

- [x] **1. UIコンポーネントの作成 (`components/GenerationOptions.tsx`)**
    - [x] `src/components/GenerationOptions.tsx` ファイルを新規作成する。
    - [x] `useGenerationOptions` フックを呼び出して、状態と更新関数を取得する。
    - [x] 3つのチェックボックスを描画し、状態と `onChange` ハンドラを接続する。
    - [x] ファイルアップロードUIはTranscriptionResultで管理するため、GenerationOptionsからは削除

- [x] **2. UIコンポーネントの統合 (`TranscriptionResult.tsx`)**
    - [x] `TranscriptionResult.tsx` 内に `<GenerationOptions />` コンポーネントを配置する。

- [x] **3. スタイリング (`GenerationOptions.module.css`)**
    - [x] `src/components/GenerationOptions.module.css` ファイルを新規作成する。
    - [x] コンポーネントに見やすいスタイルを適用する。
    - [x] ファイルアップロードUIの表示/非表示にアニメーション効果を追加する（任意）。

### フェーズ3: フロントエンドロジックの連携 (`TranscriptionResult.tsx`)

- [x] **1. `useGenerationOptions` フックの利用**
    - [x] `TranscriptionResult.tsx` 内で `useGenerationOptions` フックを呼び出し、選択状態を取得する。

- [x] **2. 生成ボタンの制御**
    - [x] `generationOptions` の値が全て`false`の場合に、「〜を生成」ボタンを非活性化するロジックを追加する。

- [x] **3. APIリクエストの修正 (`handleGenerateClick`)**
    - [x] `processingTypes` 配列を、`generationOptions` の状態に基づいて動的に生成するロジックに修正する。

- [x] **4. 結果表示とダウンロード機能の修正**
    - [x] `session` オブジェクトの各`Key`の存在有無に基づき、結果の表示を制御する。
    - [x] 一括ダウンロード機能も同様に、キーが存在するファイルのみを対象とするように修正する。

### フェーズ4: エラーハンドリングと最終調整

- [x] **1. エラー表示の実装**
    - [x] `session.status` の値（例: `BULLETS_FAILED`）を監視し、失敗したコンテンツのエリアにエラーメッセージを表示するUIを追加する。

- [x] **2. 連打防止機能の実装**
    - [x] 生成ボタンの連打を防止するため、`isGenerating`状態とリクエスト進行中フラグを使用した多重防止機能を実装する。
    - [x] ボタンの`disabled`属性、`pointerEvents`、`opacity`を使用して視覚的にも操作不可能にする。

- [x] **3. UIの改善**
    - [x] 生成コンテンツ選択ボックスのサイズを拡大し、チェックボックスとテキストを大きくする。
    - [x] 垂直スペースを調整して、コンテンツ選択とファイルアップロードエリア間の余白を適切にする。
    - [x] モバイル対応とダークモード対応を維持する。

- [x] **4. 動作確認**
    - [x] 各チェックボックスの組み合わせでコンテンツ生成が正しく動作することを確認する。
    - [x] 何も選択せずに生成ボタンが押せないことを確認する。
    - [x] `localStorage` への状態保存と復元が正しく動作することを確認する。
    - [x] 生成ボタンの連打防止が正しく動作することを確認する。

- [x] **4. コードのクリーンアップ**
    - [x] 不要になった`console.log`などを削除する。
    - [x] コンポーネントの可読性を確認し、必要であればリファクタリングする。 