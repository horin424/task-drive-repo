# Scheduled Lambda: cleanupExpiredFiles 仕様書

## 1. 概要

EventBridge スケジュールで起動し、一定時間（デフォルト2時間）以上更新がないセッションの関連S3ファイルを自動削除します。`ProcessingSession` レコードは保持し、`filesDeletionTime` を更新します。

## 2. トリガー

- EventBridge ルール（例: 毎時0分）

## 3. ロジック概要

1. DynamoDBの`ProcessingSession`をスキャンし、`filesDeletionTime`が未設定、かつ`updatedAt < threshold`（現時刻-`CLEANUP_THRESHOLD_HOURS`）のレコードを抽出。
2. 各レコードについて、入力/出力バケットの対象キーを算出・収集し、バケットごとに `DeleteObjects` を実行。
3. 削除成功後、`filesDeletionTime` を現在時刻に更新。
4. バッチ実行とリトライ（最大3回、指数バックオフ）。

## 4. 環境変数

| 変数名 | 説明 |
| :--- | :--- |
| `REGION` | AWSリージョン |
| `STORAGE_INPUT_BUCKETNAME` | 入力S3バケット名 |
| `STORAGE_OUTPUTBUCKET_BUCKETNAME` | 出力S3バケット名 |
| `API_TRANSCRIPTMINUTE_PROCESSINGSESSIONTABLE_NAME` | ProcessingSessionテーブル名 |
| `CLEANUP_THRESHOLD_HOURS` | 対象とする経過時間（デフォルト2） |
| `MAX_SESSIONS_PER_RUN` | 1回の実行での最大処理セッション数（デフォルト1000） |
| `LOG_LEVEL` | ログレベル（`info`/`debug`） |

## 5. IAM権限

- S3: 入力・出力バケットの `s3:DeleteObject`/`s3:DeleteObjects`/`s3:ListBucket`
- DynamoDB: `Scan`/`UpdateItem`
- CloudWatch Logs

## 6. 出力

- 実行結果サマリ（処理数/成功/失敗/処理時間ms/部分実行フラグ/エラー詳細）


