import { getItem, CONTAINERS } from "./cosmosClient";
import type { ProcessingSession, User } from "./models";
import {
  AuthorizationError,
  type AuthenticatedUser,
  userIsAdmin,
} from "./auth";

const SESSION_ID_REGEX = /^[a-zA-Z0-9-]{6,200}$/;

export const ensureValidSessionId = (sessionId: string): string => {
  if (!sessionId || !SESSION_ID_REGEX.test(sessionId)) {
    throw new AuthorizationError("Invalid sessionId supplied", 400);
  }
  return sessionId;
};

export const fetchSessionOrThrow = async (
  sessionId: string
): Promise<ProcessingSession> => {
  const session = await getItem<ProcessingSession>(
    CONTAINERS.SESSIONS,
    sessionId,
    sessionId
  );
  if (!session) {
    throw new AuthorizationError("Session not found", 404);
  }
  return session;
};

export const assertSessionAccess = async (
  session: ProcessingSession,
  auth: AuthenticatedUser
) => {
  if (userIsAdmin(auth) || session.owner === auth.oid) {
    return;
  }

  const user = await getItem<User>(CONTAINERS.USERS, auth.oid, auth.oid);
  if (user?.organizationID && user.organizationID === session.organizationID) {
    return;
  }

  throw new AuthorizationError("Forbidden", 403);
};
