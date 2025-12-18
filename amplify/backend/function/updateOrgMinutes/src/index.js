/* Amplify Params - DO NOT EDIT
	API_TRANSCRIPTMINUTE_GRAPHQLAPIIDOUTPUT
	API_TRANSCRIPTMINUTE_ORGANIZATIONTABLE_ARN
	API_TRANSCRIPTMINUTE_ORGANIZATIONTABLE_NAME
	ENV
	REGION
Amplify Params - DO NOT EDIT */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

// 環境変数からOrganizationテーブル名を取得
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

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
export const handler = async (event) => {
    log('info', 'updateOrgMinutes開始');
    log('debug', 'イベント詳細', event);

    if (!event.arguments || !event.arguments.input) {
        log('error', "入力引数が不足または無効です");
        throw new Error("Input arguments are missing or invalid.");
    }

    const { id, decreaseBy } = event.arguments.input;

    if (typeof id !== 'string' || id.trim() === '') {
        log('error', "入力'id'が不足または無効です");
        throw new Error("Input 'id' is missing or invalid.");
    }

    if (typeof decreaseBy !== 'number' || decreaseBy <= 0) {
        log('error', "入力'decreaseBy'は正の数である必要があります");
        throw new Error("Decrease value must be a positive number.");
    }

    if (!organizationTableName) {
        log('error', "組織テーブル名環境変数が設定されていません");
        throw new Error("Configuration error: Organization table name not found.");
    }

    log('info', '組織時間減算処理開始', { organizationId: id, decreaseBy });

    const command = new UpdateCommand({
        TableName: organizationTableName,
        Key: { id },
        // アトミックに remainingMinutes を decreaseBy だけ減算
        // 同時に、現在の remainingMinutes が decreaseBy 以上であることを確認
        UpdateExpression: "SET remainingMinutes = remainingMinutes - :val",
        ConditionExpression: "remainingMinutes >= :val",
        ExpressionAttributeValues: {
            ":val": decreaseBy
        },
        ReturnValues: "ALL_NEW" // 更新後の全ての属性値を返す (UPDATED_NEW から変更)
    });

    log('info', '組織時間更新試行中', { organizationId: id, decreaseBy });
    log('debug', 'DynamoDBコマンド詳細', command);

    try {
        const data = await docClient.send(command);
        log('info', "組織時間更新成功", { organizationId: id, remainingMinutes: data.Attributes?.remainingMinutes });
        log('debug', "更新後の組織データ", data.Attributes);
        // 更新後の組織情報を返す (GraphQLスキーマで定義したOrganization型に合うように)
        return data.Attributes;
    } catch (err) {
        if (err.name === 'ConditionalCheckFailedException') { // AWS SDK v3ではエラーコードはerr.nameで参照
            log('error', "条件チェック失敗: 残り時間不足または組織が見つかりません", { organizationId: id, decreaseBy, error: err.message });
            // このエラーはクライアントに伝えるべき重要な情報なので、再スローする
            throw new Error(`Failed to decrease minutes for organization ${id}: Not enough remaining minutes or organization not found.`);
        }
        log('error', "DynamoDB更新エラー", { organizationId: id, error: err.message });
        log('debug', "DynamoDBエラー詳細", err);
        // その他の予期せぬエラー
        throw new Error(`Error updating organization ${id}: ${err.message}`);
    }
};
