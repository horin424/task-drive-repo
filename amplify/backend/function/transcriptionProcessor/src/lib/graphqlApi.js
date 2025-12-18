/**
 * GraphQL API関連のユーティリティ関数
 */

// ⚠️ 将来削除予定: 組織データ正規化モジュールのimport
import { normalizeAndEnsureOrganizationDefaults } from './organizationDataNormalizer.js';

// GraphQL変異操作の定義
const UPDATE_PROCESSING_SESSION_MUTATION = `
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
  }
}`;

// ★ 新しいミューテーション用のGraphQL定義

// ★ 新しいミューテーション: アトミックな残り時間減算
const DECREASE_ORGANIZATION_REMAINING_MINUTES_MUTATION = `
  mutation DecreaseOrganizationRemainingMinutes($input: DecreaseOrganizationRemainingMinutesInput!) {
    decreaseOrganizationRemainingMinutes(input: $input) {
      id
      remainingMinutes
    }
  }
`;

// ★ 削除: 使用されなくなったクエリ

// ★ 追加: ProcessingSession取得用のクエリ
const GET_PROCESSING_SESSION_QUERY = `
  query GetProcessingSession($id: ID!) {
    getProcessingSession(id: $id) {
      id
      status
      language # ★ language を取得
      fileName # ★ fileName を取得
      organizationID
      owner
      # 必要に応じて他のフィールドも追加
    }
  }
`;

// ★ 追加: sessionId で ProcessingSession を検索するためのクエリ (GSI bySessionId を使用)
const GET_PROCESSING_SESSION_BY_SESSION_ID_QUERY = `
  query GetProcessingSessionBySessionId($sessionId: String!) {
    processingSessionsBySessionId(sessionId: $sessionId) {
      items {
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
      }
      nextToken
    }
  }
`;

/**
 * ProcessingSessionをIDで取得する
 * 
 * @param {object} appsyncClient - AWS AppSync GraphQLクライアント
 * @param {string} sessionId - 取得するProcessingSessionのID
 * @returns {Promise<object|null>} ProcessingSession データ、見つからない場合は null
 */
export async function getProcessingSession(appsyncClient, sessionId) {
  console.log(`ProcessingSession を取得します - ID: ${sessionId}`);
  try {
    const response = await appsyncClient.graphql({
      query: GET_PROCESSING_SESSION_QUERY,
      variables: { id: sessionId }
    });

    if (response.errors) {
      console.error(`GraphQL エラー (getProcessingSession): ${JSON.stringify(response.errors)}`);
      // エラーがあっても null を返すことで、呼び出し元でのハンドリングを容易にする
      return null; 
    }

    if (!response.data || !response.data.getProcessingSession) {
        console.warn(`ProcessingSession が見つかりません - ID: ${sessionId}`);
        return null;
    }

    console.log(`ProcessingSession を取得しました - ID: ${sessionId}`);
    return response.data.getProcessingSession;
  } catch (error) {
    console.error(`ProcessingSession 取得エラー - ID: ${sessionId}:`, error);
    // 例外が発生した場合も null を返す
    return null;
  }
}

/**
 * ProcessingSessionを sessionId で取得する (GSI を使用)
 * 
 * @param {object} appsyncClient - AWS AppSync GraphQLクライアント
 * @param {string} sessionIdValue - 検索する sessionId の値
 * @returns {Promise<object|null>} ProcessingSession データ (配列の最初の要素)、見つからない場合は null
 */
export async function getProcessingSessionBySessionId(appsyncClient, sessionIdValue) {
  console.log(`ProcessingSession を sessionId で取得します - sessionId: ${sessionIdValue}`);
  try {
    const response = await appsyncClient.graphql({
      query: GET_PROCESSING_SESSION_BY_SESSION_ID_QUERY,
      variables: { sessionId: sessionIdValue } // クエリ変数名を sessionId に合わせる
    });

    if (response.errors) {
      console.error(`GraphQL エラー (getProcessingSessionBySessionId): ${JSON.stringify(response.errors)}`);
      return null; 
    }

    const items = response.data?.processingSessionsBySessionId?.items;
    if (!items || items.length === 0) {
        console.warn(`ProcessingSession が見つかりません - sessionId: ${sessionIdValue}`);
        return null;
    }

    console.log(`ProcessingSession を sessionId で取得しました - sessionId: ${sessionIdValue}, result:`, items[0]);
    return items[0]; // GSIからのクエリは items 配列で返ってくるので最初の要素を取得
  } catch (error) {
    console.error(`ProcessingSession 取得エラー (sessionId: ${sessionIdValue}):`, error);
    return null;
  }
}

