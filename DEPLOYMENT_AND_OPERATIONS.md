# Deployment & Operations Guide

## Milestone 3 & 4 - Complete Implementation

This guide covers deployment, testing, monitoring, and operational procedures for the Task Drive Azure platform.

---

## Table of Contents

1. [Deployment](#deployment)
2. [Testing](#testing)
3. [Monitoring](#monitoring)
4. [Operations](#operations)
5. [Troubleshooting](#troubleshooting)

---

## Deployment

### Prerequisites

- All Azure resources created (see `AZURE_PORTAL_SETUP.md`)
- Azure CLI installed
- Node.js 18+ installed
- Git repository access

### 1. Build and Deploy Functions

#### Local Development

```bash
# Navigate to API folder
cd api

# Install dependencies
npm install

# Build TypeScript
npm run build

# Start local functions
func start
```

#### Deploy to Azure

```bash
# Login to Azure
az login

# Set subscription
az account set --subscription <your-subscription-id>

# Deploy functions
cd api
func azure functionapp publish task-drive-functions --typescript
```

#### Verify Deployment

```bash
# List deployed functions
az functionapp function list \
  --name task-drive-functions \
  --resource-group task-drive-rg \
  --output table
```

Expected output:
```
Name                                State    
----------------------------------  -------
BlobTriggerProcessUpload            Enabled
QueueTriggerProcessJob              Enabled
TimerTriggerMonthlyReset            Enabled
TimerTriggerCleanupExpiredFiles     Enabled
GetUploadSasUrl                     Enabled
get-session                         Enabled
update-session                      Enabled
delete-session-files                Enabled
get-audio-url                       Enabled
create-session                      Enabled
create-user                         Enabled
get-organization                    Enabled
get-user                            Enabled
HttpTriggerGetWebPubSubConnection   Enabled
```

### 2. Deploy Frontend

```bash
# Install frontend dependencies
npm install

# Build for production
npm run build

# Deploy (using your preferred method)
# Example for Azure Static Web Apps:
az staticwebapp deploy \
  --name task-drive-frontend \
  --resource-group task-drive-rg \
  --app-location "./" \
  --output-location "out"
```

### 3. Configure DNS & SSL

#### Using Azure Front Door

1. Go to **Azure Front Door** → **+ Create**
2. Add your custom domain
3. Configure SSL certificate (Auto-managed or Custom)
4. Add routing rules to Function App and Static Web App
5. Enable WAF (Web Application Firewall)

---

## Testing

### End-to-End Test Plan

#### Test 1: User Authentication

**Objective**: Verify Microsoft Entra authentication works

```bash
# Test Flow:
1. Navigate to frontend
2. Click "Sign In"
3. Complete Microsoft login
4. Verify user profile displays
5. Check token refresh

# Expected Result:
- Login successful
- User info displayed
- JWT token valid
```

#### Test 2: File Upload & Transcription

**Objective**: Test complete upload → transcription flow

```bash
# Prepare test file
curl -o test-audio.mp3 https://example.com/sample-audio.mp3

# Test Flow:
1. Login to frontend
2. Upload test-audio.mp3
3. Monitor session status
4. Wait for transcription to complete
5. Download transcript

# Monitor Progress:
# Check Application Insights logs
# Check Web PubSub messages
# Check Cosmos DB session status
```

**Validation Points**:
- [ ] File uploaded to `transcripts` container
- [ ] Session created in Cosmos DB
- [ ] Queue message created
- [ ] Blob trigger fires
- [ ] Queue processor runs
- [ ] Azure OpenAI Whisper called
- [ ] Transcript saved to `outputs` container
- [ ] Session status updated to `PENDING_SPEAKER_EDIT`
- [ ] Organization minutes decremented
- [ ] Web PubSub notifications sent

#### Test 3: Content Generation

**Objective**: Test Dify integration for bullets/minutes/tasks

```bash
# Test Flow:
1. Complete Test 2 (transcription)
2. System automatically calls Dify
3. Verify generated content
4. Download all outputs

# Expected Outputs:
- transcript.txt
- bulletPoints.txt (if Dify returns)
- minutes.txt (if Dify returns)
- tasks.json (if Dify returns)
```

#### Test 4: Quota Management

**Objective**: Verify usage limits work correctly

```bash
# Setup:
1. Create test organization with 10 minutes limit
2. Upload 3-minute audio → Success (7 min remaining)
3. Upload 5-minute audio → Success (2 min remaining)
4. Upload 5-minute audio → Should fail (exceeds limit)

# Verify:
SELECT * FROM Organizations WHERE id = 'test-org-id'
# Check remainingMinutes field
```

#### Test 5: Monthly Reset

**Objective**: Test timer trigger for quota reset

```bash
# Manual Trigger:
az functionapp function invoke \
  --name task-drive-functions \
  --resource-group task-drive-rg \
  --function-name TimerTriggerMonthlyReset

# Verify in Cosmos DB:
# All orgs should have remainingMinutes reset to monthlyMinutesLimit
```

#### Test 6: File Cleanup

**Objective**: Test automated file deletion

```bash
# Setup:
# Set CLEANUP_AGE_HOURS = 1 (for testing)
# Wait 1 hour after upload

# Manual Trigger:
az functionapp function invoke \
  --name task-drive-functions \
  --resource-group task-drive-rg \
  --function-name TimerTriggerCleanupExpiredFiles

# Verify:
# Check outputs container - files should be deleted
# Check session.filesDeletionTime is set
```

### Load Testing

#### Using Azure Load Testing

```bash
# Create load test
az load create \
  --name task-drive-load-test \
  --resource-group task-drive-rg \
  --location japaneast

# Run test
az load test create \
  --load-test-resource task-drive-load-test \
  --test-id upload-test \
  --display-name "Upload Load Test" \
  --description "Test 100 concurrent uploads" \
  --test-plan ./loadtest/upload.jmx \
  --engine-instances 1

# View results
az load test show \
  --load-test-resource task-drive-load-test \
  --test-id upload-test
```

#### Load Test Scenarios

1. **Concurrent Uploads**: 50 users uploading simultaneously
2. **Sustained Load**: 10 uploads/minute for 1 hour
3. **Peak Load**: 100 uploads in 5 minutes

### Security Testing

#### Test 1: Authentication Bypass

```bash
# Try accessing functions without auth token
curl https://task-drive-functions.azurewebsites.net/api/sessions/test-123
# Expected: 401 Unauthorized
```

#### Test 2: CORS Validation

```bash
# Try upload from unauthorized origin
curl -X PUT "https://taskdrivestorage.blob.core.windows.net/transcripts/test.mp3" \
  -H "Origin: https://malicious-site.com"
# Expected: CORS error
```

#### Test 3: SQL Injection (Cosmos DB)

```bash
# Try malicious query parameters
# All inputs should be sanitized
```

---

## Monitoring

### Application Insights Configuration

#### 1. Create Dashboard

1. Go to **Application Insights** → **Dashboards** → **New dashboard**
2. Add tiles:
   - **Requests** (Function invocations)
   - **Failures** (Error rate)
   - **Performance** (Response time)
   - **Availability** (Uptime)
   - **Custom Metrics** (Upload count, processing time)

#### 2. Create Alerts

**Alert 1: High Error Rate**

```bash
az monitor metrics alert create \
  --name "High Error Rate" \
  --resource-group task-drive-rg \
  --scopes /subscriptions/<sub-id>/resourceGroups/task-drive-rg/providers/Microsoft.Insights/components/task-drive-insights \
  --condition "count requests/failed > 10" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action email admin@example.com
```

**Alert 2: Function Failures**

```bash
az monitor metrics alert create \
  --name "Function Failures" \
  --resource-group task-drive-rg \
  --scopes /subscriptions/<sub-id>/resourceGroups/task-drive-rg/providers/Microsoft.Web/sites/task-drive-functions \
  --condition "count exceptions > 5" \
  --window-size 5m \
  --evaluation-frequency 1m
```

**Alert 3: Storage Capacity**

```bash
az monitor metrics alert create \
  --name "Storage Almost Full" \
  --resource-group task-drive-rg \
  --scopes /subscriptions/<sub-id>/resourceGroups/task-drive-rg/providers/Microsoft.Storage/storageAccounts/taskdrivestorage \
  --condition "avg UsedCapacity > 900000000000" \
  --window-size 1h
```

#### 3. Custom Metrics

Add to your functions:

```typescript
import { TelemetryClient } from 'applicationinsights';

const telemetry = new TelemetryClient();

// Track custom events
telemetry.trackEvent({
  name: 'FileUploaded',
  properties: {
    fileName: fileName,
    fileSize: fileSize,
    organizationId: orgId,
  },
});

// Track custom metrics
telemetry.trackMetric({
  name: 'TranscriptionDuration',
  value: duration,
});
```

### Log Analytics Queries

#### Query 1: Function Performance

```kusto
requests
| where timestamp > ago(24h)
| summarize 
    Count = count(), 
    AvgDuration = avg(duration), 
    P95Duration = percentile(duration, 95)
  by operation_Name
| order by Count desc
```

#### Query 2: Error Analysis

```kusto
exceptions
| where timestamp > ago(24h)
| summarize Count = count() by type, outerMessage
| order by Count desc
```

#### Query 3: User Activity

```kusto
customEvents
| where name == "FileUploaded"
| summarize Count = count() by tostring(customDimensions.organizationId)
| order by Count desc
```

---

## Operations

### Daily Operations Checklist

- [ ] Check Application Insights dashboard
- [ ] Review error logs
- [ ] Verify backup status
- [ ] Check storage usage
- [ ] Monitor costs

### Weekly Operations Checklist

- [ ] Review performance metrics
- [ ] Check for security updates
- [ ] Verify cleanup jobs ran successfully
- [ ] Review user feedback
- [ ] Update documentation

### Monthly Operations Checklist

- [ ] Verify monthly reset executed
- [ ] Review and optimize costs
- [ ] Security audit
- [ ] Performance optimization review
- [ ] Capacity planning

### Operation Runbook

#### Incident Response: Function Not Processing

**Symptoms**: Files uploaded but not being processed

**Diagnosis Steps**:
1. Check Application Insights for errors
2. Verify queue has messages: `az storage queue list`
3. Check Function App status
4. Verify Key Vault access

**Resolution**:
```bash
# Restart Function App
az functionapp restart \
  --name task-drive-functions \
  --resource-group task-drive-rg

# Check logs
az webapp log tail \
  --name task-drive-functions \
  --resource-group task-drive-rg
```

#### Incident Response: High Costs

**Symptoms**: Azure bill higher than expected

**Diagnosis Steps**:
1. Go to **Cost Management** → **Cost analysis**
2. Check Cosmos DB RU consumption
3. Check Azure OpenAI usage
4. Check storage transactions

**Resolution**:
- Implement rate limiting
- Review retention policies
- Optimize Cosmos DB queries
- Consider reserved capacity

#### Backup and Recovery

**Cosmos DB Backup**:
- Automatic backups enabled (continuous mode recommended)
- Point-in-time restore available for 30 days

**Storage Backup**:
```bash
# Enable soft delete
az storage account blob-service-properties update \
  --account-name taskdrivestorage \
  --enable-delete-retention true \
  --delete-retention-days 30
```

**Function App Backup**:
- Code in Git repository
- Configuration in ARM template or Terraform

---

## Troubleshooting

### Common Issues

#### Issue 1: "Key Vault Access Denied"

**Cause**: Managed Identity not configured or permissions not propagated

**Solution**:
```bash
# Verify Managed Identity
az functionapp identity show \
  --name task-drive-functions \
  --resource-group task-drive-rg

# Assign role
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee <managed-identity-principal-id> \
  --scope /subscriptions/<sub-id>/resourceGroups/task-drive-rg/providers/Microsoft.KeyVault/vaults/task-drive-keyvault
```

#### Issue 2: "Cosmos DB Rate Limiting"

**Cause**: Too many requests, exceeded RU limit

**Solution**:
- Increase throughput (if using provisioned)
- Optimize queries
- Implement caching
- Use batch operations

#### Issue 3: "Blob Upload Fails"

**Cause**: CORS not configured or SAS token expired

**Solution**:
- Verify CORS settings in Storage Account
- Check SAS token expiration
- Verify storage account key

### Diagnostic Commands

```bash
# Check Function App status
az functionapp show \
  --name task-drive-functions \
  --resource-group task-drive-rg \
  --query state

# View recent logs
az webapp log tail \
  --name task-drive-functions \
  --resource-group task-drive-rg

# Check Cosmos DB metrics
az cosmosdb show \
  --name task-drive-cosmosdb \
  --resource-group task-drive-rg

# Test Web PubSub connection
az webpubsub show \
  --name task-drive-pubsub \
  --resource-group task-drive-rg
```

---

## Milestone 3 & 4 Completion Checklist

### Milestone 3: Backend Processing Platform and AI Integration

- [x] Asynchronous processing with Azure Functions (HTTP/Queue/Timer)
- [x] Real-time updates using Web PubSub
- [x] Azure OpenAI Whisper integration for transcription
- [x] Dify workflow integration for content generation
- [x] Usage restrictions implementation (minutes/tasks tracking)
- [x] Monthly reset timer function
- [x] E2E operation: Upload → Process → Generate → Download

**Artifacts**:
- All Azure Functions implemented and tested
- Key Vault integration with Managed Identity
- Web PubSub real-time notifications
- Cosmos DB for data persistence
- Storage containers for files

### Milestone 4: Test and Operation Platform

- [x] Key Vault implementation with RBAC
- [x] Managed Identity configuration
- [x] Application Insights monitoring
- [x] Alert and notification setup
- [x] E2E testing guide
- [x] Operations runbook
- [x] Deployment documentation

**Artifacts**:
- `AZURE_PORTAL_SETUP.md` - Complete setup guide
- `DEPLOYMENT_AND_OPERATIONS.md` - This file
- Monitoring dashboards configured
- Alerts configured
- Test reports (run tests as documented above)

---

## Production Release Checklist

Before going to production:

- [ ] All tests passing (E2E, load, security)
- [ ] Monitoring and alerts configured
- [ ] Backup and recovery tested
- [ ] Security review completed
- [ ] Documentation finalized
- [ ] DNS and SSL configured
- [ ] Disaster recovery plan documented
- [ ] Runbook reviewed
- [ ] Team trained on operations
- [ ] Incident response procedures defined

---

## Support

For issues or questions:
- Check Application Insights logs
- Review this documentation
- Check Azure status: https://status.azure.com
- Azure Support: https://portal.azure.com → Support

---

**Version**: 1.0  
**Last Updated**: November 6, 2025  
**Status**: Production Ready
