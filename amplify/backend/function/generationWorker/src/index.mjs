/* Amplify Params - DO NOT EDIT
	API_TRANSCRIPTMINUTE_GRAPHQLAPIENDPOINTOUTPUT
	API_TRANSCRIPTMINUTE_GRAPHQLAPIIDOUTPUT
	ENV
	REGION
	STORAGE_OUTPUTBUCKET_BUCKETNAME
  SECRETS_MANAGER_SECRET_ARN (this is manually added in parameters.json or custom-cloudformation-stack.json)
  DIFY_API_URL (this is manually added in parameters.json or custom-cloudformation-stack.json)
Amplify Params - DO NOT EDIT */

import AWS from 'aws-sdk';
import { getApiKeys, generateBulletPoints, generateMinutes, generateTasks } from './lib/difyClient.js';
import { updateProcessingSession, getProcessingSessionByCustomSessionId, decreaseTaskGenerations } from './lib/graphqlClient.js';

// AWS SDKクライアントの初期化
const s3 = new AWS.S3();
const secretsManager = new AWS.SecretsManager();

// 環境変数の取得 (Amplifyが設定するもの + 手動設定が必要なもの)
const S3_OUTPUT_BUCKET = process.env.STORAGE_OUTPUTBUCKET_BUCKETNAME;
const SECRETS_MANAGER_SECRET_ARN = process.env.SECRETS_MANAGER_SECRET_ARN;
const DIFY_API_URL = process.env.DIFY_API_URL || 'https://api.dify.ai/v1'; // デフォルト値設定
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

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

// S3にファイルを保存する関数 (generationProcessorから移植・調整)
async function saveToS3(bucket, key, content, contentType) {
  try {
    await s3.putObject({
      Bucket: bucket,
      Key: key,
      Body: content,
      ContentType: contentType
    }).promise();
    log('info', `ファイルがS3に保存されました`, { bucket, key });
    return key;
  } catch (error) {
    log('error', `S3ファイル保存エラー`, { bucket, key, error: error.message });
    throw new Error(`S3にファイルを保存できませんでした: ${error.message}`);
  }
}

/**
 * @type {import('@types/aws-lambda').LambdaHandler}
 */
