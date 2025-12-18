/* Amplify Params - DO NOT EDIT
	API_TRANSCRIPTMINUTE_GRAPHQLAPIENDPOINTOUTPUT
	API_TRANSCRIPTMINUTE_GRAPHQLAPIIDOUTPUT
	API_TRANSCRIPTMINUTE_PROCESSINGSESSIONTABLE_ARN
	API_TRANSCRIPTMINUTE_PROCESSINGSESSIONTABLE_NAME
	ENV
	REGION
Amplify Params - DO NOT EDIT */

import { default as fetch, Request } from 'node-fetch';
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';

const GRAPHQL_ENDPOINT = process.env.API_TRANSCRIPTMINUTE_GRAPHQLAPIENDPOINTOUTPUT;
const AWS_REGION = process.env.REGION || 'us-east-1';
const INPUT_BUCKET = process.env.STORAGE_INPUT_BUCKETNAME;
const OUTPUT_BUCKET = process.env.STORAGE_OUTPUTBUCKET_BUCKETNAME;
const PROCESSING_SESSION_TABLE = process.env.API_TRANSCRIPTMINUTE_PROCESSINGSESSIONTABLE_NAME;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const s3Client = new S3Client({ region: AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const endpoint = new URL(GRAPHQL_ENDPOINT);

const signer = new SignatureV4({
  credentials: defaultProvider(),
  region: AWS_REGION,
  service: 'appsync',
  sha256: Sha256
});

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

// ProcessingSessionのfilesDeletionTimeを更新
const updateProcessingSessionDeletionTime = async (processingSessionId) => {
  const params = {
    TableName: PROCESSING_SESSION_TABLE,
    Key: { id: { S: processingSessionId } },
    UpdateExpression: 'SET filesDeletionTime = :deletionTime',
    ExpressionAttributeValues: {
      ':deletionTime': { S: new Date().toISOString() }
    }
  };

  try {
    await dynamoClient.send(new UpdateItemCommand(params));
    log('debug', `Updated filesDeletionTime for ProcessingSession`, { processingSessionId });
  } catch (error) {
    log('error', `Failed to update filesDeletionTime for ProcessingSession`, { 
      processingSessionId, 
      error: error.message 
    });
    throw error;
  }
};

// AppSyncへIAM認証でクエリを投げるためのヘルパー関数
const query = async (query, variables) => {
  const requestToBeSigned = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      host: endpoint.host
    },
    hostname: endpoint.hostname,
    body: JSON.stringify({ query, variables }),
    path: endpoint.pathname
  };

  const signedRequest = await signer.sign(requestToBeSigned);

  const request = new Request(endpoint, signedRequest);
  const response = await fetch(request);
  const body = await response.json();
  return body;
};

