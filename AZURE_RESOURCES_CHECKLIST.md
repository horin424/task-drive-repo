# Azure Resources - Quick Setup Checklist

## What to Add in Azure Portal

Use this as a quick reference while following `AZURE_PORTAL_SETUP.md`.

---

## 1️⃣ Resource Group

**Name**: `task-drive-rg`  
**Region**: Japan East (or your preferred)

---

## 2️⃣ Storage Account

**Name**: `taskdrivestorage` (must be unique)  
**Type**: Standard LRS  

### Containers to Create:
- [ ] `transcripts` (for uploaded audio)
- [ ] `outputs` (for generated files)
- [ ] `metadata` (for metadata)

### Queue to Create:
- [ ] `processing-queue`

### Configuration:
- [ ] CORS enabled (all origins, all methods for dev)
- [ ] Copy Connection String and Access Key

---

## 3️⃣ Cosmos DB

**Name**: `task-drive-cosmosdb`  
**API**: NoSQL  
**Mode**: Serverless

### Database:
- [ ] Database Name: `AppDb`

### Containers:
- [ ] `Organizations` (partition key: `/id`)
- [ ] `Users` (partition key: `/id`)
- [ ] `ProcessingSessions` (partition key: `/id`)

### Configuration:
- [ ] Copy URI (endpoint)
- [ ] Copy Primary Key

---

## 4️⃣ Azure OpenAI

**Name**: `task-drive-openai`  
**Region**: East US or West Europe

### Model Deployment:
- [ ] Deploy `whisper` model
- [ ] Deployment name: `whisper-1`

### Configuration:
- [ ] Copy Endpoint
- [ ] Copy Key 1

---

## 5️⃣ Key Vault

**Name**: `task-drive-keyvault`  
**Permission Model**: Azure RBAC

### Secrets to Add:
- [ ] `AzureOpenAIKey` = (your OpenAI key)
- [ ] `AzureOpenAIEndpoint` = (your OpenAI endpoint)
- [ ] `DifyApiKey` = (your Dify API key)
- [ ] `DifyWorkflowUrl` = (your Dify workflow URL)
- [ ] `CosmosDBKey` = (your Cosmos DB key)
- [ ] `WebPubSubConnectionString` = (from Web PubSub, add later)

### Configuration:
- [ ] Note the Key Vault name

---

## 6️⃣ Web PubSub

**Name**: `task-drive-pubsub`  
**Tier**: Free_F1 (or Standard_S1 for prod)

### Hub:
- [ ] Hub name: `sessionUpdates`

### Configuration:
- [ ] Copy Connection String
- [ ] Add to Key Vault as `WebPubSubConnectionString`

---

## 7️⃣ Function App

**Name**: `task-drive-functions`  
**Runtime**: Node.js 18  
**Plan**: Consumption (Serverless)  
**OS**: Linux

### Enable:
- [ ] System Assigned Managed Identity

### Application Settings:

```ini
# Storage
AzureWebJobsStorage = <storage-connection-string>
AZURE_STORAGE_ACCOUNT_NAME = taskdrivestorage
AZURE_STORAGE_ACCOUNT_KEY = <storage-key>
INPUT_CONTAINER_NAME = transcripts
OUTPUT_CONTAINER_NAME = outputs

# Cosmos DB
COSMOS_DB_ENDPOINT = <cosmosdb-endpoint>
COSMOS_DB_KEY = <cosmosdb-key>
COSMOS_DB_DATABASE_NAME = AppDb

# Key Vault
KEY_VAULT_NAME = task-drive-keyvault

# Azure OpenAI
WHISPER_DEPLOYMENT_NAME = whisper-1

# Web PubSub
WEB_PUBSUB_CONNECTION_STRING = <pubsub-connection-string>
WEB_PUBSUB_HUB_NAME = sessionUpdates

# Config
CLEANUP_AGE_HOURS = 72
```

### RBAC:
- [ ] Grant Function App "Key Vault Secrets User" role on Key Vault

---

## 8️⃣ Application Insights

**Name**: `task-drive-insights`  
**Mode**: Workspace-based

### Configuration:
- [ ] Link to Function App

---

## 9️⃣ RBAC Assignments

### Key Vault Access:
1. Go to Key Vault → Access control (IAM)
2. Add role assignment:
   - Role: **Key Vault Secrets User**
   - Assign to: **Function App Managed Identity**
   - Resource: `task-drive-functions`

