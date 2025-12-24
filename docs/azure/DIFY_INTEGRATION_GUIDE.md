# Dify Integration Guide (Local Docker + Azure)

This project can generate **minutes / bullet points / tasks** using either:
- **Dify Workflow** (recommended for Milestone 3), or
- **Direct Azure OpenAI prompts** (fallback).

The switch is controlled by an Azure Functions app setting:
- `ENABLE_DIFY_GENERATION=true` → use Dify
- `ENABLE_DIFY_GENERATION=false` (default) → use Azure OpenAI direct

## 1) Local: Run Dify with Docker

### Prerequisites
- Docker Desktop (WSL2 backend recommended)
- Ports free: `3000` (Dify web), `5001` (Dify API) for the default compose

### Start Dify
1. Clone Dify (separate folder from this repo).
2. Go to Dify’s docker folder and create the env:
   - PowerShell: `Copy-Item .env.example .env`
3. Start:
   - `docker compose up -d`
4. Open Dify Admin:
   - `http://localhost:3000`
5. Create the admin account.

### Create a Workflow App
1. In Dify: **Studio** → **Create App** → **Workflow**.
2. Add **Start** node inputs:
   - `transcript` (type: text)
   - `processingType` (type: text)
3. Add IF/ELSE routing by `processingType` (values used by this app):
   - `minutes`
   - `bullets`
   - `tasks`
4. Ensure the workflow **outputs one text field** (recommended key: `text`).

### Get API key + set URLs
1. In the Dify app: **Publish / API Access** → create an **API key** (`app-...`).
2. Dify base API URL:
   - Self-host local (typical): `http://localhost:5001/v1`

## 2) Configure this repo (local)

Update `api/local.settings.json`:
- `DIFY_API_KEY` = `app-...`
- `DIFY_WORKFLOW_URL` = `http://localhost:5001/v1`
- `ENABLE_DIFY_GENERATION` = `true`

If your workflow uses different input variable names, set:
- `DIFY_INPUT_TRANSCRIPT_KEY` (default `transcript`)
- `DIFY_INPUT_PROCESSING_TYPE_KEY` (default `processingType`)
- `DIFY_INPUT_TASK_FILE_KEY` (default `taskFileKey`)
- `DIFY_INPUT_INFORMATION_FILE_KEY` (default `informationFileKey`)

## 3) Test end-to-end locally

1. Start Azure Functions:
   - `cd api`
   - `npm run build`
   - `func start`
2. Start the frontend (separate terminal):
   - `npm run dev`
3. In the UI:
   - Upload media → wait for transcription → Speaker Edit → complete edit
   - Select content (minutes/bullets/tasks) → Generate
4. Confirm the session status transitions:
   - `SPEAKER_EDIT_COMPLETED` → `PROCESSING_*` → `ALL_COMPLETED`

## 4) Azure: Using Dify (Cloud or Self-host)

### Option A (fastest): Dify Cloud
- `DIFY_WORKFLOW_URL=https://api.dify.ai/v1`
- Use the API key created in Dify Cloud for your app.

### Option B: Self-host Dify on Azure (Docker)
Recommended simple path: **Azure VM (Ubuntu)** + Docker Compose + Nginx reverse proxy.

High-level steps:
1. Provision Ubuntu VM.
2. Install Docker + Docker Compose.
3. Clone Dify on the VM, configure `.env`, start with `docker compose up -d`.
4. Put Nginx in front (TLS + custom domain) so Dify is reachable as:
   - `https://dify.<your-domain>`
   - and Dify API at: `https://dify.<your-domain>/v1`
5. Set this repo’s `DIFY_WORKFLOW_URL=https://dify.<your-domain>/v1`

## 5) Azure Portal / Key Vault configuration (for this repo)

### Required app settings on the Function App
- `KEY_VAULT_NAME` (if using Key Vault secrets directly in code)
- `ENABLE_DIFY_GENERATION=true`

### Secrets (recommended in Key Vault)
Create these secret names (matches `api/shared/keyVaultClient.ts`):
- `DifyApiKey`
- `DifyWorkflowUrl`
- `AzureOpenAIKey`
- `AzureOpenAIEndpoint`
- `WebPubSubConnectionString`
- `CosmosDBKey`

### Managed Identity + Key Vault permissions
1. Function App → **Identity** → enable **System assigned**.
2. Key Vault → **Access control (IAM)**:
   - Grant the Function App identity **Key Vault Secrets User** role (or equivalent).

### Monitoring (Milestone 4)
1. Enable **Application Insights** on the Function App.
2. Create alerts:
   - Function failures / exceptions
   - Queue backlog (if using Storage Queue metrics)
   - Web PubSub disconnect spikes (optional)

