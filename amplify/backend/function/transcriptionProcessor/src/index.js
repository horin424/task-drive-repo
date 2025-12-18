/* Amplify Params - DO NOT EDIT
	API_TRANSCRIPTMINUTE_GRAPHQLAPIENDPOINTOUTPUT
	API_TRANSCRIPTMINUTE_GRAPHQLAPIIDOUTPUT
	API_TRANSCRIPTMINUTE_ORGANIZATIONTABLE_ARN
	API_TRANSCRIPTMINUTE_ORGANIZATIONTABLE_NAME
	API_TRANSCRIPTMINUTE_PROCESSINGSESSIONTABLE_ARN
	API_TRANSCRIPTMINUTE_PROCESSINGSESSIONTABLE_NAME
	ENV
	REGION
	STORAGE_S31D11B5D9_BUCKETNAME
Amplify Params - DO NOT EDIT */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { extractSessionId } from './lib/utils.js';
import { processTranscription } from './lib/transcriptionApi.js';
import { getProcessingSessionBySessionId, updateProcessingSession, markTranscriptionComplete, markTranscriptionFailed } from './lib/graphqlApi.js';
import { Sha256 } from "@aws-crypto/sha256-js";

// AWS SDKクライアントの初期化
const s3Client = new S3Client({ region: process.env.REGION });
const secretsManagerClient = new SecretsManagerClient({ region: process.env.REGION });

// 環境変数
const S3_OUTPUT_BUCKET = process.env.S3_OUTPUT_BUCKET;
const API_SECRET_ARN = process.env.API_SECRET_ARN;
const API_PROVIDER = process.env.API_PROVIDER || 'elevenlabs';
const DIFY_API_URL = process.env.DIFY_API_URL;
const APP_SYNC_ENDPOINT = process.env.API_TRANSCRIPTMINUTE_GRAPHQLAPIENDPOINTOUTPUT;
const API_ID = process.env.API_TRANSCRIPTMINUTE_GRAPHQLAPIIDOUTPUT;
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
 * S3イベントを処理するLambdaハンドラー
 * 
 * @param {Object} event - S3イベント
 * @returns {Promise<Object>} 処理結果
 */
