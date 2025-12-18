import {
  createProcessingSession,
  updateProcessingSession,
  getAudioPresignedUrl,
} from "./azureApi";

// Re-export Azure API functions for compatibility
export {
  getUserBySub,
  createCustomUser,
  getOrganizationById,
  createProcessingSession,
  updateProcessingSession,
  getAudioPresignedUrl,
  deleteGeneratedFiles,
} from "./azureApi";

// Legacy compatibility functions
export const createSession = createProcessingSession;
export const updateSession = updateProcessingSession;
export const getAudioUrl = getAudioPresignedUrl;

// Minimal client stub to avoid breaking imports like `client.graphql`
export const client = {
  graphql: () => ({
    subscribe: () => ({ unsubscribe: () => {} }),
  }),
};
