import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { BlobSASPermissions } from '@azure/storage-blob';
import { getContainerClient } from '../shared/storage';
import { authenticateRequest, AuthorizationError } from '../shared/auth';
import { assertSessionAccess, ensureValidSessionId, fetchSessionOrThrow } from '../shared/sessionUtils';
import { randomUUID } from 'crypto';
import { getCorrelationId } from '../shared/correlation';

export async function getAudioUrl(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const correlationId = getCorrelationId(request);
  context.log('HTTP trigger function processed get-audio-url request.', correlationId);

  try {
    const auth = await authenticateRequest(request);
    const sessionId = ensureValidSessionId(
      request.query.get('sessionId') || request.params.sessionId || ''
    );
    const requestedBlobKey = request.query.get('blobKey') || undefined;

    const session = await fetchSessionOrThrow(sessionId);
    await assertSessionAccess(session, auth);

    const expectedPrefix = `private/${session.owner}/${session.sessionId}/`;
    const blobKey = requestedBlobKey || session.inputBlobName;

    if (!blobKey) {
      context.warn('Audio blob not specified or not yet available for session', {
        sessionId,
        correlationId,
      });
      return {
        status: 404,
        jsonBody: { error: 'Audio not available', correlationId },
      };
    }
    if (!blobKey.startsWith(expectedPrefix)) {
      context.warn('Audio blob key does not match expected prefix', {
        sessionId,
        blobKey,
        expectedPrefix,
        correlationId,
      });
      return {
        status: 404,
        jsonBody: { error: 'Blob not found for session', correlationId },
      };
    }

    const containerClient = getContainerClient('transcripts');
    const blobClient = containerClient.getBlockBlobClient(blobKey);

    const exists = await blobClient.exists();
    if (!exists) {
      context.warn('Audio blob not found', { sessionId, blobKey, correlationId });
      return {
        status: 404,
        jsonBody: { error: 'Blob not found', correlationId },
      };
    }

    const permissions = BlobSASPermissions.parse('r');

    const expiresOn = new Date(Date.now() + 10 * 60 * 1000);
    const startsOn = new Date(Date.now() - 60 * 1000);
    const sasUrl = await blobClient.generateSasUrl({
      permissions,
      expiresOn,
      startsOn,
    });
    const sasCorrelationId = randomUUID();

    return {
      status: 200,
      jsonBody: {
        url: sasUrl,
        blobKey,
        expiresIn: 600,
        correlationId: sasCorrelationId,
      },
    };
  } catch (error: any) {
    const status =
      error instanceof AuthorizationError ? error.status : 500;
    context.error('Error generating audio URL:', error);
    return {
      status,
      jsonBody: { error: error.message || 'Internal server error', correlationId },
    };
  }
}

app.http('get-audio-url', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'sessions/audio-url/{sessionId?}',
  handler: getAudioUrl,
});
