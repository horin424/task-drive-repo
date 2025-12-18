# Amplify + Dify EC2 ― Tokyo VPC 実装手順書

> **目的**  既存 GitHub リポジトリの Amplify アプリを *新顧客アカウント* にデプロイし、同じ VPC 内に Dify EC2 を配置して東京リージョン単一 VPC で完結する構成を構築する。

---

## 0. 事前準備

| 項目                    | 内容                                                          |
| --------------------- | ----------------------------------------------------------- |
| AWS アカウント             | 新顧客用 (本番)・既存 Dev 用は完全分離                                     |
| IAM ログイン              | アカウントの **AdministratorAccess** ロール推奨 (構築後に最小権限化)            |
| AWS CLI / Amplify CLI | `aws --version ≥ 2.17` , `npm i -g @aws-amplify/cli@latest` |
| GitHub Repo           | 既存 Amplify アプリ (Front + Backend) への read 権限                 |
| リージョン                 | `ap-northeast-1 (Tokyo)`                                    |

---

## 1. ネットワーク基盤を作成 (VPC Stack)

### 1.1 CIDR & サブネット設計

```
VPC : 10.13.0.0/19      (≒ 8 192 IP)
└─ Public  Subnet‑A : 10.13.0.0/24   (ap‑northeast‑1a)
└─ Public  Subnet‑C : 10.13.1.0/24   (ap‑northeast‑1c)
└─ Public  Subnet‑D : 10.13.2.0/24   (ap‑northeast‑1d)
└─ Private Subnet‑A : 10.13.16.0/20  (Lambda/EC2)
└─ Private Subnet‑C : 10.13.32.0/20
└─ Private Subnet‑D : 10.13.48.0/20
```

> **作成方法**  *AWS Console → VPC ウィザード（名前タグ自動生成: ****\`\`**** 推奨）* または *CDK / Terraform*。

### 1.2 ルーティング & NAT

| ルートテーブル          | サブネット     | 0.0.0.0/0 宛先           |
| ---------------- | --------- | ---------------------- |
| **Public‑RT**    | Public‑\* | Internet Gateway (IGW) |
| **Private‑RT‑A** | Private‑A | NAT‑GW‑A               |
| **Private‑RT‑C** | Private‑C | NAT‑GW‑C               |
| **Private‑RT‑D** | Private‑D | NAT‑GW‑D               |

- NAT Gateway を **各 AZ に 1 台** (本番) 作成。名前例:`natgw-a`,`natgw-c`,`natgw-d`。

### 1.3 セキュリティグループ (SG)

| SG 名               | 方向/ポート        | 許可元/宛先                        |
| ------------------ | ------------- | ----------------------------- |
| **sg-alb-private** | In : 443      | 0.0.0.0/0 (社内VPNのみなら CIDR 制限) |
|                    | Out : 443     | sg-lambda , sg-dify           |
| **sg-lambda**      | Out : 443     | 0.0.0.0/0 (NAT or VPCE)       |
|                    |  Out : 80/443 | sg-alb-private                |
| **sg-dify**        | In : 80/443   | sg-alb-private                |
|                    | Out : 443     | 0.0.0.0/0                     |

### 1.4 VPC エンドポイント (推奨)

| 種類        | サービス                               | サブネット               | 料金           |
| --------- | ---------------------------------- | ------------------- | ------------ |
| Gateway   | `com.amazonaws.ap-northeast-1.s3`  | **Private RT 全 AZ** | 無料           |
| Interface | SecretsManager, Logs, AppSync (任意) | Private Subnet      | 0.01 \$/AZ/h |

---

## 2. Dify EC2 配置（詳細手順）

> **ゴール** : VPC 内 Private サブネット (‑1a) に Dify サーバーを 1 台立て、内部 ALB 経由で Lambda から HTTPS で呼び出せる状態にする。

### 2.1 事前チェック

| 項目                   | 推奨設定                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| **キーペア**             | `dify-prod-tky.pem`（EC2 コンソールで作成）                                                                            |
| **IAM インスタンスプロファイル** | `DifyEC2Role` ポリシー: `AmazonSSMManagedInstanceCore` + `CloudWatchAgentServerPolicy` → EC2 に SSH 不要 / Logs 収集可 |
| **AMI**              | **Amazon Linux 2023 (x86\_64 – gp3)** AMI ID (2025‑06‑18 時点): `ami‑053b0d53c279acc90`                        |
| **インスタンスタイプ**        | `t3.medium` (2 vCPU / 4 GiB) 負荷に応じて `t3.small` も可                                                            |
| **サブネット**            | `prod-transcript-minute-subnet-private1-ap-northeast-1a`                                                     |
| **セキュリティグループ**       | `sg-dify`                                                                                                    |
| **ストレージ**            | 20 GiB gp3 （デフォルト 8 GiB だと Docker レイヤ不足リスク）                                                                  |
| **User‑data**        | 下記スクリプトを貼付                                                                                                   |

```bash
#!/bin/bash
set -euxo pipefail
# --- 基本セットアップ ---
yum update -y
amazon-linux-extras install docker -y
systemctl enable --now docker

