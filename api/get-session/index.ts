import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest, AuthorizationError } from '../shared/auth';
import { fetchSessionOrThrow, ensureValidSessionId, assertSessionAccess } from '../shared/sessionUtils';

export async function getSession(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('HTTP trigger function processed get-session request.');

  try {
    // Get session ID from query or route params
    const auth = await authenticateRequest(request);
    const sessionId = ensureValidSessionId(
      request.query.get('sessionId') || request.params.sessionId || ''
    );

    const session = await fetchSessionOrThrow(sessionId);
    await assertSessionAccess(session, auth);

    return {
      status: 200,
      jsonBody: session,
    };
  } catch (error: any) {
    const status =
      error instanceof AuthorizationError ? error.status : 500;
    context.error('Error fetching session:', error);
    return {
      status,
      jsonBody: { error: error.message || 'Internal server error' },
    };
  }
}

app.http('get-session', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'sessions/{sessionId?}',
  handler: getSession,
});
