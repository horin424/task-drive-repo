import { app, InvocationContext, Timer } from '@azure/functions';
import { queryItems, patchItem, CONTAINERS } from '../shared/cosmosClient';
import { getContainerClient } from '../shared/storage';
import { ProcessingSession } from '../shared/models';
import type { PatchOperation } from '@azure/cosmos';

// Cleanup files that are older than this many hours
const CLEANUP_AGE_HOURS = parseInt(process.env.CLEANUP_AGE_HOURS || '72', 10);

export async function TimerTriggerCleanupExpiredFiles(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  const timeStamp = new Date().toISOString();
  context.log('Cleanup Timer function triggered!', timeStamp);

  try {
    // Calculate cutoff time
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - CLEANUP_AGE_HOURS);
    const cutoffISO = cutoffTime.toISOString();

    context.log(`Looking for sessions older than: ${cutoffISO}`);

    // Query for sessions that need cleanup:
    // 1. Files have not been deleted yet (filesDeletionTime is null or not set)
    // 2. Session was created more than CLEANUP_AGE_HOURS ago
    // 3. Session has completed processing (status includes 'COMPLETED' or 'ERROR')
    const query = `
      SELECT * FROM c 
      WHERE (
        c.status = 'ALL_COMPLETED' 
        OR c.status = 'TRANSCRIPTION_FAILED'
        OR c.status = 'ERROR'
      )
      AND (NOT IS_DEFINED(c.filesDeletionTime) OR c.filesDeletionTime = null)
      AND c.createdAt < @cutoffTime
    `;

    const sessions = await queryItems<ProcessingSession>(CONTAINERS.SESSIONS, query, [
      { name: '@cutoffTime', value: cutoffISO },
    ]);

    if (!sessions || sessions.length === 0) {
      context.log('No sessions found for cleanup.');
      return;
    }

    context.log(`Found ${sessions.length} sessions to clean up.`);

    const outputContainer = getContainerClient('outputs');
    const inputContainer = getContainerClient('transcripts');
    let successCount = 0;
    let errorCount = 0;

    // Process each session
    for (const session of sessions) {
      try {
        context.log(`Cleaning up session: ${session.id}`);

        // Helper function to delete a blob if it exists
        const deleteBlob = async (blobKey: string | undefined, description: string) => {
          if (!blobKey) return;

          try {
            const blobClient = outputContainer.getBlockBlobClient(blobKey);
            const exists = await blobClient.exists();
            if (exists) {
              await blobClient.delete();
              context.log(`  Deleted ${description}: ${blobKey}`);
            }
          } catch (error: any) {
            context.warn(`  Failed to delete ${description}: ${error.message}`);
          }
        };

        // Delete all generated files
        await Promise.all([
          deleteBlob(session.transcriptKey, 'transcript'),
          deleteBlob(session.bulletPointsKey, 'bulletPoints'),
          deleteBlob(session.minutesKey, 'minutes'),
          deleteBlob(session.tasksKey, 'tasks'),
        ]);
        // Delete source audio if present under transcripts
        if (session.inputBlobName) {
          try {
            const blobClient = inputContainer.getBlockBlobClient(session.inputBlobName);
            const exists = await blobClient.exists();
            if (exists) {
              await blobClient.delete();
              context.log(`  Deleted source audio: ${session.inputBlobName}`);
            }
          } catch (err: any) {
            context.warn(`  Failed to delete source audio: ${err.message}`);
          }
        }

        // Update session to mark files as deleted
        const operations: PatchOperation[] = [
          { op: 'set', path: '/transcriptKey', value: null },
          { op: 'set', path: '/bulletPointsKey', value: null },
          { op: 'set', path: '/minutesKey', value: null },
          { op: 'set', path: '/tasksKey', value: null },
          { op: 'set', path: '/filesDeletionTime', value: timeStamp },
          { op: 'set', path: '/updatedAt', value: timeStamp },
        ];

        await patchItem(CONTAINERS.SESSIONS, session.id, session.id, operations);
        successCount++;
        context.log(`  Successfully cleaned up session: ${session.id}`);
      } catch (error: any) {
        errorCount++;
        context.error(`  Failed to clean up session ${session.id}:`, error);
      }
    }

    context.log(`Cleanup complete. Success: ${successCount}, Errors: ${errorCount}`);
  } catch (error: any) {
    context.error('Error during cleanup:', error);
  }
}

// Run every day at 2 AM UTC
app.timer('TimerTriggerCleanupExpiredFiles', {
  schedule: '0 0 2 * * *',
  handler: TimerTriggerCleanupExpiredFiles,
});
