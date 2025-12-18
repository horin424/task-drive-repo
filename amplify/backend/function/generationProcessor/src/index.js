import AWS from 'aws-sdk';
import { getProcessingSessionByCustomSessionId } from './lib/graphqlClient.js';

// AWS SDKクライアントの初期化
const lambda = new AWS.Lambda();
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

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
export const handler = async (event) => {
  log('info', 'generationProcessor開始');
  log('debug', 'リクエストイベント詳細', event);
  
  try {
    const identityId = event.requestContext?.identity?.cognitoIdentityId;
    if (!identityId) {
      log('error', 'Cognito Identity IDを取得できませんでした', { identity: event.requestContext?.identity });
      return {
        statusCode: 403, 
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*"
        },
        body: JSON.stringify({ success: false, error: 'ユーザー認証情報が取得できません' }),
      };
    }
    log('info', `Cognito Identity ID取得`, { identityId });
    
    const body = JSON.parse(event.body || '{}');
    const { sessionId, transcript, processingTypes, taskFileKey, informationFileKey } = body;
    
    log('info', 'リクエストパラメータ検証', { sessionId, transcriptLength: transcript?.length, processingTypes, hasTaskFileKey: !!taskFileKey, hasInformationFileKey: !!informationFileKey });
    log('debug', 'リクエストボディ詳細', body);
    
    if (!sessionId || !transcript || !processingTypes || !Array.isArray(processingTypes) || processingTypes.length === 0) {
      log('error', '必須パラメータが不足しています', { sessionId, hasTranscript: !!transcript, processingTypes });
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*"
        },
        body: JSON.stringify({ success: false, error: 'sessionId, transcript, processingTypes は必須です' }),
      };
    }
    
    // タスク生成が含まれている場合、追加のキーを検証
    if (processingTypes.includes('tasks') && (!taskFileKey || !informationFileKey)) {
      log('error', 'タスク生成には taskFileKey と informationFileKey が必須です', { taskFileKey, informationFileKey });
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*"
        },
        body: JSON.stringify({ success: false, error: 'タスク生成にはtaskFileKeyとinformationFileKeyが必須です' }),
      };
    }
    
    // AppSyncからfileNameを取得
    log('info', 'AppSyncからセッション情報を取得中', { sessionId });
    const session = await getProcessingSessionByCustomSessionId(sessionId);
    if (!session || !session.fileName) {
      log('error', 'ProcessingSessionからfileNameを取得できませんでした', { sessionId });
      log('debug', 'セッション取得結果', session);
      return {
        statusCode: 404, // Not Found もしくは Bad Request
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*"
        },
        body: JSON.stringify({ success: false, error: 'セッション情報または元のファイル名が取得できません' }),
      };
    }
    const fileName = session.fileName;
    log('info', 'AppSyncセッション情報取得成功', { fileName });
    
    const workerPayload = {
      sessionId,
      transcript,
      identityId,
      fileName,
      processingTypes,
      taskFileKey,
      informationFileKey
    };

    log('info', 'generationWorkerを非同期で呼び出します', { sessionId, processingTypes });
    log('debug', 'workerペイロード詳細', workerPayload);
    
    // FUNCTION_GENERATIONWORKER_NAME はAmplifyが設定する環境変数を期待
    if (!process.env.FUNCTION_GENERATIONWORKER_NAME) {
        log('error', '環境変数 FUNCTION_GENERATIONWORKER_NAME が未設定です');
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*"
            },
            body: JSON.stringify({ success: false, error: 'サーバー設定エラー (worker名不詳)' }),
        };
    }

    await lambda.invoke({
      FunctionName: process.env.FUNCTION_GENERATIONWORKER_NAME,
      InvocationType: 'Event',
      Payload: JSON.stringify(workerPayload),
    }).promise();
    
    log('info', 'generationWorkerの呼び出し成功', { sessionId });
    return {
      statusCode: 202, // Accepted
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*"
      },
      body: JSON.stringify({ success: true, message: "リクエストに成功しました。", sessionId }),
    };

  } catch (error) {
    log('error', 'エンドポイント処理で予期せぬエラーが発生しました', { error: error.message });
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*"
      },
      body: JSON.stringify({
        success: false,
        error: error.message || '内部サーバーエラー'
      }),
    };
  }
};
