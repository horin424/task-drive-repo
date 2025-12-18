# 文字起こしツール (Transcript Minute)

音声・動画ファイルをアップロードし、AIを活用して自動的に文字起こし、話者認識、箇条書き要約、議事録生成を行うWebアプリケーションです。

## 主な機能

- **音声・動画ファイルの文字起こし**: MP3, M4A, WAV, MP4, OGG, AAC, WEBM, FLAC形式のファイルに対応
- **多言語文字起こし**: 日本語と英語での文字起こしに対応
- **話者認識と話者名編集**: AIによる話者の自動識別と簡単な名前編集
- **箇条書き生成**: 文字起こし内容から重要ポイントを箇条書きで抽出
- **議事録生成**: 構造化された議事録の自動生成
- **タスク一覧生成**: 文字起こし結果と関連ファイルから、AIがタスク一覧（XLSX形式）を自動生成
- **一括ダウンロード**: 文字起こし結果、箇条書き、議事録、タスク一覧をZIPファイルでダウンロード
- **選択式コンテンツ生成**: 生成対象（箇条書き・議事録・タスク）をチェックボックスで選択し、選択したものだけを生成・ダウンロード
- **利用制限管理**: 組織ごとの残り利用時間・タスク生成回数を管理し、月次で自動リセット（スケジュール実行）
- **定期クリーンアップ**: ダウンロード操作の有無にかかわらず、一定時間経過後にS3の一時ファイルを自動削除（スケジュール実行）
- **メンテナンスモード**: 環境変数で簡単に全機能を一時停止可能
- **バージョン表示と更新履歴**: アプリケーションの現在のバージョンを表示し、更新履歴を確認可能

## 技術スタック

### フロントエンド
- Next.js (React)
- TypeScript
- CSS Modules
- Zustand (クライアント状態管理)
- TanStack Query (サーバー状態管理)
- react-hot-toast (通知)
  - UIステップ管理は`providers/SessionMonitor.tsx`で一元化

### バックエンド
- AWS Amplify
- AWS Cognito (認証)
- AWS AppSync (GraphQL)
- Amazon S3 (ストレージ)
- AWS Lambda (非同期処理)
- AWS API Gateway (REST API)
- AWS Secrets Manager (APIキー管理)

### AI/ML機能
- ElevenLabs API (音声認識・文字起こし)
- Dify API (箇条書き・議事録生成)

## セットアップ

### 前提条件
- Node.js 16.x以上
- npm または yarn
- AWS アカウント
- (バックエンド) ElevenLabs APIキー
- (バックエンド) Dify APIキー

### インストール

```bash
# リポジトリのクローン
git clone https://github.com/yourusername/transcript-minute.git
cd transcript-minute

# 依存関係のインストール
yarn install
# または
npm install
```

### 環境変数の設定

このプロジェクトでは、複数の環境設定ファイルを使用して異なる実行環境を管理します：

1. **`.env.example`**: サンプル設定ファイル（Gitリポジトリに含まれています）
2. **`.env.local`**: ローカル開発用の設定（Gitリポジトリに含まれません）
3. **`.env.development`**: 開発環境用の設定
4. **`.env.demo`**: デモ環境用の設定

初回セットアップ時は、`.env.example`をコピーして`.env.local`を作成してください：

```bash
cp .env.example .env.local
```

そして、`.env.local`ファイルを編集して実際の値を設定します：

```
# AWS Amplify設定
NEXT_PUBLIC_AWS_REGION=your-aws-region
NEXT_PUBLIC_AWS_USER_POOLS_ID=your-user-pool-id
NEXT_PUBLIC_AWS_USER_POOLS_WEB_CLIENT_ID=your-web-client-id

# 環境指定
NEXT_PUBLIC_APP_ENV=development  # または demo や production

# メンテナンスモード設定
NEXT_PUBLIC_MAINTENANCE_MODE=false  # trueに設定すると全機能が停止
NEXT_PUBLIC_MAINTENANCE_MESSAGE=ただいまシステムメンテナンス中です。ご不便をおかけして申し訳ありません。
```

## 開発モード

### ローカル開発サーバーの起動

```bash
yarn dev
# または
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開くとアプリケーションが表示されます。

## 複数環境の管理

このプロジェクトでは、AWS Amplifyを使用して複数の環境（開発環境、デモ環境など）を管理できます。

### 環境の一覧表示

```bash
amplify env list
```

### 環境の切り替え

```bash
# 開発環境に切り替え
amplify env checkout dev

# デモ環境に切り替え
amplify env checkout demo
```

### 新しい環境の作成

```bash
amplify env add

# 環境名を入力（例：staging）
# リージョンを選択
# AWS profileを選択
```

### 環境ごとの設定

各環境に固有の設定を適用するには、環境名に対応する設定ファイルを作成します：

```bash
# 開発環境用の設定ファイル
cp .env.example .env.development

