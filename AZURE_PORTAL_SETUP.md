# Azure Portal Setup Guide

## Complete Resource Setup for Task Drive Azure

This guide walks you through creating all required Azure resources for Milestones 3 & 4.

---

## Prerequisites

- Azure Subscription with Contributor or Owner access
- Azure CLI installed (optional but recommended)
- Access to Azure Portal (portal.azure.com)

---

## Step 1: Create Resource Group

1. Go to **Azure Portal** → **Resource groups**
2. Click **+ Create**
3. Fill in:
   - **Subscription**: Your subscription
   - **Resource group name**: `task-drive-rg`
   - **Region**: `Japan East` (or your preferred region)
4. Click **Review + Create** → **Create**

---

## Step 2: Create Storage Account

1. Go to **Storage accounts** → **+ Create**
2. Fill in:
   - **Resource group**: `task-drive-rg`
   - **Storage account name**: `taskdrivestorage` (must be globally unique, add numbers if needed)
   - **Region**: Same as resource group
   - **Performance**: Standard
   - **Redundancy**: LRS (Locally Redundant Storage)
3. Click **Review + Create** → **Create**

### Create Containers

After deployment:
1. Go to the storage account → **Containers**
2. Create these containers:
   - `transcripts` (for uploaded audio files)
   - `outputs` (for generated files)
   - `metadata` (for metadata)

### Configure CORS (Important for frontend uploads)

1. Go to **Resource sharing (CORS)** under Settings
2. For **Blob service**, add:
   - **Allowed origins**: `*` (for dev) or your domain (for prod)
   - **Allowed methods**: GET, POST, PUT, DELETE, HEAD, OPTIONS
   - **Allowed headers**: `*`
   - **Exposed headers**: `*`
   - **Max age**: 3600
3. Click **Save**

### Get Connection String

1. Go to **Access keys** under Security + networking
2. Copy **Connection string** from key1
3. Save it as: `AZURE_STORAGE_CONNECTION_STRING`

---

## Step 3: Create Cosmos DB Account

1. Go to **Azure Cosmos DB** → **+ Create**
2. Select **Azure Cosmos DB for NoSQL**
3. Fill in:
   - **Resource group**: `task-drive-rg`
   - **Account name**: `task-drive-cosmosdb`
   - **Location**: Same region
   - **Capacity mode**: Serverless (recommended for dev/testing)
4. Click **Review + Create** → **Create**

### Create Database and Containers

After deployment:
1. Go to Cosmos DB account → **Data Explorer**
2. Click **New Database**
   - **Database id**: `AppDb`
3. Create containers (click **New Container** for each):
   
   **Container 1: Organizations**
   - **Database**: Use existing → `AppDb`
   - **Container id**: `Organizations`
   - **Partition key**: `/id`
   
   **Container 2: Users**
   - **Database**: Use existing → `AppDb`
   - **Container id**: `Users`
   - **Partition key**: `/id`
   
   **Container 3: ProcessingSessions**
   - **Database**: Use existing → `AppDb`
   - **Container id**: `ProcessingSessions`
   - **Partition key**: `/id`

### Get Connection Details

1. Go to **Keys** under Settings
2. Copy:
   - **URI**: Save as `COSMOS_DB_ENDPOINT`
   - **PRIMARY KEY**: Save as `COSMOS_DB_KEY`

---

## Step 4: Create Azure OpenAI Service

1. Go to **Azure OpenAI** → **+ Create**
2. Fill in:
   - **Resource group**: `task-drive-rg`
   - **Region**: `East US` or `West Europe` (check Whisper availability)
   - **Name**: `task-drive-openai`
   - **Pricing tier**: Standard S0
3. Click **Review + Create** → **Create**

### Deploy Whisper Model

After deployment:
1. Go to resource → **Model deployments** (or Azure OpenAI Studio)
2. Click **Create new deployment**
3. Select:
   - **Model**: `whisper`
   - **Model version**: Latest
   - **Deployment name**: `whisper-1`
4. Click **Create**

### Get Credentials

1. Go to **Keys and Endpoint** under Resource Management
2. Copy:
   - **Endpoint**: Save as `AZURE_OPENAI_ENDPOINT`
   - **KEY 1**: Save as `AZURE_OPENAI_KEY`

---

## Step 5: Create Azure Key Vault

1. Go to **Key vaults** → **+ Create**
2. Fill in:
   - **Resource group**: `task-drive-rg`
   - **Key vault name**: `task-drive-keyvault`
   - **Region**: Same region
   - **Pricing tier**: Standard
3. Go to **Access configuration** tab:
   - **Permission model**: Select **Azure role-based access control (RBAC)**
4. Click **Review + Create** → **Create**

### Add Secrets

