# CloudWatch RUM 実装方針書

## 概要
議事録自動化システムにAmazon CloudWatch RUMを導入し、認証済みユーザーのリアルユーザーモニタリングを実現する。

## プロジェクト情報
- **対象システム**: transcript-minute
- **実装範囲**: 認証済みユーザーのみ（第1段階）
- **実装時期**: v0.2.x
- **作成日**: 2025年1月

## 1. 背景と目的

### 背景
- フロントエンドでのユーザー体験問題の早期検出が必要
- クライアントサイドエラーの可視化と分析が課題
- パフォーマンス問題の定量的な把握が困難

### 目的
- 認証済みユーザーのリアルタイム体験監視
- JavaScriptエラーの自動収集と分析
- ページ読み込み時間などのパフォーマンス指標取得
- CloudWatch生態系での統合監視環境構築

## 2. 実装アプローチの選択

### 選択したオプション: **認証済みユーザーのみ監視**

#### 理由
1. **監視対象の適切性**
   - 議事録作成などの主要機能は認証後に利用
   - ビジネス価値の高い画面を重点的に監視
   - 認証完了後のRUM初期化で未認証ユーザーのイベント送信を防止

2. **IaC（Infrastructure as Code）による管理**
   - CDKによるコード化でバージョン管理可能
   - 環境ごとの自動デプロイで設定ミスを防止
   - 既存のAmplifyインフラと一貫した管理

3. **実装の簡潔性**
   - 既存のCognito Identity Pool を拡張利用
   - Amplify Hooksによる環境変数自動設定

4. **セキュリティ設計**
   - `allowUnauthenticatedIdentities: true`は技術的要件
   - Unauth Role の権限を RUM のみに限定してリスク最小化

### 除外したオプション
- **2つのApp Monitor方式**: 初期実装としては複雑すぎる（将来的に検討）
- **ログイン前からのRUM初期化**: 未認証ユーザーのデータ収集を避けるため

## 3. セキュリティ考慮事項

### 3.1 Identity Pool設定変更（必須）
**重要**: RUM SDK の技術的要件により `allowUnauthenticatedIdentities: true` が必須

```json
{
  "allowUnauthenticatedIdentities": true,  // RUM初期化に必須
  "authSelections": "identityPoolAndUserPool"
}
```

**変更理由**: RUM SDKは初期化直後に必ず未認証として `cognito-identity:GetId` を呼び出すため

### 3.2 追加される権限

#### Auth Role（認証済みユーザー）
```json
{
  "Effect": "Allow",
  "Action": [
    "rum:PutRumEvents",
    "rum:BatchGetRumMetricDefinitions"
  ],
  "Resource": "arn:aws:rum:us-east-1:006985033268:appmonitor/app-monitor-transcript-minute-*"
}
```

#### Unauth Role（未認証ユーザー - RUM初期化に必要）
```json
{
  "Effect": "Allow",
  "Action": [
    "rum:PutRumEvents",
    "rum:BatchGetRumMetricDefinitions"
  ],
  "Resource": "arn:aws:rum:us-east-1:006985033268:appmonitor/app-monitor-transcript-minute-*"
}
```

**注意**: 認証済みユーザーのみ監視する場合でも、RUM SDK の初期化には Unauth Role が必要

### 3.3 リスク評価
| リスク項目 | 評価 | 対策 |
|-----------|------|------|
| 課金攻撃 | 低 | 認証必須、サンプリング率制御 |
| 情報漏洩 | 低 | App Monitor IDは非機密情報 |
| 権限エスカレーション | 低 | RUM専用権限のみ追加 |

## 4. 技術仕様

### 4.1 アーキテクチャ
```
[Next.js App] -> [Cognito Auth] -> [CloudWatch RUM] -> [CloudWatch Console]
```

### 4.2 実装箇所
- **インフラ実装**: `amplify/backend/custom/cloudwatchrum/cdk-stack.ts`
- **自動化**: `amplify/hooks/post-push.js`
- **メイン実装**: `src/app/layout.tsx`
- **設定管理**: 環境変数 (`NEXT_PUBLIC_*`) - Amplify Hooksで自動生成
- **権限設定**: 既存のCognito IAMロール拡張

