// src/lib/azureApi.ts
import { azureConfig, tokenRequest } from "@/azure-config";
import { msalInstance } from "@/lib/msal";
import {
  InteractionRequiredAuthError,
  type AccountInfo,
  type SilentRequest,
} from "@azure/msal-browser";
import type {
  CreateProcessingSessionInputAzure,
  UpdateProcessingSessionInputAzure,
  ProcessingSessionAzure,
  UserAzure,
  OrganizationAzure,
  CreateUserInputAzure,
} from "@/types/types-azure";

const isBrowser = typeof window !== "undefined";

function buildUrl(path: string): string {
  // If caller passed an absolute URL, honor it as-is
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  let base =
    azureConfig.functions.baseUrl || azureConfig.apiManagement.baseUrl || "";
  if (!base) {
    throw new Error(
      "Azure Functions base URL is not configured. Set NEXT_PUBLIC_AZURE_FUNCTION_URL."
    );
  }
  // Avoid double /api in case base already includes it
  if (base.match(/\/api\/?$/) && path.startsWith("/api")) {
    base = base.replace(/\/api\/?$/, "");
  }
  const normalizedBase = base.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

const getActiveAccount = (): AccountInfo | null => {
  if (!isBrowser) {
    return null;
  }
  return (
    msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0] || null
  );
};

const logoutOnAuthFailure = () => {
  if (!isBrowser) {
    return;
  }
  const account = getActiveAccount();
  if (account) {
    msalInstance.logoutRedirect({ account }).catch((error) => {
      console.error("Failed to logout after auth failure:", error);
    });
  }
};

const acquireAccessToken = async (
  forceRefresh = false
): Promise<string | null> => {
  if (!isBrowser) {
    throw new Error("Access tokens can only be acquired in the browser.");
  }
  const account = getActiveAccount();
  if (!account) {
    throw new Error("No active account. Please sign in again.");
  }
  const silentRequest: SilentRequest = {
    ...tokenRequest,
    account,
    forceRefresh: forceRefresh || tokenRequest.forceRefresh,
  };
  try {
    const result = await msalInstance.acquireTokenSilent(silentRequest);
    return result.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      await msalInstance.acquireTokenRedirect({
        ...tokenRequest,
        account,
        prompt: "select_account",
      });
      throw new Error("User interaction required to obtain an access token.");
    }
    throw error;
  }
};

const buildHeaders = async (
  init?: RequestInit,
  forceRefresh?: boolean
): Promise<Headers> => {
  const headers = new Headers(init?.headers);
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;

  if (!isFormData && init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (azureConfig.apiManagement.subscriptionKey) {
    headers.set(
      "Ocp-Apim-Subscription-Key",
      azureConfig.apiManagement.subscriptionKey
    );
  }

  const token = await acquireAccessToken(forceRefresh);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return headers;
};

export async function callAzureApi<T = unknown>(
  path: string,
  init?: RequestInit,
  attempt = 0
): Promise<T> {
  const headers = await buildHeaders(init, attempt > 0);
  const method = init?.method || "POST";

  const response = await fetch(buildUrl(path), {
    ...init,
    method,
    headers,
  });

  if (response.status === 401 || response.status === 403) {
    if (attempt === 0) {
      return callAzureApi<T>(path, init, attempt + 1);
    }
    logoutOnAuthFailure();
    const text = await response.text().catch(() => "");
    throw new Error(`Azure API unauthorized ${response.status}: ${text}`);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Azure API error ${response.status}: ${text}`);
  }
  const ct = response.headers.get("content-type") || "";
  return (
    ct.includes("application/json") ? response.json() : response.text()
  ) as Promise<T>;
}

interface UploadSasUrlResponse {
  sasUrl: string;
  blobName: string;
  expiresOn?: string;
}

export interface UploadSasUrlRequest {
  sessionId: string;
  fileName: string;
  contentType?: string;
}

export const getUploadSasUrl = async (
  payload: UploadSasUrlRequest
): Promise<UploadSasUrlResponse> => {
  const targets = buildEndpointVariants(
    azureConfig.functions.endpoints.getUploadSasUrl
  );

  for (const target of targets) {
    try {
      return await callAzureApi<UploadSasUrlResponse>(target, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;
      if (!message.includes("404")) {
        throw error;
      }
      // continue to next variant on 404
    }
  }

  // Final fallback to GET with query params using the first variant
  const first = targets[0] || azureConfig.functions.endpoints.getUploadSasUrl;
  const pathWithParams = `${first}?sessionId=${encodeURIComponent(
    payload.sessionId
  )}&fileName=${encodeURIComponent(payload.fileName)}`;

  try {
    return await callAzureApi<UploadSasUrlResponse>(pathWithParams, {
      method: "GET",
    });
  } catch {
    // Last-resort: unauthenticated GET (for local dev CORS/mixed-content issues)
    const url = buildUrl(pathWithParams);
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Azure API error ${res.status}: ${text}`);
    }
    return (await res.json()) as UploadSasUrlResponse;
  }
};

export interface OutputUploadSasUrlRequest {
  sessionId: string;
  purpose?: "transcript" | "tasks" | "information" | "custom";
  fileName?: string;
  blobName?: string;
}