After deployment:
1. Go to Key Vault → **Secrets** → **+ Generate/Import**
2. Add these secrets:

   **Secret 1: AzureOpenAIKey**
   - **Name**: `AzureOpenAIKey`
   - **Value**: (paste your Azure OpenAI KEY 1)
   
   **Secret 2: AzureOpenAIEndpoint**
   - **Name**: `AzureOpenAIEndpoint`
   - **Value**: (paste your Azure OpenAI endpoint)
   
   **Secret 3: DifyApiKey**
   - **Name**: `DifyApiKey`
   - **Value**: (your Dify API key)
   
   **Secret 4: DifyWorkflowUrl**
   - **Name**: `DifyWorkflowUrl`
   - **Value**: (your Dify workflow URL)
   
   **Secret 5: CosmosDBKey**
   - **Name**: `CosmosDBKey`
   - **Value**: (your Cosmos DB primary key)
   
   **Secret 6: WebPubSubConnectionString**
   - **Name**: `WebPubSubConnectionString`
   - **Value**: (will get this in next step)

---

## Step 6: Create Web PubSub Service

1. Go to **Web PubSub** → **+ Create**
2. Fill in:
   - **Resource group**: `task-drive-rg`
   - **Resource name**: `task-drive-pubsub`
   - **Region**: Same region
   - **Pricing tier**: Free_F1 (for dev) or Standard_S1 (for prod)
   - **Unit count**: 1
3. Click **Review + Create** → **Create**

### Configure Hub

After deployment:
1. Go to Web PubSub resource → **Settings** → **Hubs**
2. Click **+ Add**
   - **Hub name**: `sessionUpdates`
3. Click **Save**

### Get Connection String

1. Go to **Keys** under Settings
2. Copy **Connection string**
3. Go back to **Key Vault** → Add this as the `WebPubSubConnectionString` secret

---

## Step 7: Create Storage Queue

1. Go to your **Storage Account** (created in Step 2)
2. Go to **Queues** under Data storage
3. Click **+ Queue**
   - **Name**: `processing-queue`
4. Click **OK**

---

## Step 8: Create Function App

1. Go to **Function App** → **+ Create**
2. Fill in **Basics** tab:
   - **Resource group**: `task-drive-rg`
   - **Function App name**: `task-drive-functions`
   - **Runtime stack**: Node.js
   - **Version**: 18 LTS
   - **Region**: Same region
   - **Operating System**: Linux (recommended)
   - **Plan type**: Consumption (Serverless)
3. Click **Review + Create** → **Create**

### Configure Application Settings

After deployment:
1. Go to Function App → **Configuration** → **Application settings**
2. Add these settings (click **+ New application setting** for each):

   ```
   AzureWebJobsStorage = (your storage connection string)
   COSMOS_DB_ENDPOINT = (your Cosmos DB URI)
   COSMOS_DB_KEY = (your Cosmos DB key)
   COSMOS_DB_DATABASE_NAME = AppDb
   KEY_VAULT_NAME = task-drive-keyvault
   WHISPER_DEPLOYMENT_NAME = whisper-1
   WEB_PUBSUB_CONNECTION_STRING = (your Web PubSub connection string)
   WEB_PUBSUB_HUB_NAME = sessionUpdates
   AZURE_STORAGE_ACCOUNT_NAME = taskdrivestorage
   AZURE_STORAGE_ACCOUNT_KEY = (your storage account key)
   INPUT_CONTAINER_NAME = transcripts
   OUTPUT_CONTAINER_NAME = outputs
   CLEANUP_AGE_HOURS = 72
   ```

3. Click **Save**

### Enable Managed Identity

