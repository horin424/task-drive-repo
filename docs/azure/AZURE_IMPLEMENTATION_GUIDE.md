# Azure Implementation Guide

## Overview

This guide explains how to use the Azure implementation of the Transcript Minute application, which provides a parallel implementation to the existing AWS setup.

## Architecture Comparison

| Component | AWS | Azure |
|-----------|-----|-------|
| **Authentication** | AWS Cognito | Microsoft Entra External ID (Azure AD B2C) |
| **Storage** | Amazon S3 | Azure Blob Storage |
| **Backend Functions** | AWS Lambda | Azure Functions |
| **API Gateway** | AWS API Gateway + AppSync | Azure Functions HTTP Triggers |
| **Database** | DynamoDB (via AppSync) | Cosmos DB or Azure SQL |
| **Real-time Updates** | AppSync Subscriptions | Azure SignalR Service (or polling) |
| **Secrets Management** | AWS Secrets Manager | Azure Key Vault |
| **Monitoring** | CloudWatch | Application Insights |

## File Structure

The Azure implementation is organized in parallel to the AWS implementation:

```
src/
├── lib/
│   ├── storage.ts              # AWS S3 storage utilities
│   ├── storage-azure.ts        # Azure Blob Storage utilities ✨ NEW
│   ├── api.ts                  # AWS AppSync/GraphQL client
│   └── api-azure.ts            # Azure Functions HTTP client ✨ NEW
├── hooks/
│   ├── useMediaUpload.ts       # AWS upload hook
│   ├── useMediaUpload-azure.ts # Azure upload hook ✨ NEW
│   ├── useAuthInit.ts          # AWS auth initialization
│   └── useAuthInit-azure.ts    # Azure auth initialization ✨ NEW
├── types/
│   ├── index.ts                # AWS types
│   └── types-azure.ts          # Azure types ✨ NEW
├── providers/
│   ├── AuthProvider.tsx        # MSAL provider ✨ NEW
├── app/
│   ├── page.tsx                # AWS version (active)
│   └── page-azure.tsx          # Azure version ✨ NEW
├── azure-config.ts             # Azure configuration ✨ NEW
```

## Implementation Details

### 1. Authentication (Azure AD B2C / Entra External ID)

**File:** `src/hooks/useAuth.ts`, `src/providers/AuthProvider.tsx`

The authentication system uses Microsoft Authentication Library (MSAL) for browser-based authentication.

**Key Features:**
- Popup-based login flow
- Token management and renewal
- Role-based access control (Admin/User)
- Silent token acquisition

**Usage in Components:**
```typescript
import { useAuth } from '@/hooks/useAuth';

const MyComponent = () => {
  const { login, logout, isAuthenticated, getAccessToken } = useAuth();
  
  // Check if user is authenticated
  if (!isAuthenticated) {
    return <button onClick={login}>Login</button>;
  }
  
  // Get access token for API calls
  const token = await getAccessToken();
};
```

### 2. File Upload to Azure Blob Storage

**File:** `src/lib/storage-azure.ts`

**Key Functions:**

#### `uploadToAzure(blobName, data, options)`
Uploads a file to Azure Blob Storage.

```typescript
import { uploadToAzure } from '@/lib/storage-azure';

const result = await uploadToAzure(
  'session-123/audio.mp3',
  fileBlob,
  {
    useInputContainer: true, // Use 'transcripts' container
    onProgress: (progress) => {
      console.log(`${progress.transferredBytes} / ${progress.totalBytes}`);
    }
  }
);
```

**Options:**
- `containerName`: Custom container name
- `useInputContainer`: If true, uses 'transcripts' container; otherwise 'outputs'
- `contentType`: MIME type of the file
- `onProgress`: Progress callback

#### `getAzureBlobUrl(blobName, options)`
Gets a URL for accessing a blob (for production, should generate SAS token server-side).

```typescript
const url = await getAzureBlobUrl('session-123/transcript.txt');
```

### 3. API Client for Azure Functions

**File:** `src/lib/api-azure.ts`

This module provides functions to interact with Azure Functions backend.

**Key Functions:**

#### Session Management
```typescript
import { 
  createSessionAzure, 
  updateSessionAzure, 
  getSessionAzure 
} from '@/lib/api-azure';

// Create a processing session
const session = await createSessionAzure({
  owner: azureAdObjectId,
  sessionId: uuidv4(),
  organizationID: 'org-123',
  fileName: 'meeting.mp3',
  language: 'ja',
  status: ProcessingStatusAzure.UPLOADED,
  uploadTime: new Date().toISOString(),
});

// Update session status
await updateSessionAzure({
  id: session.id,
  status: ProcessingStatusAzure.PROCESSING_TRANSCRIPTION,
});

// Get session by ID
const currentSession = await getSessionAzure('session-123');
```

