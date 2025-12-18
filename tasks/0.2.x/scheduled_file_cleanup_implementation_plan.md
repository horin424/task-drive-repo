# スケジューリングされたファイルクリーンアップ機能 実装方針書

## 1. 概要

機密事項の確実な削除を目的として、S3バケット内のファイルを定期的に削除するLambda関数を実装する。
ユーザーがダウンロード後に手動削除されなかった場合や、削除処理が失敗した場合のフェイルセーフとして機能する。

## 2. 要件

### 2.1 機能要件
- **定期実行**: 毎時0分に自動実行
- **削除基準**: ProcessingSessionの最終更新（updatedAt）から2時間経過したファイル
- **削除対象**: 
  - 入力バケット内のファイル（音声・動画ファイル）
  - 出力バケット内のファイル（文字起こし、箇条書き、議事録、タスク一覧）
  - ProcessingSessionレコードは**保持**（問い合わせ対応のため）
- **除外対象**: なし（アクティブセッションも削除対象）

### 2.2 非機能要件
- **信頼性**: 個別ファイル削除失敗時もバッチ処理継続
- **パフォーマンス**: 一度に最大1000セッションまで処理
- **監視性**: 処理結果の詳細ログ出力
- **保守性**: 環境変数による設定変更可能

## 3. アーキテクチャ

### 3.1 システム構成
```
EventBridge Scheduler (cron: 0 * * * ? *)
    ↓
cleanupExpiredFiles Lambda
    ↓
ProcessingSession DynamoDB Table (読み取り専用)
    ↓
S3 Input/Output Buckets (削除)
```

### 3.2 処理フロー
1. **削除対象セッション特定**: ProcessingSessionテーブルから2時間以上前のセッションを取得
2. **ファイル削除**: 各セッションに関連するS3ファイルを削除
3. **レコード更新**: ProcessingSessionに削除フラグを設定（詳細は後で決定）
4. **結果ログ**: 処理結果をCloudWatchに出力

## 4. 技術仕様

### 4.1 Lambda関数設定
| 項目 | 値 | 理由 |
|------|----|----|
| 関数名 | `cleanupExpiredFiles` | 機能を明確に表現 |
| ランタイム | Node.js | 既存システムとの統一 |
| メモリ | 256MB | DynamoDB/S3操作に適切 |
| タイムアウト | 15分 | 大量処理に対応 |
| 同時実行数 | 1 | 重複実行防止 |
| スケジュール | `cron(0 * * * ? *)` | 毎時0分実行 |

### 4.2 削除基準
```javascript
const deleteThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2時間前
const isExpiredSession = (session) => new Date(session.updatedAt) < deleteThreshold;
```

### 4.3 バッチ処理仕様
- **最大処理数**: 1000セッション/回
- **超過時対応**: 同一実行内で1000件ずつ継続処理（Lambda制限時間内まで）
- **並行処理**: セッション削除は並行実行（Promise.all使用）

**継続処理の将来的リスク**
- **実行時間の予測困難**: 大量データ蓄積時に15分制限に接近する可能性
- **メモリ使用量増加**: 処理済みセッション情報の蓄積によるメモリ不足リスク
- **他システムへの影響**: 長時間実行によるDynamoDB/S3への負荷集中
- **部分失敗の複雑化**: 途中で失敗した場合の再実行時の重複処理リスク

**対策**
- 実行時間監視とアラート設定
- 処理セッション数が閾値を超えた場合の分割実行への移行検討

### 4.4 エラーハンドリング
- **個別リトライ**: 各ファイル削除で最大3回リトライ
- **失敗時処理**: 3回失敗後はスキップして次のセッションへ
- **バッチ継続**: 一部セッションの削除失敗でも全体処理は継続

### 4.5 ログ出力仕様
```javascript
// 標準ログ（LOG_LEVEL=info）
{
  totalSessions: 150,
  successCount: 148,
  failedCount: 2,
  executionTimeMs: 12340,
  errors: [
    { sessionId: "xxx", error: "S3 delete failed" }
  ]
}

// デバッグログ（LOG_LEVEL=debug）
// 上記 + 各セッション処理の詳細ログ
```

## 5. データベース設計

### 5.1 ProcessingSessionの拡張
削除状態管理のため、削除タイムスタンプを追加：

```graphql
type ProcessingSession {
  # 既存フィールド...
  filesDeletionTime: AWSDateTime  # ファイル削除日時（null = 未削除）
}
```

**DynamoDBクエリ最適化**
```javascript
// 削除対象セッション取得（FilterExpression使用）
const params = {
  TableName: PROCESSING_SESSION_TABLE,
  FilterExpression: 'attribute_not_exists(filesDeletionTime) AND updatedAt < :threshold',
  ExpressionAttributeValues: {
    ':threshold': twoHoursAgo.toISOString()
  }
};
```

## 6. 環境変数

