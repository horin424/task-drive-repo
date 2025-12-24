# Azure Implementation - Quick Start Guide

## What Has Been Completed

- Complete frontend implementation (Entra auth + file upload)
- Complete backend implementation (Functions + Cosmos + Web PubSub)
- Azure OpenAI Whisper transcription pipeline
- Dify workflow integration for minutes/bullets/tasks
- Usage limits + monthly reset + cleanup jobs
- Production-ready documentation and runbooks

## 📦 New Files Created

```
src/
├── lib/
│   ├── storage-azure.ts        ← Azure Blob Storage operations
│   └── api-azure.ts            ← Azure Functions HTTP client
├── hooks/
│   ├── useMediaUpload-azure.ts ← File upload hook
│   └── useAuthInit-azure.ts    ← Auth initialization hook
├── types/
│   └── types-azure.ts          ← Complete TypeScript types
└── azure-config.ts             ← Azure configuration (updated)

docs/azure/
├── env-azure-example.txt                      ← Environment variables template
├── AZURE_IMPLEMENTATION_GUIDE.md              ← Complete implementation guide
├── AZURE_FRONTEND_IMPLEMENTATION_SUMMARY.md   ← Technical summary
└── QUICK_START.md                             ← This file
```

## 🚀 How to Use the Azure Implementation

### Option 1: Test Azure Implementation Immediately

1. **Install the new Azure package:**
   ```bash
   npm install
   ```
   This installs `@azure/storage-blob` that was added to `package.json`.

2. **Configure environment variables:**
   ```bash
   # Create .env.local from template
   cp docs/azure/env-azure-example.txt .env.local
   
   # Edit .env.local with your Azure credentials
   ```

   **Minimum required variables:**
   ```env
   NEXT_PUBLIC_ENTRA_CLIENT_ID=your-azure-ad-app-id
   NEXT_PUBLIC_ENTRA_TENANT_NAME=your-tenant-name
   NEXT_PUBLIC_AZURE_STORAGE_ACCOUNT=yourstorageaccount
   NEXT_PUBLIC_AZURE_STORAGE_KEY=your-storage-key
   NEXT_PUBLIC_AZURE_FUNCTION_URL=https://your-functions.azurewebsites.net
   ```

3. **Switch to Azure page:**
   ```bash
   # Option A: Temporarily rename files
   mv src/app/page.tsx src/app/page-aws.tsx
   mv src/app/page-azure.tsx src/app/page.tsx
   
   # Option B: Access via custom route (no changes needed)
   # Just navigate to /azure route
   ```

4. **Run development server:**
   ```bash
   npm run dev
   ```

5. **Test the functionality:**
   - Navigate to `http://localhost:3000` (or `/azure`)
   - Click "ログイン" to authenticate with Azure AD
   - Upload an audio/video file
   - Monitor the upload progress
   - Check Azure Storage for the uploaded file

### Option 2: Keep AWS, Prepare Azure for Later

No action needed! The Azure implementation exists in parallel and doesn't affect your current AWS setup.

When ready to test Azure:
- Just follow Option 1 above
- Your AWS implementation remains unchanged

## 🔑 Required Azure Resources

### For Frontend Testing (What You Need Now)

1. **Azure AD B2C / Entra External ID**
   - Create tenant: https://portal.azure.com
   - Register application
   - Note: Client ID and Tenant Name
   - Configure redirect URIs: `http://localhost:3000`, your production URL

2. **Azure Storage Account**
   - Create storage account
   - Create containers: `transcripts`, `outputs`
   - Enable CORS for web access:
     ```
     Allowed origins: *
     Allowed methods: GET, POST, PUT, DELETE
     Allowed headers: *
     ```
   - Note: Account name and access key

3. **Azure Functions App** (For full functionality)
   - Create Function App (Node.js 18+)
   - Deploy backend functions (see Backend Development section)
   - Note: Function App URL

### For Production Deployment (What You'll Need Later)

4. **Azure Cosmos DB** or **Azure SQL Database**
5. **Azure Key Vault** (for secrets)
6. **Azure SignalR Service** (for real-time updates)
7. **Application Insights** (for monitoring)

## 📋 Component Usage Examples

### 1. File Upload

```typescript
import { useMediaUploadAzure } from '@/hooks/useMediaUpload-azure';

function MyComponent() {
  const { upload, isLoading, uploadProgress, currentSession } = useMediaUploadAzure();
  
  const handleUpload = (file: File) => {
    upload({ file, language: 'ja' });
  };
  
  return (
    <div>
      <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />
      {isLoading && <p>Uploading: {uploadProgress}%</p>}
      {currentSession && <p>Status: {currentSession.status}</p>}
    </div>
  );
}
```

### 2. Authentication

```typescript
import { useAuth } from '@/hooks/useAuth';
import { useAuthInitAzure } from '@/hooks/useAuthInit-azure';

function App() {
  const { login, logout, isAuthenticated } = useAuth();
  const { isLoading } = useAuthInitAzure();
  
  if (isLoading) return <Loading />;
  if (!isAuthenticated) return <button onClick={login}>Login</button>;
  
  return <MainApp onLogout={logout} />;
}
```

### 3. Direct Storage Access

```typescript
import { uploadToAzure, getAzureBlobUrl } from '@/lib/storage-azure';

// Upload a file
const result = await uploadToAzure('session-123/audio.mp3', fileBlob, {
  useInputContainer: true,
  onProgress: (p) => console.log(`${p.transferredBytes} / ${p.totalBytes}`)
});

// Get file URL
const url = await getAzureBlobUrl('session-123/transcript.txt');
```

### 4. API Calls

