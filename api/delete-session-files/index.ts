import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { CONTAINERS, patchItem } from '../shared/cosmosClient';
import type { PatchOperation } from '@azure/cosmos';
import { getContainerClient } from '../shared/storage';
import { ProcessingSession } from '../shared/models';
import { authenticateRequest, AuthorizationError } from '../shared/auth';
import { fetchSessionOrThrow, assertSessionAccess, ensureValidSessionId } from '../shared/sessionUtils';
import { randomUUID } from 'crypto';

export async function deleteSessionFiles(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('HTTP trigger function processed delete-session-files request.');

  try {
    const auth = await authenticateRequest(request);
    const body = (await request.json()) as any;
    const sessionId = ensureValidSessionId(body?.sessionId || '');

    // Get session from Cosmos DB
    const session = await fetchSessionOrThrow(sessionId);
    await assertSessionAccess(session, auth);

    const outputContainer = getContainerClient('outputs');
    const deletedFiles: string[] = [];
    const errors: string[] = [];

    // Helper function to delete a blob if it exists
    const deleteBlob = async (blobKey: string | undefined, description: string) => {
      if (!blobKey) return;

      try {
        const blobClient = outputContainer.getBlockBlobClient(blobKey);
        const exists = await blobClient.exists();
        if (exists) {
          await blobClient.delete();
          deletedFiles.push(description);
          context.log(`Deleted ${description}: ${blobKey}`);
        }
      } catch (error: any) {
        context.warn(`Failed to delete ${description}: ${error.message}`);
        errors.push(`${description}: ${error.message}`);
      }
    };

    // Delete all generated files
    await Promise.all([
      deleteBlob(session.transcriptKey, 'transcript'),
      deleteBlob(session.bulletPointsKey, 'bulletPoints'),
      deleteBlob(session.minutesKey, 'minutes'),
      deleteBlob(session.tasksKey, 'tasks'),
    ]);

    // Update session to remove file keys and mark files as deleted
    const operations: PatchOperation[] = [
      { op: 'set', path: '/transcriptKey', value: null },
      { op: 'set', path: '/bulletPointsKey', value: null },
      { op: 'set', path: '/minutesKey', value: null },
      { op: 'set', path: '/tasksKey', value: null },
      { op: 'set', path: '/filesDeletionTime', value: new Date().toISOString() },
      { op: 'set', path: '/updatedAt', value: new Date().toISOString() },
    ];

    await patchItem(CONTAINERS.SESSIONS, sessionId, sessionId, operations);

    const correlationId = randomUUID();
    context.log('Session files deleted', {
      sessionId,
      deletedFiles,
      correlationId,
      user: auth.oid,
    });

    return {
      status: 200,
      jsonBody: {
        message: 'Files deleted successfully',
        deletedFiles,
        errors: errors.length > 0 ? errors : undefined,
        correlationId,
      },
    };
  } catch (error: any) {
    const status =
      error instanceof AuthorizationError ? error.status : 500;
    context.error('Error deleting session files:', error);
    return {
      status,
      jsonBody: { error: error.message || 'Internal server error' },
    };
  }
}

app.http('delete-session-files', {
  methods: ['DELETE', 'POST'],
  authLevel: 'anonymous',
  route: 'sessions/delete-files',
  handler: deleteSessionFiles,
});
