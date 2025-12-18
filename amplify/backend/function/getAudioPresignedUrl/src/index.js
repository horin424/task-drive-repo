/* Amplify Params - DO NOT EDIT
	API_TRANSCRIPTMINUTE_GRAPHQLAPIENDPOINTOUTPUT
	API_TRANSCRIPTMINUTE_GRAPHQLAPIIDOUTPUT
	ENV
	REGION
	STORAGE_S31D11B5D9_BUCKETNAME
Amplify Params - DO NOT EDIT */

import AWS from 'aws-sdk';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import fetch from 'node-fetch';

// AWS設定
AWS.config.update({ region: process.env.REGION });
const s3 = new AWS.S3();

// AppSync設定
const APP_SYNC_ENDPOINT = process.env.API_TRANSCRIPTMINUTE_GRAPHQLAPIENDPOINTOUTPUT;

// ProcessingSessionを取得するクエリ
const GET_PROCESSING_SESSION = `
    query GetProcessingSession($id: ID!) {
        getProcessingSession(id: $id) {
            id
            owner
            identityId
            sessionId
            fileName
            organizationID
        }
    }
`;

// SigV4署名付きGraphQLクライアント
const graphqlClient = {
    request: async (query, variables) => {
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

        const response = await fetch(APP_SYNC_ENDPOINT, {
            method: 'POST',
            headers: signedRequest.headers,
            body: signedRequest.body
        });

        const result = await response.json();

        if (result.errors) {
            throw new Error(`GraphQL Error: ${JSON.stringify(result.errors)}`);
        }

        return result.data;
    }
};

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
export const handler = async (event) => {
    console.log(`EVENT: ${JSON.stringify(event)}`);
    
    try {
        // GraphQLイベントからセッションIDと認証情報を取得
        const sessionId = event.arguments?.sessionId;
        const userSub = event.identity?.sub;
        
        if (!sessionId) {
            throw new Error('Session ID is required');
        }
        
        if (!userSub) {
            throw new Error('User authentication is required');
        }
        
        // ProcessingSessionを取得
        const sessionData = await graphqlClient.request(GET_PROCESSING_SESSION, {
            id: sessionId
        });
        
        const session = sessionData.getProcessingSession;
        if (!session) {
            throw new Error('Session not found');
        }
        
        // ユーザー認証：セッションの所有者かチェック
        if (session.owner !== userSub) {
            throw new Error('Unauthorized: You do not own this session');
        }
        
        // 音声ファイルのS3キーを構築
        // 入力バケットのパス形式: private/{identityId}/{sessionId}/{fileName}
        const audioFileKey = `private/${session.identityId}/${session.sessionId}/${session.fileName}`;
        
        // 署名付きURLを生成（15分間有効）
        const signedUrl = s3.getSignedUrl('getObject', {
            Bucket: process.env.STORAGE_S31D11B5D9_BUCKETNAME,
            Key: audioFileKey,
            Expires: 15 * 60 // 15分
        });
        
        console.log(`Generated signed URL for session ${sessionId}: ${signedUrl}`);
        
        return signedUrl;
        
    } catch (error) {
        console.error('Error generating signed URL:', error);
        throw error;
    }
};
