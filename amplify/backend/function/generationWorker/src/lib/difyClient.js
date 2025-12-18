import axios from 'axios';
import FormData from 'form-data';

// S3からファイルを取得するヘルパー関数
async function getS3File(s3, bucket, key) {
  try {
    const params = { Bucket: bucket, Key: key };
    const data = await s3.getObject(params).promise();
    return data.Body;
  } catch (error) {
    console.error(`S3からのファイル取得エラー (Bucket: ${bucket}, Key: ${key}):`, error);
    throw new Error(`S3からのファイル取得に失敗しました: ${key}`);
  }
}

// Difyにファイルをアップロードするヘルパー関数
async function uploadFileToDify(fileBuffer, fileName, mimeType, apiKey, apiUrl, userId) {
  const form = new FormData();
  form.append('file', fileBuffer, { filename: fileName, contentType: mimeType });
  form.append('user', userId);

  try {
    const response = await axios.post(`${apiUrl}/files/upload`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    console.log(`Difyへのファイルアップロード成功: ${fileName}, file_id: ${response.data.id}`);
    return response.data.id;
  } catch (error) {
    console.error(`Difyへのファイルアップロードエラー (${fileName}):`, error.response ? JSON.stringify(error.response.data) : error.message);
    throw new Error(`Difyへのファイルアップロードに失敗しました: ${fileName}`);
  }
}

// シークレットマネージャーからAPIキーを取得する関数
async function getApiKeys(secretsManager, secretArn) {
  try {
    const secretData = await secretsManager.getSecretValue({
      SecretId: secretArn
    }).promise();

    if (!secretData.SecretString) {
      throw new Error('シークレット文字列が空です');
    }

    const secrets = JSON.parse(secretData.SecretString);
    if (!secrets.dify_bullet_points_api_key || !secrets.dify_minutes_api_key) {
      console.warn('Secrets Manager には、dify_bullet_points_api_key, dify_minutes_api_key のどちらか、または両方が不足している可能性があります。');
    }
    return secrets;

  } catch (error) {
    console.error('APIキー取得エラー:', error);
    throw error;
  }
}

// 長いテキストを分割する関数（APIの制限に対応）
// 話者の切り替わりを考慮して分割する
function splitTranscript(transcript, maxLength = 6000) {
  if (transcript.length <= maxLength) return [transcript];
  
  const chunks = [];
  let startIndex = 0;
  
  while (startIndex < transcript.length) {
    // 最大文字数でカット
    let endIndex = Math.min(startIndex + maxLength, transcript.length);
    
    // 最後まで到達していない場合、適切な区切り位置を探す
    if (endIndex < transcript.length) {
      // 1. 話者の切り替わりを最優先で探す（**[speaker_X]**形式）
      const speakerPattern = /\*\*\[([^\]]+)\]\*\*/g;
      let bestSpeakerEnd = -1;
      let match;
      
      // startIndexから少し後ろから検索開始（最低限の内容を確保）
      const minSearchStart = startIndex + Math.floor(maxLength * 0.3);
      
      speakerPattern.lastIndex = 0; // 正規表現のlastIndexをリセット
      while ((match = speakerPattern.exec(transcript)) !== null) {
        const speakerStart = match.index;
        if (speakerStart >= minSearchStart && speakerStart <= endIndex) {
          bestSpeakerEnd = speakerStart;
        }
        if (speakerStart > endIndex) break;
      }
      
      // 話者の切り替わりが見つかった場合、そこで区切る
      if (bestSpeakerEnd > startIndex) {
        endIndex = bestSpeakerEnd;
      } else {
        // 2. 話者の切り替わりが見つからない場合、文または段落の区切りで切る
        const sentenceEnd = transcript.lastIndexOf('.', endIndex);
        const paragraphEnd = transcript.lastIndexOf('\n', endIndex);
        
        // 文または段落の終わりが適度な位置にあれば、そこで切る
        if (sentenceEnd > startIndex + maxLength * 0.7) {
          endIndex = sentenceEnd + 1; // ピリオドを含める
        } else if (paragraphEnd > startIndex + maxLength * 0.7) {
          endIndex = paragraphEnd + 1; // 改行を含める
        }
      }
    }
    
    chunks.push(transcript.substring(startIndex, endIndex));
    startIndex = endIndex;
  }
  
  return chunks;
}

