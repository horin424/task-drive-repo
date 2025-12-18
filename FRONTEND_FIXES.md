# Frontend Integration Fixes for Azure Backend

## Issues Found and Fixes Required

### 1. Missing Helper Functions in `azure-config.ts`

**Issue**: Functions `getApiBaseUrl()` and `getApiHeaders()` are referenced but not defined.

**Fix**: Add these helper functions to `azure-config.ts`

---

### 2. Incorrect API Endpoints

**Issue**: Endpoint paths don't match the actual Azure Functions routes we created.

**Current endpoints** in `azure-config.ts`:
```typescript
createSession: "/api/create-session",  // ❌ Wrong
updateSession: "/api/update-session",  // ❌ Wrong
```

**Should be** (matching backend):
```typescript
createSession: "/api/sessions",         // ✅ Correct
updateSession: "/api/sessions",         // ✅ Correct
getSession: "/api/sessions",            // ✅ New
deleteFiles: "/api/sessions/delete-files", // ✅ Correct
getAudioUrl: "/api/sessions/audio-url",    // ✅ Correct
```

---

### 3. Missing Environment Variables

**Issue**: Frontend needs Azure-specific environment variables.

**Required** in `.env.local`:
```env
# Azure Authentication (Microsoft Entra)
NEXT_PUBLIC_FRONTEND_CLIENT_ID=<your-entra-client-id>
NEXT_PUBLIC_TENANT=<your-tenant-id>
NEXT_PUBLIC_API_CLIENT_ID=<your-api-client-id>
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000
NEXT_PUBLIC_POST_LOGOUT_URI=http://localhost:3000

# Azure Functions
NEXT_PUBLIC_AZURE_FUNCTION_URL=https://task-drive-functions.azurewebsites.net

# Azure Storage
NEXT_PUBLIC_AZURE_STORAGE_ACCOUNT=taskdrivestorage
NEXT_PUBLIC_AZURE_STORAGE_KEY=<your-storage-key>

# Azure Location
NEXT_PUBLIC_AZURE_LOCATION=japaneast
NEXT_PUBLIC_AZURE_RESOURCE_GROUP=task-drive-rg

# Maintenance
NEXT_PUBLIC_MAINTENANCE_MODE=false
NEXT_PUBLIC_MAINTENANCE_MESSAGE=System maintenance in progress.
```

---

### 4. Duplicate API Files

**Issue**: You have both `api-azure.ts` and `azureApi.ts` with overlapping functionality.

**Recommendation**: Use `azureApi.ts` as it's simpler and works without authentication for now.

---

### 5. Web PubSub Connection Function

**Issue**: `getSignalRConnectionInfo()` references undefined functions.

---

## Complete Fixed Files

### ✅ File 1: `azure-config.ts` - FIXED

Already updated with:
- ✅ Correct API endpoints matching backend routes
- ✅ Helper functions `getApiBaseUrl()` and `getApiHeaders()`
- ✅ Fixed `getSignalRConnectionInfo()` function

### ✅ File 2: `azureApi.ts` - FIXED

Already updated with:
- ✅ Correct HTTP methods (GET/POST/PUT/DELETE)
- ✅ Proper URL construction for GET requests
- ✅ Updated `getUploadSasUrl()` to use config endpoints
- ✅ Updated all session and user functions

---

## Required Actions

### 1. Create `.env.local` File

Create this file in the root directory:

```bash
cp .env.example .env.local
```

Then update with these values:

```env
# Azure Authentication (Microsoft Entra)
NEXT_PUBLIC_FRONTEND_CLIENT_ID=<your-entra-application-client-id>
NEXT_PUBLIC_TENANT=<your-tenant-id>
NEXT_PUBLIC_API_CLIENT_ID=<your-api-client-id>  # Optional for now
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000
NEXT_PUBLIC_POST_LOGOUT_URI=http://localhost:3000

# Azure Functions
NEXT_PUBLIC_AZURE_FUNCTION_URL=https://task-drive-functions.azurewebsites.net

# For local development, use:
# NEXT_PUBLIC_AZURE_FUNCTION_URL=http://localhost:7071

# Azure Storage
NEXT_PUBLIC_AZURE_STORAGE_ACCOUNT=taskdrivestorage
NEXT_PUBLIC_AZURE_STORAGE_KEY=<your-storage-account-key>

# Azure Location
NEXT_PUBLIC_AZURE_LOCATION=japaneast
NEXT_PUBLIC_AZURE_RESOURCE_GROUP=task-drive-rg

# Maintenance Mode
NEXT_PUBLIC_MAINTENANCE_MODE=false
NEXT_PUBLIC_MAINTENANCE_MESSAGE=System maintenance in progress.

# App Environment
NEXT_PUBLIC_APP_ENV=development
```

### 2. Install Missing Dependencies (if needed)

```bash
npm install
```

All required packages are already in `package.json`:
- ✅ `@azure/msal-browser`
- ✅ `@azure/msal-react`
- ✅ `@azure/storage-blob`
- ✅ `@microsoft/signalr`

### 3. Test the Integration

#### Step 1: Start Backend (if testing locally)

```bash
cd api
func start
```

#### Step 2: Start Frontend

```bash
npm run dev
```

#### Step 3: Test Upload Flow