# --- Dify コンテナ起動 ---
REGION="ap-northeast-1"
export DIFY_ENV=prod
export DIFY_PORT=5000
# Secrets Manager から API キーなどを取得する例
# SECRET_JSON=$(aws secretsmanager get-secret-value --region $REGION --secret-id dify/prod | jq -r .SecretString)
# export OPENAI_API_KEY=$(echo $SECRET_JSON | jq -r .openai)

docker run -d --name dify \
  -p 80:5000 \
  -e DIFY_ENV=$DIFY_ENV \
  --restart unless-stopped \
  ghcr.io/langgenius/dify:latest
```

> **Tips**
>
> - SSM Agent が自動インストールされるため、Systems Manager → *Session Manager* でシェルに入れます。
> - API キーを環境変数で直書きしないよう Secrets Manager 連携推奨。

---

### 2.2 Launch Template 作成

1. **EC2 → Launch Templates → Create**
2. ネットワーク設定: **VPC = prod‑transcript‑minute‑vpc** / Private サブネット‑1a
3. セキュリティグループ: **sg-dify**
4. ストレージと IAM ロールを指定
5. Advanced → User data にスクリプト貼付 → **Create template version**

> ⚠️ **確認** : Network interfaces → “Auto‑assign public IP = Disabled”。

### 2.3 インスタンス起動

- Launch Template から **Launch instance from template** → 1 台起動
- 起動後 **SSM Session Manager** で `curl -f http://localhost/healthz || echo "OK"` で疎通確認。

---

### 2.4 内部 ALB (Application Load Balancer)

1. **EC2 → Load Balancers → Create**
   - **Scheme** : Internal
   - **Network mapping** : Public サブネット‑1a (ALB は NAT 経由で外部通信しない)
   - **Security group** : `sg-alb-private`
2. **Target Group**
   - Type : Instances / Protocol HTTP / Port 80
   - Health check : path `/`  (※ Dify コンテナはルート `/` が 200 を返すため) / success codes `200`
   - 登録ターゲット : 先ほどの Dify EC2
3. **Listener** 443
   - **ACM 証明書** : `*.internal.dify.local` などプライベート CA or ACM DNS 検証
   - Forward to Target Group 上記

> 内部アクセスのみなら **HTTP 80 リスナー + SG 制限** でも可。Lambda から HTTPS を期待する場合は 443 を用意。

---

### 2.5 (オプション) Auto Scaling Group

1. EC2 → Auto Scaling → Create
2. Launch Template = 上で作成
3. VPC Subnet = Private‑1a
4. Desired = 1, Min = 1, Max = 3
5. Target tracking → ALB RequestCountPerTarget

---

### 2.6 内部ドメイン名の発行 (任意)

- **Route 53 → Private Hosted Zone** : `dify.internal`
- A レコード `api.dify.internal` → **Alias → ALB**
- Lambda 側は `https://api.dify.internal/` で呼び出せるようになる。

---

