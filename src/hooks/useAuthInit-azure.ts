import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import type { AccountInfo, IdTokenClaims } from '@azure/msal-browser';
import { useSessionStore } from '@/stores/sessionStore';
import { 
  getUserByIdAzure, 
  getOrganizationByIdAzure, 
  createCustomUserAzure 
} from '@/lib/api-azure';
import { getErrorMessage } from '@/utils/errorHandler';
import type { UserAzure } from '@/types/types-azure';

/**
 * Azure version of useAuthInit hook
 * Fetches user and organization data after MSAL authentication
 * This is the Azure equivalent of useAuthInit.ts (AWS Cognito)
 */
export const useAuthInitAzure = () => {
  const { accounts } = useMsal();
  const { 
    setOrganization, 
    setDbUser, 
    setIsAdmin, 
    setIsInitialized, 
    isInitialized 
  } = useSessionStore();

  const fetchInitialData = async (): Promise<boolean | null> => {
    // Check if we have an authenticated MSAL account
    if (!accounts || accounts.length === 0) {
      return null;
    }

    const account: AccountInfo = accounts[0];

    try {
      // Extract user information from MSAL account
      const idTokenClaims = account.idTokenClaims as IdTokenClaims | undefined;
      const azureAdObjectId =
        (idTokenClaims?.oid as string | undefined) ||
        account.localAccountId ||
        account.homeAccountId;
      if (!azureAdObjectId) {
        throw new Error('Azure AD object identifier is missing.');
      }
      const username = account.username;
      const email = account.username; // In MSAL, username is typically the email

      // Check for admin role from token claims
      const roles = Array.isArray(idTokenClaims?.roles)
        ? (idTokenClaims.roles as string[])
        : [];
      const isAdmin = roles.some(
        (role) => role && role.toLowerCase() === 'admin'
      );
      setIsAdmin(isAdmin);

      // Try to get user from Azure backend
      let userRecord: UserAzure | null = null;
      try {
        userRecord = await getUserByIdAzure(azureAdObjectId);
      } catch (error) {
        if (error instanceof Error && error.message?.includes('404')) {
          userRecord = null;
        } else {
          throw error;
        }
      }

      // If user doesn't exist, create a new user record
      if (!userRecord) {
        console.log('User not found in database, creating new user record...');
        userRecord = await createCustomUserAzure({
          username: username || email || 'Unknown User',
          email: email || '',
          azureAdObjectId: azureAdObjectId,
          isAdmin: isAdmin,
        });
      }

      if (!userRecord) {
        throw new Error('Failed to get or create user record in database.');
      }

      // Set user in store
      setDbUser({ id: userRecord.id });

      // Fetch organization if user belongs to one
      if (userRecord.organizationID) {
        const organization = await getOrganizationByIdAzure(userRecord.organizationID);
        
        if (organization) {
          setOrganization({
            id: organization.id,
            name: organization.name,
            remainingMinutes: organization.remainingMinutes,
            remainingTaskGenerations: organization.remainingTaskGenerations ?? 100,
            monthlyMinutes: organization.monthlyMinutes ?? 6000,
            monthlyTaskGenerations: organization.monthlyTaskGenerations ?? 100,
          });
        } else {
          console.warn('Organization not found for user');
          setOrganization(null);
        }
      } else {
        console.log('User is not associated with any organization');
        setOrganization(null);
      }

      return true;
    } catch (error) {
      console.error('Error during Azure auth initialization:', getErrorMessage(error));
      setOrganization(null);
      setDbUser(null);
      setIsAdmin(false);
      throw error;
    }
  };

  // Create a stable user identifier for the query key
  const userIdentifier = accounts?.[0]?.localAccountId || null;

  const { isSuccess, isError, isLoading, error } = useQuery({
    queryKey: ['azureAuthInit', userIdentifier],
    queryFn: fetchInitialData,
    enabled: !!userIdentifier, // Only run when we have an authenticated user
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  // Set initialization flag when query completes
  useEffect(() => {
    if (isSuccess || isError) {
      setIsInitialized(true);
    }
  }, [isSuccess, isError, setIsInitialized]);

  return { 
    isLoading: isLoading && !isInitialized, 
    isError,
    error,
  };
};

