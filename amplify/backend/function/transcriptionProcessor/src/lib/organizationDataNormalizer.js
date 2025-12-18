/* 
 * 組織データ正規化モジュール
 * 
 * ⚠️ 重要: この機能は将来的に削除される可能性があります
 * 既存組織への初期値適用のための一時的な実装です
 * 
 * 機能削除時の手順:
 * 1. このファイルを削除
 * 2. 各Lambda関数から normalizeAndEnsureOrganizationDefaults の呼び出しを削除
 * 3. 関連するimport文を削除
 */

import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

// デフォルト値定数
const DEFAULT_MONTHLY_MINUTES = 6000;
const DEFAULT_MONTHLY_TASK_GENERATIONS = 100;

/**
 * 組織データの正規化とデフォルト値設定
 * @param {import('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient} docClient - DynamoDB Document Client
 * @param {string} tableName - Organization テーブル名
 * @param {string} organizationId - 組織ID
 * @returns {Promise<Object>} 正規化された組織データ
 */
export const normalizeAndEnsureOrganizationDefaults = async (docClient, tableName, organizationId) => {
  console.log(`⚠️ [TEMP] Normalizing organization data for: ${organizationId}`);
  
  // 1. 組織データを取得
  const getCommand = new GetCommand({
    TableName: tableName,
    Key: { id: organizationId }
  });
  
  const result = await docClient.send(getCommand);
  if (!result.Item) {
    throw new Error(`Organization not found: ${organizationId}`);
  }
  
  const orgData = result.Item;
  
  // 2. デフォルト値が必要かチェック
  const needsUpdate = 
    orgData.remainingTaskGenerations === null || orgData.remainingTaskGenerations === undefined ||
    orgData.monthlyTaskGenerations === null || orgData.monthlyTaskGenerations === undefined ||
    orgData.monthlyMinutes === null || orgData.monthlyMinutes === undefined;
  
  // 3. 必要に応じてDynamoDBを更新
  if (needsUpdate) {
    console.log(`⚠️ [TEMP] Applying default values to organization ${organizationId}`);
    
    const updateCommand = new UpdateCommand({
      TableName: tableName,
      Key: { id: organizationId },
      UpdateExpression: "SET " +
        "#rtg = if_not_exists(#rtg, :defaultTaskGens), " +
        "#mtg = if_not_exists(#mtg, :defaultTaskGens), " +
        "#mm = if_not_exists(#mm, :defaultMinutes)",
      ExpressionAttributeNames: {
        "#rtg": "remainingTaskGenerations",
        "#mtg": "monthlyTaskGenerations", 
        "#mm": "monthlyMinutes"
      },
      ExpressionAttributeValues: {
        ":defaultTaskGens": DEFAULT_MONTHLY_TASK_GENERATIONS,
        ":defaultMinutes": DEFAULT_MONTHLY_MINUTES
      },
      ReturnValues: "ALL_NEW"
    });
    
    const updateResult = await docClient.send(updateCommand);
    console.log(`⚠️ [TEMP] Default values applied successfully for organization ${organizationId}`);
    return updateResult.Attributes;
  }
  
  // 4. メモリ上での正規化（念のため）
  const normalizedData = {
    ...orgData,
    remainingTaskGenerations: orgData.remainingTaskGenerations ?? DEFAULT_MONTHLY_TASK_GENERATIONS,
    monthlyTaskGenerations: orgData.monthlyTaskGenerations ?? DEFAULT_MONTHLY_TASK_GENERATIONS,
    remainingMinutes: orgData.remainingMinutes ?? DEFAULT_MONTHLY_MINUTES,
    monthlyMinutes: orgData.monthlyMinutes ?? DEFAULT_MONTHLY_MINUTES
  };
  
  console.log(`⚠️ [TEMP] Organization data normalized for: ${organizationId}`);
  return normalizedData;
};

/**
 * メモリ上での組織データ正規化のみ（DB更新なし）
 * @param {Object} orgData - 組織データ
 * @returns {Object} 正規化された組織データ
 */
export const normalizeOrganizationDataInMemory = (orgData) => ({
  ...orgData,
  remainingTaskGenerations: orgData.remainingTaskGenerations ?? DEFAULT_MONTHLY_TASK_GENERATIONS,
  monthlyTaskGenerations: orgData.monthlyTaskGenerations ?? DEFAULT_MONTHLY_TASK_GENERATIONS,
  remainingMinutes: orgData.remainingMinutes ?? DEFAULT_MONTHLY_MINUTES,
  monthlyMinutes: orgData.monthlyMinutes ?? DEFAULT_MONTHLY_MINUTES
}); 