# デモ環境用の設定ファイル
cp .env.example .env.demo
```

これらのファイルを編集して、環境固有の値を設定します。

## メンテナンスモードの使用方法

アプリケーションのメンテナンス時や一時的な停止が必要な場合、環境変数を変更するだけで簡単にメンテナンスモードを有効にできます：

1. **メンテナンスモードの有効化**:
   ```
   NEXT_PUBLIC_MAINTENANCE_MODE=true
   ```

2. **メンテナンスメッセージのカスタマイズ**:
   ```
   NEXT_PUBLIC_MAINTENANCE_MESSAGE=システムアップグレードのため、XX月XX日まで利用できません。
   ```

3. **緊急時の切り替え方法**:
   - AWS Amplifyコンソールから環境変数を直接編集
   - または、`amplify push`コマンドでデプロイ

メンテナンスモードが有効な場合、ユーザーはログイン後にメンテナンスメッセージを表示されますが、アプリケーションの主要機能は使用できなくなります。

## バージョン管理と更新履歴

アプリケーションには現在のバージョン表示と更新履歴確認機能が実装されています：

1. **バージョン表示**:
   - アプリケーションのバージョンは`package.json`の`version`フィールドから取得
   - ヘッダー部分の更新履歴ボタンに表示される

2. **更新履歴の管理**:
   - 更新履歴は`public/changelog.md`ファイルにMarkdown形式で記録
   - 各バージョンの変更内容を詳細に記録可能

3. **更新履歴の閲覧**:
   - ログイン後の画面上部にある「更新履歴」ボタンをクリックすると閲覧可能
   - モーダルウィンドウで表示され、ダークモードにも対応

4. **更新履歴の編集方法**:
   ```markdown
   # 更新履歴

   ## v0.2.0 (2023-12-15)
   - 新機能: 更新履歴表示機能の追加
   - 改善: ダークモード対応の強化
   - 修正: 音声認識精度の向上

   ## v0.1.0 (2023-11-01)
   - 初期リリース
   ```

アプリの更新時には、`package.json`のバージョン番号と`public/changelog.md`の内容を更新することで、ユーザーに変更内容を通知できます。

## AWSへのデプロイ

AWS Amplifyを使用したデプロイ：

```bash
# Amplify CLIのインストール（初回のみ）
npm install -g @aws-amplify/cli

# 環境を選択してデプロイ
amplify push
```

### 特定の環境へのデプロイ

```bash
# 開発環境へのデプロイ
amplify env checkout dev
amplify push

# デモ環境へのデプロイ
amplify env checkout demo
amplify push
```

## システムアーキテクチャ

本システムのアーキテクチャは、フロントエンドからのリクエストをトリガーに、バックエンドのAWS Lambdaで非同期処理を実行する構成になっています。これにより、時間のかかるAI処理中でもユーザーは快適にアプリケーションを操作できます。

1.  **ファイルアップロードと文字起こし (S3トリガー)**
    1.  ユーザーがNext.jsフロントエンドから音声/動画ファイルをアップロードします。
    2.  ファイルはAmazon S3のプライベートバケットに保存されます。
    3.  S3へのファイル作成をトリガーとして、`transcriptionProcessor` Lambda関数が起動します。
    4.  Lambdaは外部の文字起こしAPI (ElevenLabs/Dify) を呼び出し、結果のテキストをS3の出力用バケットに保存します。
    5.  処理の進捗 (例: `PROCESSING`, `COMPLETED`, `FAILED`) は、AWS AppSyncを通じてリアルタイムにフロントエンドへ通知されます。

2.  **コンテンツ生成 (API Gateway + 二段Lambda)**
    1.  ユーザーがフロントエンドのチェックボックスで生成対象（`bullets`, `minutes`, `tasks`）を選択し、「生成」ボタンをクリックします。
    2.  フロントエンドは、選択された種類のみを`processingTypes`配列に含め、Amazon API Gatewayの単一エンドポイント (`/generate/process-all`) にリクエストを送信します。タスク一覧生成を含む場合は、追加のファイル（タスク定義ファイル、関連情報ファイル）もアップロードされます。
    3.  API Gatewayは、リクエストを受け付けるエンドポイント用Lambda (`generationProcessor`) を同期的に呼び出します。
    4.  `generationProcessor`はリクエストを検証し、時間のかかる処理を実行するワーカー用Lambda (`generationWorker`) を**非同期**で呼び出します。その後、即座に `202 Accepted` レスポンスをフロントエンドに返します。
    5.  `generationWorker`はバックグラウンドでDify APIを呼び出します。選択された種類のみ処理し、箇条書き・議事録の場合は文字起こしテキストを、タスク一覧生成の場合は文字起こしテキストとアップロードされた2つのファイルを入力としてAI処理を実行し、結果をS3に保存します。
    6.  文字起こし時と同様に、処理の進捗と結果はAppSync Subscriptionを通じてフロントエンドに通知され、UIが動的に更新されます。

### バックエンドでのAPIキー管理と権限
ElevenLabsやDifyのAPIキーは、フロントエンドコードには一切含めず、AWS Secrets Managerに安全に保管されます。各Lambda関数は、実行時にSecrets Managerから必要なAPIキーを動的に取得して使用します。

生成物や一時ファイルの削除は、フロントエンドから直接S3を操作せず、GraphQLミューテーション（`deleteGeneratedFiles`）経由でLambdaが実行します。出力用S3バケット（カスタムリソース）には、各Lambdaの`custom-policies.json`で最小権限を明示付与しています。

詳細なアーキテクチャと処理フローについては、`docs/` ディレクトリ内のドキュメントも参照してください。

## ライセンス

[MIT](LICENSE)

## 問い合わせ

詳細な情報や質問については、プロジェクト管理者にお問い合わせください。
#   t a s k - d r i v e - a z u r e  
 # task-drive-azure