### 4.3 技術要件
- **フレームワーク**: Next.js 15.2.2 (App Router)
- **認証**: AWS Amplify v6.13.5 + Cognito
- **RUMクライアント**: AWS RUM Web Client
- **CDK**: AWS CDK v2 (`aws-cdk-lib` ^2.80.0) - v1ではRUMモジュール未対応
- **デプロイ**: Amplify Hosting (静的書き出し)

### 4.4 監視対象テレメトリ
- **Performance**: ページ読み込み時間、Core Web Vitals
- **Errors**: JavaScriptエラー、未処理例外
- **HTTP**: API呼び出しの成功/失敗率、レスポンス時間

## 5. 実装範囲

### 5.1 第1段階（今回実装）
- [x] 認証済みユーザーのみの監視
- [x] 基本的なRUM設定
- [x] IAM権限の最小限追加
- [x] Next.js App Routerでの統合

### 5.2 対象外（将来検討）
- ログインページの監視
- 未認証ユーザーの体験監視
- カスタムメトリクスの送信
- アラート設定の自動化

## 11. 実装決定事項

### 11.1 基本設定
- **App Monitor名**: `app-monitor-transcript-minute-{env}`
- **サンプリング率**: `1.0` (100%) - 問い合わせ対応のため全データ収集
- **X-Ray連携**: 無効（`enableXRay: false`）
- **開発環境**: 基本的に有効、環境変数で制御可能
- **データ保持期間**: 30日（固定、長期保持はCloudWatch Logs側で設定）
- **ログ取り込み**: 有効（問い合わせ分析の詳細化のため）

### 11.2 権限設定
- **権限スコープ**: 特定のApp Monitorのみに限定
- **対象ロール**: Auth Role と Unauth Role の両方に設定
- **追加制限**: リソースARNによる制限で最小権限を実現
- **IAMロール**: 既存ロールの拡張

#### Auth Role と Unauth Role 共通設定
```json
{
  "Effect": "Allow",
  "Action": [
    "rum:PutRumEvents",
    "rum:BatchGetRumMetricDefinitions"
  ],
  "Resource": "arn:aws:rum:us-east-1:006985033268:appmonitor/app-monitor-transcript-minute-*"
}
```

**重要**: 
- `aws:CalledVia` Conditionは**使用不可**（ブラウザ→RUM直接呼び出しでは値が空）
- Conditionを付けると `PutRumEvents` が 403 エラーで失敗
- 最小権限はResourceスコープ（ARN指定）で担保

### 11.3 実装方式
- **実装場所**: 専用Provider作成（※実装詳細は11.7を参照）
- **初期化タイミング**: 認証完了後
- **エラーハンドリング**: アプリケーション継続、サイレント処理
- **除外ページ**: なし（全ページ監視）

### 11.4 環境変数設計
```typescript
NEXT_PUBLIC_RUM_ENABLED: string          // "true" | "false"
NEXT_PUBLIC_RUM_APP_MONITOR_ID: string   // App Monitor ID
NEXT_PUBLIC_RUM_REGION: string           // "us-east-1"
NEXT_PUBLIC_RUM_IDENTITY_POOL_ID: string // Cognito Identity Pool ID
NEXT_PUBLIC_RUM_SAMPLE_RATE: string      // "1.0" (問い合わせ対応のため全データ収集)
```

#### サンプリング率設定方針
- **全環境**: `1.0`（100%）- 問い合わせ対応時の詳細分析のため全データを収集
- 利用量増加時は将来的にサンプリング率調整を検討

### 11.5 テレメトリ設定
- **Performance**: 有効（ページ読み込み時間、Core Web Vitals）
- **Errors**: 有効（JavaScript例外、Promise rejection）
- **HTTP**: 有効（API呼び出し、レスポンス時間）
- **Navigation**: 有効（ページ間遷移、SPAルーティング）
  - ※navigationはリージョン対応状況に注意（東京リージョンは2024-Q4対応済み）

### 11.6 エラーハンドリング詳細
- **ネットワークエラー**: データ破棄（失敗したデータは諦める）
- **エラーログ**: コンソールのみ（CloudWatch Logsを汚染しない）
- **初期化失敗**: サイレント処理、アプリケーション継続

