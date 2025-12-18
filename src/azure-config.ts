import type { BrowserCacheLocation, LogLevel } from "@azure/msal-browser";

const rawTenant = process.env.NEXT_PUBLIC_TENANT?.trim();
const userFlow = process.env.NEXT_PUBLIC_USER_FLOW?.trim();
const explicitAuthority = process.env.NEXT_PUBLIC_AUTHORITY?.trim();
const tenantNameWithoutDomain = rawTenant
  ? rawTenant.replace(/\.onmicrosoft\.com$/i, "")
  : undefined;
const tenantDomainForB2C = tenantNameWithoutDomain
  ? `${tenantNameWithoutDomain}.onmicrosoft.com`
  : undefined;
const derivedB2CHost =
  process.env.NEXT_PUBLIC_B2C_DOMAIN?.trim() ||
  (tenantNameWithoutDomain
    ? `${tenantNameWithoutDomain}.b2clogin.com`
    : undefined);
const b2cAuthority =
  userFlow && tenantDomainForB2C && derivedB2CHost
    ? `https://${derivedB2CHost}/${tenantDomainForB2C}/${userFlow}`
    : undefined;

const resolvedAuthority =
  explicitAuthority ||
  b2cAuthority ||
  (rawTenant
    ? `https://login.microsoftonline.com/${rawTenant}`
    : "https://login.microsoftonline.com/common");

const configuredKnownAuthorities = (() => {
  const fromEnv =
    process.env.NEXT_PUBLIC_KNOWN_AUTHORITIES?.split(",")
      .map((host) => host.trim())
      .filter(Boolean) ?? [];
  if (fromEnv.length > 0) return fromEnv;
  if (b2cAuthority && derivedB2CHost) return [derivedB2CHost];
  return undefined;
})();

const redirectUri =
  process.env.NEXT_PUBLIC_REDIRECT_URI?.trim() || "http://localhost:3000";
const postLogoutRedirectUri =
  process.env.NEXT_PUBLIC_POST_LOGOUT_URI?.trim() || "http://localhost:3000";

const baseScopes = ["openid", "profile", "email", "offline_access"];
const apiScope = process.env.NEXT_PUBLIC_API_CLIENT_ID
  ? `api://${process.env.NEXT_PUBLIC_API_CLIENT_ID}/access_as_user`
  : undefined;
const defaultMsalScopes = Array.from(
  new Set(apiScope ? [...baseScopes, apiScope] : baseScopes)
);

const cacheLocation =
  (process.env.NEXT_PUBLIC_MSAL_CACHE_LOCATION as BrowserCacheLocation) ||
  "sessionStorage";
const storeAuthStateInCookie =
  process.env.NEXT_PUBLIC_MSAL_STORE_AUTH_STATE_IN_COOKIE === "true";
const enableMsalVerboseLogging =
  process.env.NEXT_PUBLIC_MSAL_ENABLE_VERBOSE_LOGGING === "true";

// Azure Configuration - replaces aws-exports
export const azureConfig = {
  // Microsoft Entra (Azure AD) Configuration
  auth: {
    clientId: process.env.NEXT_PUBLIC_FRONTEND_CLIENT_ID || "",
    authority: resolvedAuthority,
    knownAuthorities: configuredKnownAuthorities,
    redirectUri,
    postLogoutRedirectUri,
  },

  // Azure Storage Configuration
  storage: {
    accountName: process.env.NEXT_PUBLIC_AZURE_STORAGE_ACCOUNT || "",
    accountKey: process.env.NEXT_PUBLIC_AZURE_STORAGE_KEY || "",
    containerName: "transcripts",
    outputContainerName: "outputs",
  },

  // Azure Functions Configuration
  functions: {
    baseUrl:
      process.env.NEXT_PUBLIC_AZURE_FUNCTION_URL || "http://localhost:7071",
    endpoints: {
      // Session endpoints
      createSession: "/api/sessions",
      updateSession: "/api/sessions",
      getSession: "/api/sessions",
      deleteFiles: "/api/sessions/delete-files",
      getAudioUrl: "/api/sessions/audio-url",
      getOutputUrl: "/api/sessions/output-url",
      getOutputUploadSasUrl: "/api/sessions/output-upload-sas",
      processGeneration: "/api/generate/process-all",

      // User endpoints
      createUser: "/api/users",
      getUser: "/api/users",

      // Organization endpoints
      getOrganization: "/api/organizations",

      // Upload endpoint
      getUploadSasUrl: "/api/GetUploadSasUrl",

      // Web PubSub endpoint
      getWebPubSubConnection: "/api/HttpTriggerGetWebPubSubConnection",
    },
  },

  // Azure API Management Configuration
  apiManagement: {
    baseUrl: process.env.NEXT_PUBLIC_AZURE_APIM_URL || "",
    subscriptionKey: process.env.NEXT_PUBLIC_AZURE_APIM_SUBSCRIPTION_KEY || "",
  },

  // Application Configuration
  app: {
    region: process.env.NEXT_PUBLIC_AZURE_LOCATION || "japaneast",
    resourceGroup: process.env.NEXT_PUBLIC_AZURE_RESOURCE_GROUP || "",
    maintenanceMode: process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true",
    maintenanceMessage:
      process.env.NEXT_PUBLIC_MAINTENANCE_MESSAGE ||
      "System maintenance in progress.",
  },
};

// MSAL Configuration
export const msalConfig = {
  auth: {
    ...azureConfig.auth,
  },
  cache: {
    cacheLocation,
    storeAuthStateInCookie,
  },
  system: {
    loggerOptions: {
      loggerCallback: (
        level: LogLevel,
        message: string,
        containsPii: boolean
      ) => {
        if (containsPii) {
          return;
        }
        const isProd = process.env.NODE_ENV === "production";
        const errorLevel = 0;
        const warningLevel = 1;
        const infoLevel = 2;
        const verboseLevel = 3;

        if (level === infoLevel && (!enableMsalVerboseLogging || isProd))
          return;
        if (level === verboseLevel && (!enableMsalVerboseLogging || isProd))
          return;

        if (level === errorLevel) {
          console.error(message);
        } else if (level === warningLevel) {
          console.warn(message);
        } else if (level === infoLevel) {
          console.info(message);
        } else if (level === verboseLevel) {
          console.debug(message);
        }
      },
    },
  },
};

// Login Request Configuration
export const loginRequest = {
  scopes: defaultMsalScopes,
  prompt: "select_account",
};

// Token Request Configuration
export const tokenRequest = {
  scopes: defaultMsalScopes,
  forceRefresh: false,
};

// Helper function to get API base URL
export function getApiBaseUrl(): string {
  return (
    azureConfig.functions.baseUrl || azureConfig.apiManagement.baseUrl || ""
  );
}

// Helper function to get API headers
export function getApiHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  // Add API Management subscription key if available
  if (azureConfig.apiManagement.subscriptionKey) {
    headers["Ocp-Apim-Subscription-Key"] =
      azureConfig.apiManagement.subscriptionKey;
  }

  return headers;
}