#### User Management
```typescript
import { 
  createCustomUserAzure, 
  getUserByIdAzure 
} from '@/lib/api-azure';

// Get user by Azure AD Object ID
const user = await getUserByIdAzure(azureAdObjectId);

// Create new user
const newUser = await createCustomUserAzure({
  username: 'john.doe@example.com',
  email: 'john.doe@example.com',
  azureAdObjectId: 'oid-123',
  organizationID: 'org-123',
});
```

#### Organization Management
```typescript
import { 
  getOrganizationByIdAzure,
  decreaseOrganizationMinutesAzure 
} from '@/lib/api-azure';

// Get organization
const org = await getOrganizationByIdAzure('org-123');

// Decrease remaining minutes (atomic operation)
const updatedOrg = await decreaseOrganizationMinutesAzure('org-123', 5);
```

### 4. Media Upload Hook

**File:** `src/hooks/useMediaUpload-azure.ts`

This hook manages the complete file upload workflow.

```typescript
import { useMediaUploadAzure } from '@/hooks/useMediaUpload-azure';

const MyUploadComponent = () => {
  const { 
    upload, 
    isLoading, 
    isError, 
    error, 
    uploadProgress, 
    currentSession 
  } = useMediaUploadAzure();
  
  const handleUpload = (file: File) => {
    upload({ file, language: 'ja' });
  };
  
  return (
    <div>
      <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />
      {isLoading && <div>Uploading: {uploadProgress}%</div>}
      {currentSession && <div>Session: {currentSession.status}</div>}
    </div>
  );
};
```

**Workflow:**
1. Creates a processing session via Azure Function
2. Uploads file to Azure Blob Storage
3. Sets up real-time updates subscription
4. Monitors processing status changes

### 5. Authentication Initialization

**File:** `src/hooks/useAuthInit-azure.ts`

This hook initializes user data after authentication.

```typescript
import { useAuthInitAzure } from '@/hooks/useAuthInit-azure';

const App = () => {
  const { isLoading, isError } = useAuthInitAzure();
  
  if (isLoading) return <LoadingSpinner />;
  if (isError) return <ErrorMessage />;
  
  return <MainApp />;
};
```

**What it does:**
1. Extracts user info from MSAL account
2. Creates or retrieves user record from database
3. Loads organization information
4. Sets admin status based on roles
5. Updates Zustand store with all data

### 6. Real-time Updates

**Current Implementation:** Polling (every 3 seconds)
**Production Recommendation:** Azure SignalR Service

#### Using Polling (Current)
```typescript
import { subscribeToSessionUpdatesAzure } from '@/lib/api-azure';

const unsubscribe = subscribeToSessionUpdatesAzure(
  sessionId,
  (updatedSession) => {
    console.log('Session updated:', updatedSession);
    // Update UI
  }
);

// Cleanup
return () => unsubscribe();
```

#### Azure SignalR Integration (Recommended)
For production, integrate Azure SignalR Service:

```typescript
// Backend (Azure Function)
const signalR = new SignalRService(connectionString);
await signalR.send({
  target: 'sessionUpdated',
  arguments: [session],
  userId: session.owner
});

// Frontend
import * as signalR from '@microsoft/signalr';

const connection = new signalR.HubConnectionBuilder()
  .withUrl('https://your-signalr.service.signalr.net/hub')
  .build();

connection.on('sessionUpdated', (session) => {
  updateCurrentSession(session);
});
```

## Environment Setup

### Development Environment

1. **Copy the environment template:**
   ```bash
   cp docs/azure/env-azure-example.txt .env.local
   ```

2. **Fill in the required values:**
   - `NEXT_PUBLIC_ENTRA_CLIENT_ID`: From Azure AD app registration
   - `NEXT_PUBLIC_ENTRA_TENANT_NAME`: Your B2C tenant name
   - `NEXT_PUBLIC_AZURE_STORAGE_ACCOUNT`: Storage account name
   - `NEXT_PUBLIC_AZURE_STORAGE_KEY`: Storage account key
   - `NEXT_PUBLIC_AZURE_FUNCTION_URL`: Your Function App URL

3. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

4. **Run development server:**
   ```bash
   npm run dev
   ```

5. **Navigate to Azure version:**
   - Temporarily rename `src/app/page.tsx` to `src/app/page-aws.tsx`
   - Rename `src/app/page-azure.tsx` to `src/app/page.tsx`
   - Or update your routing logic

### Production Deployment

#### Option 1: Azure Static Web Apps
```bash
# Install Azure Static Web Apps CLI
npm install -g @azure/static-web-apps-cli

# Deploy
swa deploy --env production
```

#### Option 2: Azure App Service
```bash
# Build the application
npm run build

# Deploy via Azure CLI
az webapp up \
  --resource-group transcript-minute-rg \
  --name transcript-minute-app \
  --plan transcript-minute-plan
```

