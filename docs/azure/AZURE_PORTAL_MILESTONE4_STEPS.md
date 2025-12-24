# Azure Portal Tasks (Milestone 4) — Steps & Checklist

This file lists the **Azure Portal** work required to complete **Milestone 4**:
- Key Vault + Managed Identity / RBAC
- Monitoring (Application Insights / Log Analytics) + alerts
- E2E / load / security testing
- Production deployment (DNS / SSL / custom domain)

> Notes
> - Use **separate environments** (dev/staging/prod) if possible.
> - Do **not** store secrets in code or in Git. Use Key Vault.

---

## 1) Azure Resources (Create/Confirm)

### 1.1 Resource Group
1. Azure Portal → **Resource groups** → **Create**
2. Name: `<project>-rg-<env>` (example: `taskdrive-rg-prod`)
3. Region: same as your main services (recommended: `Japan East` / your chosen region)

### 1.2 Storage Account (Blob + Queue)
1. Portal → **Storage accounts** → **Create**
2. Recommended:
   - Performance: **Standard**
   - Redundancy: **LRS** (dev) / **ZRS** (prod optional)
   - Secure transfer required: **On**
3. After creation:
   - Storage account → **Data storage** → **Containers**
     - Create container: `transcripts`
     - Create container: `outputs`
   - Storage account → **Data storage** → **Queues**
     - Confirm your queue used by Functions exists (if your function app creates it automatically, just verify)
4. CORS (only if your frontend directly touches blobs; otherwise keep strict):
   - Storage account → **Settings** → **Resource sharing (CORS)** → Blob service
   - Allow your frontend origin(s) only (prod domain), methods: `GET, PUT, POST, HEAD`

### 1.3 Cosmos DB (NoSQL)
1. Portal → **Azure Cosmos DB** → **Create** → **Azure Cosmos DB for NoSQL**
2. Create database: `cosmodbazure` (or your chosen name)
3. Create containers (partition key should match your current design; typically `/id`):
   - `Organizations`
   - `Users`
   - `ProcessingSessions`
4. Confirm throughput mode (dev: shared, prod: autoscale if needed)

### 1.4 Azure Web PubSub
1. Portal → **Web PubSub** → **Create**
2. After creation:
   - Create hub name (matches code default): `updates` or set env `WEBPUBSUB_HUB_NAME`
3. Access keys:
   - You will store the connection string in Key Vault (recommended)

### 1.5 Azure OpenAI (Whisper + GPT deployment)
1. Portal → **Azure AI Foundry / Azure OpenAI** → your resource
2. Deploy:
   - Whisper deployment (e.g., `whisper-deployment`)
   - GPT deployment (e.g., `gpt-4o-mini`)
3. Collect:
   - Endpoint URL
   - API Key
4. Store these in Key Vault (recommended)

### 1.6 Dify (choose one)
**Option A: Dify Cloud**
- Use `https://api.dify.ai/v1` as `DIFY_WORKFLOW_URL`

**Option B: Self-host Dify on Azure**
- Simplest production path: **Linux VM + Docker Compose + Nginx + TLS**
- Ensure your public API base becomes: `https://dify.<your-domain>/v1`

---

## 2) Key Vault + Managed Identity (RBAC)

### 2.1 Create Key Vault
1. Portal → **Key vaults** → **Create**
2. Name: `<project>-kv-<env>`
3. Networking: dev can be public; prod recommended private endpoints later

### 2.2 Create Secrets (names used by backend)
Create these Key Vault secrets (exact names):
- `AzureOpenAIEndpoint`
- `AzureOpenAIKey`
- `DifyWorkflowUrl`
- `DifyApiKey`
- `CosmosDBKey`
- `WebPubSubConnectionString`
- `StorageAccountKey` (optional but recommended)

### 2.3 Enable Managed Identity on Function App
1. Portal → **Function App** → **Identity**
2. Turn **System assigned** = **On**
3. Copy the Object (principal) ID (for auditing)

### 2.4 Grant Key Vault permissions (RBAC)
1. Portal → **Key Vault** → **Access control (IAM)** → **Add role assignment**
2. Role: **Key Vault Secrets User**
3. Assign to: your **Function App** managed identity

> Result: your Functions can read secrets either via direct Key Vault fetch (when `KEY_VAULT_NAME` is set) or via Key Vault references in app settings.

---

## 3) Function App (Production Configuration)

### 3.1 Create Function App
1. Portal → **Function App** → **Create**
2. Runtime: **Node.js 18 LTS**
3. Hosting: Consumption or Premium (Premium recommended for stable latency)
4. Set Application Insights to **On**

