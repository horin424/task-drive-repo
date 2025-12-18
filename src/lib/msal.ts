// src/lib/msal.ts
import {
  PublicClientApplication,
  EventType,
  type AccountInfo,
} from "@azure/msal-browser";
import { azureConfig, msalConfig } from "@/azure-config";

export const msalInstance = new PublicClientApplication(msalConfig);

// Initialize and handle redirect response with minimal logging to avoid PII exposure
msalInstance
  .initialize()
  .then(() => msalInstance.handleRedirectPromise())
  .then((response) => {
    if (response?.account) {
      msalInstance.setActiveAccount(response.account);
      return;
    }
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      msalInstance.setActiveAccount(accounts[0]);
    }
  })
  .catch((error) => {
    console.error("MSAL initialization error:", error);
  });

// Set the active account after a successful login without logging sensitive data
msalInstance.addEventCallback((event) => {
  if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
    const account = event.payload as AccountInfo;
    msalInstance.setActiveAccount(account);
  }
});

// This object is for the user logout flow
export const logoutRequest = {
  postLogoutRedirectUri: azureConfig.auth.postLogoutRedirectUri,
};