## Required Azure Resources

### 1. Azure AD B2C / Entra External ID
- Application registration
- User flows (sign-up/sign-in)
- User groups (Admin, Users)

### 2. Azure Storage Account
- Containers: `transcripts`, `outputs`
- CORS configuration for web access
- Private endpoints (optional, for security)

### 3. Azure Functions
Required functions:
- `sessions` (CRUD operations)
- `users` (user management)
- `organizations` (organization management)
- `sessions/delete-files` (file cleanup)
- `sessions/audio-url` (SAS token generation)
- `generation/process` (content generation)

### 4. Cosmos DB or Azure SQL
Schema:
- `Organizations` table/collection
- `Users` table/collection
- `ProcessingSessions` table/collection

### 5. Azure Key Vault
Store secrets:
- `elevenlabs-api-key`
- `dify-api-key`
- `storage-connection-string`

### 6. Azure SignalR Service (Optional)
- For real-time updates
- Hub: `processingsessions`

### 7. Application Insights
- For monitoring and logging
- Connected to Function App

## Migration from AWS to Azure

### Switching Between Implementations

The codebase supports both AWS and Azure implementations. To switch:

1. **Use Azure implementation:**
   - Swap `page.tsx` ↔ `page-azure.tsx`
   - Or create a route: `/azure` → `page-azure.tsx`

2. **Environment-based selection:**
   ```typescript
   // src/app/page.tsx
   import { useRouter } from 'next/navigation';
   
   const platform = process.env.NEXT_PUBLIC_PLATFORM; // 'aws' | 'azure'
   
   if (platform === 'azure') {
     return <AzureVersion />;
   } else {
     return <AWSVersion />;
   }
   ```

### Data Migration

To migrate existing data from AWS to Azure:

1. **Export from DynamoDB:**
   ```bash
   aws dynamodb scan --table-name Organizations > organizations.json
   aws dynamodb scan --table-name Users > users.json
   aws dynamodb scan --table-name ProcessingSessions > sessions.json
   ```

2. **Import to Cosmos DB/Azure SQL:**
   ```bash
   # Create an Azure Function or script to import data
   node scripts/import-to-azure.js
   ```

3. **Migrate S3 files to Blob Storage:**
   ```bash
   # Use AzCopy or Azure Storage Migration
   azcopy copy \
     "https://your-bucket.s3.amazonaws.com/*" \
     "https://yourstorage.blob.core.windows.net/transcripts" \
     --recursive
   ```

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
# Test Azure Functions locally
cd azure-functions
func start

# Test file upload
npm run test:azure:upload

# Test authentication
npm run test:azure:auth
```

### End-to-End Tests
```bash
npx playwright test tests/azure/
```

## Troubleshooting

### Authentication Issues

**Problem:** Login popup doesn't appear
**Solution:** Check MSAL configuration and redirect URIs in Azure AD

**Problem:** Token expired errors
**Solution:** MSAL automatically refreshes tokens; check network connectivity

### Storage Issues

**Problem:** CORS errors when uploading
**Solution:** Configure CORS in Azure Storage account settings

**Problem:** 403 Forbidden errors
**Solution:** Verify storage account key or SAS token is correct

### API Issues

**Problem:** Azure Function returns 401
**Solution:** Ensure access token is included in request headers

**Problem:** Session not updating in real-time
**Solution:** Check polling interval or SignalR connection

## Performance Optimization

1. **Use SAS tokens instead of account keys** for better security
2. **Enable Azure CDN** for faster blob access
3. **Implement caching** with Azure Redis Cache
4. **Use Azure Front Door** for global distribution
5. **Enable Application Insights** for performance monitoring

## Security Best Practices

1. **Never expose storage keys** in client code
2. **Generate SAS tokens server-side** with minimal permissions
3. **Use managed identities** for Azure Functions
4. **Enable private endpoints** for storage and functions
5. **Store secrets in Key Vault**, not environment variables
6. **Implement rate limiting** in API Management
7. **Enable WAF** (Web Application Firewall) for production

## Next Steps

1. Backend implementation complete
   - Azure Functions + Cosmos DB + Web PubSub
   - Azure OpenAI Whisper transcription
   - Dify workflow integration for minutes/bullets/tasks
   - Quotas + monthly reset + cleanup jobs

2. Production hardening (Milestone 4)
   - Key Vault + Managed Identity + RBAC
   - Application Insights + Log Analytics + alerts
   - DNS/SSL/custom domain
   - Load and security testing

3. Deployment artifacts
   - Operation runbook
   - Test report
   - Production release checklist

## Support

For questions or issues with the Azure implementation:
- Review this guide
- Check `docs/azure/` for additional documentation
- Consult Azure documentation
- Contact the development team

---

**Last Updated:** 2025-12-20
**Version:** 1.1.0

