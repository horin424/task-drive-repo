# Azure Migration Setup Guide

## Prerequisites
1. Azure account (free tier available)
2. Node.js 18+ installed
3. Azure CLI installed
4. Git installed

## Step 1: Install Azure CLI

### Windows (PowerShell as Administrator)
```powershell
# Download and install Azure CLI
Invoke-WebRequest -Uri https://aka.ms/installazurecliwindows -OutFile .\AzureCLI.msi
Start-Process msiexec.exe -Wait -ArgumentList '/I AzureCLI.msi /quiet'
```

### macOS
```bash
brew install azure-cli
```

### Linux
```bash
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

## Step 2: Login to Azure
```bash
az login
```

## Step 3: Create Resource Group
```bash
# Set variables
RESOURCE_GROUP="transcript-minute-rg"
LOCATION="eastus"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION
```

## Step 4: Create Azure AD B2C Tenant
```bash
# Create B2C tenant (this will open browser)
az ad b2c tenant create \
  --tenant-name "transcriptminute" \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION
```

## Step 5: Create Storage Account
```bash
STORAGE_ACCOUNT="transcriptminutestorage$(date +%s)"

az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2
```

## Step 6: Create Function App
```bash
FUNCTION_APP="transcript-minute-functions"

az functionapp create \
  --resource-group $RESOURCE_GROUP \
  --consumption-plan-location $LOCATION \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --name $FUNCTION_APP \
  --storage-account $STORAGE_ACCOUNT
```

## Step 7: Create API Management
```bash
APIM_NAME="transcript-minute-api"

az apim create \
  --resource-group $RESOURCE_GROUP \
  --name $APIM_NAME \
  --location $LOCATION \
  --publisher-email "admin@transcriptminute.com" \
  --publisher-name "Transcript Minute" \
  --sku-name Consumption
```

## Step 8: Create Static Web App
```bash
SWA_NAME="transcript-minute-web"

az staticwebapp create \
  --name $SWA_NAME \
  --resource-group $RESOURCE_GROUP \
  --source https://github.com/yourusername/yourrepo \
  --location $LOCATION \
  --branch main \
  --app-location "/" \
  --output-location "out"
```

## Step 9: Get Configuration Values
```bash
# Get storage account key
STORAGE_KEY=$(az storage account keys list --resource-group $RESOURCE_GROUP --account-name $STORAGE_ACCOUNT --query '[0].value' -o tsv)

# Get B2C tenant ID
B2C_TENANT_ID=$(az ad b2c tenant list --query '[0].tenantId' -o tsv)

# Get Function App URL
FUNCTION_URL=$(az functionapp show --name $FUNCTION_APP --resource-group $RESOURCE_GROUP --query defaultHostName -o tsv)

echo "Storage Account: $STORAGE_ACCOUNT"
echo "Storage Key: $STORAGE_KEY"
echo "B2C Tenant ID: $B2C_TENANT_ID"
echo "Function App URL: https://$FUNCTION_URL"
```

## Next Steps
1. Save these values to a `.env.local` file
2. Configure Azure AD B2C applications
3. Set up the database (Cosmos DB or SQL Database)
4. Begin code migration
