# バージョン表示と更新履歴機能実装タスク

## 概要
アプリケーションに現在のバージョン表示と更新履歴（アップデート履歴）を表示する機能を実装します。
ユーザーがログイン後の画面上部で更新履歴ボタンをクリックすると、モーダルウィンドウで更新履歴が表示される仕組みです。

## 実装タスク

### 1. 準備作業
- [x] 1.1 必要なパッケージのインストール
  ```bash
  yarn add react-markdown
  ```
- [x] 1.2 環境変数設定の追加
  - `next.config.ts`ファイルを編集してアプリバージョンを環境変数として設定

### 2. 更新履歴ファイルの作成
- [x] 2.1 更新履歴ファイルの作成
  - `public/changelog.md`ファイルを作成
  - Markdown形式で更新履歴を記録
  ```markdown
  # 更新履歴

  ## v0.1.0 (2023-XX-XX)
  - 初期リリース
  - 基本的な文字起こし機能
  - 話者認識機能
  ```

### 3. 更新履歴モーダルコンポーネントの作成
- [x] 3.1 モーダルコンポーネントの作成
  - `src/components/VersionHistoryModal.tsx`ファイルを作成
  - モーダルの基本構造実装
  - ReactMarkdownを使用したマークダウンレンダリング
- [x] 3.2 スタイル定義ファイルの作成
  - `src/components/VersionHistoryModal.module.css`ファイルを作成
  - モーダルのスタイルを定義

### 4. バージョン情報取得の実装
- [x] 4.1 next.config.tsの編集
  ```typescript
  const nextConfig = {
    env: {
      APP_VERSION: process.env.npm_package_version || require('./package.json').version,
    }
    // 他の設定...
  };
  ```
- [x] 4.2 バージョン情報表示コンポーネントの作成
  - `src/components/VersionInfo.tsx`を作成（ヘッダーに表示するバージョン番号）

### 5. ヘッダーUIへの更新履歴ボタン追加
- [x] 5.1 `src/app/page.tsx`の編集
  - `app-header`部分に更新履歴ボタンを追加
  - モーダル表示状態の管理（useState）
  - 更新履歴ボタンの配置（サインアウトボタンの左側）

### 6. モーダル表示ロジックの実装
- [x] 6.1 モーダル表示のための状態管理
  ```tsx
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  
  const openChangelog = () => setIsChangelogOpen(true);
  const closeChangelog = () => setIsChangelogOpen(false);
  ```
- [x] 6.2 更新履歴ファイル読み込みロジックの実装
  - fetch APIを使用してMarkdownファイルを取得

### 7. UIテストとフィードバック
- [ ] 7.1 ボタン配置とデザインの調整
- [ ] 7.2 モーダル表示テスト
- [ ] 7.3 レスポンシブデザイン確認

### 8. ドキュメント更新
- [ ] 8.1 システム説明資料の更新
  - 新機能について追記

## 実装詳細

### VersionHistoryModal.tsx
```tsx
import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from './VersionHistoryModal.module.css';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VersionHistoryModal({ isOpen, onClose }: VersionHistoryModalProps) {
  const [changelog, setChangelog] = useState('');
  
  useEffect(() => {
    if (isOpen) {
      fetch('/changelog.md')
        .then(res => res.text())
        .then(text => setChangelog(text))
        .catch(err => {
          console.error('更新履歴の読み込みに失敗しました:', err);
          setChangelog('# 更新履歴\n\n更新履歴の読み込みに失敗しました。');
        });
    }
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>更新履歴</h2>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>
        <div className={styles.changelogContent}>
          <ReactMarkdown>{changelog}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
```

### ヘッダーへの更新履歴ボタン追加
page.tsxの既存ヘッダー部分に以下を追加します:

```tsx
{/* ヘッダー部分 */}
<div className="app-header" style={{...}}>
  {/* ... */}
  <div className="header-actions" style={{
    display: 'flex',
    gap: '1rem',
    alignItems: 'center'
  }}>
    <button 
      onClick={openChangelog}
      style={{
        padding: '0.5rem 1rem',
        borderRadius: '0.25rem',
        backgroundColor: 'var(--background-secondary, #e5e7eb)',
        border: 'none',
        cursor: 'pointer'
      }}
    >
      更新履歴 v{process.env.APP_VERSION}
    </button>
    <button 
      onClick={signOut}
      style={{...}}
    >
      サインアウト
    </button>
  </div>
</div>

{/* 更新履歴モーダル */}
<VersionHistoryModal 
  isOpen={isChangelogOpen} 
  onClose={closeChangelog} 
/>
```

## 完了条件
- ヘッダーに「更新履歴 vX.X.X」ボタンが表示される
- ボタンクリックで更新履歴モーダルが開く
- モーダル内に更新履歴が正しく表示される
- 現在のバージョンがpackage.jsonから正しく取得・表示される 