### 3.2 Set App Settings (Configuration)
Portal → Function App → **Settings** → **Environment variables**

Required (examples; use your real values):
- Auth:
  - `AUTH_TENANT_ID`
  - `AUTH_AUDIENCE`
  - `AUTH_REQUIRED_SCOPES` (example: `access_as_user`)
- Storage:
  - `AZURE_STORAGE_ACCOUNT_NAME`
  - `AZURE_STORAGE_ACCOUNT_KEY` (prefer Key Vault)
  - `AZURE_STORAGE_INPUT_CONTAINER=transcripts`
  - `AZURE_STORAGE_OUTPUT_CONTAINER=outputs`
- Cosmos:
  - `COSMOS_DB_ENDPOINT`
  - `COSMOS_DB_KEY` (prefer Key Vault)
  - `COSMOS_DB_DATABASE_NAME`
- Web PubSub:
  - `WEB_PUBSUB_CONNECTION_STRING` (prefer Key Vault)
  - `WEBPUBSUB_HUB_NAME` (if not default)
- Azure OpenAI:
  - `AZURE_OPENAI_ENDPOINT` (prefer Key Vault)
  - `AZURE_OPENAI_API_KEY` (prefer Key Vault)
  - `AZURE_OPENAI_DEPLOYMENT` (e.g., `gpt-4o-mini`)
  - `WHISPER_DEPLOYMENT_NAME` (e.g., `whisper-deployment`)
- Dify:
  - `ENABLE_DIFY_GENERATION=true`
  - `DIFY_WORKFLOW_URL` (prefer Key Vault)
  - `DIFY_API_KEY` (prefer Key Vault)
  - Optional mapping if your workflow uses different input variable names:
    - `DIFY_INPUT_TRANSCRIPT_KEY` (default `transcript`)
    - `DIFY_INPUT_PROCESSING_TYPE_KEY` (default `processingType`)

### 3.3 CORS
Portal → Function App → **API** → **CORS**
- Allow only your frontend production origin(s)
- Remove `*` in production

---

## 4) Monitoring (Application Insights / Log Analytics) + Alerts

### 4.1 Application Insights
1. Ensure Function App has **Application Insights** enabled
2. Portal → **Application Insights** → verify incoming telemetry

### 4.2 Log Analytics (optional but recommended)
1. Create a **Log Analytics Workspace**
2. Connect App Insights to it (workspace-based App Insights recommended)

### 4.3 Alerts (recommended minimum)
Create alerts in Azure Monitor:
- Function App:
  - **Function failures** (count > 0 in 5 minutes)
  - **Server errors (5xx)** spike
  - **High latency** (optional)
- Storage Queue:
  - **Queue length** high / old messages (backlog)
- Cosmos DB:
  - RU throttling / high latency
- Web PubSub:
  - Connection/throughput anomalies (optional)

---

## 5) DNS / SSL / Custom Domain (Production)

Choose one:

### Option A (recommended): Azure Front Door (single entry point)
1. Create **Front Door Standard/Premium**
2. Add origins:
   - Frontend (Static Web App or hosting origin)
   - Function App origin
3. Add custom domain `app.<your-domain>`
4. Enable HTTPS with managed certificate
5. (Premium) Enable WAF policy and attach it

### Option B: Custom domains separately
- Frontend: Static Web App custom domain + cert
- Function App: custom domain + cert

---

## 6) Testing Checklist (Milestone 4 artifact)

### 6.1 E2E (Happy Path)
1. Login
2. Upload audio/video
3. Confirm transcription completes
4. Speaker edit saves speaker map
5. Generate minutes/bullets/tasks (Dify enabled)
6. Download outputs
7. Confirm cleanup removes files after retention window

### 6.2 Load Test (basic)
- Use a small script tool (k6/JMeter) to simulate:
  - Upload (SAS) + queue processing + generation
- Track:
  - queue backlog, function duration, error rate, cost

### 6.3 Security Test (basic)
- Confirm:
  - CORS is restricted to your domain(s)
  - No secrets in app settings (use Key Vault)
  - Storage uses SAS (short TTL) and does not expose public containers
  - Functions require bearer token (401 without token)

---

## 7) “Done” Criteria for Milestone 4

Milestone 4 is considered complete when:
- Key Vault + Managed Identity works (no plaintext secrets)
- App Insights has telemetry + alerts configured
- Custom domain + HTTPS is enabled
- E2E tests documented + executed (test report)
- Runbook exists (operations + troubleshooting)

