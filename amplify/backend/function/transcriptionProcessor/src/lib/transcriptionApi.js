import axios from 'axios';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import FormData from 'form-data';

/**
 * 署名付きS3 URLを生成する
 * @param {S3Client} s3Client - S3クライアントインスタンス
 * @param {string} bucket - S3バケット名
 * @param {string} key - オブジェクトキー
 * @returns {Promise<string>} 署名付きURL
 */
async function getS3SignedUrl(s3Client, bucket, key) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

/**
 * 外部APIを使用して音声ファイルの文字起こしを行う
 * 
 * @param {object} s3Client - AWS S3クライアント
 * @param {object} secretsManager - AWS SecretsManagerクライアント
 * @param {string} audioFileUrl - 処理する音声ファイルのURL
 * @param {string} apiProvider - 使用するAPIプロバイダー（例: 'dify'）
 * @param {string} apiSecretArn - API認証情報を取得するためのSecretsManagerのARN
 * @param {string} difyApiUrl - DifyのAPIエンドポイント
 * @param {string} language - 文字起こしに使用する言語コード (例: 'ja', 'en')
 * @returns {Promise<object>} 文字起こし結果
 */
async function processTranscription(
  s3Client,
  secretsManager,
  audioFileUrl,
  apiProvider,
  apiSecretArn,
  difyApiUrl,
  language
) {
  console.log(`APIプロバイダー ${apiProvider}、言語 ${language} を使用して文字起こしを処理します`);
  
  // APIキーをSecretsManagerから取得
  const secretData = await getApiSecret(secretsManager, apiSecretArn);
  
  switch (apiProvider.toLowerCase()) {
    case 'elevenlabs':
      return await processElevenLabsTranscription(audioFileUrl, secretData.elevenlabs_api_key, language);
    case 'dify':
      return await processDifyTranscription(audioFileUrl, secretData.difyApiKey, difyApiUrl, language);
    default:
      throw new Error(`サポートされていないAPIプロバイダー: ${apiProvider}`);
  }
}

/**
 * SecretsManagerからAPIシークレットを取得
 * 
 * @param {object} secretsManager - AWS SecretsManagerクライアント
 * @param {string} secretArn - シークレットのARN
 * @returns {Promise<object>} APIシークレット
 */
async function getApiSecret(secretsManager, secretArn) {
  const command = new GetSecretValueCommand({ SecretId: secretArn });
  const secretResponse = await secretsManager.send(command);
  
  if ('SecretString' in secretResponse) {
    return JSON.parse(secretResponse.SecretString);
  }
  
  throw new Error('APIシークレットを取得できません');
}

/**
 * ElevenLabs APIを使用して文字起こしを処理
 * 
 * @param {string} audioFileUrl - 処理する音声ファイルのURL
 * @param {string} apiKey - ElevenLabs APIキー
 * @param {string} language - 文字起こし言語コード
 * @returns {Promise<object>} 文字起こし結果
 */
async function processElevenLabsTranscription(audioFileUrl, apiKey, language) {
  console.log(`ElevenLabs API (言語: ${language}) を使用して文字起こしを開始します`);
  const API_URL = "https://api.elevenlabs.io/v1/speech-to-text";
  // 環境変数が明示的に'false'に設定されていない限り、cloud_storage_urlを使用する
  const useCloudStorageUrl = process.env.USE_CLOUD_STORAGE_URL !== 'false';
  
  try {
    let response;
    
    if (useCloudStorageUrl) {
      // 新しい方法: cloud_storage_urlパラメータを使用 (FormDataで送信)
      console.log('cloud_storage_urlパラメータを使用してAPIを呼び出します。URL:', audioFileUrl);
      
      // FormDataを作成
      const formData = new FormData();
      formData.append('model_id', 'scribe_v1');
      formData.append('language_code', language);
      formData.append('diarize', 'true');
      formData.append('cloud_storage_url', audioFileUrl);
      
      console.log('ElevenLabs APIにFormDataでリクエスト送信中...');
      response = await axios.post(API_URL, formData, {
        headers: {
          'xi-api-key': apiKey,
          ...formData.getHeaders()
        }
      });
    } else {
      // 従来の方法: ファイルをダウンロードしてFormDataで送信
      console.log('従来の方法を使用: 署名付きURLから音声ファイルをダウンロード中...');
      const audioResponse = await axios.get(audioFileUrl, {
        responseType: 'arraybuffer'
      });
      
      // FormDataを作成
      const formData = new FormData();
      formData.append('file', Buffer.from(audioResponse.data), {
        filename: 'audio.mp3',
        contentType: 'audio/mpeg'
      });
      formData.append('model_id', 'scribe_v1');
      formData.append('language_code', language);
      formData.append('diarize', 'true');
      
      // API呼び出し
      console.log('ElevenLabs APIにリクエスト送信中...');
      response = await axios.post(API_URL, formData, {
        headers: {
          'xi-api-key': apiKey,
          ...formData.getHeaders()
        }
      });
    }
    
    // レスポンスを検証
    if (!response.data || !response.data.text) {
      throw new Error('ElevenLabs APIからの無効なレスポンス');
    }
    
    console.log('ElevenLabs APIからの文字起こしが成功しました');
    
    // words配列を使用して音声の長さを計算
    let audioLengthSeconds = 0;
    if (response.data.words && response.data.words.length > 0) {
      const lastWord = response.data.words[response.data.words.length - 1];
      audioLengthSeconds = Math.ceil(lastWord.end);
    }
    
    // フォーマットされた文字起こし結果を生成
    const formattedTranscript = formatElevenLabsTranscript(response.data);
    
    // カスタムJSON形式を生成
    const customJsonData = createCustomJsonFormat(response.data, language);
    
    // 結果を構築して返す
    return {
      text: formattedTranscript,
      audioLengthSeconds: audioLengthSeconds || 0,
      customJsonData: customJsonData
    };
  } catch (error) {
    console.error('ElevenLabs API呼び出しエラー:', error.message);
    if (error.response) {
      console.error('レスポンスデータ:', JSON.stringify(error.response.data));
      console.error('レスポンスステータス:', error.response.status);
    }
    throw new Error(`ElevenLabs文字起こし処理中のエラー: ${error.message}`);
  }
}

