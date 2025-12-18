# Lambda関数 IAM権限 比較ドキュメント

このドキュメントは、各Lambda関数に付与されている権限を、自動生成されたものと手動で追加したものに分けて記録します。

## transcriptionProcessor Lambda関数

### 概要
音声/動画ファイルのS3アップロードをトリガーとして、外部API（ElevenLabs/Dify）を使用して文字起こし処理を実行するLambda関数です。

### 自動生成された権限

#### 1. amplify-lambda-execution-policy
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "appsync:GraphQL"
            ],
            "Resource": [
                "arn:aws:appsync:us-east-1:006985033268:apis/rmtticetkfe4bdsr46d3uwk6v4/types/Query/*",
                "arn:aws:appsync:us-east-1:006985033268:apis/rmtticetkfe4bdsr46d3uwk6v4/types/Mutation/*"
            ],
            "Effect": "Allow"
        },
        {
            "Action": "s3:ListBucket",
            "Resource": [
                "arn:aws:s3:::transcriptminutee59b87753a5a45619813e746bd1335d823cd-demo"
            ],
            "Effect": "Allow"
        },
        {
            "Action": [
                "s3:PutObject",
                "s3:GetObject"
            ],
            "Resource": [
                "arn:aws:s3:::transcriptminutee59b87753a5a45619813e746bd1335d823cd-demo/*"
            ],
            "Effect": "Allow"
        },
        {
            "Action": [
                "dynamodb:Get*",
                "dynamodb:BatchGetItem",
                "dynamodb:List*",
                "dynamodb:Describe*",
                "dynamodb:Scan",
                "dynamodb:Query",
                "dynamodb:PartiQLSelect",
                "dynamodb:Update*",
                "dynamodb:RestoreTable*",
                "dynamodb:PartiQLUpdate"
            ],
            "Resource": [
                "arn:aws:dynamodb:us-east-1:006985033268:table/Organization-rmtticetkfe4bdsr46d3uwk6v4-demo",
                "arn:aws:dynamodb:us-east-1:006985033268:table/Organization-rmtticetkfe4bdsr46d3uwk6v4-demo/index/*"
            ],
            "Effect": "Allow"
        },
        {
            "Action": [
                "dynamodb:Get*",
                "dynamodb:BatchGetItem",
                "dynamodb:List*",
                "dynamodb:Describe*",
                "dynamodb:Scan",
                "dynamodb:Query",
                "dynamodb:PartiQLSelect",
                "dynamodb:Update*",
                "dynamodb:RestoreTable*",
                "dynamodb:PartiQLUpdate"
            ],
            "Resource": [
                "arn:aws:dynamodb:us-east-1:006985033268:table/ProcessingSession-rmtticetkfe4bdsr46d3uwk6v4-demo",
                "arn:aws:dynamodb:us-east-1:006985033268:table/ProcessingSession-rmtticetkfe4bdsr46d3uwk6v4-demo/index/*"
            ],
            "Effect": "Allow"
        }
    ]
}
```

**内容:**
- **AppSync GraphQL**: 処理状況の更新（Query/Mutation）
- **S3 メインバケット**: 入力ファイルの読み取り、処理結果の保存
- **DynamoDB Organization**: 組織情報の参照・更新（利用時間の管理）
- **DynamoDB ProcessingSession**: セッション状態の参照・更新

#### 2. lambda-execution-policy
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:us-east-1:006985033268:log-group:/aws/lambda/transcriptionProcessor-demo:log-stream:*",
            "Effect": "Allow"
        }
    ]
}
```

**内容:**
- **CloudWatch Logs**: ログ出力のための基本権限

### 手動で追加した権限

#### 3. SecretsManagerAccess
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "secretsmanager:GetSecretValue",
            "Resource": "arn:aws:secretsmanager:us-east-1:006985033268:secret:transcription-api-keys-dev-DIH7Cu"
        }
    ]
}
```

**目的**: ElevenLabs/Dify APIキーの取得
**必要性**: 外部API呼び出しのための認証情報を安全に管理

#### 4. SQSDLQAccess
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "sqs:SendMessage"
            ],
            "Resource": "arn:aws:sqs:us-east-1:006985033268:transcriptminute-dlq-dev"
        }
    ]
}
```

**目的**: Dead Letter Queue（DLQ）へのメッセージ送信
**必要性**: 処理失敗時のメッセージを保存してトラブルシューティングを可能にする

#### 5. transcript-minute-outputbucket
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::transcriptminutee59b87753a5a45619813e746bd1335d4d612-output-dev/private/*"
        }
    ]
}
```

**目的**: 出力専用S3バケットへのアクセス
**必要性**: 再帰的Lambda実行を防ぐため、処理結果を入力バケットとは別の出力バケットに保存

### 権限設定の変更点

1. **環境別のリソース分離**: 
   - demo環境: `apis/rmtticetkfe4bdsr46d3uwk6v4`
   - dev環境: `apis/q5b2s3oswjhwtapy2zqqrjcwjm`

2. **セキュリティ強化**:
   - APIキーのSecrets Manager管理
   - DLQによる失敗処理の追跡

3. **アーキテクチャ改善**:
   - 入力・出力バケットの分離による無限ループ防止

### セキュリティ考慮事項

- **最小権限の原則**: 各権限は必要最小限に設定
- **リソース固有化**: ARNでリソースを明示的に指定
- **環境分離**: dev/demo環境で完全に分離された権限設定 