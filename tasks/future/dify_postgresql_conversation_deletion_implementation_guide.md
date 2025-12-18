# Dify会話削除機能 PostgreSQL直接アクセス実装方針書

## 1. 概要

本ドキュメントは、PostgreSQL直接アクセスによりDifyの会話ログを物理削除する専用Lambda関数の実装方針を定義する。

従来のDify API（ソフトデリート）では完全削除が不可能だったため、PostgreSQLデータベースに直接アクセスして`messages`テーブルから対象レコードを物理削除する方式に変更する。

## 2. アーキテクチャ設計

### 2.1 システム構成

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│ generationWorker│───▶│difyConversation │───▶│   Dify          │
│                 │    │    Cleaner      │    │ PostgreSQL DB   │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
     (既存)                  (新規)                  (既存)
```

### 2.2 処理フロー

1. **generationWorker**: コンテンツ生成完了後、`conversation_id`を取得
2. **非同期呼び出し**: `difyConversationCleaner`Lambda を Event モードで起動
3. **PostgreSQL接続**: 専用Lambda がDifyのPostgreSQLに接続
4. **メッセージ削除**: `messages`テーブルから該当レコードを物理削除
5. **ログ出力**: 削除結果をCloudWatch Logsに記録

### 2.3 責任分離

| コンポーネント | 責任 |
|----------------|------|
| **generationWorker** | コンテンツ生成、conversation_id取得、クリーナー呼び出し |
| **difyConversationCleaner** | PostgreSQL接続、会話削除、エラーハンドリング |
| **Dify PostgreSQL** | データ永続化 |

## 3. 実装詳細

### 3.1 新規Lambda関数: difyConversationCleaner

#### 3.1.1 基本仕様

- **関数名**: `difyConversationCleaner`
- **ランタイム**: Node.js 18.x
- **メモリサイズ**: 128MB
- **タイムアウト**: 900秒（15分）
- **VPC**: DifyのPostgreSQLと同一VPC
- **IAM Role**: VPC接続権限 + CloudWatch Logs権限
- **呼び出し方式**: Event（非同期）
- **リトライ**: 標準リトライ（最大2回）
- **依存関係**: `pg`ライブラリ（最新安定版）
- **バッチ削除**: 複数 `conversation_id` を一括削除に対応
- **接続プール**: 使用しない（単一接続 / トランザクション）
- **Lambda Layer**: 使用しない（関数内に `pg` を包含）

#### 3.1.2 主要機能

```javascript
const { Client } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

// Secrets Manager から認証情報を取得
const getDbCredentials = async () => {
  const command = new GetSecretValueCommand({
    SecretId: process.env.DIFY_DB_SECRET_NAME
  });
  
  const response = await secretsClient.send(command);
  return JSON.parse(response.SecretString);
};