/**
 * ElevenLabs APIのレスポンスを整形して文字起こしテキストを生成する
 * @param {object} data - ElevenLabs APIのレスポンス
 * @returns {string} 整形された文字起こしテキスト
 */
function formatElevenLabsTranscript(data) {
  if (!data.words || !Array.isArray(data.words)) {
    return data.text || '';
  }
  
  const transcript = [];
  let currentSpeaker = null;
  let currentChunks = [];

  for (const item of data.words) {
    const speaker = item.speaker_id;
    const text = item.text;

    // スピーカーが切り替わったら、これまでの内容をまとめる
    if (speaker !== currentSpeaker) {
      if (currentSpeaker !== null) {
        // 単語間のスペースを一切入れない
        transcript.push([currentSpeaker, currentChunks.join('')]);
      }
      currentSpeaker = speaker;
      currentChunks = [];
    }

    // audio_eventなら((笑い))のように()を含めて格納
    currentChunks.push(text);
  }

  // ループ終了後の最後のスピーカー
  if (currentSpeaker !== null && currentChunks.length > 0) {
    transcript.push([currentSpeaker, currentChunks.join('')]);
  }

  // 整形した結果を文字列にまとめる
  const outputLines = [];
  for (const [speaker, combinedText] of transcript) {
    outputLines.push(`**[${speaker}]**`);
    outputLines.push(combinedText);
    outputLines.push(""); // 空行で区切る
  }

  return outputLines.join("\n");
}

/**
 * ElevenLabs APIのレスポンスからカスタムJSON形式を生成する
 * @param {object} data - ElevenLabs APIのレスポンス
 * @param {string} requestedLanguage - ユーザーが指定した言語コード
 * @returns {object} カスタムJSON形式のデータ
 */
function createCustomJsonFormat(data, requestedLanguage) {
  // 音声の長さを計算
  let audioLengthSeconds = 0;
  if (data.words && data.words.length > 0) {
    const lastWord = data.words[data.words.length - 1];
    audioLengthSeconds = Math.ceil(lastWord.end);
  }

  // カスタムJSON形式を生成
  return {
    schema_version: "1.0",
    audio_duration: audioLengthSeconds,
    language: requestedLanguage, // ユーザーが指定した言語を使用
    preprocessing_info: null,
    words: data.words || []
  };
}

/**
 * Dify APIを使用して文字起こしを処理
 * 
 * @param {string} audioFileUrl - 処理する音声ファイルのURL
 * @param {string} apiKey - Dify APIキー
 * @param {string} apiUrl - Dify APIエンドポイント
 * @param {string} language - 文字起こし言語コード
 * @returns {Promise<object>} 文字起こし結果
 */
async function processDifyTranscription(audioFileUrl, apiKey, apiUrl, language) {
  console.log(`Dify API (言語: ${language}) を使用して文字起こしを開始します`);
  
  try {
    // APIリクエストのボディを構築
    const requestBody = {
      inputs: {
        audio_url: audioFileUrl,
        // language: language // Dify APIが言語パラメータを受け付けるか要確認
      },
      response_mode: "blocking",
      user: "transcription-service"
    };
    
    // Dify APIを呼び出し
    const response = await axios.post(
      `${apiUrl}/completion-messages`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );
    
    // レスポンスを検証
    if (response.status !== 200 || !response.data || !response.data.answer) {
      throw new Error('Dify APIからの無効なレスポンス');
    }
    
    console.log('Dify APIからの文字起こしが成功しました');
    
    // 結果を構築して返す
    return {
      text: response.data.answer,
      audioLengthSeconds: response.data.audio_length_seconds || 0
    };
  } catch (error) {
    console.error('Dify API呼び出しエラー:', error.message);
    if (error.response) {
      console.error('レスポンスデータ:', JSON.stringify(error.response.data));
      console.error('レスポンスステータス:', error.response.status);
    }
    throw new Error(`Dify文字起こし処理中のエラー: ${error.message}`);
  }
}

export {
  getS3SignedUrl,
  processTranscription
}; 