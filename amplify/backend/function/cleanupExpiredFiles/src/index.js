/* Amplify Params - DO NOT EDIT
	API_TRANSCRIPTMINUTE_GRAPHQLAPIIDOUTPUT
	API_TRANSCRIPTMINUTE_ORGANIZATIONTABLE_ARN
	API_TRANSCRIPTMINUTE_ORGANIZATIONTABLE_NAME
	API_TRANSCRIPTMINUTE_PROCESSINGSESSIONTABLE_ARN
	API_TRANSCRIPTMINUTE_PROCESSINGSESSIONTABLE_NAME
	ENV
	REGION
	STORAGE_S31D11B5D9_BUCKETNAME
Amplify Params - DO NOT EDIT */

import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

// 環境変数の取得
const AWS_REGION = process.env.REGION || 'ap-northeast-1';
const INPUT_BUCKET = process.env.STORAGE_INPUT_BUCKETNAME;
const OUTPUT_BUCKET = process.env.STORAGE_OUTPUTBUCKET_BUCKETNAME;
const PROCESSING_SESSION_TABLE = process.env.API_TRANSCRIPTMINUTE_PROCESSINGSESSIONTABLE_NAME;
const CLEANUP_THRESHOLD_HOURS = parseInt(process.env.CLEANUP_THRESHOLD_HOURS || '2');
const MAX_SESSIONS_PER_RUN = parseInt(process.env.MAX_SESSIONS_PER_RUN || '1000');
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// 必須環境変数の検証
const validateEnvironmentVariables = () => {
  const missingVars = [];
  
  if (!INPUT_BUCKET) missingVars.push('STORAGE_INPUT_BUCKETNAME');
  if (!OUTPUT_BUCKET) missingVars.push('STORAGE_OUTPUTBUCKET_BUCKETNAME');
  if (!PROCESSING_SESSION_TABLE) missingVars.push('API_TRANSCRIPTMINUTE_PROCESSINGSESSIONTABLE_NAME');
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
};

// クライアントの初期化
const s3Client = new S3Client({ region: AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: AWS_REGION });

// ログ出力ヘルパー
const log = (level, message, data = null) => {
  if (level === 'debug' && LOG_LEVEL !== 'debug') return;
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(data && { data })
  };
  console.log(JSON.stringify(logEntry));
};

// 削除対象のProcessingSessionを取得
const getExpiredSessions = async () => {
  const threshold = new Date(Date.now() - CLEANUP_THRESHOLD_HOURS * 60 * 60 * 1000);
  log('debug', 'Scanning for expired sessions', { threshold: threshold.toISOString() });

  const params = {
    TableName: PROCESSING_SESSION_TABLE,
    FilterExpression: 'attribute_not_exists(filesDeletionTime) AND updatedAt < :threshold',
    ExpressionAttributeValues: {
      ':threshold': { S: threshold.toISOString() }
    }
  };

  try {
    const result = await dynamoClient.send(new ScanCommand(params));
    const sessions = result.Items || [];
    
    log('info', `Found ${sessions.length} expired sessions`);
    log('debug', 'Expired sessions details', { sessionCount: sessions.length });
    
    return sessions;
  } catch (error) {
    log('error', 'Failed to get expired sessions', { error: error.message });
    throw error;
  }
};

// 指数バックオフによる遅延
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// リトライ機能付きセッションファイル削除
const deleteSessionFilesWithRetry = async (session, maxRetries = 3) => {
  const sessionId = session.id?.S;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log('debug', `Delete attempt ${attempt}/${maxRetries} for session ${sessionId}`);
      const result = await deleteSessionFiles(session);
      
      if (attempt > 1) {
        log('info', `Session ${sessionId} succeeded on attempt ${attempt}`);
      }
      
      return result;
    } catch (error) {
      log('error', `Delete attempt ${attempt}/${maxRetries} failed for session ${sessionId}`, { 
        error: error.message 
      });
      
      if (attempt === maxRetries) {
        log('error', `All ${maxRetries} attempts failed for session ${sessionId}`);
        throw error;
      }
      
      // 指数バックオフ: 1秒、2秒、3秒
      const delayMs = attempt * 1000;
      log('debug', `Retrying after ${delayMs}ms for session ${sessionId}`);
      await delay(delayMs);
    }
  }
};