exports.handler = async (event) => {
  const { conversationIds, userId } = event;
  
  // バッチ削除対応: conversationIds 配列をチェック
  if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
    console.error('Missing or empty conversationIds array in event');
    return { statusCode: 400, error: 'Missing conversationIds array' };
  }

  let client;
  const results = [];

  try {
    // Secrets Manager から認証情報取得
    const credentials = await getDbCredentials();
    
    client = new Client({
      host: process.env.DIFY_DB_HOST,
      port: parseInt(process.env.DIFY_DB_PORT),
      database: process.env.DIFY_DB_NAME,
      user: credentials.username,
      password: credentials.password,
      ssl: {
        rejectUnauthorized: false, // 自己署名証明書の場合
        // 本番環境では rejectUnauthorized: true を推奨
      },
      statement_timeout: 5000, // 5秒でタイムアウト
    });

    await client.connect();

    // 各 conversation_id を順番に処理
    for (const conversationId of conversationIds) {
      try {
        await client.query('BEGIN');
        
        // 最新メッセージID取得
        const messageResult = await client.query(
          'SELECT id FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1',
          [conversationId]
        );
        
        if (messageResult.rows.length === 0) {
          console.log(`No messages found for conversation_id: ${conversationId}`);
          await client.query('ROLLBACK');
          results.push({ conversationId, status: 'not_found' });
          continue;
        }
        
        const latestMessageId = messageResult.rows[0].id;
        
        // メッセージ削除
        const deleteResult = await client.query(
          'DELETE FROM messages WHERE id = $1',
          [latestMessageId]
        );
        
        await client.query('COMMIT');
        
        console.log(`Successfully deleted message ${latestMessageId} for conversation ${conversationId}`);
        results.push({ 
          conversationId, 
          status: 'deleted', 
          deletedMessageId: latestMessageId 
        });
        
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error deleting conversation ${conversationId}:`, error.message);
        results.push({ 
          conversationId, 
          status: 'error', 
          error: error.message 
        });
      }
    }
    
    return { 
      statusCode: 200, 
      totalRequested: conversationIds.length,
      results: results
    };
    
  } catch (error) {
    console.error('Fatal error in conversation cleanup:', error.message);
    return { statusCode: 500, error: error.message };
  } finally {
    if (client) {
      await client.end();
    }
  }
};
```

### 3.2 generationWorker の修正

#### 3.2.1 Lambda呼び出し処理の追加

```javascript
// generationWorker/src/index.mjs に追加
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });

// 会話削除を非同期で実行する関数（**複数ID対応**）
const deleteConversationsAsync = async (conversationIds, userId) => {
  if (process.env.DIFY_DELETE_CONVERSATIONS !== 'true') {
    return;
  }

  if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
    return;
  }
  
  try {
    const payload = {
      conversationIds, // 配列で渡す
      userId
    };
    
    const command = new InvokeCommand({
      FunctionName: process.env.DIFY_CONVERSATION_CLEANER_FUNCTION,
      InvocationType: 'Event', // 非同期実行
      Payload: JSON.stringify(payload)
    });
    
    await lambdaClient.send(command);
    log('info', 'Conversation cleanup initiated', { conversationCount: conversationIds.length });
    
  } catch (error) {
    log('warn', 'Failed to initiate conversation cleanup', { 
      conversationIds, 
      error: error.message 
    });
    // エラーでも生成処理は継続
  }
};
```

#### 3.2.2 各生成関数への統合

```javascript
// generateBulletPoints, generateMinutes, generateTasks など各関数の完了後に追加

const conversationIds = [];
if (bulletsResult?.conversationId) conversationIds.push(bulletsResult.conversationId);
if (minutesResult?.conversationId) conversationIds.push(minutesResult.conversationId);
if (tasksResult?.conversationId) conversationIds.push(tasksResult.conversationId);

if (conversationIds.length > 0) {
  await deleteConversationsAsync(conversationIds, identityId);
}
```

## 4. セキュリティ設計

### 4.1 ネットワークセキュリティ

- **VPC配置**: Lambda をプライベートサブネットに配置
- **セキュリティグループ**: 最小権限の原則
  - DB SG: Lambda SG からの TCP/5432 のみ許可
  - Lambda SG: アウトバウンドのみ許可

### 4.2 認証・認可

#### 4.2.1 データベース認証

- **認証方式**: SCRAM-SHA-256（最新暗号化）
- **パスワード設定**: `password_encryption = 'scram-sha-256'`、`scram_iterations = 4096` 以上
- **DB認証情報**: AWS Secrets Manager で管理、自動ローテーション有効（30-60日）
- **専用ユーザー**: `dify_cleaner` 作成（本体用 `dify_app` とは分離）

#### 4.2.2 権限分離・最小権限モデル

| ロール | 権限 | 用途 |
|-------|------|------|
| `postgres` | スーパーユーザー | 管理用（手動接続のみ） |
| `dify_app` | `CONNECT`, `SELECT`, `INSERT`, `UPDATE` など通常操作 | Dify 本体アプリケーション |
| `dify_cleaner` | `CONNECT`, `SELECT`, `DELETE` **のみ** | 会話削除 Lambda 専用 |

**権限設定例**:
```sql
-- クリーナー専用ユーザー作成
CREATE ROLE dify_cleaner LOGIN PASSWORD 'managed_by_secrets_manager';

-- 必要最小限の権限付与
GRANT CONNECT ON DATABASE dify TO dify_cleaner;
GRANT USAGE ON SCHEMA public TO dify_cleaner;
GRANT SELECT, DELETE ON TABLE messages TO dify_cleaner;

-- 他テーブルへのアクセスは明示的に禁止（デフォルト REVOKE）
```

#### 4.2.3 接続セキュリティ

- **pg_hba.conf 設定例**:
```
# VPC CIDR のみ許可、SSL 必須、SCRAM-SHA-256 認証
hostssl  dify   dify_cleaner  10.0.0.0/16  scram-sha-256
```

- **IAM Role**: 必要最小限の権限
  - `AWSLambdaVPCAccessExecutionRole`（VPC 接続）
  - `secretsmanager:GetSecretValue`（認証情報取得）
  - `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents`（ログ）

### 4.3 通信セキュリティ

- **SSL/TLS**: PostgreSQL接続は SSL 必須
  - `ssl = on`、`ssl_min_protocol_version = 'TLSv1.2'` 以上
  - `ssl_cert_file`, `ssl_key_file`, `ssl_ca_file` の適切な配置
  - クライアント側: `sslmode=require` 以上を指定
- **VPC内通信**: インターネット経由なし
- **証明書検証**: 本番環境では `sslmode=verify-full` を推奨

### 4.4 データベース設計・パフォーマンス

#### 4.4.1 テーブル構造・インデックス

| 項目 | 推奨設定 | 理由 |
|------|----------|------|
| **インデックス** | `CREATE INDEX idx_messages_conversation_id ON messages (conversation_id);` | 削除対象の高速特定 |
| **削除方式** | 最新メッセージのみ削除（`ORDER BY created_at DESC LIMIT 1`） | 会話全体削除より安全・高速 |
| **行ロック競合** | `DELETE WHERE id = $1` で主キー指定 | 最小範囲ロックで衝突回避 |

#### 4.4.2 接続・パフォーマンス設定

| パラメータ | 推奨値 | 理由 |
|-----------|-------|------|
| `max_connections` | 100 程度 | Dify + Lambda 全体の見積もり |
| `statement_timeout` | `5s` | 削除処理の長時間実行防止 |
| `idle_in_transaction_session_timeout` | `30s` | 不正なトランザクション継続防止 |
| `autovacuum_vacuum_cost_limit` | デフォルト | 大量DELETE後のvacuum暴走防止 |

#### 4.4.3 運用・監視

| 項目 | 設定・手順 |
|------|------------|
| **バックアップ** | pgBackRest / WAL-G などで S3 への自動バックアップ |
| **Point-In-Time Recovery** | 物理削除による事故に備えた PITR 有効化 |
| **削除監査ログ** | PostgreSQL ログレベル調整で削除操作を記録 |
| **接続監視** | `pg_stat_activity` での接続数・実行中クエリ監視 |

## 5. 環境変数・設定

### 5.1 difyConversationCleaner 用環境変数

```json
{
  "DIFY_DB_HOST": "dify-postgresql-host",
  "DIFY_DB_PORT": "5432", 
  "DIFY_DB_NAME": "dify",
  "DIFY_DB_SECRET_NAME": "dify/cleaner/credentials",
  "AWS_REGION": "ap-northeast-1"
}
```

**Secrets Manager 認証情報例**:
```json
{
  "username": "dify_cleaner",
  "password": "auto_generated_secure_password"
}
```

### 5.2 generationWorker 用環境変数

```json
{
  "DIFY_DELETE_CONVERSATIONS": "true",
  "DIFY_CONVERSATION_CLEANER_FUNCTION": "difyConversationCleaner"
}
```

## 6. 実装ステップ

### Step 1: PostgreSQL調査・準備
1. Dify PostgreSQL のスキーマ調査
2. `messages` テーブル構造確認
3. 専用DB役割・パスワード作成
4. 接続テスト実行

### Step 2: difyConversationCleaner Lambda 作成
1. Amplify CLI で新規関数作成
2. PostgreSQL クライアント（pg）依存関係追加
3. VPC設定・セキュリティグループ設定
4. 環境変数設定（Secrets Manager 統合）

### Step 3: generationWorker 修正
1. Lambda SDK 依存関係追加
2. 会話削除呼び出し処理追加
3. 各生成関数への統合
4. 環境変数追加

### Step 4: テスト・検証
1. 単体テスト（difyConversationCleaner）
2. 統合テスト（generationWorker → cleaner）
3. エラーハンドリングテスト
4. パフォーマンステスト

### Step 5: デプロイ・監視
1. dev 環境デプロイ・テスト
2. 本番環境デプロイ
3. CloudWatch メトリクス設定
4. アラート設定

## 7. 監視・運用

### 7.1 メトリクス

- **成功率**: 削除成功/失敗の比率
- **レスポンス時間**: PostgreSQL 接続・削除時間
- **エラー率**: 各種エラーの発生頻度

### 7.2 ログ監視

```javascript
// 成功ログ
console.log(`Successfully deleted message ${messageId} for conversation ${conversationId}`);

// エラーログ  
console.error(`Failed to delete conversation ${conversationId}:`, error);
```

### 7.3 アラート設定

- 削除失敗率が閾値を超過
- PostgreSQL 接続エラー頻発
- Lambda タイムアウト・メモリ不足

## 8. 運用考慮事項

### 8.1 障害対応

- **PostgreSQL 接続失敗**: リトライ機能実装
- **削除対象なし**: 正常なケースとしてログ記録
- **権限エラー**: DB役割・権限の確認

### 8.2 スケーラビリティ

- **同時実行制御**: Lambda の予約済み同時実行数設定
- **接続プール**: PostgreSQL コネクション管理
- **バッチ削除**: 将来的な一括削除機能

### 8.3 データ整合性

- **トランザクション**: BEGIN/COMMIT/ROLLBACK の徹底
- **削除確認**: 削除前の存在確認
- **ログ記録**: 削除操作の詳細記録

---

## セキュリティリスクと対策

### 5432 を公開するリスク

* **0.0.0.0/0 でポスグレ（5432）を開けると、インターネット上の誰からでも到達可能**になり、パスワード総当たり・脆弱性スキャン・DoS などの入り口になります。実際に「管理ポートを公開したセキュリティグループはインシデントの温床になる」と複数のクラウドセキュリティ研究で警告されています。([securitylabs.datadoghq.com][1], [Intelligent Discovery][2])

### 「SG でアクセス先を絞る」だけで十分？

#### 最低限の対策としては OK

* **VPC 内に閉じ、Inbound を「Lambda 用 SG」のみ許可**にすれば、外部からの直接アクセス経路はほぼ遮断できます。AWS 公式も "DB SG のソースにアプリ／Lambda 側 SG を指定する" 方式を推奨しています。([AWS ドキュメント][3], [AWS ドキュメント][4])
* **Lambda → DB の通信は VPC 内部の ENI 経由**で完結するため、インターネットを経由しません（NAT Gateway も不要）。

#### ただし「それだけで万全」ではない

1. **ホスト側で 5432 を公開している限り、誤設定や将来の SG 変更で再び穴が開く**

   * Docker の `ports: "5432:5432"` を削除し、**コンテナ内部ネットワークだけにバインド**できるならそちらの方が安全。
2. **平文パスワード認証のまま**だと、VPC 内からの盗聴・内部犯行に対して弱い。

   * `require_ssl = on`（RDS なら `rds.force_ssl=1`）+ クライアント側 `sslmode=require` を徹底。
3. **権限制御**

   * Lambda 用 DB ユーザーには `SELECT/DELETE` など必要最小限の権限のみ付与。
   * `pg_hba.conf` で接続元 CIDR / SG に加え、ユーザー毎の認可も絞る。
4. **脆弱性パッチ**

   * コンテナイメージを自動更新しないと、CVE 対応が遅れがち。RDS／Aurora に移行すればパッチ管理を AWS に委譲できる。

### 実運用におすすめの構成

| レイヤ        | 推奨設定                                                                                  | メモ             |
| ---------- | ------------------------------------------------------------------------------------- | -------------- |
| **ネットワーク** | DB コンテナ（または RDS）を **プライベートサブネット**に配置。<br>DB SG の Inbound は「Lambda SG × TCP/5432」のみ許可。 | インターネット経路を排除   |
| **通信経路**   | SSL/TLS 必須 (`sslmode=require`)                                                        | MITM 対策        |
| **認証情報**   | Secrets Manager で **自動ローテーション**し、Lambda は環境変数でなく **SDK 経由で取得**                        | キー流出リスクを最小化    |
| **権限**     | Lambda 用ロールに `AWSLambdaVPCAccessExecutionRole`、DB ユーザーには最小権限                          |                |
| **監査**     | VPC Flow Logs + CloudWatch Logs Insights で 5432 への試行を監視                               | 不審なトラフィック検知    |
| **代替案**    | RDS Proxy や Aurora Serverless v2                                                      | 接続プール管理と自動スケール |

### まとめ

* **「SG で Lambda だけ許可」は実用レベルの防御線**ですが、

  * パブリック IP／0.0.0.0/0 のルールは残さない
  * SSL・最小権限・パッチ自動化など多層防御を併用
* コンテナの 5432 ポートは **ホストに公開しない設計**（Docker ネットワーク内で閉じる or RDS へ移行）が長期的にはより安全です。

[1]: https://securitylabs.datadoghq.com/cloud-security-atlas/vulnerabilities/security-group-open-to-internet/ "Security group exposes risky ports to the internet |  Datadog Security Labs"
[2]: https://www.intelligentdiscovery.io/controls/ec2/aws-ec2-postgresql-open "EC2 PostgreSQL Open to the Internet | Security Best Practice"
[3]: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.RDSSecurityGroups.html "Controlling access with security groups - Amazon Relational Database Service"
[4]: https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html "Giving Lambda functions access to resources in an Amazon VPC - AWS Lambda" 