---

## 🔟 Deploy Functions

```bash
cd api
npm install
npm run build
func azure functionapp publish task-drive-functions
```

### Verify Deployment:
```bash
az functionapp function list \
  --name task-drive-functions \
  --resource-group task-drive-rg \
  --output table
```

Expected functions (14 total):
- [ ] BlobTriggerProcessUpload
- [ ] QueueTriggerProcessJob
- [ ] TimerTriggerMonthlyReset
- [ ] TimerTriggerCleanupExpiredFiles
- [ ] GetUploadSasUrl
- [ ] get-session
- [ ] update-session
- [ ] delete-session-files
- [ ] get-audio-url
- [ ] create-session
- [ ] create-user
- [ ] get-organization
- [ ] get-user
- [ ] HttpTriggerGetWebPubSubConnection

---

## Environment Variables Summary

### Required from Azure Portal:

| Variable | Get From | Where |
|----------|----------|-------|
| Storage Connection String | Storage Account → Access keys → Connection string |
| Storage Account Key | Storage Account → Access keys → Key1 |
| Cosmos DB Endpoint | Cosmos DB → Keys → URI |
| Cosmos DB Key | Cosmos DB → Keys → Primary Key |
| Azure OpenAI Endpoint | Azure OpenAI → Keys and Endpoint → Endpoint |
| Azure OpenAI Key | Azure OpenAI → Keys and Endpoint → Key 1 |
| Web PubSub Connection | Web PubSub → Keys → Connection string |
| Function App URL | Function App → Overview → URL |

---

## Testing Checklist

After setup:

- [ ] Upload test file to Storage
- [ ] Verify session created in Cosmos DB
- [ ] Check queue message exists
- [ ] Monitor Application Insights logs
- [ ] Verify function execution
- [ ] Check Web PubSub messages
- [ ] Verify transcription completes
- [ ] Download results from outputs container

---

## Cost Estimate (Monthly)

| Resource | Estimated Cost |
|----------|----------------|
| Storage Account | $5-20 |
| Cosmos DB (Serverless) | $10-50 |
| Azure OpenAI | $0.006/minute |
| Key Vault | ~$0.03 per 10k ops |
| Web PubSub (Free) | $0 |
| Function App | $5-20 |
| Application Insights | $2-10 |
| **Total** | **~$25-100** |

---

## Quick Commands

### Check all resources:
```bash
az resource list \
  --resource-group task-drive-rg \
  --output table
```

### Check Function App:
```bash
az functionapp show \
  --name task-drive-functions \
  --resource-group task-drive-rg \
  --query state
```

### View logs:
```bash
az webapp log tail \
  --name task-drive-functions \
  --resource-group task-drive-rg
```

### Test storage:
```bash
az storage container list \
  --account-name taskdrivestorage \
  --auth-mode login
```

---

## Troubleshooting Quick Fixes

### Functions not triggering?
```bash
# Restart Function App
az functionapp restart \
  --name task-drive-functions \
  --resource-group task-drive-rg
```

### Key Vault access denied?
```bash
# Verify Managed Identity
az functionapp identity show \
  --name task-drive-functions \
  --resource-group task-drive-rg

# Check role assignment
az role assignment list \
  --assignee <principal-id> \
  --scope /subscriptions/<sub-id>/resourceGroups/task-drive-rg
```

### Storage CORS issues?
- Go to Storage Account → Resource sharing (CORS)
- Add `*` for Allowed origins (dev only)
- Add all HTTP methods

---

## Next Steps After Setup

1. ✅ All Azure resources created
2. ✅ Functions deployed
3. ✅ Environment variables configured
4. ✅ RBAC assignments complete
5. → Run E2E tests (see `DEPLOYMENT_AND_OPERATIONS.md`)
6. → Configure monitoring alerts
7. → Set up CI/CD pipeline
8. → Production deployment

---

## Support Resources

- **Full Guide**: `AZURE_PORTAL_SETUP.md`
- **Operations**: `DEPLOYMENT_AND_OPERATIONS.md`
- **Completion**: `MILESTONE_3_4_COMPLETION.md`
- **Azure Docs**: https://docs.microsoft.com/azure

---

**Estimated Setup Time**: 1-2 hours  
**Difficulty**: Intermediate  
**Prerequisites**: Azure subscription, basic Azure knowledge

---

✅ **Print this checklist and check off items as you complete them!**
