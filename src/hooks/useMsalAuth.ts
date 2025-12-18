import { useEffect } from "react";
import { useMsal, useAccount } from "@azure/msal-react";
import { loginRequest } from "@/azure-config";
import { useSessionStore } from "@/stores/sessionStore";
import { InteractionStatus, type AccountInfo } from "@azure/msal-browser";

// Microsoft user type
interface MsalUser {
  userId: string;
  username: string;
  email?: string;
  roles?: string[];
  oid?: string;
}

const extractRoles = (claims?: AccountInfo["idTokenClaims"]): string[] => {
  if (!claims) {
    return [];
  }
  if (Array.isArray(claims.roles)) {
    return claims.roles as string[];
  }
  return [];
};

export const useMsalAuth = () => {
  const { instance, accounts, inProgress } = useMsal();
  const account = useAccount(accounts[0]);
  const { setUser, setIsInitialized } = useSessionStore();

  const convertMsalAccountToUser = (
    msalAccount?: AccountInfo | null
  ): MsalUser | null => {
    if (!msalAccount) return null;

    const claims = msalAccount.idTokenClaims as Record<string, unknown> | undefined;
    const oidClaim =
      typeof claims?.oid === "string" ? (claims.oid as string) : undefined;

    return {
      userId: msalAccount.localAccountId || msalAccount.homeAccountId,
      username: msalAccount.username || msalAccount.name || "Unknown User",
      email: msalAccount.username,
      roles: extractRoles(msalAccount.idTokenClaims),
      oid: oidClaim,
    };
  };

  const login = async () => {
    if (inProgress !== InteractionStatus.None) {
      return;
    }
    try {
      await instance.loginRedirect(loginRequest);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const logout = async () => {
    if (inProgress !== InteractionStatus.None) {
      return;
    }
    try {
      if (account) {
        await instance.logoutRedirect({ account });
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  useEffect(() => {
    if (inProgress === InteractionStatus.None) {
      const msalUser = convertMsalAccountToUser(account);
      setUser(msalUser);
      setIsInitialized(true);
    }
  }, [account, inProgress, setUser, setIsInitialized]);

  const isLoading = inProgress !== InteractionStatus.None;
  const isAuthenticated = !!account && !isLoading;

  return {
    login,
    logout,
    isLoading,
    isAuthenticated,
    user: account ? convertMsalAccountToUser(account) : null,
  };
};