// チャンクから最後の話者を取得する関数
function getLastSpeakerFromChunk(chunk) {
  // **[speaker_X]**形式の話者タグを全て検索
  const speakerPattern = /\*\*\[([^\]]+)\]\*\*/g;
  let lastSpeaker = null;
  let match;
  
  while ((match = speakerPattern.exec(chunk)) !== null) {
    lastSpeaker = match[1];
  }
  
  return lastSpeaker;
}

// 話者の文脈を保持してテキストを分割する関数
function splitTranscriptWithSpeakerContext(transcript, maxLength = 6000) {
  // 元のテキストが短い場合はそのまま返す
  if (transcript.length <= maxLength) return [transcript];
  
  // 基本的なチャンク分割を実行
  const chunks = splitTranscript(transcript, maxLength);
  const contextualChunks = [];
  
  for (let i = 0; i < chunks.length; i++) {
    let chunk = chunks[i].trim();
    
    // チャンクの最初に話者名があるかチェック
    const startsWithSpeaker = /^\*\*\[([^\]]+)\]\*\*/.test(chunk);
    
    if (!startsWithSpeaker && i > 0) {
      // 前のチャンクから最後の話者を取得
      const lastSpeaker = getLastSpeakerFromChunk(contextualChunks[i-1]);
      if (lastSpeaker) {
        // 話者名を先頭に追加し、改行で区切る
        chunk = `**[${lastSpeaker}]**:\n${chunk}`;
      }
    }
    
    contextualChunks.push(chunk);
  }
  
  return contextualChunks;
}

// 箇条書き生成APIを呼び出す関数
async function generateBulletPoints(transcript, apiKey, apiUrl, userId) {
  try {
    // 話者の文脈を保持してテキストを分割
    const chunks = splitTranscriptWithSpeakerContext(transcript);
    let allBulletPoints = '';
    
    // 各チャンクを順番に処理
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      const response = await axios.post(
        `${apiUrl}/chat-messages`,
        {
          query: chunk,
          response_mode: 'blocking',
          inputs: {},
          user: userId
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          }
        }
      );
      
      // 応答テキストを追加
      allBulletPoints += response.data.answer + '\n\n';
    }
    
    return allBulletPoints.trim();
  } catch (error) {
    console.error('箇条書き生成エラー:', error.response ? JSON.stringify(error.response.data) : error.message);
    throw new Error(`箇条書き生成に失敗しました: ${error.response ? error.response.data.message : error.message}`);
  }
}

