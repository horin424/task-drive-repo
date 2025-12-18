import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { patchItem, CONTAINERS } from '../shared/cosmosClient';
import type { PatchOperation } from '@azure/cosmos';
import { sendSessionUpdate } from '../shared/webPubSubClient';
import { authenticateRequest, AuthorizationError } from '../shared/auth';
import { fetchSessionOrThrow, assertSessionAccess, ensureValidSessionId } from '../shared/sessionUtils';

export async function updateSession(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('HTTP trigger function processed update-session request.');

  try {
    const auth = await authenticateRequest(request);
    const body = (await request.json()) as Record<string, unknown>;
    const rawSessionId =
      typeof body.sessionId === 'string' ? body.sessionId : '';
    const sessionId = ensureValidSessionId(rawSessionId);
    const updatesValue = body.updates;

    if (!updatesValue || typeof updatesValue !== 'object') {
      throw new AuthorizationError('updates object is required', 400);
    }
    const updates = updatesValue as Record<string, unknown>;

    const session = await fetchSessionOrThrow(sessionId);
    await assertSessionAccess(session, auth);

    const allowedKeys = new Set([
      'status',
      'transcriptKey',
      'bulletPointsKey',
      'minutesKey',
      'tasksKey',
      'taskFileKey',
      'informationFileKey',
      'processingTypes',
      'speakerMap',
      'audioLengthSeconds',
      'errorMessage',
      'transcriptFormat',
      'filesDeletionTime',
    ]);

    const operations: PatchOperation[] = [];
    for (const [key, value] of Object.entries(updates)) {
      if (!allowedKeys.has(key)) {
        context.warn(`Ignoring unsupported update key "${key}"`);
        continue;
      }
      operations.push({
        op: 'set',
        path: `/${key}`,
        value,
      });
    }

    if (operations.length === 0) {
      return {
        status: 200,
        jsonBody: session,
      };
    }

    operations.push({
      op: 'set',
      path: '/updatedAt',
      value: new Date().toISOString(),
    });

    const updatedSession = await patchItem(
      CONTAINERS.SESSIONS,
      sessionId,
      sessionId,
      operations
    );

    // Send real-time update via Web PubSub
    const statusValue = updates['status'] as string | undefined;
    if (typeof statusValue !== 'undefined') {
      await sendSessionUpdate(sessionId, statusValue, updatedSession).catch((err) =>
        context.warn('Failed to send Web PubSub update:', err)
      );
    }

    return {
      status: 200,
      jsonBody: updatedSession,
    };
  } catch (error: any) {
    const status =
      error instanceof AuthorizationError
        ? error.status
        : error.code === 404
        ? 404
        : 500;
    context.error('Error updating session:', error);

    return {
      status,
      jsonBody: { error: error.message || 'Internal server error' },
    };
  }
}

app.http('update-session', {
  methods: ['PUT', 'PATCH'],
  authLevel: 'anonymous',
  route: 'sessions',
  handler: updateSession,
});