/**
 * ProcessingSessionのステータスを更新する
 * 
 * @param {object} appsyncClient - AWS AppSync GraphQLクライアント
 * @param {string} sessionId - 更新するProcessingSessionのID
 * @param {string} status - 新しいステータス値
 * @param {object} additionalData - 追加の更新データ (オプション)
 * @returns {Promise<object>} 更新されたProcessingSession
 */
export async function updateProcessingSession(appsyncClient, sessionId, status, additionalData = {}) {
  console.log(`ProcessingSession ${sessionId} のステータスを更新: ${status}`);
  
  // 更新入力の作成
  // owner情報を明示的に含めない場合は取得処理を行う
  let input = {
    id: sessionId,
    status,
    ...additionalData
  };
  
  // owner情報が含まれていない場合、既存のデータから取得
  if (!input.owner) {
    try {
      const existingSession = await getProcessingSession(appsyncClient, sessionId);
      if (existingSession && existingSession.owner) {
        console.log(`既存のowner情報を維持: ${existingSession.owner}`);
        input.owner = existingSession.owner;
      }
    } catch (err) {
      console.warn(`既存レコードからownerを取得できませんでした。更新は継続します: ${err.message}`);
    }
  }
  
  try {
    // GraphQL API呼び出し
    const response = await appsyncClient.graphql({
      query: UPDATE_PROCESSING_SESSION_MUTATION,
      variables: {
        input
      }
    });
    
    if (response.errors) {
      throw new Error(`GraphQL エラー: ${JSON.stringify(response.errors)}`);
    }
    
    console.log(`ProcessingSession ${sessionId} が正常に更新されました`);
    return response.data.updateProcessingSession;
  } catch (error) {
    console.error(`ProcessingSession更新エラー:`, error);
    throw new Error(`ProcessingSession ${sessionId} の更新に失敗しました: ${error.message}`);
  }
}

/**
 * ProcessingSessionが完了したことをマークする
 * 
 * @param {object} appsyncClient - AWS AppSync GraphQLクライアント
 * @param {string} sessionId - 更新するProcessingSessionのID
 * @param {string} transcriptKey - S3内の生文字起こしのキー
 * @param {number} audioLengthSeconds - 音声の長さ（秒）
 * @returns {Promise<object>} 更新されたProcessingSession
 */