### 11.7 技術実装詳細
- **初期化タイミング**: 認証完了後
- **SSR対応**: Dynamic Import方式（Next.js 15ベストプラクティス）
- **Cookie設定**: `{ secure: true, sameSite: 'strict' }`
- **X-Ray連携**: 無効（分散トレーシング不要）
- **CDK実装**: v2使用、実ARN取得、パラメータ化対応
- **ログ取り込み**: 有効（`cwLogEnabled: true`）

### 11.8 最終RUM設定
```typescript
// Identity Pool設定（allowUnauthenticatedIdentities: true必須）
const identityPoolConfig = {
  identityPoolId: process.env.NEXT_PUBLIC_RUM_IDENTITY_POOL_ID,
  region: process.env.NEXT_PUBLIC_RUM_REGION
};

// RUM設定
const rumConfig = {
  telemetries: ['performance', 'errors', 'http', 'navigation'],
  sessionSampleRate: 1.0,
  allowCookies: true,
  enableXRay: false,
  cookieAttributes: { secure: true, sameSite: 'strict' },
  ...identityPoolConfig
};

// 認証完了後に初期化（未認証ユーザーのイベント送信を防ぐ）
useEffect(() => {
  if (user?.isAuthenticated && process.env.NEXT_PUBLIC_RUM_ENABLED === 'true') {
    import('aws-rum-web').then(({ AwsRum }) => {
      new AwsRum(
        process.env.NEXT_PUBLIC_RUM_APP_MONITOR_ID!,
        process.env.NEXT_PUBLIC_RUM_REGION!,
        '0.2.0',
        rumConfig
      );
    });
  }
}, [user?.isAuthenticated]);
```

## 6. 実装手順概要

### Phase 1: CDKカスタムリソース作成
1. Amplify CDKカスタムリソース追加
2. CloudWatch RUM App Monitor のCDK実装
3. Amplify Hooksによる環境変数自動設定

### Phase 2: IAM権限設定
1. 既存Cognito IAMロール（Auth/Unauth）の権限拡張
2. Identity Pool設定変更（`allowUnauthenticatedIdentities: true`）

### Phase 3: フロントエンド実装
1. RUM Web Clientの導入
2. RUM Providerの作成と実装
3. layout.tsxでの統合

### Phase 4: テスト・検証・デプロイ
1. 開発環境での動作確認
2. 本番環境でのデータ取得確認
3. CloudWatchコンソールでの監視開始

## 7. 将来の拡張可能性

### 7.1 第2段階候補
- **ゲストユーザー監視**: ログインページの問題検出
- **カスタムイベント**: 業務固有のユーザーアクション追跡
- **アラート連携**: 重要エラーのSlack通知など

### 7.2 技術的拡張
- **X-Ray連携**: 分散トレーシングとの統合
- **CloudWatch Insights**: ログ分析の高度化
- **ダッシュボード作成**: 運用監視用のカスタムダッシュボード

## 8. 成功指標

### 8.1 技術指標
- RUMデータの正常収集（エラー率 < 1%）
- ページ読み込み時間の可視化
- JavaScriptエラーの検出・分類

### 8.2 運用指標
- 問題検出から対応までの時間短縮
- ユーザー報告前の問題発見率向上
- パフォーマンス改善のデータ活用

## 9. 注意事項

### 9.1 データの取り扱い
- RUMデータには個人識別情報を含めない
- セッション情報は暗号化された形で保存
- GDPR等のプライバシー規制への配慮
- 必要に応じてCloudWatch LogsグループにKMS CMKを設定

### 9.2 運用考慮事項
- サンプリング率による課金制御
- データ保持期間の適切な設定
- 監視アラートの適切な閾値設定

### 9.4 CDK実装における重要な注意点
**CDK v2必須要件**:
- CDK v1では`@aws-cdk/aws-rum`モジュールが存在しない
- `aws-cdk-lib`と`constructs`を使用する

**ARN/ID取得の正確性**:
- ワイルドカード使用は避け、実際のARNを取得
- `UnauthRoleArn`と`IdentityPoolId`を確実に取得
- CloudFormation `Malformed ARN`エラーの回避

