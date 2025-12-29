# TaskDrive Azure（議事録自動化システム）

音声/動画をアップロードし、**文字起こし → 話者編集 → コンテンツ生成（議事録/箇条書き/タスク）→ ダウンロード**までを一気通貫で行うアプリです。  
AWS版からAzureへ移行した構成を含みます（フロント: Next.js / バック: Azure Functions）。

## 1. 全体構成（Project Composition）

- **Frontend**: Next.js 15 / React 19 / TypeScript
- **Backend**: Azure Functions（HTTP / Queue / Timer）
- **Storage**: Azure Blob Storage（入力: `transcripts` / 出力: `outputs`）
- **DB**: Azure Cosmos DB（Organizations / Users / ProcessingSessions）
- **Progress**: Web PubSub（＋フォールバックでポーリング）
- **AI**: Azure OpenAI Whisper（文字起こし）＋ GPT（要約/生成）＋（任意）Dify Workflow
- **制限**: 月次の残り分数・タスク生成回数（Timerでリセット）

## 2. ディレクトリ構成

```text
.
├─ src/                # Next.js フロントエンド
│  ├─ app/             # 画面（ルーティング）
│  ├─ components/      # UI コンポーネント（アップロード/話者編集/生成など）
│  ├─ hooks/           # Hooks（アップロード/結果取得/話者編集など）
│  ├─ lib/             # Azure API/Storage クライアント
│  ├─ stores/          # Zustand ストア
│  └─ types/           # 型定義
├─ api/                # Azure Functions（バックエンド）
│  ├─ */index.ts       # Functions 本体（HTTP/Queue/Timer）
│  ├─ shared/          # Cosmos/Storage/Auth/KeyVault など共通処理
│  ├─ host.json        # Functions 設定
│  └─ local.settings*.json
└─ docs/azure/         # Azure 構築・運用ドキュメント
```

## 3. 使い方（ローカル開発）

### 3.1 前提（Prerequisites）

- Node.js（推奨: 20）
- Azure Functions Core Tools（`func`）
- Docker Desktop（Dify を使う場合）
- ローカルで Storage を使う場合: Azurite もしくは実際の Azure Storage

### 3.2 環境変数の準備（日本語での説明付き）

**フロントエンド（Next.js）**
- `.env.local.example` を `.env.local` にコピーして値を設定します。

**バックエンド（Azure Functions）**
- `api/local.settings.example.json` を `api/local.settings.json` にコピーして値を設定します。

```powershell
# Windows PowerShell では cp ではなく Copy-Item を使います
Copy-Item .env.local.example .env.local
Copy-Item api\local.settings.example.json api\local.settings.json
```

話者自動割り当て（Whisperは話者分離を返さないため、GPTで最大3話者に自動分類）を使う場合は、
`api/local.settings.json` に以下を設定します。

```json
{
  "Values": {
    "ENABLE_SPEAKER_ASSIGNMENT": "true",
    "SPEAKER_ASSIGNMENT_MODEL_DEPLOYMENT": "gpt-4o-mini",
    "SPEAKER_ASSIGNMENT_MAX_SPEAKERS": "3"
  }
}
```

### 3.3 バックエンド（Azure Functions）起動

```powershell
# api/ 配下へ移動（バックエンド）
Set-Location .\api

# 依存関係のインストールとビルド
npm install
npm run build

# Functions 起動（既定: http://localhost:7071）
func start
```

### 3.4 フロントエンド（Next.js）起動

```powershell
# リポジトリ直下（フロントエンド）
Set-Location ..

# 依存関係をインストール
npm install

# 開発サーバ起動（http://localhost:3000）
npm run dev
```

### 3.5 画面上の操作フロー（How to Use）

1. メディアファイル（音声/動画）をアップロード
2. 文字起こし処理が完了するまで待機（進捗が更新）
3. **話者編集（Speaker Edit）**で話者名を入力・確認（必要なら再生ボタンで確認）
4. **Content Generation** で生成対象（議事録/箇条書き/タスク）を選択して生成
5. 生成結果をダウンロード（ZIP）

## 4. Dify 連携（Workflow/Chatflow）

このプロジェクトは、生成処理を以下のどちらでも実行できます。

- **Dify Workflow**（推奨）: `ENABLE_DIFY_GENERATION=true`
- **Azure OpenAI 直接生成（フォールバック）**: `ENABLE_DIFY_GENERATION=false`

ローカルのDify（Docker）起動、Workflow作成、APIキー設定などは以下を参照してください。  
`docs/azure/DIFY_INTEGRATION_GUIDE.md`

## 5. よくあるエラー（Troubleshooting）

### 5.1 `Port 7071 is unavailable`

```powershell
# 7071 を使っているプロセスを確認
netstat -ano | findstr :7071

# PID を終了（例: 12345）
taskkill /PID 12345 /F
```

### 5.2 `cp is not recognized...`

Windows PowerShell では `cp` ではなく `Copy-Item` を使ってください。

## 6. 関連ドキュメント（Docs）

- `docs/azure/QUICK_START.md`
- `docs/azure/AZURE_IMPLEMENTATION_GUIDE.md`
- `docs/azure/IMPLEMENTATION_CHECKLIST.md`
- `docs/azure/DIFY_INTEGRATION_GUIDE.md`