1. Go to Function App → **Identity** → **System assigned** tab
2. Set **Status** to **On**
3. Click **Save**
4. Copy the **Object (principal) ID** (you'll need this for Key Vault access)

### Grant Key Vault Access

1. Go to your **Key Vault** → **Access control (IAM)**
2. Click **+ Add** → **Add role assignment**
3. Search for **Key Vault Secrets User** role → Select it → Click **Next**
4. Click **+ Select members**
5. Search for your Function App name (`task-drive-functions`)
6. Select it → Click **Select** → **Review + assign**

---

## Step 9: Create Application Insights

1. Go to **Application Insights** → **+ Create**
2. Fill in:
   - **Resource group**: `task-drive-rg`
   - **Name**: `task-drive-insights`
   - **Region**: Same region
   - **Resource Mode**: Workspace-based (recommended)
3. Click **Review + Create** → **Create**

### Link to Function App

1. Go to your **Function App** → **Application Insights** under Settings
2. Click **Turn on Application Insights**
3. Select **Existing resource** → Choose `task-drive-insights`
4. Click **Apply**

---

## Step 10: Deploy Azure Functions

### Option A: Deploy from VS Code

1. Install **Azure Functions extension** in VS Code
2. Sign in to Azure
3. Right-click on the `api` folder → **Deploy to Function App**
4. Select your Function App (`task-drive-functions`)
5. Wait for deployment to complete

### Option B: Deploy using Azure CLI

```bash
cd api
npm install
npm run build
func azure functionapp publish task-drive-functions
```

---

## Step 11: Test Your Setup

### 1. Test Storage Upload

```bash
az storage blob upload \
  --account-name taskdrivestorage \
  --container-name transcripts \
  --name test.txt \
  --file test.txt
```

### 2. Test Function App

Go to Function App → **Functions** → Select a function → Click **Code + Test** → Click **Test/Run**

### 3. Check Logs

Go to Application Insights → **Transaction search** to view logs

---

## Environment Variables Summary

Here's a complete list of environment variables to configure:

### For Function App (Azure Portal)
```
# Storage
AzureWebJobsStorage=<storage-connection-string>
AZURE_STORAGE_ACCOUNT_NAME=taskdrivestorage
AZURE_STORAGE_ACCOUNT_KEY=<storage-key>
INPUT_CONTAINER_NAME=transcripts
OUTPUT_CONTAINER_NAME=outputs

# Cosmos DB
COSMOS_DB_ENDPOINT=<cosmosdb-endpoint>
COSMOS_DB_KEY=<cosmosdb-key>
COSMOS_DB_DATABASE_NAME=AppDb

# Key Vault
KEY_VAULT_NAME=task-drive-keyvault

# Azure OpenAI
WHISPER_DEPLOYMENT_NAME=whisper-1

# Web PubSub
WEB_PUBSUB_CONNECTION_STRING=<pubsub-connection-string>
WEB_PUBSUB_HUB_NAME=sessionUpdates

# Config
CLEANUP_AGE_HOURS=72
```

### For Frontend (.env.local)
```
NEXT_PUBLIC_AZURE_FUNCTION_URL=https://task-drive-functions.azurewebsites.net
NEXT_PUBLIC_AZURE_STORAGE_ACCOUNT=taskdrivestorage
NEXT_PUBLIC_AZURE_STORAGE_KEY=<storage-key>
NEXT_PUBLIC_WEB_PUBSUB_HUB=sessionUpdates
```

---

## Verification Checklist

- [ ] Resource Group created
- [ ] Storage Account with 3 containers (transcripts, outputs, metadata)
- [ ] Storage CORS configured
- [ ] Cosmos DB with database and 3 containers
- [ ] Azure OpenAI with Whisper deployment
- [ ] Key Vault with 6 secrets
- [ ] Web PubSub with hub configured
- [ ] Storage Queue created
- [ ] Function App created and configured
- [ ] Managed Identity enabled on Function App
- [ ] Key Vault access granted to Function App
- [ ] Application Insights linked to Function App
- [ ] Azure Functions deployed
- [ ] All environment variables set

---

## Estimated Costs (Monthly)

- **Storage Account**: ~$5-20 (depending on usage)
- **Cosmos DB (Serverless)**: ~$10-50 (pay per request)
- **Azure OpenAI**: ~$0.006 per minute of audio
- **Key Vault**: ~$0.03 per 10,000 operations
- **Web PubSub (Free tier)**: $0
- **Function App (Consumption)**: ~$5-20 (first 1M executions free)
- **Application Insights**: ~$2-10 (first 5GB free)

**Total estimated**: ~$25-100/month (varies with usage)

---

## Next Steps

1. Deploy your Azure Functions (see Step 10)
2. Configure frontend environment variables
3. Test the E2E flow: Upload → Process → Download
4. Set up monitoring alerts in Application Insights
5. Review security and implement least privilege access

---

## Troubleshooting

### Functions Not Triggering
- Check Application Insights logs
- Verify queue messages are being created
- Ensure Managed Identity has Key Vault access

### Storage Access Denied
- Verify CORS settings
- Check storage account key is correct
- Ensure containers exist

### Cosmos DB Connection Errors
- Verify endpoint and key
- Check firewall settings (allow Azure services)
- Ensure containers are created

### Key Vault Access Denied
- Verify Managed Identity is enabled
- Check RBAC role assignment
- Wait a few minutes for permissions to propagate

---

## Support Resources

- [Azure Functions Documentation](https://docs.microsoft.com/azure/azure-functions/)
- [Cosmos DB Documentation](https://docs.microsoft.com/azure/cosmos-db/)
- [Azure OpenAI Documentation](https://learn.microsoft.com/azure/ai-services/openai/)
- [Key Vault Documentation](https://docs.microsoft.com/azure/key-vault/)
- [Web PubSub Documentation](https://docs.microsoft.com/azure/azure-web-pubsub/)