**Service-linked Role考慮**:
- 組織SCPで`iam:CreateServiceLinkedRole`拒否設定がある場合は注意
- 必要に応じて許可設定を追加

### 9.3 CSP（Content Security Policy）設定
CloudFrontで強固なCSPを設定している場合、以下の設定が必要：

```javascript
// CSP設定例
script-src 'self' https://client.rum.us-east-1.amazonaws.com;
connect-src 'self' 
  https://dataplane.rum.us-east-1.amazonaws.com
  https://rms.rum.us-east-1.amazonaws.com;
```

**注意**: v1.16以降では `rms.rum` エンドポイントも必要

## 10. 具体的な実装内容

### 10.1 CDKカスタムリソース実装

#### package.json設定
```json
{
  "name": "custom-resource",
  "version": "1.0.0",
  "dependencies": {
    "@aws-amplify/cli-extensibility-helper": "^2.0.0",
    "aws-cdk-lib": "^2.80.0",
    "constructs": "^10.0.0"
  },
  "devDependencies": {
    "typescript": "^4.2.4"
  }
}
```

#### CDK Stack実装 (cdk-stack.ts)
```typescript
import { Stack, StackProps, aws_rum as rum, CfnParameter, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as AmplifyHelpers from '@aws-amplify/cli-extensibility-helper';
import { AmplifyDependentResourcesAttributes } from '../../types/amplify-dependent-resources-ref';

export class CloudWatchRumStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps, amplifyResourceProps?: AmplifyHelpers.AmplifyResourceProps) {
    super(scope, id, props);
    
    new CfnParameter(this, 'env', {
      type: 'String',
      description: 'Current Amplify CLI env name',
    });
    
    // Amplifyドメインパラメータ（環境ごとに変更可能）
    const amplifyDomain = new CfnParameter(this, 'AmplifyDomain', {
      type: 'String',
      default: 'dev.d3sakkbawtnkcg.amplifyapp.com',
      description: 'Amplify app domain for RUM monitoring'
    });
    
    const amplifyProjectInfo = AmplifyHelpers.getProjectInfo();
    
    // 依存リソースの取得
    const retVal: AmplifyDependentResourcesAttributes = AmplifyHelpers.addResourceDependency(this,
      amplifyResourceProps!.category,
      amplifyResourceProps!.resourceName,
      [
        { category: 'auth', resourceName: 'transcriptminute472b0aaa' }
      ]
    );
    
    // 実際のARNとIDを取得（ワイルドカード使用を避ける）
    const identityPoolId = retVal.auth.transcriptminute472b0aaa.IdentityPoolId;
    const guestRoleArn = retVal.auth.transcriptminute472b0aaa.UnauthRoleArn;
    
    // RUM App Monitor作成
    const appMonitor = new rum.CfnAppMonitor(this, 'RumAppMonitor', {
      name: `app-monitor-transcript-minute-${amplifyProjectInfo.envName}`,
      domain: amplifyDomain.valueAsString,
      
      appMonitorConfiguration: {
        allowCookies: true,
        enableXRay: false,
        guestRoleArn: guestRoleArn,
        identityPoolId: identityPoolId,
        sessionSampleRate: 1,
        telemetries: ['performance', 'errors', 'http', 'navigation']
      },
      cwLogEnabled: true  // 問い合わせ分析のためログ取り込み有効
    });
    
    // Output設定
    new CfnOutput(this, 'AppMonitorId', {
      value: appMonitor.attrAppMonitorId,
      description: 'CloudWatch RUM App Monitor ID'
    });
    
    new CfnOutput(this, 'AppMonitorName', {
      value: appMonitor.name!,
      description: 'CloudWatch RUM App Monitor Name'
    });
    
    new CfnOutput(this, 'IdentityPoolId', {
      value: identityPoolId,
      description: 'Cognito Identity Pool ID'
    });
    
    new CfnOutput(this, 'GuestRoleArn', {
      value: guestRoleArn,
      description: 'Cognito Unauthenticated Role ARN'
    });
  }
}
```

### 10.2 Amplify Hooks実装