// セッションのファイルをS3から削除
const deleteSessionFiles = async (session) => {
  const recordId = session.id?.S;  // DynamoDBプライマリキー
  const sessionId = session.sessionId?.S;  // 実際のセッション識別子
  const identityId = session.identityId?.S;
  const fileName = session.fileName?.S;
  const transcriptKey = session.transcriptKey?.S;
  const bulletPointsKey = session.bulletPointsKey?.S;
  const minutesKey = session.minutesKey?.S;
  const tasksKey = session.tasksKey?.S;
  const taskFileKey = session.taskFileKey?.S;
  const informationFileKey = session.informationFileKey?.S;

  log('debug', `Processing session files for deletion`, { recordId, sessionId });

  const objectsToDelete = [];

  // 入力ファイルのキーを構築
  if (fileName && identityId && sessionId) {
    const inputKey = `private/${identityId}/${sessionId}/${fileName}`;
    objectsToDelete.push({ Key: inputKey, Bucket: INPUT_BUCKET });
    log('debug', `Added input file to deletion list`, { 
      key: inputKey, 
      bucket: INPUT_BUCKET,
      fileName,
      identityId,
      sessionId
    });
  } else {
    log('debug', `Input file not added - missing data`, { 
      hasFileName: !!fileName,
      hasIdentityId: !!identityId,
      hasSessionId: !!sessionId
    });
  }

  // 出力ファイルのキーを追加
  const outputKeys = [
    { key: transcriptKey, type: 'transcript' },
    { key: bulletPointsKey, type: 'bulletPoints' },
    { key: minutesKey, type: 'minutes' },
    { key: tasksKey, type: 'tasks' }
  ];

  // taskFileKey と informationFileKey は相対パスなので、プレフィックスを付ける
  if (taskFileKey && identityId) {
    const fullTaskFileKey = `private/${identityId}/${taskFileKey}`;
    outputKeys.push({ key: fullTaskFileKey, type: 'taskFile' });
    log('debug', `Added task file to deletion list (with prefix)`, { 
      originalKey: taskFileKey, 
      fullKey: fullTaskFileKey,
      bucket: OUTPUT_BUCKET
    });
  } else if (taskFileKey) {
    log('debug', `Task file not added - missing identityId`, { taskFileKey });
  }

  if (informationFileKey && identityId) {
    const fullInformationFileKey = `private/${identityId}/${informationFileKey}`;
    outputKeys.push({ key: fullInformationFileKey, type: 'informationFile' });
    log('debug', `Added information file to deletion list (with prefix)`, { 
      originalKey: informationFileKey, 
      fullKey: fullInformationFileKey,
      bucket: OUTPUT_BUCKET
    });
  } else if (informationFileKey) {
    log('debug', `Information file not added - missing identityId`, { informationFileKey });
  }

  // outputKeysを処理してobjectsToDeleteに追加
  for (const { key, type } of outputKeys) {
    if (key) {
      objectsToDelete.push({ Key: key, Bucket: OUTPUT_BUCKET });
      log('debug', `Added output file to deletion list`, { 
        key, 
        bucket: OUTPUT_BUCKET,
        type
      });
    } else {
      log('debug', `Output file not added - null key`, { type });
    }
  }

  if (objectsToDelete.length === 0) {
      log('debug', `No files to delete for session`, { recordId, sessionId });
  return { success: true, deletedCount: 0 };
}

log('debug', `Total files to delete`, { 
  recordId,
  sessionId,
  totalFiles: objectsToDelete.length,
  files: objectsToDelete
});

  // バケットごとにグループ化してS3削除実行
  const objectsByBucket = objectsToDelete.reduce((acc, { Key, Bucket }) => {
    if (!acc[Bucket]) acc[Bucket] = [];
    acc[Bucket].push({ Key });
    return acc;
  }, {});

  let deletedCount = 0;
  
  for (const Bucket in objectsByBucket) {
    const filesToDelete = objectsByBucket[Bucket];
    
    log('debug', `Attempting to delete files from bucket`, {
      bucket: Bucket,
      fileCount: filesToDelete.length,
      files: filesToDelete.map(f => f.Key)
    });

    const command = new DeleteObjectsCommand({
      Bucket,
      Delete: {
        Objects: filesToDelete,
        Quiet: false,
      },
    });

    try {
      const deleteResult = await s3Client.send(command);
      deletedCount += filesToDelete.length;
      
      log('debug', `Delete result for bucket`, { 
        bucket: Bucket,
        requestedFiles: filesToDelete.length,
        deletedFiles: deleteResult.Deleted?.length || 0,
        errors: deleteResult.Errors?.length || 0
      });

      // 削除されたファイルの詳細をログ出力
      if (deleteResult.Deleted && deleteResult.Deleted.length > 0) {
        log('debug', `Successfully deleted files`, {
          bucket: Bucket,
          deletedFiles: deleteResult.Deleted.map(d => d.Key)
        });
      }

      if (deleteResult.Errors && deleteResult.Errors.length > 0) {
        log('error', `S3 delete errors for session`, { 
          recordId,
          sessionId,
          bucket: Bucket, 
          errors: deleteResult.Errors.map(e => ({
            key: e.Key,
            code: e.Code,
            message: e.Message
          }))
        });
        throw new Error(`Failed to delete some objects from bucket ${Bucket}`);
      }
    } catch (error) {
      log('error', `Failed to delete files for session`, { 
        recordId,
        sessionId,
        bucket: Bucket, 
        requestedFiles: filesToDelete.map(f => f.Key),
        error: error.message 
      });
      throw error;
    }
  }

  log('debug', `Successfully processed session`, { recordId, sessionId, deletedFiles: deletedCount });
  
  // filesDeletionTimeを現在時刻に更新（DynamoDBプライマリキーを使用）
  await updateProcessingSessionDeletionTime(recordId);
  log('debug', `Updated filesDeletionTime for session`, { recordId, sessionId });

  return { success: true, deletedCount };
};

