# Azure Authentication Migration Guide

This document outlines the changes made to migrate from AWS Cognito to Microsoft Entra External ID authentication.

## Changes Made

### 1. Updated Main App Component (`src/app/page.tsx`)
- **Removed**: AWS Amplify imports and configuration
- **Added**: MSAL (Microsoft Authentication Library) provider
- **Changed**: Authentication flow to use Microsoft Entra External ID
- **Added**: Login screen for unauthenticated users

### 2. Created New Authentication Hook (`src/hooks/useMsalAuth.ts`)
- **Replaces**: `useAuthInit.ts` (AWS Amplify based)
- **Features**:
  - Microsoft Entra External ID authentication
  - Token acquisition and management
  - User data conversion from MSAL to internal format
  - Login/logout functionality
  - Organization and user data fetching

### 3. Updated Azure Configuration (`src/azure-config.ts`)
- **Changed**: From Azure AD B2C to Microsoft Entra External ID
- **Updated**: Authority URL format to use `ciamlogin.com`
- **Added**: API scopes for backend authentication
- **Configured**: Proper redirect URIs and logout URIs

### 4. Updated App Header (`src/components/AppHeader.tsx`)
- **Removed**: AWS Amplify signOut prop dependency
- **Added**: MSAL logout functionality
- **Simplified**: Component interface

### 5. Updated Session Store (`src/stores/sessionStore.ts`)
- **Changed**: User type from AWS Amplify `AuthUser` to custom `MsalUser`
- **Maintained**: All existing functionality and state management

### 6. Created Azure API Client (`src/lib/azureApi.ts`)
- **Replaces**: AWS Amplify GraphQL client
- **Features**:
  - Authenticated HTTP requests using Microsoft tokens
  - All existing API functions (user, organization, session management)
  - Error handling and token management

### 7. Updated API Module (`src/lib/api.ts`)
- **Simplified**: To re-export Azure API functions
- **Maintained**: Backward compatibility with existing code

## Environment Variables Required

Create a `.env.local` file with the following variables:

```env
# Microsoft Entra External ID Configuration
NEXT_PUBLIC_FRONTEND_CLIENT_ID=your-frontend-client-id
NEXT_PUBLIC_API_CLIENT_ID=your-api-client-id
NEXT_PUBLIC_TENANT=your-tenant-name
NEXT_PUBLIC_USER_FLOW=B2C_1_signupsignin
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000
NEXT_PUBLIC_POST_LOGOUT_URI=http://localhost:3000

# Azure Functions Configuration
NEXT_PUBLIC_AZURE_FUNCTION_URL=http://localhost:7071

# Azure Storage Configuration
NEXT_PUBLIC_AZURE_STORAGE_ACCOUNT=your-storage-account
NEXT_PUBLIC_AZURE_STORAGE_KEY=your-storage-key

# Application Configuration
NEXT_PUBLIC_MAINTENANCE_MODE=false
NEXT_PUBLIC_MAINTENANCE_MESSAGE=ただいまシステムメンテナンス中です。ご不便をおかけして申し訳ありません。
```

## Required Dependencies

Add these packages to your `package.json`:

```bash
npm install @azure/msal-browser @azure/msal-react
```

Remove these AWS Amplify packages:

```bash
npm uninstall aws-amplify @aws-amplify/ui-react
```

## Azure Setup Required

### 1. Microsoft Entra External ID Tenant
- Register frontend SPA application
- Register backend API application
- Create user flows (sign-up/sign-in, password reset, profile edit)
- Configure API permissions and scopes

### 2. Azure Functions
- Deploy backend API endpoints
- Configure authentication middleware
- Set up environment variables

### 3. Azure Blob Storage
- Create storage account and containers
- Configure SAS token generation
- Set up proper permissions

## Migration Benefits

1. **Native Azure Integration**: Better integration with Azure services
2. **Enhanced Security**: Microsoft Entra External ID provides enterprise-grade security
3. **Simplified Architecture**: Removes dependency on AWS services
4. **Cost Optimization**: Potential cost savings with Azure-native services
5. **Compliance**: Better compliance with Microsoft ecosystem requirements

## Next Steps

1. Set up Microsoft Entra External ID tenant and applications
2. Deploy Azure Functions backend
3. Configure Azure Blob Storage
4. Test authentication flow
5. Deploy to production environment

## Testing

1. Start the development server: `npm run dev`
2. Navigate to the application
3. Click the login button
4. Complete the Microsoft authentication flow
5. Verify user data and organization information loads correctly
6. Test logout functionality

## Troubleshooting

- **Login Issues**: Check environment variables and tenant configuration
- **Token Errors**: Verify API permissions and scopes
- **API Errors**: Ensure Azure Functions are deployed and accessible
- **Storage Issues**: Check Azure Blob Storage configuration and permissions