```typescript
import { 
  createSessionAzure, 
  getUserByIdAzure,
  getOrganizationByIdAzure 
} from '@/lib/api-azure';

// Create session
const session = await createSessionAzure({
  owner: userId,
  sessionId: uuidv4(),
  organizationID: 'org-123',
  fileName: 'meeting.mp3',
  language: 'ja',
  status: ProcessingStatusAzure.UPLOADED,
  uploadTime: new Date().toISOString(),
});

// Get user
const user = await getUserByIdAzure(azureAdObjectId);

// Get organization
const org = await getOrganizationByIdAzure('org-123');
```

## Backend Implementation Ready

Note: The Azure Functions backend is implemented in /api and ready to run.

### What Is Implemented:

1. Sessions API (/api/sessions)
   - POST: Create session
   - PUT/PATCH: Update session
   - GET: Get session by ID
   - DELETE: Delete session files
   - GET: Audio/output SAS URLs

2. Users API (/api/users)
   - POST: Create user
   - GET: Get user by Azure AD Object ID
   - PUT/PATCH: Update user

3. Organizations API (/api/organizations)
   - GET: Get org by ID / list all (admin)
   - POST: Decrease minutes
   - POST: Decrease task generations

4. Transcription Pipeline
   - Blob trigger on transcripts
   - Azure OpenAI Whisper transcription
   - Saves transcript to outputs
   - Updates session status

5. Content Generation
   - POST /api/generate/process-all
   - Uses Dify Workflow when ENABLE_DIFY_GENERATION=true
   - Falls back to direct Azure OpenAI prompts

6. Scheduled Functions
   - Monthly quota reset
   - Expired files cleanup

### How to Run Locally (Backend)

```
cd api
npm install
npm run build
func start
```

### Required Backend Env (Dify)

Add to api/local.settings.json:
```
ENABLE_DIFY_GENERATION=true
DIFY_API_KEY=app-xxxxxxxx
DIFY_WORKFLOW_URL=http://localhost:5001/v1
```

See docs/azure/DIFY_INTEGRATION_GUIDE.md for workflow setup and Key Vault steps.

## 🔄 Switching Between AWS and Azure

### Method 1: Environment Variable

```typescript
// src/app/page.tsx
const PLATFORM = process.env.NEXT_PUBLIC_PLATFORM || 'aws';

export default function Page() {
  if (PLATFORM === 'azure') {
    return <AzurePage />;
  }
  return <AWSPage />;
}
```

Then in `.env.local`:
```
NEXT_PUBLIC_PLATFORM=azure  # or 'aws'
```

### Method 2: Separate Routes

Keep both:
- `/` → AWS implementation (page.tsx)
- `/azure` → Azure implementation (page-azure.tsx)

Users can test both!

## Feature Comparison

| Feature | AWS | Azure | Status |
|---------|-----|-------|--------|
| Authentication | Cognito | Entra ID | DONE |
| File Storage | S3 | Blob Storage | DONE |
| Upload Progress | OK | OK | DONE |
| Session Management | AppSync | Functions API | DONE |
| Real-time Updates | Subscriptions | Polling/Web PubSub | DONE |
| User Management | DynamoDB | Functions + Cosmos DB | DONE |
| File Processing | Lambda | Functions | DONE |

Legend: DONE = implemented and working

## 🐛 Troubleshooting

### Issue: CORS errors when uploading
**Solution:** Configure CORS in Azure Storage Account settings

### Issue: 401 Unauthorized from Functions
**Solution:** Ensure MSAL token is being sent in requests (check `api-azure.ts`)

### Issue: "Module not found: @azure/storage-blob"
**Solution:** Run `npm install`

### Issue: Login popup blocked
**Solution:** Allow popups in browser settings

### Issue: File not appearing in Azure Storage
**Solution:** Check container names and access keys in `.env.local`

## 📚 Documentation

- **Complete Guide:** `docs/azure/AZURE_IMPLEMENTATION_GUIDE.md`
- **Technical Summary:** `docs/azure/AZURE_FRONTEND_IMPLEMENTATION_SUMMARY.md`
- **Environment Variables:** `docs/azure/env-azure-example.txt`
- **This Quick Start:** `docs/azure/QUICK_START.md`

## Quick Tips

1. Testing locally
   - Run Functions (func start) and frontend (npm run dev)
   - Full E2E flow is available

2. Real-time updates
   - Web PubSub already supported
   - Polling fallback still works

3. Security
   - Dev: local settings OK
   - Prod: use Key Vault + Managed Identity

4. Performance
   - Enable CDN for blob access
   - Use Web PubSub instead of polling for scale
   - Consider chunked uploads for very large files

## Checklist

Before testing locally:
- [ ] Azure AD app registered with correct redirect URIs
- [ ] Storage account created with transcripts and outputs containers
- [ ] CORS enabled on storage account (dev only; restrict in prod)
- [ ] .env.local configured with all required values
- [ ] api/local.settings.json configured with backend values
- [ ] npm install completed successfully
- [ ] npm run dev running without errors
- [ ] func start running without errors

Required for production:
- [ ] Azure Functions deployed
- [ ] Cosmos DB created and containers provisioned
- [ ] Key Vault configured with secrets + Managed Identity
- [ ] Web PubSub configured
- [ ] Dify workflow deployed and API key stored

## Success Indicators

You know it is working when:
1. Login popup appears and authenticates successfully
2. User info displays after login
3. File upload shows progress percentage
4. File appears in Azure Blob Storage
5. Transcription completes and speaker edit appears
6. Content generation completes (minutes/bullets/tasks)
7. Download produces the expected output files

## 📞 Need Help?

1. Check the detailed guide: `docs/azure/AZURE_IMPLEMENTATION_GUIDE.md`
2. Review code comments in the implementation files
3. Check Azure Portal for service logs
4. Review browser console for errors

---

**Ready to start?** Follow the steps in "Option 1" above! 🚀

