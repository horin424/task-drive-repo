# Scheduled Lambda: monthlyReset 仕様書

## 1. 概要

EventBridge スケジュールで起動し、全組織の `remainingMinutes` と `remainingTaskGenerations` を、それぞれ `monthlyMinutes`/`monthlyTaskGenerations` にリセットします。既存組織に対しては不足フィールドへデフォルト値（分=6000、回数=100）を適用します。

## 2. トリガー

- EventBridge ルール（例: 毎月最終日 15:00 UTC）

## 3. ロジック概要

1. Organization テーブルをページングしながらスキャン。
2. 各レコードに対し、欠損フィールドへデフォルト値を適用（メモリ上）。
3. `UpdateCommand` で `remainingMinutes` と `remainingTaskGenerations` をリセット。`monthly*` も合わせて設定。
4. 成功/失敗の集計を出力。

## 4. 環境変数

| 変数名 | 説明 |
| :--- | :--- |
| `API_TRANSCRIPTMINUTE_ORGANIZATIONTABLE_NAME` | Organizationテーブル名 |
| `LOG_LEVEL` | ログレベル（`info`/`debug`） |

## 5. IAM権限

- DynamoDB: `Scan`/`UpdateItem`
- CloudWatch Logs

## 6. 出力

- 実行結果サマリ（処理件数/成功/失敗/デフォルト値）


