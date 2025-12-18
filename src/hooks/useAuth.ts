import { useMsal } from '@azure/msal-react';
import { loginRequest, tokenRequest } from '../azure-config';
import { useSessionStore } from '../stores/sessionStore';
import { useEffect } from 'react';

export const useAuth = () => {
  const { instance, accounts, inProgress } = useMsal();
  const { setUser, setDbUser, setOrganization, setIsAdmin, setIsInitialized } = useSessionStore();

  // Handle login
  const login = async () => {
    try {
      await instance.loginPopup(loginRequest);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  // Handle logout
  const logout = async () => {
    try {
      await instance.logoutPopup();
      setUser(null);
      setDbUser(null);
      setOrganization(null);
      setIsAdmin(false);
      setIsInitialized(false);
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  };

  // Get access token
  const getAccessToken = async () => {
    if (accounts.length === 0) {
      throw new Error('No accounts found');
    }

    try {
      const response = await instance.acquireTokenSilent({
        ...tokenRequest,
        account: accounts[0]
      });
      return response.accessToken;
    } catch (error) {
      console.error('Token acquisition failed:', error);
      throw error;
    }
  };

  // Update user in store when accounts change
  useEffect(() => {
    if (accounts.length > 0) {
      const account = accounts[0];
      setUser({
        userId: account.localAccountId,
        username: account.username,
        email: account.username, // MSAL uses username for email
      });
    } else {
      setUser(null);
    }
  }, [accounts, setUser]);

  return {
    login,
    logout,
    getAccessToken,
    accounts,
    inProgress,
    isAuthenticated: accounts.length > 0,
    user: accounts.length > 0 ? accounts[0] : null,
  };
};