const handler = async (event) => {
  log('info', 'transcriptionProcessor開始', { recordCount: event.Records?.length || 0 });
  log('debug', 'S3イベント詳細', event);
  
  // S3イベントからレコードを取得
  const records = event.Records || [];
  
  if (records.length === 0) {
    log('error', 'イベントにレコードが見つかりません');
    return { statusCode: 400, body: JSON.stringify({ message: 'No records in event' }) };
  }
  
  // 最初のレコードを処理
  const record = records[0];
  
  // バケット名とオブジェクトキーを取得
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
  
  log('info', `ファイル処理開始`, { bucket, key });
  
  // ★ 元のファイル名を取得 (キーの最後の部分)
  const originalFilename = key.split('/').pop();
  if (!originalFilename) {
      log('error', `キーからファイル名を抽出できませんでした`, { key });
      throw new Error('ファイル名をキーから抽出できません');
  }
  log('info', `元のファイル名取得`, { originalFilename });
  
  // AppSyncエンドポイントの検証
  if (!APP_SYNC_ENDPOINT) {
    log('error', 'AppSyncエンドポイントが設定されていません');
    throw new Error('AppSync endpoint configuration error');
  }
  
  // APIの検証
  let apiId = API_ID;
  if (!apiId && APP_SYNC_ENDPOINT) {
    // URLからAPIIDを抽出する試み
    const urlParts = APP_SYNC_ENDPOINT.split('/');
    if (urlParts.length >= 5) {
      apiId = urlParts[4];
    } else {
      log('error', 'エンドポイントURLからAPI IDを抽出できませんでした');
    }
  }
  
  if (!apiId) {
    log('error', 'API IDが設定されていません');
    throw new Error('AppSync API ID configuration error');
  }
  
  // GraphQLを実行するカスタムクライアント（SigV4署名付きHTTP）
  const graphqlClient = {
    graphql: async ({ query, variables }) => {
      const endpointUrl = new URL(APP_SYNC_ENDPOINT);
      const request = new HttpRequest({
        protocol: endpointUrl.protocol,
        hostname: endpointUrl.hostname,
        path: endpointUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Host': endpointUrl.hostname
        },
        body: JSON.stringify({ query, variables })
      });

      const signer = new SignatureV4({
        service: 'appsync',
        region: process.env.REGION,
        credentials: defaultProvider(),
        sha256: Sha256
      });

      const signedRequest = await signer.sign(request);

      log('debug', '署名済みリクエストヘッダー', signedRequest.headers);

      const fetchResponse = await fetch(APP_SYNC_ENDPOINT, {
        method: signedRequest.method,
        headers: signedRequest.headers,
        body: signedRequest.body
      });

      const json = await fetchResponse.json();
      return json;
    }
  };
  
  // セッションIDを抽出 (これは sessionId フィールドの値を抽出する想定)
  const sessionIdFromKey = extractSessionId(key);
  let sessionData = null; // sessionDataをtry-catchの外側で宣言
  
  try {
    if (!sessionIdFromKey) {
      throw new Error(`Unable to extract session ID from key: ${key}`);
    }
    
    log('info', `キーからセッションID抽出`, { sessionIdFromKey });

    // ★★★ getProcessingSessionBySessionId を呼び出して language を取得 ★★★
    sessionData = await getProcessingSessionBySessionId(graphqlClient, sessionIdFromKey);
    if (!sessionData) {
      throw new Error(`ProcessingSessionが見つかりません (sessionId: ${sessionIdFromKey})`);
    }
    const language = sessionData.language;
    const fileName = sessionData.fileName; // fileName も取得（文字起こし結果のファイル名生成に利用）
    log('info', `セッション情報取得`, { language, fileName });
    if (!language) {
        throw new Error(`ProcessingSessionから言語が取得できません (sessionId: ${sessionIdFromKey})`);
    }
    
    log('debug', `セッション詳細データ`, sessionData);

    // ★★★ ステータスを PROCESSING_TRANSCRIPTION に更新 (id は sessionData.id を使用) ★★★
    await updateProcessingSession(graphqlClient, sessionData.id, 'PROCESSING_TRANSCRIPTION', {
      owner: sessionData.owner // 明示的にowner情報を渡す
    });
    log('info', `ステータスをPROCESSING_TRANSCRIPTIONに更新しました`);
    
    // ★★★ identityId をキーから抽出 (S3キーの構築に必要) ★★★
    const keyParts = key.split('/');
    if (keyParts.length < 4 || keyParts[0] !== 'private') {
      log('error', `キーの形式が不正です`, { key, expectedFormat: 'private/<identityId>/<sessionId>/...' });
      throw new Error('キーからIdentity IDを抽出できません');
    }
    const identityId = keyParts[1];
    log('info', `Identity ID抽出`, { identityId });
    
    // S3から一時的な署名付きURLを生成
    const getObjectCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    });
    const audioFileUrl = await getSignedUrl(s3Client, getObjectCommand, { expiresIn: 3600 });
    
    log('info', `文字起こし処理開始`);
    log('debug', `署名付きURL生成`, { audioFileUrl });
    
    // Secrets Manager ARNの検証
    if (!API_SECRET_ARN) {
      log('error', 'API_SECRET_ARNが設定されていません');
      throw new Error('Secret ARN configuration error');
    }
    // 出力バケット環境変数の検証を追加
    if (!S3_OUTPUT_BUCKET) {
        log('error', 'S3_OUTPUT_BUCKETが設定されていません');
        throw new Error('Output bucket configuration error');
    }
    
    // 外部APIを使用して文字起こしを実行
    const transcriptionResult = await processTranscription(
      s3Client,
      secretsManagerClient,
      audioFileUrl,
      API_PROVIDER,
      API_SECRET_ARN,
      DIFY_API_URL,
      language // ★ language を渡す
    );
    
    // ★★★ 修正: identityId を使った正しいS3キー形式に変更 ★★★
    // originalFilename の代わりに sessionData.fileName を使う
    const transcriptFilename = `文字起こし_${fileName}.json`; 
    const transcriptKey = `private/${identityId}/${sessionIdFromKey}/${transcriptFilename}`;
    
    // カスタムJSON形式をS3に保存
    const dataToSave = transcriptionResult.customJsonData || {
      schema_version: "1.0",
      audio_duration: transcriptionResult.audioLengthSeconds || 0,
      language: language, // ProcessingSessionから取得した言語を使用
      preprocessing_info: null,
      words: []
    };
    
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_OUTPUT_BUCKET,
      Key: transcriptKey,
      Body: JSON.stringify(dataToSave, null, 2),
      ContentType: 'application/json'
    }));
    
    log('info', `文字起こし結果が出力バケットに保存されました`, { bucket: S3_OUTPUT_BUCKET, key: transcriptKey });
    
    // ProcessingSessionステータスを更新
    const audioLengthSeconds = transcriptionResult.audioLengthSeconds || 0;
    
    await markTranscriptionComplete(
      graphqlClient,
      sessionData.id, // ★ ProcessingSession の id を渡す
      transcriptKey, 
      audioLengthSeconds
    );
    
    log('info', '文字起こし処理完了', { sessionId: sessionIdFromKey, transcriptKey });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: '文字起こし処理が完了しました',
        sessionId: sessionIdFromKey,
        transcriptKey
      })
    };
    
  } catch (error) {
    log('error', '処理中にエラーが発生しました', { error: error.message });
    
    try {
      // セッションIDを抽出できる場合は失敗ステータスを更新
      const sessionIdForError = extractSessionId(key);
      if (sessionIdForError) {
        if (sessionData && sessionData.id) { // sessionData が取得できていればそのidを使う
           await markTranscriptionFailed(
             graphqlClient,
             sessionData.id, // ★ ProcessingSession の id
             error.message,
             {
               owner: sessionData.owner // 明示的にowner情報を渡す
             }
           );
        } else if (sessionIdForError) {
           log('error', `ProcessingSessionのidが不明なため、ステータス更新はスキップ`, { sessionId: sessionIdForError, error: error.message });
        }
      }
    } catch (updateError) {
      log('error', 'ステータス更新中にエラーが発生しました', { updateError: updateError.message });
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: '文字起こし処理中にエラーが発生しました',
        error: error.message
      })
    };
  }
};

export { handler }; 