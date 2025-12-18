# Azure Infrastructure Setup Guide

This guide will help you set up the complete Azure infrastructure for the Transcript Minute application.

## Prerequisites

- Azure subscription with appropriate permissions
- PowerShell (Windows) or Bash (Linux/Mac)
- Node.js 18+ installed
- Git installed

## Quick Start

### 1. Install Azure CLI

```powershell
# Run as Administrator
.\scripts\install-azure-cli.ps1
```

### 2. Login to Azure

```bash
az login
az account set --subscription <your-subscription-id>
```

### 3. Deploy Complete Infrastructure

```powershell
# This will create all required Azure resources
.\scripts\setup-azure-infrastructure.ps1
```

### 4. Configure Azure AD B2C

```powershell
# This will set up authentication
.\scripts\setup-azure-b2c.ps1
```

### 5. Deploy Azure Functions

```powershell
# This will deploy the backend functions
.\scripts\deploy-azure-functions.ps1
```

## Manual Setup (Alternative)

If you prefer to set up resources manually through the Azure Portal:

### 1. Create Resource Group
- Name: `transcript-minute-rg`
- Location: `Japan East`

### 2. Create Storage Account
- Name: `transcriptminutestorage[timestamp]`
- Performance: Standard
- Replication: LRS
- Create containers: `transcripts`, `outputs`

### 3. Create Cosmos DB
- Name: `transcript-minute-db`
- API: Core (SQL)
- Create database: `transcriptminute`
- Create containers: `processingsessions`, `organizations`, `users`

### 4. Create Key Vault
- Name: `transcript-minute-kv`
- Enable RBAC authorization

### 5. Create Function App
- Name: `transcript-minute-functions`
- Runtime: Node.js 18
- Consumption plan

### 6. Create Azure AD B2C
- Tenant name: `transcriptminute`
- Create user flow: `B2C_1_signupsignin`
- Register application
- Create user groups: Admin, Users

### 7. Create SignalR Service
- Name: `transcript-minute-signalr`
- Tier: Standard

### 8. Create Application Insights
- Name: `transcript-minute-insights`

## Configuration

After setup, update your `.env.local` file with the generated values:

```bash
# Copy from the generated .env.local file
NEXT_PUBLIC_AZURE_STORAGE_ACCOUNT=your_storage_account
NEXT_PUBLIC_AZURE_STORAGE_KEY=your_storage_key
NEXT_PUBLIC_AZURE_FUNCTION_URL=https://your-function-app.azurewebsites.net
# ... other values
```

## Verification

### 1. Check Resources
```bash
az resource list --resource-group transcript-minute-rg --output table
```

### 2. Test Storage
```bash
az storage container list --account-name your_storage_account --auth-mode login
```

### 3. Test Functions
```bash
az functionapp list --resource-group transcript-minute-rg --output table
```

## Troubleshooting

### Common Issues

1. **Permission Denied**
   - Ensure you have Contributor or Owner role on the subscription
   - Check if your account has B2C tenant creation permissions

2. **Resource Name Conflicts**
   - Storage account names must be globally unique
   - Try adding a timestamp or random suffix

3. **B2C Tenant Creation**
   - This requires manual steps in Azure Portal
   - Follow the instructions in the script output

4. **Function Deployment Fails**
   - Ensure Azure Functions Core Tools are installed
   - Check if the Function App exists and is accessible

### Getting Help

- Check Azure Portal for resource status
- Review Azure Activity Log for errors
- Check Function App logs in Application Insights

## Next Steps

After infrastructure setup:

1. **Deploy Frontend**: Update the Next.js app to use Azure services
2. **Configure AI**: Set up Azure OpenAI and Dify
3. **Test End-to-End**: Verify the complete workflow
4. **Set up Monitoring**: Configure alerts and dashboards

## Cost Optimization

- Use Consumption plans for Functions
- Enable auto-pause for Cosmos DB
- Set up storage lifecycle policies
- Monitor usage with Cost Management

## Security Checklist

- [ ] Private endpoints enabled for all services
- [ ] Key Vault configured with proper access policies
- [ ] B2C tenant secured with MFA
- [ ] Storage account access restricted
- [ ] Function App authentication enabled
- [ ] Network security groups configured
- [ ] Application Insights data retention set