#### post-push.js実装
```javascript
const fs = require('fs');
const path = require('path');

try {
  const parameters = JSON.parse(fs.readFileSync(0, { encoding: 'utf8' }));
  
  const amplifyMetaFile = JSON.parse(fs.readFileSync(path.join(
    parameters.data.amplify.environment.projectPath,
    'amplify',
    'backend',
    'amplify-meta.json'
  )));
  
  // エラーハンドリング付きで値を取得
  const custom = amplifyMetaFile.custom;
  if (!custom || !custom.cloudwatchrum) {
    console.warn('CloudWatch RUM custom resource not found in amplify-meta.json');
    process.exit(0);
  }
  
  const rumOutput = custom.cloudwatchrum.output;
  if (!rumOutput || !rumOutput.AppMonitorId || !rumOutput.IdentityPoolId) {
    console.error('Required RUM outputs not found. Check CloudFormation stack status.');
    process.exit(1);
  }
  
  console.log('=== CloudWatch RUM 環境変数 ===');
  console.log(`NEXT_PUBLIC_RUM_APP_MONITOR_ID=${rumOutput.AppMonitorId}`);
  console.log(`NEXT_PUBLIC_RUM_IDENTITY_POOL_ID=${rumOutput.IdentityPoolId}`);
  console.log(`NEXT_PUBLIC_RUM_REGION=us-east-1`);
  console.log(`NEXT_PUBLIC_RUM_ENABLED=true`);
  console.log(`NEXT_PUBLIC_RUM_SAMPLE_RATE=1.0`);
  console.log('===========================');
  
  // 環境変数ファイル自動生成
  const envContent = `# CloudWatch RUM Settings (自動生成)
NEXT_PUBLIC_RUM_ENABLED=true
NEXT_PUBLIC_RUM_APP_MONITOR_ID=${rumOutput.AppMonitorId}
NEXT_PUBLIC_RUM_REGION=us-east-1
NEXT_PUBLIC_RUM_IDENTITY_POOL_ID=${rumOutput.IdentityPoolId}
NEXT_PUBLIC_RUM_SAMPLE_RATE=1.0
# GuestRoleArn: ${rumOutput.GuestRoleArn || 'N/A'}
`;
  
  const envFilePath = path.join(parameters.data.amplify.environment.projectPath, '.env.local.rum');
  fs.writeFileSync(envFilePath, envContent);
  console.log(`RUM環境変数を ${envFilePath} に書き出しました`);
  
} catch (error) {
  console.error('Amplify Hooks処理でエラーが発生:', error.message);
  console.log('手動で環境変数を設定してください。');
}
```

### 10.3 IAM権限設定

#### Auth Role権限（認証済みユーザー用）
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "rum:PutRumEvents",
        "rum:BatchGetRumMetricDefinitions"
      ],
      "Resource": "arn:aws:rum:us-east-1:006985033268:appmonitor/app-monitor-transcript-minute-*"
    }
  ]
}
```

#### Unauth Role権限（RUM SDK初期化用）
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "rum:PutRumEvents",
        "rum:BatchGetRumMetricDefinitions"
      ],
      "Resource": "arn:aws:rum:us-east-1:006985033268:appmonitor/app-monitor-transcript-minute-*"
    }
  ]
}
```

### 10.4 フロントエンド実装

#### 環境変数型定義追加 (src/types/environment.d.ts)
```typescript
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // 既存の環境変数...
      
      // CloudWatch RUM設定
      NEXT_PUBLIC_RUM_ENABLED: string;          // "true" | "false"
      NEXT_PUBLIC_RUM_APP_MONITOR_ID: string;   // App Monitor ID
      NEXT_PUBLIC_RUM_REGION: string;           // "us-east-1"
      NEXT_PUBLIC_RUM_IDENTITY_POOL_ID: string; // Cognito Identity Pool ID
      NEXT_PUBLIC_RUM_SAMPLE_RATE: string;      // "1.0"
    }
  }
}

export {};
```

