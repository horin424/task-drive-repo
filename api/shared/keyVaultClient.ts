import { SecretClient } from "@azure/keyvault-secrets";
import {
  DefaultAzureCredential,
  ManagedIdentityCredential,
} from "@azure/identity";

const keyVaultName = process.env.KEY_VAULT_NAME || "";
const keyVaultUrl = keyVaultName
  ? `https://${keyVaultName}.vault.azure.net`
  : "";

let secretClient: SecretClient | null = null;
const secretCache: Map<string, { value: string; expiry: number }> = new Map();

// MAPPING: Connects secret names to your local.settings.json
const ENV_VAR_MAPPING: Record<string, string> = {
  AzureOpenAIKey: "AZURE_OPENAI_API_KEY",
  AzureOpenAIEndpoint: "AZURE_OPENAI_ENDPOINT",
  DifyApiKey: "DIFY_API_KEY",
  DifyWorkflowUrl: "DIFY_WORKFLOW_URL",
  CosmosDBKey: "COSMOS_DB_KEY",
  WebPubSubConnectionString: "WEB_PUBSUB_CONNECTION_STRING",
};

export const getSecretClient = (): SecretClient => {
  // In local dev, we might not have Key Vault, so we return a dummy or fallback
  if (!secretClient && keyVaultUrl) {
    const credential =
      process.env.AZURE_FUNCTIONS_ENVIRONMENT === "Production"
        ? new ManagedIdentityCredential()
        : new DefaultAzureCredential();
    secretClient = new SecretClient(keyVaultUrl, credential);
  }
  return secretClient as SecretClient;
};

export const getSecret = async (secretName: string): Promise<string> => {
  // 1. Try Environment Variables FIRST (Critical for Local Dev)
  if (process.env[secretName]) return process.env[secretName]!;

  const mappedName = ENV_VAR_MAPPING[secretName];
  if (mappedName && process.env[mappedName]) return process.env[mappedName]!;

  // 2. If not in Env, try Cache or Key Vault (if configured)
  try {
    if (!keyVaultUrl) throw new Error("Key Vault not configured locally");
    const client = getSecretClient();
    const secret = await client.getSecret(secretName);
    return secret.value || "";
  } catch (error) {
    throw new Error(
      `Secret '${secretName}' not found. Check local.settings.json.`
    );
  }
};

export const getSecrets = async (
  secretNames: string[]
): Promise<Record<string, string>> => {
  const secrets: Record<string, string> = {};
  await Promise.all(
    secretNames.map(async (name) => {
      secrets[name] = await getSecret(name);
    })
  );
  return secrets;
};

export const clearSecretCache = (): void => {
  secretCache.clear();
};

export const SECRET_NAMES = {
  AZURE_OPENAI_KEY: "AzureOpenAIKey",
  AZURE_OPENAI_ENDPOINT: "AzureOpenAIEndpoint",
  DIFY_API_KEY: "DifyApiKey",
  DIFY_WORKFLOW_URL: "DifyWorkflowUrl",
  COSMOS_DB_KEY: "CosmosDBKey",
  STORAGE_ACCOUNT_KEY: "StorageAccountKey",
  WEB_PUBSUB_CONNECTION_STRING: "WebPubSubConnectionString",
};

export const getAzureOpenAICredentials = async (): Promise<{
  endpoint: string;
  key: string;
}> => {
  const [endpoint, key] = await Promise.all([
    getSecret(SECRET_NAMES.AZURE_OPENAI_ENDPOINT),
    getSecret(SECRET_NAMES.AZURE_OPENAI_KEY),
  ]);
  return { endpoint, key };
};

export const getDifyCredentials = async (): Promise<{
  apiKey: string;
  workflowUrl: string;
}> => {
  const [apiKey, workflowUrl] = await Promise.all([
    getSecret(SECRET_NAMES.DIFY_API_KEY),
    getSecret(SECRET_NAMES.DIFY_WORKFLOW_URL),
  ]);
  return { apiKey, workflowUrl };
};