export const handler = async (event) => {
  log('info', 'generationWorker開始', { sessionId: event.sessionId, processingTypes: event.processingTypes });
  log('debug', 'EVENT詳細', event);

  const { sessionId, transcript, identityId, processingTypes, taskFileKey, informationFileKey } = event;

  if (!sessionId || !transcript || !identityId || !processingTypes || !Array.isArray(processingTypes) || processingTypes.length === 0) {
    log('error', "必要なパラメータが不足しています", { sessionId, hasTranscript: !!transcript, identityId, processingTypes });
    return { statusCode: 400, body: JSON.stringify({ message: "必要なパラメータが不足しています。" }) };
  }

  let appSyncRecordId;
  let fileName;
  let apiKeys;

  try {
    // 1. AppSyncからセッション情報を取得 (fileName と AppSyncレコードID)
    log('info', 'AppSyncからセッション情報を取得中', { sessionId });
    const session = await getProcessingSessionByCustomSessionId(sessionId);
    if (!session || !session.id || !session.fileName) {
      log('error', 'セッション情報がAppSyncで見つかりません', { sessionId });
      log('debug', 'セッション取得結果', session);
      return { statusCode: 404, body: JSON.stringify({ message: "セッション情報が見つかりません。" }) };
    }
    appSyncRecordId = session.id;
    fileName = session.fileName;
    log('info', 'AppSyncセッション情報取得成功', { appSyncRecordId, fileName });

    // 2. Dify APIキーを取得
    if (!SECRETS_MANAGER_SECRET_ARN) {
        log('error', 'SECRETS_MANAGER_SECRET_ARN 環境変数が設定されていません');
        if (appSyncRecordId) {
            await updateProcessingSession(appSyncRecordId, 'ERROR_CONFIG');
        }
        return { statusCode: 500, body: JSON.stringify({ message: "SECRETS_MANAGER_SECRET_ARN 未設定" }) };
    }
    log('info', 'Secrets ManagerからAPIキーを取得中');
    log('debug', 'Secrets Manager ARN', { arn: SECRETS_MANAGER_SECRET_ARN });
    apiKeys = await getApiKeys(secretsManager, SECRETS_MANAGER_SECRET_ARN);
    if (!apiKeys.dify_bullet_points_api_key || !apiKeys.dify_minutes_api_key) {
        log('warn', '必要なDify APIキー(箇条書き/議事録)が不足している可能性があります');
        log('debug', 'APIキー取得結果', apiKeys);
    }
    log('info', "Dify APIキー取得成功");

  } catch (error) {
    log('error', "初期化処理に失敗しました", { error: error.message });
    if (appSyncRecordId) {
      try {
        await updateProcessingSession(appSyncRecordId, 'INITIALIZATION_FAILED');
      } catch (updateError) {
        log('error', "初期化失敗時のAppSyncステータス更新にも失敗しました", { updateError: updateError.message });
      }
    }
    return { statusCode: 500, body: JSON.stringify({ message: "初期化処理に失敗しました。", error: error.message }) };
  }
  
  // メイン処理ループ
  for (const type of processingTypes) {
    log('info', `処理タイプ "${type}" を開始`, { sessionId, appSyncRecordId });
    let processingStatus, completedStatus, failedStatus, difyApiKey;

    if (type === "bullets") {
      processingStatus = 'PROCESSING_BULLETS';
      completedStatus = 'BULLETS_COMPLETED';
      failedStatus = 'BULLETS_FAILED';
      difyApiKey = apiKeys.dify_bullet_points_api_key;
    } else if (type === "minutes") {
      processingStatus = 'PROCESSING_MINUTES';
      completedStatus = 'MINUTES_COMPLETED';
      failedStatus = 'MINUTES_FAILED';
      difyApiKey = apiKeys.dify_minutes_api_key;
    } else if (type === "tasks") {
      processingStatus = 'PROCESSING_TASKS';
      completedStatus = 'TASKS_COMPLETED';
      failedStatus = 'TASKS_FAILED';
      difyApiKey = apiKeys.dify_tasks_api_key; 
    } else {
      log('warn', `未対応の処理タイプです`, { type });
      await updateProcessingSession(appSyncRecordId, `UNKNOWN_TYPE_${type.toUpperCase()}`);
      continue;
    }

    try {
      // タスク生成の場合、事前に残り回数をチェック
      if (type === "tasks") {
        log('info', 'タスク生成前の回数チェックを開始');
        try {
          const sessionData = await getProcessingSessionByCustomSessionId(sessionId);
          const organizationId = sessionData?.organizationID;
          
          if (!organizationId) {
            throw new Error('organizationIDが取得できません。タスク生成を中止します。');
          }
          
          // シンプルな回数チェック（DynamoDB直接取得）
          const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
          const { DynamoDBDocumentClient, GetCommand } = await import("@aws-sdk/lib-dynamodb");
          
          const client = new DynamoDBClient({});
          const docClient = DynamoDBDocumentClient.from(client);
          const organizationTableName = process.env.API_TRANSCRIPTMINUTE_ORGANIZATIONTABLE_NAME;
          
          const getCommand = new GetCommand({
            TableName: organizationTableName,
            Key: { id: organizationId }
          });
          
          const result = await docClient.send(getCommand);
          if (!result.Item) {
            throw new Error(`Organization not found: ${organizationId}`);
          }
          
          // デフォルト値適用してチェック
          const remainingTaskGenerations = result.Item.remainingTaskGenerations ?? 100;
          if (remainingTaskGenerations <= 0) {
            throw new Error(`タスク生成の回数上限に達しています。残り回数: ${remainingTaskGenerations}回`);
          }
          
          log('info', 'タスク生成前チェック完了', { remainingTaskGenerations });
        } catch (checkError) {
          log('error', 'タスク生成前チェックエラー', { error: checkError.message });
          throw new Error(`タスク生成前チェック失敗: ${checkError.message}`);
        }
      }

      // ステータス: 処理中
      log('info', `ステータス更新`, { status: processingStatus, appSyncRecordId });
      await updateProcessingSession(appSyncRecordId, processingStatus);

      // Dify API呼び出し
      log('info', `Dify API呼び出し開始`, { type });
      let generatedContent;
      if (type === "bullets") {
        generatedContent = await generateBulletPoints(transcript, difyApiKey, DIFY_API_URL, identityId);
      } else if (type === "minutes") {
        generatedContent = await generateMinutes(transcript, difyApiKey, DIFY_API_URL, identityId);
      } else if (type === "tasks") {
        if (!difyApiKey) {
          throw new Error('タスク生成用のDify APIキーがありません。');
        }
        generatedContent = await generateTasks(s3, S3_OUTPUT_BUCKET, transcript, taskFileKey, informationFileKey, difyApiKey, DIFY_API_URL, identityId);
      } else {
        generatedContent = "";
      }
      log('info', `Dify API呼び出し完了`, { type, resultLength: generatedContent.length });
      // generatedContent.substringを使うとエラーになるので、コメントアウト
      // log('debug', `Dify API呼び出し結果内容`, { type, generatedContent: generatedContent.substring(0, 500) + '...' });

      // S3へ保存
      const baseFilename = fileName.split('.').slice(0, -1).join('.');
      const isTask = type === "tasks";
      const generatedFilename = 
        isTask ? `タスク一覧_${baseFilename}.xlsx` :
        type === "bullets" ? `箇条書き_${baseFilename}.txt` :
        `議事録_${baseFilename}.txt`;
      const s3Key = `private/${identityId}/${sessionId}/${generatedFilename}`;
      
      log('info', `S3へ保存開始`, { type, s3Key });
      await saveToS3(S3_OUTPUT_BUCKET, s3Key, generatedContent, isTask ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/plain; charset=utf-8');
      log('info', `S3へ保存完了`, { type });

      // ステータス: 完了 (S3キーも更新)
      log('info', `ステータス更新`, { status: completedStatus, s3Key, appSyncRecordId });
      if (type === "bullets") {
        await updateProcessingSession(appSyncRecordId, completedStatus, null, s3Key, null);
      } else if (type === "minutes") {
        await updateProcessingSession(appSyncRecordId, completedStatus, null, null, s3Key);
      } else if (type === "tasks") {
        await updateProcessingSession(appSyncRecordId, completedStatus, null, null, null, s3Key);
        
        // ★ タスク生成完了時に回数を1減算
        try {
          // ProcessingSessionからorganizationIDを取得
          const sessionData = await getProcessingSessionByCustomSessionId(sessionId);
          const organizationId = sessionData?.organizationID;
          
          if (organizationId) {
            log('info', 'タスク生成回数減算開始', { organizationId });
            await decreaseTaskGenerations(organizationId, 1);
            log('info', 'タスク生成回数減算完了');
          } else {
            log('warn', 'organizationIDが取得できませんでした。タスク生成回数減算をスキップします', { sessionId });
          }
        } catch (decreaseError) {
          log('error', 'タスク生成回数減算エラー', { error: decreaseError.message });
          // エラーでも処理は継続（ログのみ）
        }
      }
      log('info', `処理タイプ正常終了`, { type });

    } catch (error) {
      log('error', `処理タイプでエラーが発生しました`, { type, sessionId, error: error.message });
      try {
        log('info', `ステータス更新`, { status: failedStatus, appSyncRecordId });
        await updateProcessingSession(appSyncRecordId, failedStatus);
      } catch (updateError) {
        log('error', `失敗ステータス更新にも失敗しました`, { type, updateError: updateError.message });
      }
      // 個別エラーはここでキャッチし、次のprocessingTypeの処理は継続する
    }
  }

  // 全てのtypeの処理が終わった後、最終ステータスを確認・更新
  try {
    log('info', "全処理タイプ完了後、最終ステータス確認処理を開始");
    const finalSession = await getProcessingSessionByCustomSessionId(sessionId);
    // processingTypesに応じて完了条件を判定する
    const requestedBullets = processingTypes.includes('bullets');
    const requestedMinutes = processingTypes.includes('minutes');
    const requestedTasks = processingTypes.includes('tasks');

    let allDone = true;
    if (requestedBullets && !finalSession?.bulletPointsKey) allDone = false;
    if (requestedMinutes && !finalSession?.minutesKey) allDone = false;
    if (requestedTasks && !finalSession?.tasksKey) allDone = false;
    
    if (finalSession && allDone) {
      if (!finalSession.status || (!finalSession.status.includes('FAILED') && !finalSession.status.includes('ERROR'))) {
        log('info', `要求されたすべての成果物が存在するため、ステータスをALL_COMPLETEDに更新`, { appSyncRecordId: finalSession.id });
        await updateProcessingSession(finalSession.id, 'ALL_COMPLETED');
      } else {
        log('info', `すべての成果物は存在するが、既存ステータスがエラーのためALL_COMPLETEDへの更新はスキップ`, { status: finalSession.status });
      }
    } else {
      log('info', "いくつかの成果物が未完了のため、ALL_COMPLETEDへの更新は行いません", {
        hasBpKey: !!finalSession?.bulletPointsKey,
        hasMinKey: !!finalSession?.minutesKey,
        hasTaskKey: !!finalSession?.tasksKey,
      });
    }
  } catch (error) {
    log('error', "最終ステータス確認処理中にエラーが発生しました", { error: error.message });
  }

  log('info', `全処理完了 (Lambda終了)`, { sessionId });
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "generationWorkerの全処理が試行されました", sessionId }),
  };
};