// 議事録生成APIを呼び出す関数
async function generateMinutes(transcript, apiKey, apiUrl, userId) {
  try {
    const response = await axios.post(
      `${apiUrl}/chat-messages`,
      {
        query: transcript,
        response_mode: 'blocking',
        inputs: {},
        user: userId
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );
    
    return response.data.answer.trim();
  } catch (error) {
    console.error('議事録生成エラー:', error.response ? JSON.stringify(error.response.data) : error.message);
    throw new Error(`議事録生成に失敗しました: ${error.response ? error.response.data.message : error.message}`);
  }
}

// タスク一覧生成のメインロジック
async function generateTasks(s3, s3Bucket, transcript, taskFileKey, informationFileKey, apiKey, apiUrl, identityId) {
  console.log('タスク生成処理を開始します。');
  const userId = identityId;

  console.log('Step 1/5: S3からのファイル取得とBuffer作成');
  // S3キーにprivate/identityId/プレフィックスを追加
  const fullTaskFileKey = `private/${identityId}/${taskFileKey}`;
  const fullInformationFileKey = `private/${identityId}/${informationFileKey}`;
  
  const taskFileBuffer = await getS3File(s3, s3Bucket, fullTaskFileKey);
  const informationFileBuffer = await getS3File(s3, s3Bucket, fullInformationFileKey);
  const transcriptBuffer = Buffer.from(transcript, 'utf-8');
  console.log('  > 完了');

  console.log('Step 2/5: Difyへのファイルアップロード');
  const [taskUploadId, infoUploadId, transcriptUploadId] = await Promise.all([
    uploadFileToDify(taskFileBuffer, 'task.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', apiKey, apiUrl, userId),
    uploadFileToDify(informationFileBuffer, 'information.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', apiKey, apiUrl, userId),
    uploadFileToDify(transcriptBuffer, 'transcription.txt', 'text/plain', apiKey, apiUrl, userId),
  ]);
  console.log('  > 完了');

  console.log('Step 3/5: DifyのメインAPI呼び出し (ストリーミング)');
  const streamResponse = await axios.post(
    `${apiUrl}/chat-messages`,
    {
      inputs: {
        task: { type: 'document', transfer_method: 'local_file', upload_file_id: taskUploadId },
        information: { type: 'document', transfer_method: 'local_file', upload_file_id: infoUploadId },
        transcription: { type: 'document', transfer_method: 'local_file', upload_file_id: transcriptUploadId },
      },
      query: "please generate task list.",
      response_mode: 'streaming',
      user: userId
    },
    {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      responseType: 'stream',
    }
  );
  console.log('  > API呼び出し成功、レスポンス待機');

  console.log('Step 4/5: ストリームから結果URLを抽出');
  let fileUrl = '';
  const stream = streamResponse.data;

  const urlPromise = new Promise((resolve, reject) => {
    stream.on('data', (chunk) => {
      const chunkStr = chunk.toString();
      const lines = chunkStr.split('\n').filter(line => line.startsWith('data: '));

      for (const line of lines) {
        try {
          const jsonData = JSON.parse(line.substring(5));
          if (jsonData.event === 'message_end' || jsonData.event === 'workflow_finished') {
            if (jsonData.files && jsonData.files.length > 0 && jsonData.files[0].url) {
              fileUrl = jsonData.files[0].url;
              console.log(`  > 結果ファイルURLを発見: ${fileUrl}`);
              resolve(fileUrl);
              stream.destroy();
              return;
            } else if (jsonData.data?.outputs?.answer) {
                const answer = jsonData.data.outputs.answer;
                const urlMatch = answer.match(/https:\/\/[^)]+/);
                if (urlMatch) {
                    fileUrl = urlMatch[0];
                    console.log(`  > 結果ファイルURLを発見 (フォールバック): ${fileUrl}`);
                    resolve(fileUrl);
                    stream.destroy();
                    return;
                }
            }
          }
        } catch {
          // JSONパースエラーは無視して継続
        }
      }
    });

    stream.on('end', () => {
      if (!fileUrl) {
        reject(new Error('ストリームから結果ファイルのURLを抽出できませんでした。'));
      }
    });

    stream.on('error', (err) => {
      reject(new Error(`ストリーム処理エラー: ${err.message}`));
    });
  });

  await urlPromise;
  console.log('  > 完了');

  console.log('Step 5/5: 結果ファイルをダウンロード');
  // 相対パスの場合は、DifyのベースURLと結合する
  const downloadUrl = fileUrl.startsWith('http') ? fileUrl : `${apiUrl.replace('/v1', '')}${fileUrl}`;
  console.log(`  > ダウンロードURL: ${downloadUrl}`);
  
  const fileResponse = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
  console.log(`  > ダウンロード成功 (サイズ: ${fileResponse.data.length} bytes)`);
  
  return fileResponse.data;
}

export {
  getApiKeys,
  generateBulletPoints,
  generateMinutes,
  generateTasks,
  splitTranscript
}; 