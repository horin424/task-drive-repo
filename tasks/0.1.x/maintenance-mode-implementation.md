# 機能停止モード実装タスク

## 1. 環境変数の追加

- [x] `.env.example`に機能停止モード関連の環境変数を追加
  - [x] `NEXT_PUBLIC_MAINTENANCE_MODE`変数を追加（デフォルト値：`false`）
  - [x] `NEXT_PUBLIC_MAINTENANCE_MESSAGE`変数を追加（デフォルトメッセージ設定）

- [x] 各環境ファイル（`.env.development`, `.env.demo`など）に設定を追加

## 2. 型定義の追加

- [x] TypeScript型定義に環境変数を追加
  ```typescript
  // src/types/environment.d.ts
  declare global {
    namespace NodeJS {
      interface ProcessEnv {
        NEXT_PUBLIC_MAINTENANCE_MODE: string;
        NEXT_PUBLIC_MAINTENANCE_MESSAGE: string;
        // 他の既存の環境変数...
      }
    }
  }
  
  export {};
  ```

## 3. メンテナンス通知コンポーネントの作成

- [x] メンテナンス通知用のコンポーネントを作成
  ```typescript
  // src/components/MaintenanceNotice.tsx
  import React from 'react';

  interface MaintenanceNoticeProps {
    message: string;
  }

  const MaintenanceNotice: React.FC<MaintenanceNoticeProps> = ({ message }) => {
    return (
      <div className="maintenance-notice" style={{
        marginTop: '1rem',
        padding: '1.5rem',
        backgroundColor: 'var(--background-accent, #f9fafb)',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #f59e0b',
        color: 'var(--text-primary, #111827)',
        textAlign: 'center'
      }}>
        <h2 style={{ 
          color: '#f59e0b', 
          marginTop: 0,
          fontWeight: 'bold'
        }}>
          メンテナンスのお知らせ
        </h2>
        <p style={{ fontSize: '1.1rem' }}>{message}</p>
      </div>
    );
  };

  export default MaintenanceNotice;
  ```

## 4. メインコンポーネントの修正

- [x] `src/app/page.tsx`の`AuthenticatedScreen`コンポーネントを修正
  - [x] 環境変数からメンテナンスモード状態を取得する処理を追加
  - [x] メンテナンスモード時の条件付きレンダリングを実装
  - [x] 通常コンテンツ（MediaUploaderなど）の表示条件を修正

## 5. テスト

- [ ] メンテナンスモードの動作テスト
  - [x] 環境変数を`false`に設定した場合の通常動作確認
  - [x] 環境変数を`true`に設定した場合のメンテナンス表示確認
  - [x] 異なるメッセージでの表示確認

- [ ] UIテスト
  - [ ] メンテナンス表示のスタイル確認（ライト/ダークモード両方）
  - [ ] レスポンシブ対応の確認

## 6. デプロイと運用手順

- [x] 機能停止モードの切り替え手順をドキュメント化
  - [x] 各環境（開発/デモ/本番）でのモード切替方法
  - [x] 緊急時の切替手順

## 7. ドキュメント更新

- [x] `README.md`に新機能の説明を追加
- [x] `システム説明資料.md`に実装詳細を追加 