1. Navigate to `http://localhost:3000`
2. Sign in with Microsoft Entra
3. Upload an audio file
4. Monitor the processing
5. Check Application Insights logs

---

## API Endpoint Mapping

### Backend → Frontend Mapping

| Backend Function | Route | Frontend Method |
|-----------------|-------|----------------|
| `create-session` | POST `/api/sessions` | `createProcessingSession()` |
| `update-session` | PUT `/api/sessions` | `updateProcessingSession()` |
| `get-session` | GET `/api/sessions/:id` | `getProcessingSession()` |
| `delete-session-files` | DELETE `/api/sessions/delete-files` | `deleteGeneratedFiles()` |
| `get-audio-url` | GET `/api/sessions/audio-url` | `getAudioPresignedUrl()` |
| `create-user` | POST `/api/users` | `createCustomUser()` |
| `get-user` | GET `/api/users/:id` | `getUserByIdAzure()` |
| `get-organization` | GET `/api/organizations/:id` | `getOrganizationById()` |
| `GetUploadSasUrl` | GET `/api/GetUploadSasUrl` | `getUploadSasUrl()` |
| `HttpTriggerGetWebPubSubConnection` | GET `/api/HttpTriggerGetWebPubSubConnection` | `getSignalRConnectionInfo()` |

---

## Common Issues & Solutions

### Issue 1: CORS Error

**Error**: `Access to fetch has been blocked by CORS policy`

**Solution**:
1. Ensure Storage Account CORS is configured (see `AZURE_PORTAL_SETUP.md`)
2. For local development, Functions automatically handle CORS
3. For production, configure CORS in Function App:

```bash
az functionapp cors add \
  --name task-drive-functions \
  --resource-group task-drive-rg \
  --allowed-origins https://your-frontend-domain.com
```

### Issue 2: 404 Not Found

**Error**: `Azure API Error (404): Not Found`

**Possible causes**:
1. Functions not deployed yet → Deploy using `func azure functionapp publish`
2. Wrong base URL → Check `NEXT_PUBLIC_AZURE_FUNCTION_URL`
3. Wrong endpoint path → Verify routes match

### Issue 3: 401 Unauthorized

**Error**: `Azure API Error (401): Unauthorized`

**Note**: Currently, functions are set to `authLevel: 'function'` which means they require a function key OR are accessible if authentication is disabled.

For testing, you can:
1. Get function key from Azure Portal
2. Add to URL: `?code=<function-key>`
3. Or temporarily set `authLevel: 'anonymous'` in function code (dev only!)

### Issue 4: Storage Upload Fails

**Error**: Upload to blob storage fails

**Solution**:
1. Verify storage account key is correct
2. Check container name matches ("transcripts")
3. Ensure CORS is configured on storage account
4. Check SAS URL is not expired

---

## Testing Checklist

### Frontend Tests

- [ ] Authentication works (Microsoft Entra login)
- [ ] User profile loads after login
- [ ] File upload initiates successfully
- [ ] SAS URL is generated
- [ ] File uploads to blob storage
- [ ] Session is created in Cosmos DB
- [ ] Real-time updates appear (polling)
- [ ] Processing status updates
- [ ] Generated files can be downloaded
- [ ] File cleanup works

### Integration Tests

- [ ] Frontend → GetUploadSasUrl → Success
- [ ] Frontend → Upload to Blob → BlobTrigger fires
- [ ] Frontend → Create Session → Session in DB
- [ ] Frontend → Get Session → Session data returned
- [ ] Frontend → Update Session → Session updated
- [ ] Frontend → Get Audio URL → SAS token returned
- [ ] Frontend → Delete Files → Files removed

---

## Development Workflow

### 1. Local Development (Backend + Frontend)

```bash
# Terminal 1: Start Azure Functions
cd api
func start

# Terminal 2: Start Next.js
cd ..
npm run dev
```

Frontend URL: `http://localhost:3000`  
Backend URL: `http://localhost:7071`

Update `.env.local`:
```env
NEXT_PUBLIC_AZURE_FUNCTION_URL=http://localhost:7071
```

### 2. Frontend Only (Use Deployed Backend)

```bash
npm run dev
```

Update `.env.local`:
```env
NEXT_PUBLIC_AZURE_FUNCTION_URL=https://task-drive-functions.azurewebsites.net
```

### 3. Production

```bash
npm run build
npm start
```

---

## Next Steps

1. ✅ **Fixed**: API endpoints now match backend
2. ✅ **Fixed**: Helper functions added
3. ✅ **Fixed**: azureApi.ts uses correct HTTP methods
4. ⏭️ **Todo**: Create `.env.local` with your Azure credentials
5. ⏭️ **Todo**: Test file upload flow
6. ⏭️ **Todo**: Test session management
7. ⏭️ **Todo**: Test real-time updates with Web PubSub
8. ⏭️ **Todo**: Implement authentication token passing (optional for now)

---

## Summary

All frontend integration issues have been fixed:

✅ **azure-config.ts**: 
- Correct API endpoints
- Helper functions added
- Web PubSub connection fixed

✅ **azureApi.ts**: 
- Correct HTTP methods
- Proper URL construction
- All functions updated

✅ **Ready for testing**: Just add your `.env.local` and test!

---

**Status**: ✅ Frontend is now properly integrated with the Azure backend!

**Next**: Follow the testing checklist to verify everything works end-to-end.