// ProcessingSessionのfilesDeletionTimeを更新
const updateProcessingSessionDeletionTime = async (sessionId) => {
  const params = {
    TableName: PROCESSING_SESSION_TABLE,
    Key: { id: { S: sessionId } },
    UpdateExpression: 'SET filesDeletionTime = :deletionTime',
    ExpressionAttributeValues: {
      ':deletionTime': { S: new Date().toISOString() }
    }
  };

  try {
    await dynamoClient.send(new UpdateItemCommand(params));
    log('debug', `Updated filesDeletionTime for session ${sessionId}`);
  } catch (error) {
    log('error', `Failed to update filesDeletionTime for session ${sessionId}`, { 
      error: error.message 
    });
    throw error;
  }
};

/**
 * @type {import('@types/aws-lambda').ScheduledHandler}
 */
export const handler = async () => {
  const startTime = Date.now();
  
  try {
    // 環境変数の検証
    validateEnvironmentVariables();
    
    // デバッグ用：環境変数の確認
    log('info', 'Environment variables check', {
      AWS_REGION,
      INPUT_BUCKET,
      OUTPUT_BUCKET,
      PROCESSING_SESSION_TABLE,
      CLEANUP_THRESHOLD_HOURS,
      env: {
        REGION: process.env.REGION,
        STORAGE_S31D11B5D9_BUCKETNAME: process.env.STORAGE_S31D11B5D9_BUCKETNAME,
        STORAGE_OUTPUTBUCKET_BUCKETNAME: process.env.STORAGE_OUTPUTBUCKET_BUCKETNAME,
        API_TRANSCRIPTMINUTE_PROCESSINGSESSIONTABLE_NAME: process.env.API_TRANSCRIPTMINUTE_PROCESSINGSESSIONTABLE_NAME
      }
    });

    log('info', 'Starting scheduled file cleanup', {
      thresholdHours: CLEANUP_THRESHOLD_HOURS,
      maxSessionsPerRun: MAX_SESSIONS_PER_RUN
    });

    let totalSessions = 0;
    let successCount = 0; 
    let failedCount = 0;
    const errors = [];

    // 1. 削除対象セッションを取得
    const expiredSessions = await getExpiredSessions();
    totalSessions = expiredSessions.length;

    if (totalSessions === 0) {
      log('info', 'No expired sessions found');
      return {
        statusCode: 200,
        body: JSON.stringify({
          totalSessions: 0,
          successCount: 0,
          failedCount: 0,
          executionTimeMs: Date.now() - startTime
        })
      };
    }

    // 2. バッチ処理で各セッションのファイルを削除
    let processedSessions = 0;
    
    while (processedSessions < totalSessions) {
      const batchStart = processedSessions;
      const batchEnd = Math.min(processedSessions + MAX_SESSIONS_PER_RUN, totalSessions);
      const currentBatch = expiredSessions.slice(batchStart, batchEnd);
      const batchSize = currentBatch.length;
      
      log('info', `Processing batch: ${batchStart + 1}-${batchEnd} (${batchSize} sessions)`);
      
      // 並行処理でバッチ内のセッションを処理
      const batchPromises = currentBatch.map(async (session) => {
        const sessionId = session.id?.S;
        
        try {
          log('debug', `Processing session ${sessionId}`);
          
          // S3ファイル削除（リトライ機能付き）
          const deleteResult = await deleteSessionFilesWithRetry(session);
          
          // ProcessingSession更新
          await updateProcessingSessionDeletionTime(sessionId);
          
          log('debug', `Successfully processed session ${sessionId}`, { 
            deletedFiles: deleteResult.deletedCount 
          });
          
          return { success: true, sessionId, deletedFiles: deleteResult.deletedCount };
          
        } catch (error) {
          const errorInfo = { sessionId, error: error.message };
          log('error', `Failed to process session ${sessionId}`, errorInfo);
          return { success: false, sessionId, error: errorInfo };
        }
      });
      
      // バッチ実行と結果集計
      const batchResults = await Promise.all(batchPromises);
      
      for (const result of batchResults) {
        if (result.success) {
          successCount++;
        } else {
          failedCount++;
          errors.push(result.error);
        }
      }
      
      processedSessions += batchSize;
      log('info', `Batch completed: ${batchSize} sessions processed (Success: ${batchResults.filter(r => r.success).length}, Failed: ${batchResults.filter(r => !r.success).length})`);
      
      // Lambda制限時間チェック（14分で早期終了）
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > 14 * 60 * 1000 && processedSessions < totalSessions) {
        log('info', `Approaching Lambda timeout limit. Processed ${processedSessions}/${totalSessions} sessions.`);
        break;
      }
    }

    // 3. 実行結果をログ出力
    const executionTimeMs = Date.now() - startTime;
    const result = {
      totalSessions,
      processedSessions,
      successCount,
      failedCount,
      executionTimeMs,
      ...(processedSessions < totalSessions && { partialProcessing: true }),
      ...(errors.length > 0 && { errors })
    };

    log('info', 'Scheduled file cleanup completed', result);

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };

  } catch (error) {
    log('error', 'Scheduled file cleanup failed', { error: error.message });
    throw error;
  }
};
