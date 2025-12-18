import fetch from 'node-fetch'; // ESMスタイルに変更
import AWS from 'aws-sdk'; // ESMスタイルに変更

const APPSYNC_API_URL = process.env.APPSYNC_API_URL;
// const APPSYNC_API_KEY = process.env.APPSYNC_API_KEY; // APIキーは不要

// sessionIdで検索するためのGraphQLクエリ
const listProcessingSessionsBySessionIdQuery = ` 
query ListProcessingSessionsBySessionId($sessionId: String!, $limit: Int, $nextToken: String) {
  processingSessionsBySessionId(sessionId: $sessionId, limit: $limit, nextToken: $nextToken) {
    items {
      id
      owner
      status
      transcriptKey
      bulletPointsKey
      minutesKey
      fileName
      language
      createdAt
      updatedAt
      identityId
      sessionId
      organizationID
    }
    nextToken
  }
}`;

// GraphQLクライアント関数
async function callGraphQL(query, variables) {
  try {
    // AppSyncエンドポイントURLを解析
    const endpoint = new URL(APPSYNC_API_URL);

    // AWS SDK v2 を使用してリクエストを作成
    const request = new AWS.HttpRequest(endpoint, process.env.REGION);

    request.method = 'POST';
    request.headers['Content-Type'] = 'application/json';
    request.headers['Host'] = endpoint.host; // hostヘッダーを明示的に設定
    request.path = endpoint.pathname; // 署名対象のパスを正しく設定
    request.body = JSON.stringify({
      query,
      variables
    });

    // IAM認証情報を使用してリクエストに署名
    const signer = new AWS.Signers.V4(request, 'appsync');
    signer.addAuthorization(AWS.config.credentials, new Date());

    // 署名付きリクエストを node-fetch で送信
    const response = await fetch(APPSYNC_API_URL, {
      method: request.method,
      headers: request.headers,
      body: request.body
    });

    const json = await response.json();
    
    // エラーチェック
    if (json.errors) {
      console.error('GraphQL errors:', JSON.stringify(json.errors));
      // エラー内容をより詳細に出力
      json.errors.forEach(err => console.error('GraphQL Error Details:', err)); 
      throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
    }
    
    return json;
  } catch (error) {
    console.error('GraphQL API呼び出しエラー:', error);
    // スタックトレースも出力
    console.error(error.stack); 
    throw error;
  }
}

// カスタム sessionId で ProcessingSession を取得する関数
async function getProcessingSessionByCustomSessionId(customSessionId) {
  if (!customSessionId) {
    console.error('getProcessingSessionByCustomSessionId: customSessionId is null or undefined');
    return null; // またはエラーをスロー
  }
  try {
    const response = await callGraphQL(listProcessingSessionsBySessionIdQuery, { 
      sessionId: customSessionId,
      limit: 1 // sessionId は一意なので、1件取得できれば十分
    });
    // processingSessionsBySessionId クエリは items 配列を返す
    if (response.data?.processingSessionsBySessionId?.items?.length > 0) {
      return response.data.processingSessionsBySessionId.items[0];
    }
    return null; // 見つからなかった場合
  } catch (error) {
    console.error(`Error fetching ProcessingSession by customSessionId ${customSessionId}:`, error);
    throw error; // エラーを再スローするか、null を返すかは呼び出し側のエラーハンドリングによる
  }
}

export { getProcessingSessionByCustomSessionId }; 