#### RUM Provider実装 (src/providers/RumProvider.tsx)
```typescript
'use client';

import { useEffect } from 'react';
import { useAuthInit } from '@/hooks/useAuthInit';

interface RumProviderProps {
  children: React.ReactNode;
}

export default function RumProvider({ children }: RumProviderProps) {
  const { user } = useAuthInit();

  useEffect(() => {
    if (user?.isAuthenticated && process.env.NEXT_PUBLIC_RUM_ENABLED === 'true') {
      
      // Dynamic Import でSSR問題を回避
      import('aws-rum-web').then(({ AwsRum }) => {
        try {
          // Identity Pool設定
          const identityPoolConfig = {
            identityPoolId: process.env.NEXT_PUBLIC_RUM_IDENTITY_POOL_ID,
            region: process.env.NEXT_PUBLIC_RUM_REGION
          };

          // RUM設定
          const rumConfig = {
            telemetries: ['performance', 'errors', 'http', 'navigation'],
            sessionSampleRate: parseFloat(process.env.NEXT_PUBLIC_RUM_SAMPLE_RATE || '1.0'),
            allowCookies: true,
            enableXRay: false,
            cookieAttributes: { secure: true, sameSite: 'strict' as const },
            ...identityPoolConfig
          };

          // RUM初期化
          new AwsRum(
            process.env.NEXT_PUBLIC_RUM_APP_MONITOR_ID!,
            process.env.NEXT_PUBLIC_RUM_REGION!,
            '0.2.0',
            rumConfig
          );

          console.log('CloudWatch RUM initialized successfully');
        } catch (error) {
          console.error('RUM initialization failed:', error);
          // アプリケーション継続、サイレント処理
        }
      }).catch(error => {
        console.error('Failed to load AWS RUM Web Client:', error);
      });
    }
  }, [user?.isAuthenticated]);

  return <>{children}</>;
}
```

#### Layout統合 (src/app/layout.tsx)
```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import QueryProvider from "./QueryProvider";
import RumProvider from "@/providers/RumProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "議事録自動化システム",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <RumProvider>
          <QueryProvider>{children}</QueryProvider>
        </RumProvider>
      </body>
    </html>
  );
}
```

### 10.5 トラブルシューティング

#### CDKデプロイエラー対処法

**1. CDK v1依存関係エラー**
```bash
# エラー例
npm ERR! 404 Not Found - GET https://registry.npmjs.org/@aws-cdk%2faws-rum

# 対策
- package.jsonでCDK v2使用を確認
- @aws-cdk/* → aws-cdk-lib に変更
```

**2. CloudFormation Malformed ARNエラー**
```bash
# エラー例
Invalid template: Template format error: Malformed ARN

# 対策
- ワイルドカード使用を避ける
- retVal.auth.transcriptminute472b0aaa.UnauthRoleArn を使用
```

**3. Identity Pool IDエラー**
```bash
# エラー例
GuestRoleArn requires an identityPoolId

# 対策
- Fn.ref() 使用を避ける
- 実値を直接取得: retVal.auth.transcriptminute472b0aaa.IdentityPoolId
```

#### RUM初期化エラー対処法

**1. 認証エラー**
```javascript
// エラー例
NotAuthorizedException: User is not authorized to perform: cognito-identity:GetId

// 対策
- allowUnauthenticatedIdentities: true 確認
- IAM権限の確認
```

**2. 403エラー**
```javascript
// エラー例
Access Denied: PutRumEvents

# 対策
- IAM Conditionを削除
- リソースARNスコープ確認
```

### 10.6 デプロイ手順

#### 1. カスタムリソース作成
```bash
amplify add custom
# → AWS CDK 選択
# → リソース名: cloudwatchrum
```

#### 2. 依存関係インストール
```bash
cd amplify/backend/custom/cloudwatchrum
npm install
```

#### 3. Identity Pool設定変更
```bash
# AmplifyコンソールまたはCLIで設定変更
allowUnauthenticatedIdentities: true
```

#### 4. デプロイ実行
```bash
amplify build
amplify push -y
```

## 11. 関連ドキュメント

- [AWS CloudWatch RUM公式ドキュメント](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-RUM.html)
- [認証済み・ゲストユーザー分離のベストプラクティス](https://aws.amazon.com/blogs/mt/how-to-isolate-signed-in-users-from-guest-users-within-amazon-cloudwatch-rum/)
- プロジェクト内関連ファイル:
  - `amplify/backend/auth/transcriptminute472b0aaa/cli-inputs.json`
  - `src/app/layout.tsx`
  - `amplify/backend/backend-config.json` 