### 2.7 動作テスト

| コマンド                                       | 期待結果                          |
| ------------------------------------------ | ----------------------------- |
| Lambda (test event) → ALB URL `/v1/health` | HTTP 200 JSON `{status:"ok"}` |
| EC2 SSM → `curl -I http://localhost/`      | 200 OK                        |
| CloudWatch Logs (`/var/log/docker`)        | Dify サービスの起動ログが ERROR 無し      |

---

### 2.8 EC2 Instance Connect (Private‑IP)

> **目的** : Public IP を持たない Private サブネット内 EC2 に対し、ブラウザベースの SSH を実現。

| ステップ                    | 設定内容                                                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **① EIC Endpoint 作成**   | VPC → **Instance Connect Endpoints → Create**  • VPC : `prod-transcript-minute-vpc`  • Subnet : `private1-ap-northeast-1a`  • SG : \`\` (新規) |
| **② SG (EIC)**          | **Inbound** TCP 22 ← *Your IP /32*  **Outbound** All traffic → 0.0.0.0/0                                                                     |
| **③ SG (dify)**         | 追加 Inbound TCP 22 ← `sg-dify-ec2-instance-connect`                                                                                           |
| **④ IAM ポリシー (接続ユーザー)** | 既存 `AmazonEC2InstanceConnect` に **以下 4 アクション** を追加                                                                                           |

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2-instance-connect:OpenTunnel",
        "ec2-instance-connect:SendSSHPublicKey",
        "ec2:DescribeInstances",
        "ec2:DescribeInstanceConnectEndpoints"
      ],
      "Resource": "*"
    }
  ]
}
```

5. **接続手順**\
   EC2 → *Instance* → **Connect** → **Private IP** タブ → Endpoint を選択 → **Connect**

> **トラブルシュート**\
> • `Access denied` → IAM アクション不足\
> • `Endpoint not ready` → EIC Status が **available** になるまで待機

### 2.9 Dify 管理者コンソールへのアクセス（SSM ポートフォワーディング版）

> **目的** : Public IP を使わず、Systems Manager (SSM) 経由で Dify の `/admin` UI と SSH を安全に操作する。実際に行った手順を時系列で記録。

#### 2.9.1 事前準備

