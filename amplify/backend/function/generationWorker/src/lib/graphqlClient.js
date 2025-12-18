import fetch from 'node-fetch'; // ESMスタイルに変更
import AWS from 'aws-sdk'; // ESMスタイルに変更

const APPSYNC_API_URL = process.env.API_TRANSCRIPTMINUTE_GRAPHQLAPIENDPOINTOUTPUT; // 環境変数をAmplify提供のものに修正
// const APPSYNC_API_KEY = process.env.APPSYNC_API_KEY; // APIキーは不要

// GraphQLクエリとミューテーションの定義
const updateProcessingSessionMutation = `
mutation UpdateProcessingSession($input: UpdateProcessingSessionInput!) {
  updateProcessingSession(input: $input) {
    id
    owner
    identityId
    sessionId
    organizationID
    fileName
    language
    status
    uploadTime
    transcriptKey
    bulletPointsKey
    minutesKey
    audioLengthSeconds
    errorMessage
    transcriptFormat
    createdAt
    updatedAt
    __typename
    tasksKey
  }
}`;

// ★ 新しいミューテーション: タスク生成回数減算
const decreaseOrganizationTaskGenerationsMutation = `
mutation DecreaseOrganizationTaskGenerations($input: DecreaseOrganizationTaskGenerationsInput!) {
  decreaseOrganizationTaskGenerations(input: $input) {
    id
    remainingTaskGenerations
    remainingMinutes
    name
  }
}`;

// ★★★ 変更点: sessionId で検索するためのGraphQLクエリを追加 ★★★
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
      tasksKey
      fileName
      language
      createdAt
      updatedAt
      identityId
      sessionId # sessionId も取得対象に含めておく
      organizationID
    }
    nextToken
  }
}`;

// ★★★ 変更なし: IDで取得する既存のクエリも残しておく（他で使われている可能性のため） ★★★
const getProcessingSessionQuery = `
query GetProcessingSession($id: ID!) {
  getProcessingSession(id: $id) {
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
}`;

// GraphQLクライアント関数
async function callGraphQL(query, variables) {
  try {

    await new Promise((res, rej) => {
      AWS.config.credentials.get(err => (err ? rej(err) : res()))
    })
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

// ProcessingSessionの更新
async function updateProcessingSession(id, status, transcriptKey = null, bulletPointsKey = null, minutesKey = null, tasksKey = null) {
  // まず現在のセッション情報を取得してownerを維持
  const currentSessionResult = await getProcessingSession(id); // AppSync IDで取得
  const owner = currentSessionResult?.data?.getProcessingSession?.owner;
  
  const input = {
    id,
    status
  };

  if (transcriptKey) {
    input.transcriptKey = transcriptKey;
  }
  
  if (bulletPointsKey) {
    input.bulletPointsKey = bulletPointsKey;
  }
  
  if (minutesKey) {
    input.minutesKey = minutesKey;
  }

  if (tasksKey) {
    input.tasksKey = tasksKey;
  }
  
  // 既存のowner情報があれば維持
  if (owner) {
    console.log(`既存のowner情報を維持します: ${owner}`);
    input.owner = owner;
  }

  return callGraphQL(updateProcessingSessionMutation, { input });
}

// ★★★ 変更点: カスタム sessionId で ProcessingSession を取得する新しい関数 ★★★
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

// ★★★ 変更なし: IDで取得する既存の関数も残しておく ★★★
async function getProcessingSession(id) {
  return callGraphQL(getProcessingSessionQuery, { id });
}

// ★ 新しい関数: タスク生成回数減算
async function decreaseTaskGenerations(organizationId, decreaseBy) {
  console.log(`タスク生成回数を減算します: organizationId=${organizationId}, decreaseBy=${decreaseBy}`);
  try {
    const response = await callGraphQL(decreaseOrganizationTaskGenerationsMutation, {
      input: {
        id: organizationId,
        decreaseBy: decreaseBy
      }
    });
    console.log('タスク生成回数減算成功:', response.data?.decreaseOrganizationTaskGenerations);
    return response.data?.decreaseOrganizationTaskGenerations;
  } catch (error) {
    console.error('タスク生成回数減算エラー:', error);
    throw error;
  }
}

// ★★★ 変更点: 新しい関数をエクスポート ★★★
export { updateProcessingSession, getProcessingSession, getProcessingSessionByCustomSessionId, decreaseTaskGenerations }; 