// ProcessingSessionを取得するためのGraphQLクエリ
// 必要な情報をすべて含める
const getProcessingSessionQuery = /* GraphQL */ `
  query ProcessingSessionsBySessionId($sessionId: String!) {
    processingSessionsBySessionId(sessionId: $sessionId) {
      items {
        id
        identityId
        owner
        sessionId
        fileName
        transcriptKey
        bulletPointsKey
        minutesKey
        tasksKey
        taskFileKey
        informationFileKey
      }
    }
  }
`;

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
export const handler = async (event) => {
  log('debug', 'Received delete files request', { event });
  
  const { sessionId } = event.arguments;
  const requesterSub = event.identity?.sub; // cognitoIdentityId から sub に変更

  if (!sessionId || !requesterSub) {
    log('error', 'Session ID or requester identity (sub) is missing', { sessionId, requesterSub });
    throw new Error('Session ID and requester identity are required.');
  }

  try {
    // 1. AppSyncからセッション情報を取得
    const sessionResult = await query(getProcessingSessionQuery, { sessionId });
    const sessionData = sessionResult.data?.processingSessionsBySessionId?.items?.[0];

    if (!sessionData) {
      log('error', 'Session not found', { sessionId });
      throw new Error('Session not found.');
    }
    
    log('debug', 'Session data retrieved', { 
      sessionId, 
      owner: sessionData.owner,
      hasTaskFileKey: !!sessionData.taskFileKey,
      hasInformationFileKey: !!sessionData.informationFileKey,
      taskFileKey: sessionData.taskFileKey,
      informationFileKey: sessionData.informationFileKey,
      allKeys: {
        transcriptKey: sessionData.transcriptKey,
        bulletPointsKey: sessionData.bulletPointsKey,
        minutesKey: sessionData.minutesKey,
        tasksKey: sessionData.tasksKey,
        taskFileKey: sessionData.taskFileKey,
        informationFileKey: sessionData.informationFileKey
      }
    });

    // 2. 所有者検証
    // event.identity.sub は owner フィールドと比較する
    if (sessionData.owner !== requesterSub) {
      log('error', 'Unauthorized access attempt', { 
        sessionId, 
        requester: requesterSub, 
        owner: sessionData.owner 
      });
      throw new Error('Unauthorized: You can only delete your own files.');
    }
    
    // 3. 削除対象のS3オブジェクトキーをリストアップ
    const objectsToDelete = [];

    // 3a. 入力ファイルのキーを構築して追加
    if (sessionData.fileName && sessionData.identityId && sessionData.sessionId) {
        // 入力ファイルのパス形式 `private/{identityId}/{sessionId}/{fileName}`
        const inputKey = `private/${sessionData.identityId}/${sessionData.sessionId}/${sessionData.fileName}`;
        objectsToDelete.push({ Key: inputKey, Bucket: INPUT_BUCKET });
    }

    // 3b. 生成ファイルのキーを追加
    const outputKeys = [
      sessionData.transcriptKey,
      sessionData.bulletPointsKey,
      sessionData.minutesKey,
      sessionData.tasksKey,
    ];

    // taskFileKey と informationFileKey は相対パスなので、プレフィックスを付ける
    if (sessionData.taskFileKey && sessionData.identityId) {
      const fullTaskFileKey = `private/${sessionData.identityId}/${sessionData.taskFileKey}`;
      outputKeys.push(fullTaskFileKey);
      log('debug', 'Added task file with prefix', { 
        originalKey: sessionData.taskFileKey, 
        fullKey: fullTaskFileKey 
      });
    } else {
      log('debug', 'Task file not added', { 
        hasTaskFileKey: !!sessionData.taskFileKey,
        hasIdentityId: !!sessionData.identityId,
        taskFileKey: sessionData.taskFileKey,
        identityId: sessionData.identityId
      });
    }

    if (sessionData.informationFileKey && sessionData.identityId) {
      const fullInformationFileKey = `private/${sessionData.identityId}/${sessionData.informationFileKey}`;
      outputKeys.push(fullInformationFileKey);
      log('debug', 'Added information file with prefix', { 
        originalKey: sessionData.informationFileKey, 
        fullKey: fullInformationFileKey 
      });
    } else {
      log('debug', 'Information file not added', { 
        hasInformationFileKey: !!sessionData.informationFileKey,
        hasIdentityId: !!sessionData.identityId,
        informationFileKey: sessionData.informationFileKey,
        identityId: sessionData.identityId
      });
    }

    for (const key of outputKeys) {
      if (key) {
        objectsToDelete.push({ Key: key, Bucket: OUTPUT_BUCKET });
      }
    }

    if (objectsToDelete.length === 0) {
      log('debug', 'No files to delete for this session.');
      return true;
    }

    log('debug', 'Objects to delete:', { 
      objectsToDelete,
      totalFiles: objectsToDelete.length,
      outputKeysCount: outputKeys.length,
      inputFilesCount: (sessionData.fileName && sessionData.identityId && sessionData.sessionId) ? 1 : 0
    });

    // 4. S3からオブジェクトを一括削除
    // バケットごとにグループ化してDeleteObjectsを呼び出す
    const objectsByBucket = objectsToDelete.reduce((acc, { Key, Bucket }) => {
        if (!acc[Bucket]) {
            acc[Bucket] = [];
        }
        acc[Bucket].push({ Key });
        return acc;
    }, {});

    for (const Bucket in objectsByBucket) {
        const command = new DeleteObjectsCommand({
            Bucket,
            Delete: {
                Objects: objectsByBucket[Bucket],
                Quiet: false,
            },
        });

        const deleteResult = await s3Client.send(command);
        log('debug', `Delete result for bucket ${Bucket}:`, { deleteResult });

        if (deleteResult.Errors && deleteResult.Errors.length > 0) {
            log('error', `Error deleting objects from bucket ${Bucket}:`, { deleteResult });
            // 1つでもエラーがあれば全体を失敗とする
            throw new Error(`Failed to delete some objects from bucket ${Bucket}.`);
        }
    }
    
    log('debug', 'Successfully deleted all associated files.');

    // 5. ProcessingSessionのfilesDeletionTimeを更新
    await updateProcessingSessionDeletionTime(sessionData.id);

    // 6. 成功を返す
    return true;

  } catch (error) {
    log('error', 'Error in deleteGeneratedFiles Lambda:', { error });
    // AppSyncにエラーを伝播させる
    throw error;
  }
};