export async function markTranscriptionComplete(
  appsyncClient,
  sessionId,
  transcriptKey,
  audioLengthSeconds
) {
  console.log(`ProcessingSessionを更新します - ID: ${sessionId}, 文字起こしキー: ${transcriptKey}, 音声長: ${audioLengthSeconds}秒`);

  // ProcessingSessionの情報を取得して、ownerを維持する
  const sessionData = await getProcessingSession(appsyncClient, sessionId);
  if (!sessionData) {
    console.error(`更新対象のProcessingSessionが見つかりません: ${sessionId}`);
    throw new Error(`ProcessingSession ${sessionId} not found`);
  }

  // 元のowner情報を保持する
  const owner = sessionData.owner;
  console.log(`現在のowner値: ${owner}、この値を維持して更新します`);

  // ★★★ 修正: 処理順序を変更 - 先に組織の残り時間を更新 ★★★
  
  // 1. 使用時間を計算 (秒数を分に切り上げ)
  const usedMinutes = Math.ceil(audioLengthSeconds / 60);
  console.log(`音声長 ${audioLengthSeconds} 秒から計算された使用時間: ${usedMinutes} 分`);

  // 2. 組織の残り時間をアトミックに減算
  const organizationId = sessionData.organizationID;
  if (!organizationId) {
    console.error(`セッション ${sessionId} から organizationID が取得できませんでした。`);
    throw new Error(`ProcessingSession ${sessionId} に organizationID が設定されていません`);
  }

  // ⚠️ 将来削除予定: 組織データの正規化と使用時間チェック
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient } = await import("@aws-sdk/lib-dynamodb");
  const client = new DynamoDBClient({});
  const docClient = DynamoDBDocumentClient.from(client);
  const organizationTableName = process.env.API_TRANSCRIPTMINUTE_ORGANIZATIONTABLE_NAME;

  const normalizedOrg = await normalizeAndEnsureOrganizationDefaults(
    docClient,
    organizationTableName,
    organizationId
  );

  // 使用時間不足チェック
  if (normalizedOrg.remainingMinutes < usedMinutes) {
    const errorMessage = `使用時間が不足しています。必要: ${usedMinutes}分, 残り: ${normalizedOrg.remainingMinutes}分`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  console.log(`組織 ${organizationId} の残り時間から ${usedMinutes} 分を減算します`);

  try {
    // リクエスト内容をログ出力
    const requestInput = {
      id: organizationId,
      decreaseBy: usedMinutes
    };
    console.log(`GraphQLリクエスト送信: decreaseOrganizationRemainingMinutes`, JSON.stringify(requestInput));

    // decreaseOrganizationRemainingMinutes ミューテーションを実行
    const decreaseResult = await appsyncClient.graphql({
      query: DECREASE_ORGANIZATION_REMAINING_MINUTES_MUTATION,
      variables: {
        input: requestInput
      }
    });

    console.log(`GraphQLレスポンス受信: ${JSON.stringify(decreaseResult)}`);

    // GraphQLエラーをチェック
    if (decreaseResult.errors) {
      console.error(`GraphQLエラー (decreaseOrganizationRemainingMinutes): ${JSON.stringify(decreaseResult.errors)}`);
      throw new Error(`GraphQL errors: ${JSON.stringify(decreaseResult.errors)}`);
    }

    const updatedOrganization = decreaseResult.data?.decreaseOrganizationRemainingMinutes;
    if (updatedOrganization) {
      console.log(`組織 ${organizationId} の残り時間が正常に更新されました。新しい残り時間: ${updatedOrganization.remainingMinutes} 分`);
    } else {
      console.error(`decreaseOrganizationRemainingMinutes の結果が null です。レスポンス: ${JSON.stringify(decreaseResult)}`);
      throw new Error('残り時間の減算処理で有効な結果が返されませんでした');
    }

  } catch (error) {
    console.error(`組織 ${organizationId} の残り時間更新中にエラーが発生しました:`, error);
    
    // ConditionalCheckFailedException (残高不足) の場合の特別処理
    if (error.errors && error.errors.some(e => e.extensions?.errorType === 'ConditionalCheckFailedException')) {
      const errorMessage = `組織の残り使用時間が不足しています。必要: ${usedMinutes} 分`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    } else {
      // その他のエラーの場合も失敗として扱う
      const errorMessage = `組織の使用時間更新に失敗しました: ${error.message}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  // 3. ProcessingSession を更新 (ステータスを PENDING_SPEAKER_EDIT に)
  const updatedSession = await updateProcessingSession(appsyncClient, sessionId, 'PENDING_SPEAKER_EDIT', {
      transcriptKey,
      audioLengthSeconds,
      transcriptFormat: 'JSON', // カスタムJSON形式であることを示す
      owner // 元のowner値を明示的に含める
  });

  return updatedSession; // ProcessingSessionの更新結果を返す
}

/**
 * ProcessingSessionが失敗したことをマークする
 * 
 * @param {object} appsyncClient - AWS AppSync GraphQLクライアント
 * @param {string} sessionId - 更新するProcessingSessionのID
 * @param {string} errorMessage - エラーメッセージ
 * @param {object} additionalData - 追加の更新データ (オプション)
 * @returns {Promise<object>} 更新されたProcessingSession
 */
export async function markTranscriptionFailed(
  appsyncClient,
  sessionId,
  errorMessage,
  additionalData = {}
) {
  console.log(`ProcessingSessionの失敗をマークします - ID: ${sessionId}, エラー: ${errorMessage}`);
  
  // updateProcessingSession を使用して更新
  try {
    const result = await updateProcessingSession(appsyncClient, sessionId, 'TRANSCRIPTION_FAILED', { 
      errorMessage: errorMessage || 'Unknown error', // エラーメッセージを設定
      ...additionalData
    });
    console.log('ProcessingSession 失敗ステータス更新完了');
    return result;
  } catch (error) {
    // updateProcessingSession内でエラーログは出力されるのでここでは再スローのみ
    console.error(`markTranscriptionFailed 内でのエラー: ${error.message}`);
    throw error;
  }
} 