1. **AWS CLI プロファイルを作成**（`aws configure --profile takewa`）
2. **EC2 インスタンスに IAM ロール** `AmazonSSMManagedInstanceCore` をアタッチ
3. [macOS での Session Manager プラグインのインストール]\([https://docs.aws.amazon.com/ja\_jp/systems-manager/latest/userguide/install-plugin-macos-overview.html](https://docs.aws.amazon.com/ja_jp/systems-manager/latest/userguide/install-plugin-macos-overview.html))
4. **SSM エージェント確認** : `sudo systemctl restart amazon-ssm-agent` で再起動 & Active 状態を確認
5. **ローカル秘密鍵の権限を制限** :
   ```bash
   chmod 400 "~/Account_Data/dify-prod(takewa).pem"
   ```

#### 2.9.2 SSH 用トンネル確立

```bash
aws ssm start-session \
  --target i-06c60aa2b22c28545 \
  --document-name AWS-StartPortForwardingSession \
  --parameters '{"portNumber":["22"],"localPortNumber":["2222"]}' \
  --profile takewa
```

- 実行後 `Port 2222 opened … Waiting for connections...` と表示されたターミナルは **開いたまま** にする。

#### 2.9.3 ローカルから SSH 接続

```bash
ssh -i "~/Account_Data/dify-prod(takewa).pem" \
    -p 2222 ec2-user@localhost
```

- 初回は known‑hosts 追加確認 (`yes`) が出る。

#### 2.9.4 Dify `/admin` 画面にアクセス

1. **HTTP 用ポートフォワーディングを別ターミナルで開始**
   ```bash
   aws ssm start-session \
     --target i-06c60aa2b22c28545 \
     --document-name AWS-StartPortForwardingSession \
     --parameters '{"portNumber":["80"],"localPortNumber":["8443"]}' \
     --profile takewa
   ```
2. ブラウザで `http://localhost:8443/admin` を開き、Dify 管理 UI にログイン / Sign Up。

#### 2.9.5 セッション終了手順

1. ブラウザを閉じる → `/admin` 操作終了
2. SSH セッションで `exit`
3. 2 つの *start‑session* ターミナルそれぞれで **Ctrl‑C** し、`Exiting session` を確認

> **備考**
>
> - SSM セッションは最大 1 時間。継続が必要なら再実行。
> - 恒常アクセスが要る場合は AWS Client VPN の採用を検討。

---

### 2.10 CloudFront + 内部 ALB（**ACM なし / デフォルト CloudFront ドメイン採用**）

> **目的**: 内部 ALB をパブリック公開せず、CloudFront が持つ既定ドメイン（`*.cloudfront.net`）経由で Dify API/UI を呼び出す。証明書の追加取得は不要。

| ステップ                          | 設定手順                                                                                                                                                                                                                                                                                                                                                                                                                                    | 補足                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **① CloudFront Distribution** | • **Origin** = 内部 ALB DNS (protocol **HTTP only**, port **80**)• **Grant CloudFront access to origin = No** (OAC なし)• Viewer protocol policy = **Redirect HTTP → HTTPS**• **Response headers policy = SimpleCORS** (CloudFront が `Access-Control-Allow-Origin: *` を自動付与)• **Origin request policy = Managed-AllViewer** ← ★追加 (プリフライトヘッダー `Origin`, `Access-Control-Request-*` を ALB へ転送)• **Alternate CNAME / Custom SSL** : **設定しない** | `dxyz.cloudfront.net` が自動付与＆ AWS 証明書で TLS 終端 |
| **② ALB SG 更新**               | `sg-alb-private` **Inbound 80** ← CloudFront エッジ CIDR (簡易なら `0.0.0.0/0` + WAF 制限)                                                                                                                                                                                                                                                                                                                                                       | CloudFront → ALB の HTTP 通信を許可                |
| **③ 取得したドメインをメモ**             | 例:`https://d123abc4.cloudfront.net`                                                                                                                                                                                                                                                                                                                                                                                                     | 以降「CloudFront 既定ドメイン」と呼称                     |
| **④ CORS (Dify)**             | `.env` に`ACCESS_CONTROL_ALLOW_ORIGIN=https://prodtakewa.d23ct2g1zz4hgz.amplifyapp.com``ACCESS_CONTROL_ALLOW_METHODS=GET,POST,OPTIONS,PUT,PATCH,DELETE`                                                                                                                                                                                                                                                                                  | OPTIONS を 200 応答するように設定 (テスト済み)              |
| **⑤ フロント設定**                  | Amplify 環境変数`NEXT_PUBLIC_DIFY_API_URL=https://d123abc4.cloudfront.net/v1`                                                                                                                                                                                                                                                                                                                                                               | Frontend から Dify API を呼び出す先を更新               |

> **プリフライト 200 OK を確認済み**  (SSM ポートフォワーディング `curl -I -X OPTIONS http://localhost:8080/v1/chat-messages …` で 200 + CORS ヘッダー)

> **次のチェック**  : CloudFront ビヘイビアに上記 `Origin request policy` を設定後、`curl -I -X OPTIONS https://dxyz.cloudfront.net/v1/chat-messages …` が 200 を返すことを確認。• **Alternate CNAME / Custom SSL** : **設定しない** | デフォルトの `dxyz.cloudfront.net` が自動付与＆ AWS 証明書で TLS 終端  | | **② ALB SG 更新** ALB SG 更新\*\* | `sg-alb-private` **Inbound 80** ← CloudFront エッジ CIDR (簡易なら `0.0.0.0/0` + WAF 制限) | CloudFront → ALB の HTTP 通信を許可 | | **③ 取得したドメインをメモ** | 例:`https://d123abc4.cloudfront.net` | 以降「CloudFront 既定ドメイン」と呼称 | | **④ CORS (Dify)** | `.env` `ACCESS_CONTROL_ALLOW_ORIGIN=https://d123abc4.cloudfront.net` | OPTIONS も許可 | | **⑤ フロント設定** | Amplify 環境変数 or `.env` で `NEXT_PUBLIC_DIFY_API_URL=https://d123abc4.cloudfront.net/v1` | Frontend から Dify API を呼び出す先を更新 |

> **料金感**\
> CloudFront 東京 POP: \~0.085 USD/GB + 0.0075 USD/10k req\
> WAF 基本費用: 14 USD/1000 万リクエスト＋追加ルール課金

#### 2.10.1 WAF サイズ制限ルール除外 (2025‑06‑19 対応済み)

- フロントエンドの "議事録生成" API が **HTTP 403** (CloudFront Error) となった原因は、デフォルト Web ACL 内の \`\` が *8 KB 超の POST ボディ* をブロックしていたため。
- **解決手順**
  1. WAF コンソール → 既存 Web ACL → **Rules** タブを展開
  2. `AWSManagedRulesCommonRuleSet` → `SizeRestrictions_BODY` の **Action override** を **Count**（もしくは *Allow*）へ変更
  3. **Save rule** → **Save** で Web ACL を再デプロイ
  4. 数分後に `curl -I -X POST https://dxyz.cloudfront.net/v1/chat-messages …` で **HTTP 200** を確認
- 他の Managed ルールは維持されるため、基本的な OWASP Top‑10 保護は継続。
- 将来的に Body サイズ上限を超えるエンドポイントが増える場合は、カスタムルールで正規表現／JSON schema 制御へ置き換えも検討。\
  \*\*

> CloudFront 東京 POP: \~0.085 USD/GB + 0.0075 USD/10k req\
> WAF 基本費用: 14 USD/1000 万リクエスト＋追加ルール課金

---

## 3. Amplify アプリの環境複製 Amplify アプリの環境複製

. Amplify アプリの環境複製. Amplify アプリの環境複製 Amplify アプリの環境複製 Amplify アプリの環境複製 Amplify アプリの環境複製

### 3.1 Git クローン & CLI 初期化

```bash
# 1. リポジトリ取得
gh repo clone <org>/<project>
cd <project>

# 2. AWS CLI プロファイル作成
aws configure --profile prod-tky
  AWS Access Key ID [None]: ********
  AWS Secret Access Key [None]: ********
  Default region name [None]: ap-northeast-1

# 3. Amplify 初期化
amplify init --profile prod-tky
  ? Enter a name for the project › transcript-app
  ? Environment name › prod
  ? Choose your default editor › VSCode
  ? Choose the type of app that you're building › javascript
  (...省略...)
```

### 3.2 新環境追加 (既存 Dev との差分反映)

```bash
amplify env add prod --profile prod-tky
  ? Select AWS profile › prod-tky
  ? Do you want to use an existing VPC › Yes
  ✔ VPC ID (vpc-0abc...)
  ✔ Private Subnets (3)  
  ✔ Security Groups: sg-lambda
```

> **tips** : `team-provider-info.json` に VPC 設定が保存される。

### 3.3 Lambda を VPC 内へ接続 (1 AZ モード)

> Amplify CLI では現状 \`\`\*\* で VPC 設定が反映できない\*\* ため、今回は **コンソール操作 → その後 Amplify に Pull で取り込み** という手順で確定。

| 手順                                        | 画面操作                                                                                                                                                     | ポイント                       |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **① 関数を選択**                               | Lambda → *Functions* → 対象 (`generationWorker` など) → *Configuration → VPC* → **Edit**                                                                     |                            |
| **② VPC 設定**                              | • VPC : `prod-transcript-minute-vpc`• **Subnets** : `prod-transcript-minute-subnet-private1-ap-northeast-1a` (1 AZ 運用)• **Security group** : `sg-lambda` | 警告「高可用性には 2 AZ 推奨」は無視可。    |
| **③ SG ルール確認**                            | `sg-lambda` → Outbound TCP 80/443 → `sg-alb-private` があること                                                                                               | Inbound ルールは不要 (Lambda 起点) |
| **④ IAM ロール**                             | `AWSLambdaVPCAccessExecutionRole` がアタッチされていることを確認                                                                                                        | 無い場合は IAM → ロールに追加         |
| **⑤ テスト**                                 | *Test* イベントで外部 API へ到達 (Secrets Manager / S3)                                                                                                            | 成功 → VPC & NAT が正しく動作      |
| **⑥ 設定を IaC へ反映**                         | \`\`\`bash                                                                                                                                               |                            |
| amplify pull --restore --profile prod-tky |                                                                                                                                                          |                            |
| \`\`\`                                    | CloudFormation テンプレに VPCConfig が取り込まれ、次回 `amplify push` で上書きされなくなる                                                                                       |                            |

> **2 AZ に拡張したい場合** : Private‑1c を追加 → `sg-lambda` Outbound 80/443 → NAT‑C or Interface VPCE が必要。詳細は §1.2 ルーティング & NAT 参照。

---

### 3.4 API Gateway → 内部 ALB ルーティング API Gateway → 内部 ALB ルーティング

1. **VPC Link 作成** (`apigw-link-dify`)
   - Target NLB/ALB: `alb-private`
2. **Backend > customCDK** フォルダに CDK スタックを追加し、`/generate/*` エンドポイントに VPC Link をインテグレート。
3. `amplify push` でデプロイ。

---

## 4. ホスティングと環境変数

| 項目              | 値                                                         | 備考                    |
| --------------- | --------------------------------------------------------- | --------------------- |
| Amplify Hosting | GitHub ブランチ `main`                                        | 新アプリ (東京リージョン) を作成し接続 |
| 環境変数 (例)        | `NEXT_PUBLIC_APPSYNC_URL`, `NEXT_PUBLIC_MAINTENANCE_MODE` | 東京リージョン用に更新           |
| CloudFront      | OAI → S3 バケットにポリシー適用                                      | SPA を非公開バケットで保護       |

---

## 5. CI/CD フロー

1. **Amplify Console → Build Settings**
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm ci
       build:
         commands:
           - npm run build
   artifacts:
     baseDirectory: .next
     files:
       - '**/*'
   cache:
     paths:
       - node_modules/**/*
   ```
2. Amplify が CloudFormation + CodeBuild を自動実行し、API 更新後に `lambda build` → S3 → CloudFront Invalidation。

---

## 6. テスト & 検証

| テスト項目                     | 手順                                             |
| ------------------------- | ---------------------------------------------- |
| S3 → Lambda Trigger       | S3 入力バケットにサンプル MP3 をアップロード→Lambda LOGS 確認      |
| Lambda → Dify ALB 経由 HTTP | `generationProcessor` LOGS で 200 応答確認          |
| AppSync Subscription      | フロント UI でステータスがリアルタイム更新するか                     |
| NAT 帯域 / 料金               | CloudWatch → NAT Gateway Metrics (BytesOut) 監視 |

---

## 7. 運用 Tips

- **コスト最適化** : S3 Gateway VPCE → NAT 経由転送を削減。CloudWatch Logs & S3 ライフサイクルで不要データを自動削除。
- **セキュリティ** : SG は最小許可。SecretsManager へのアクセスは IAM ポリシー `Condition:VpcEndpoint` で制限。
- **バックアップ** : DynamoDB PITR/Export, S3 Versioning を有効化。
- **CI と IaC 分離** : Amplify Gen 1 → 後日 CDK 移行も視野に。VPC ID / Subnet ID は `context` で切替。

---

## 8. クリーンアップ (不要リソース削除)

```bash
amplify env remove dev
aws ec2 delete-nat-gateway --nat-gateway-id ngw-xxxxx
aws cloudformation delete-stack --stack-name dify-alb-stack
# ほか、VPC Endpoints / IAM など
```

---

### 完了🎉

これで *Amplify バックエンド* と *Dify EC2* を同一 VPC に統合し、セキュアかつスケーラブルな東京リージョン本番環境が構築できました。

