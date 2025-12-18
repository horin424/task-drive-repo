/* Amplify Params - DO NOT EDIT
	API_TRANSCRIPTMINUTE_GRAPHQLAPIIDOUTPUT
	API_TRANSCRIPTMINUTE_ORGANIZATIONTABLE_ARN
	API_TRANSCRIPTMINUTE_ORGANIZATIONTABLE_NAME
	ENV
	REGION
Amplify Params - DO NOT EDIT */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const organizationTableName = process.env.API_TRANSCRIPTMINUTE_ORGANIZATIONTABLE_NAME;
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

// デフォルト値
const DEFAULT_MONTHLY_MINUTES = 6000;          // 更新されたデフォルト値
const DEFAULT_MONTHLY_TASK_GENERATIONS = 100;  // 更新されたデフォルト値

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

/**
 * 組織データの正規化処理（デフォルト値適用）
 */
const normalizeOrganizationData = (orgData) => ({
  ...orgData,
  remainingTaskGenerations: orgData.remainingTaskGenerations ?? DEFAULT_MONTHLY_TASK_GENERATIONS,
  monthlyTaskGenerations: orgData.monthlyTaskGenerations ?? DEFAULT_MONTHLY_TASK_GENERATIONS,
  remainingMinutes: orgData.remainingMinutes ?? DEFAULT_MONTHLY_MINUTES,
  monthlyMinutes: orgData.monthlyMinutes ?? DEFAULT_MONTHLY_MINUTES
});

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
export const handler = async (event) => {
    log('info', 'monthlyReset開始');
    log('debug', '月次リセットイベント詳細', event);
    
    if (!organizationTableName) {
        log('error', "組織テーブル名環境変数が設定されていません");
        throw new Error("Configuration error: Organization table name not found.");
    }

    let processedCount = 0;
    let successCount = 0;
    let failureCount = 0;
    let lastEvaluatedKey = undefined;

    try {
        log('info', '月次リセットスキャン開始', { tableName: organizationTableName });
        
        do {
            const scanCommand = new ScanCommand({
                TableName: organizationTableName,
                // 全フィールドを取得してデフォルト値処理を行う
                ExclusiveStartKey: lastEvaluatedKey
            });

            const scanResult = await docClient.send(scanCommand);
            
            if (scanResult.Items && scanResult.Items.length > 0) {
                log('info', `スキャンバッチで組織を発見`, { organizationCount: scanResult.Items.length });
                for (const item of scanResult.Items) {
                    processedCount++;
                    try {
                        // 組織データを正規化（デフォルト値適用）
                        const normalizedOrg = normalizeOrganizationData(item);
                        
                        log('info', '組織リセット開始', { 
                            organizationId: item.id,
                            currentMinutes: item.remainingMinutes,
                            resetToMinutes: normalizedOrg.monthlyMinutes,
                            currentTaskGenerations: item.remainingTaskGenerations,
                            resetToTaskGenerations: normalizedOrg.monthlyTaskGenerations
                        });
                        
                        const updateCommand = new UpdateCommand({
                            TableName: organizationTableName,
                            Key: { id: item.id },
                            UpdateExpression: "SET remainingMinutes = :minutes, remainingTaskGenerations = :taskGens, monthlyMinutes = :monthlyMin, monthlyTaskGenerations = :monthlyTaskGens",
                            ExpressionAttributeValues: {
                                ":minutes": normalizedOrg.monthlyMinutes,
                                ":taskGens": normalizedOrg.monthlyTaskGenerations,
                                ":monthlyMin": normalizedOrg.monthlyMinutes,
                                ":monthlyTaskGens": normalizedOrg.monthlyTaskGenerations
                            },
                            ReturnValues: "NONE" // 更新結果は不要
                        });
                        
                        await docClient.send(updateCommand);
                        log('info', '組織リセット成功', { organizationId: item.id });
                        successCount++;
                    } catch (updateError) {
                        log('error', '組織更新失敗', { organizationId: item.id, error: updateError.message });
                        log('debug', '組織更新エラー詳細', updateError);
                        failureCount++;
                    }
                }
            } else {
                log('info', "このスキャンバッチで組織が見つからないか、スキャン完了");
            }
            lastEvaluatedKey = scanResult.LastEvaluatedKey;
            if(lastEvaluatedKey){
                log('info', "次の組織セットへページネーション中");
            }
        } while (lastEvaluatedKey);

        log('info', '月次リセット処理完了', { 
            processedCount, 
            successCount, 
            failureCount,
            defaultValues: {
                monthlyMinutes: DEFAULT_MONTHLY_MINUTES,
                monthlyTaskGenerations: DEFAULT_MONTHLY_TASK_GENERATIONS
            }
        });
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Monthly reset completed successfully.",
                processedCount,
                successCount,
                failureCount,
                defaultValues: {
                    monthlyMinutes: DEFAULT_MONTHLY_MINUTES,
                    monthlyTaskGenerations: DEFAULT_MONTHLY_TASK_GENERATIONS
                }
            }),
        };

    } catch (scanError) {
        log('error', "月次リセットスキャンまたは全体プロセス中にエラー", { error: scanError.message });
        log('debug', "月次リセットエラー詳細", scanError);
        throw new Error(`Error during monthly reset: ${scanError.message}`);
    }
};
