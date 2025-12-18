# Session Monitor Implementation - UI ステップ管理の一元化

## 問題の概要

### 現在の問題
1. **UIステップ管理の分散**
   - `MediaUploader.tsx` でセッション状態を監視し `setCurrentStep` を呼び出し
   - 以前は `TranscriptionResult.tsx` でも同様の処理が存在（削除済み）
   - UIステップの更新ロジックが複数箇所に散在

2. **責務の肥大化**
   - `MediaUploader` は「メディアアップロード」が主責務だが、アプリ全体のワークフロー管理も担っている
   - コンポーネントの責務が不明確

3. **再利用性の問題**
   - 別のページや将来の機能（既存セッション再開など）で同じステップ管理ロジックが必要になった場合、重複実装が発生

4. **currentSession の管理問題**
   - `useMediaUpload` フック内でローカル state として管理
   - `MediaUploader` がアンマウントされると状態が失われる
   - 他のコンポーネントからアクセスできない

### 根本原因
- UIステップは「アプリ全体のプロセス」を示すグローバル状態であるにも関わらず、個別コンポーネントで管理されている
- セッション状態の監視とUIステップ更新が密結合している

## 修正方針

### アーキテクチャ設計
**SessionMonitor Provider 方式**を採用し、ルート近くで「セッション監視 + ステップ制御」を一元管理する。

### 責務分離
- **SessionMonitor**: セッション状態の監視とUIステップの更新
- **各コンポーネント**: 表示・入力処理のみに集中
- **sessionStore**: セッション情報のグローバル管理

## 実装計画

### Phase 1: sessionStore の拡張
- [ ] `sessionStore` に `currentSession` と関連アクションを追加
- [ ] `ProcessingSession` 型の import と型定義を追加

### Phase 2: useMediaUpload の修正
- [ ] `currentSession` の管理を `sessionStore` に移管
- [ ] GraphQL Subscription の更新先を `sessionStore` に変更
- [ ] ローカル state の `currentSession` を削除

### Phase 3: SessionMonitor Provider の作成
- [ ] `src/providers/SessionMonitor.tsx` を作成
- [ ] セッション状態監視の `useEffect` を実装
- [ ] ステータスとUIステップのマッピングロジックを実装

### Phase 4: 既存コンポーネントの修正
- [ ] `MediaUploader.tsx` からステップ管理ロジックを削除
- [ ] 不要な `useUiStore` の依存を削除

### Phase 5: 統合とテスト
- [ ] `app/page.tsx` で `<SessionMonitor>` をラップ
- [ ] 動作確認とテスト

## 実装詳細

### 1. sessionStore の拡張

```typescript
interface SessionState {
  // 既存のフィールド...
  currentSession: ProcessingSession | null;
  setCurrentSession: (session: ProcessingSession | null) => void;
  updateCurrentSession: (session: ProcessingSession) => void;
}
```

### 2. SessionMonitor Provider

```typescript
export const SessionMonitor = ({ children }: { children: React.ReactNode }) => {
  const { currentSession } = useSessionStore();
  const { setCurrentStep } = useUiStore();

  useEffect(() => {
    // セッション状態に応じてUIステップを更新
    const status = currentSession?.status;
    if (!status) {
      setCurrentStep('upload');
      return;
    }
    
    switch (status) {
      case ProcessingStatus.UPLOADED:
      case ProcessingStatus.PROCESSING_TRANSCRIPTION:
        setCurrentStep('transcribe');
        break;
      case ProcessingStatus.PENDING_SPEAKER_EDIT:
        setCurrentStep('edit');
        break;
      case ProcessingStatus.SPEAKER_EDIT_COMPLETED:
      case ProcessingStatus.PROCESSING_BULLETS:
      case ProcessingStatus.PROCESSING_MINUTES:
      case ProcessingStatus.PROCESSING_TASKS:
        setCurrentStep('generate');
        break;
      case ProcessingStatus.ALL_COMPLETED:
        setCurrentStep('results');
        break;
    }
  }, [currentSession?.status, setCurrentStep]);

  return <>{children}</>;
};
```

### 3. ステータスとUIステップのマッピング

| ProcessingStatus | UIStep | 説明 |
|------------------|--------|------|
| `UPLOADED`, `PROCESSING_TRANSCRIPTION` | `transcribe` | 文字起こし処理中 |
| `PENDING_SPEAKER_EDIT` | `edit` | 話者編集待ち |
| `SPEAKER_EDIT_COMPLETED`, `PROCESSING_BULLETS`, `PROCESSING_MINUTES`, `PROCESSING_TASKS` | `generate` | コンテンツ生成中 |
| `ALL_COMPLETED` | `results` | 完了 |
| セッションなし | `upload` | 初期状態 |

## 期待される効果

### 1. 責務の明確化
- 各コンポーネントが本来の責務に集中できる
- UIステップ管理が一箇所に集約される

### 2. 保守性の向上
- ステップ遷移ロジックの変更が一箇所で済む
- デバッグ時にステップ変更の追跡が容易

### 3. 再利用性の向上
- 新しいページや機能でも同じステップ管理ロジックを使用可能
- セッション情報のグローバル管理により、コンポーネント間での情報共有が容易

### 4. テスタビリティの向上
- ステップ管理ロジックが独立してテスト可能
- モックしやすい構造

## 注意点

### 1. パフォーマンス
- `currentSession` の更新頻度が高い場合、不要な再レンダリングを防ぐ最適化が必要

### 2. エラーハンドリング
- セッション取得失敗時の適切なフォールバック処理

### 3. 移行期間
- 段階的な実装により、一時的に重複したロジックが存在する可能性

## 実装スケジュール

- **Phase 1-2**: sessionStore拡張とuseMediaUpload修正
- **Phase 3**: SessionMonitor Provider作成
- **Phase 4**: 既存コンポーネント修正
- **Phase 5**: 統合テスト

各フェーズ完了後に動作確認を行い、問題があれば修正してから次のフェーズに進む。 