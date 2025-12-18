# 英語文字起こし機能の実装タスク

## 1. UIの変更

- [x] `MediaUploader.tsx`コンポーネントに言語選択UI（ラジオボタンまたはドロップダウン）を追加
  - [x] 日本語（初期値）と英語のオプションを実装
  - [x] スタイル調整

- [x] 言語選択のローカルストレージ処理を実装
  - [x] 言語設定の保存機能を実装（`saveLanguagePreference`）
  - [x] 言語設定の取得機能を実装（`getLanguagePreference`）
  - [x] 初期表示時に保存された言語設定を読み込む

## 2. APIリクエストの修正

- [x] `transcriptionApi.ts`内のAPIリクエスト処理を修正
  - [x] ElevenLabs APIリクエストに言語パラメータを追加
  - [x] 選択した言語をリクエストに含める

## 3. 状態管理の実装

- [x] 言語選択の状態管理を実装
  - [x] 言語選択用のstate/contextを作成
  - [x] 言語切り替え時の状態更新処理を実装

## 4. ユーティリティ関数の作成

- [x] `src/utils`ディレクトリに言語設定用のユーティリティファイルを作成
  ```typescript
  // languageUtils.ts
  export const saveLanguagePreference = (language: string) => {
    localStorage.setItem('transcription-language', language);
  };

  export const getLanguagePreference = (): string => {
    return localStorage.getItem('transcription-language') || 'ja';
  };
  ```

## 5. テスト

- [ ] 言語選択UIのテスト
  - [ ] 初期表示が正しいか
  - [ ] 言語切り替えが機能するか

- [ ] 言語設定の保存と取得のテスト
  - [ ] ページリロード後も設定が保持されるか
  - [ ] 別ブラウザセッションでも設定が保持されるか

- [ ] API連携テスト
  - [ ] 選択した言語で正しくAPIリクエストが送信されるか
  - [ ] 英語選択時に英語での文字起こしが行われるか

## 6. リファクタリングと最適化

- [x] コードの整理
- [x] パフォーマンス最適化

## 7. ドキュメント更新

- [ ] `README.md`に新機能の説明を追加
- [ ] `システム説明資料.md`に実装詳細を追加 