| 変数名 | デフォルト値 | 説明 |
|-------|-------------|------|
| `CLEANUP_THRESHOLD_HOURS` | `2` | 削除基準時間 |
| `MAX_SESSIONS_PER_RUN` | `1000` | 一度の実行での最大処理数 |
| `LOG_LEVEL` | `info` | ログレベル（info/debug） |
| `DRY_RUN` | `false` | テスト実行モード |

## 7. 実装フェーズ

### Phase 1: 基本機能実装
- [ ] Lambda関数作成（`amplify add function`）
- [ ] ProcessingSession取得ロジック
- [ ] S3ファイル削除ロジック
- [ ] 基本的なエラーハンドリング

### Phase 2: 堅牢性向上
- [ ] リトライ機能実装
- [ ] バッチ処理制限
- [ ] ログ出力強化

### Phase 3: 運用機能
- [ ] ProcessingSession更新ロジック
- [ ] DryRunモード（オプション）
- [ ] 監視・アラート設定

## 8. テスト方針

### 8.1 単体テスト
- [ ] 削除基準判定ロジック
- [ ] S3削除処理
- [ ] エラーハンドリング

### 8.2 統合テスト
- [ ] DynamoDB連携
- [ ] S3連携
- [ ] スケジューラー連携

### 8.3 本番テスト
- [ ] DryRunモードでの動作確認
- [ ] 少量データでの実行確認
- [ ] 監視ダッシュボード確認

## 9. 運用考慮事項

### 9.1 監視
- [ ] Lambda実行エラー監視
- [ ] 処理時間監視
- [ ] 削除失敗率監視

### 9.2 メンテナンス
- [ ] 削除基準時間の調整手順
- [ ] 緊急停止手順
- [ ] ログ分析手順

## 10. リスク・制約事項

### 10.1 リスク
- **大量セッション時の実行時間超過**: バッチサイズ制限で対応
- **DynamoDB読み取り負荷**: 必要に応じて読み取りキャパシティ調整
- **S3削除失敗**: リトライ機能で対応

### 10.2 制約事項
- **削除の不可逆性**: 一度削除されたファイルは復旧不可
- **ProcessingSession保持**: 削除状態管理が必要
- **タイムゾーン依存**: UTC基準で処理

## 11. 長期運用における課題と将来対策

### 11.1 ProcessingSessionレコード蓄積問題

**問題の概要**
- 現在の実装ではProcessingSessionレコードを永続保持
- 一日100件の処理で年間36,500件のレコードが蓄積
- 毎時スキャン処理の性能劣化とコスト増加が予想される

**影響予測**
| 期間 | 累積レコード数 | 年間DynamoDBコスト | スキャン実行時間 | 対策必要度 |
|------|-------------|------------------|-------------|-----------|
| 1年後 | 36,500件 | 約$80 | 2-5秒 | 監視 |
| 3年後 | 109,500件 | 約$240 | 10-20秒 | **要検討** |
| 5年後 | 182,500件 | 約$400 | 30-60秒 | **要対策** |

### 11.2 推奨する将来対策

**Phase 1（1-2年後）: クエリ最適化**
- GSI（Global Secondary Index）の追加検討
- `updatedAt` + `filesDeletionTime` の複合インデックス
- FilterExpressionからKeyConditionExpressionへの移行

**Phase 2（2-3年後）: ProcessingSessionライフサイクル管理**
```javascript
// 段階的削除ライフサイクル
const processingSessionLifecycle = {
  "0-2時間": "S3ファイル削除",
  "1年後": "ProcessingSessionレコード削除",
  "問い合わせ用": "最低1年間は保持（要件次第で調整）"
};
```

**実装オプション**
1. **同一Lambda内での古いレコード削除**
   - 現在のcleanupExpiredFiles関数に追加
   - 1年以上古いProcessingSessionを月次で削除

2. **専用アーカイブLambda作成**
   - 月1回実行の別Lambda関数
   - より慎重なアーカイブ処理
   - 監査ログ生成機能

### 11.3 対策実施の目安

**immediate（現在）**
- 現在の方式で問題なし
- FilterExpression使用で十分

**1-2年後（10万件到達時）**
- DynamoDBクエリ最適化の検討開始
- GSI追加または代替手法の評価

**2-3年後（15万件超過時）**
- ProcessingSessionレコード削除機能の実装
- Lambda timeout問題の回避

**注意**: 問い合わせ対応要件に応じて保持期間は調整可能

---

## 決定事項
- **削除基準**: updatedAtから2時間
- **実行スケジュール**: 毎時0分
- **削除対象**: S3ファイルのみ（ProcessingSessionレコードは保持）
- **アクティブセッション**: 除外しない
- **バッチサイズ**: 1000セッション（同一実行内で継続処理）
- **エラーハンドリング**: 個別リトライ3回、失敗時スキップ
- **削除状態管理**: filesDeletionTime（削除タイムスタンプ）
- **DynamoDBクエリ**: FilterExpression使用（一日100件想定で当面対応）

## 未決定事項（要議論）
- **DryRunモード実装要否**
- **ProcessingSessionレコードの長期保持戦略** 