export const getOutputUploadSasUrl = async (
  payload: OutputUploadSasUrlRequest
): Promise<UploadSasUrlResponse> => {
  const targets = buildEndpointVariants(
    azureConfig.functions.endpoints.getOutputUploadSasUrl
  );

  for (const target of targets) {
    try {
      return await callAzureApi<UploadSasUrlResponse>(target, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;
      if (!message.includes("404")) {
        throw error;
      }
    }
  }

  const first =
    targets[0] || azureConfig.functions.endpoints.getOutputUploadSasUrl;
  const query = new URLSearchParams({
    sessionId: payload.sessionId,
  });
  if (payload.purpose) query.set("purpose", payload.purpose);
  if (payload.fileName) query.set("fileName", payload.fileName);
  if (payload.blobName) query.set("blobName", payload.blobName);

  const pathWithParams = `${first}?${query.toString()}`;

  try {
    return await callAzureApi<UploadSasUrlResponse>(pathWithParams, {
      method: "GET",
    });
  } catch {
    const url = buildUrl(pathWithParams);
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Azure API error ${res.status}: ${text}`);
    }
    return (await res.json()) as UploadSasUrlResponse;
  }
};

function buildEndpointVariants(endpoint: string): string[] {
  const variants = new Set<string>();
  const normalized = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  variants.add(normalized);
  if (normalized.startsWith("/api/")) {
    variants.add(normalized.replace(/^\/api/, ""));
  } else {
    variants.add(`/api${normalized}`);
  }
  return Array.from(variants);
}

// All API functions will now work with proper bearer tokens
export async function getUserBySub(sub: string): Promise<UserAzure[]> {
  const path = `${
    azureConfig.functions.endpoints.getUser
  }?sub=${encodeURIComponent(sub)}`;
  const data = await callAzureApi<UserAzure | UserAzure[]>(path, {
    method: "GET",
  });
  if (!data) {
    return [];
  }
  return Array.isArray(data) ? data : [data];
}

export async function getUserByIdAzure(
  userId: string
): Promise<UserAzure | null> {
  const path = `${azureConfig.functions.endpoints.getUser}/${userId}`;
  return callAzureApi<UserAzure | null>(path, { method: "GET" });
}

export async function createCustomUserAzure(
  input: CreateUserInputAzure
): Promise<UserAzure> {
  return callAzureApi<UserAzure>(azureConfig.functions.endpoints.createUser, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

type LegacyCreateUserInput = Omit<CreateUserInputAzure, "azureAdObjectId"> & {
  azureAdObjectId?: string;
  cognitoSub?: string;
};

export async function getOrganizationByIdAzure(
  id: string
): Promise<OrganizationAzure | null> {
  const path = `${azureConfig.functions.endpoints.getOrganization}/${id}`;
  return callAzureApi<OrganizationAzure | null>(path, { method: "GET" });
}

export async function createCustomUser(
  input: LegacyCreateUserInput
): Promise<UserAzure> {
  const payload: CreateUserInputAzure = {
    username: input.username,
    email: input.email,
    organizationID: input.organizationID,
    isAdmin: input.isAdmin,
    azureAdObjectId:
      input.azureAdObjectId ??
      input.cognitoSub ??
      `legacy-${input.username}`,
  };
  return createCustomUserAzure(payload);
}

export async function getOrganizationById(
  id: string
): Promise<OrganizationAzure | null> {
  return getOrganizationByIdAzure(id);
}

// Sessions
export async function createProcessingSession(
  input: CreateProcessingSessionInputAzure
): Promise<ProcessingSessionAzure> {
  return callAzureApi<ProcessingSessionAzure>(
    azureConfig.functions.endpoints.createSession,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export async function updateProcessingSession(
  sessionId: string,
  updates: Partial<UpdateProcessingSessionInputAzure>
): Promise<ProcessingSessionAzure> {
  return callAzureApi<ProcessingSessionAzure>(
    azureConfig.functions.endpoints.updateSession,
    {
      method: "PUT",
      body: JSON.stringify({ sessionId, updates }),
    }
  );
}

export async function getProcessingSession(
  sessionId: string
): Promise<ProcessingSessionAzure> {
  const path = `${azureConfig.functions.endpoints.getSession}/${sessionId}`;
  return callAzureApi<ProcessingSessionAzure>(path, { method: "GET" });
}

// Files
export interface AudioUrlOptions {
  blobKey?: string;
}

export async function getAudioPresignedUrl(
  sessionId: string,
  options?: AudioUrlOptions
): Promise<string> {
  const query = new URLSearchParams({ sessionId });
  if (options?.blobKey) {
    query.set("blobKey", options.blobKey);
  }
  const path = `${azureConfig.functions.endpoints.getAudioUrl}?${query.toString()}`;
  const response = await callAzureApi<{ url: string }>(path, {
    method: "GET",
  });
  return response.url;
}

export async function getOutputPresignedUrl(
  sessionId: string,
  blobKey: string
): Promise<string> {
  const query = new URLSearchParams({ sessionId, blobKey });
  const path = `${azureConfig.functions.endpoints.getOutputUrl}?${query.toString()}`;
  const response = await callAzureApi<{ url: string }>(path, {
    method: "GET",
  });
  return response.url;
}

export async function deleteGeneratedFiles(sessionId: string): Promise<void> {
  await callAzureApi<void>(azureConfig.functions.endpoints.deleteFiles, {
    method: "DELETE",
    body: JSON.stringify({ sessionId }),
  });
}
