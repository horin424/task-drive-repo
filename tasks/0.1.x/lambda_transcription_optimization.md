# Lambda文字起こし処理の最適化タスク

このドキュメントは、AWS Lambdaでの文字起こし処理実行時にメモリ不足エラーが発生する問題を解決するためのタスクと詳細実装手順を管理します。

## 問題の背景

Lambda関数の文字起こし処理において、以下のエラーが発生しています：
```
Runtime exited with error: signal: killed
Runtime.ExitError
```

この問題は以下の原因で発生しています：
- 現在の実装では、S3から音声ファイル全体をダウンロードしてメモリに保持
- その後、FormDataを使ってElevenLabs APIにファイルを送信
- 大きな音声ファイルの場合、Lambdaのメモリ制限に達して強制終了される

## 解決方法

ElevenLabs APIが提供する`cloud_storage_url`パラメータを使用することで、Lambda関数が音声ファイルをダウンロードする必要をなくし、直接S3の署名付きURLをAPIに渡すことでメモリ使用量を削減します。

## 詳細実装手順

### 1. ElevenLabs API呼び出し方法の変更

#### ファイル: `amplify/backend/function/transcriptionProcessor/src/lib/transcriptionApi.js`

`processElevenLabsTranscription`関数を以下のように変更します：

**変更前:**
```javascript
async function processElevenLabsTranscription(audioFileUrl, apiKey) {
  console.log('ElevenLabs APIを使用して文字起こしを開始します');
  const API_URL = "https://api.elevenlabs.io/v1/speech-to-text";
  
  try {
    // 音声ファイルをダウンロード
    console.log('署名付きURLから音声ファイルをダウンロード中...');
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
    formData.append('language_code', 'ja');  // デフォルトで日本語を使用
    formData.append('diarize', 'true');
    
    // API呼び出し
    console.log('ElevenLabs APIにリクエスト送信中...');
    const response = await axios.post(API_URL, formData, {
      headers: {
        'xi-api-key': apiKey,
        ...formData.getHeaders()
      }
    });
    
    // 以下略...
```

**変更後:**
```javascript
async function processElevenLabsTranscription(audioFileUrl, apiKey) {
  console.log('ElevenLabs APIを使用して文字起こしを開始します');
  const API_URL = "https://api.elevenlabs.io/v1/speech-to-text";
  // 環境変数が明示的に'false'に設定されていない限り、cloud_storage_urlを使用する
  const useCloudStorageUrl = process.env.USE_CLOUD_STORAGE_URL !== 'false';
  
  try {
    let response;
    
    if (useCloudStorageUrl) {
      // 新しい方法: cloud_storage_urlパラメータを使用
      console.log('cloud_storage_urlパラメータを使用してAPIを呼び出します。URL:', audioFileUrl);
      
      // リクエストデータを作成（JSONフォーマット）
      const requestData = {
        model_id: 'scribe_v1',
        language_code: 'ja',
        diarize: true,
        cloud_storage_url: audioFileUrl
      };
      
      // API呼び出し
      console.log('ElevenLabs APIにリクエスト送信中...');
      response = await axios.post(API_URL, requestData, {
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
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
      formData.append('language_code', 'ja');
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
    
    // 以下処理継続...
```

### 2. 環境変数の設定

#### ファイル: `amplify/backend/function/transcriptionProcessor/function-parameters.json`

環境変数リストに新しいフラグを追加します：

```json
{
  "cloudFormationParameterName": "useCloudStorageUrl",
  "environmentVariableName": "USE_CLOUD_STORAGE_URL"
}
```

### 3. Lambda関数のメモリとタイムアウト設定の更新

大きなファイルでも処理できるように、またバックアップとして従来の方法を使用する場合のために、メモリサイズとタイムアウト設定を更新します。

#### Amplify CLIでLambda関数の設定を更新：

1. **Lambda設定ファイルの編集:**
   ```bash
   cd amplify/backend/function/transcriptionProcessor
   ```

2. **`transcriptionProcessor-cloudformation-template.json` ファイルの更新:**
   このファイルの `Resources.LambdaFunction.Properties` セクションを編集します。
   ```json
   "MemorySize": 2048,
   "Timeout": 300
   ```
   
   変更前:
   ```json
   "MemorySize": 1024,  // または現在の値
   "Timeout": 30        // または現在の値
   ```
   
   変更後:
   ```json
   "MemorySize": 2048,  // 2GB メモリ
   "Timeout": 300       // 5分タイムアウト
   ```

3. **または、Amplify CLIコマンドから更新:**
   ```bash
   amplify update function
   ```
   プロンプトが表示されたら:
   - 更新するLambda関数として「transcriptionProcessor」を選択
   - 「Lambda function configuration」を選択
   - 「Edit memory size」および「Edit timeout」オプションを選択
   - メモリサイズを2048MB（2GB）に設定
   - タイムアウトを300秒（5分）に設定

4. **変更をデプロイ:**
   ```bash
   amplify push
   ```

## 期待される結果

- Lambda関数のメモリ使用量が大幅に削減され、「Runtime exited with error: signal: killed」エラーが解消される
- 大きな音声ファイルでも正常に文字起こしが行われる
- 処理時間の短縮と信頼性の向上

## テスト計画

1. **機能テスト:**
   - 小さなファイル（1分未満）での文字起こしが正常に機能するか
   - 中程度のファイル（5分程度）での文字起こしが正常に機能するか
   - 大きなファイル（30分以上）での文字起こしが正常に機能するか

2. **エラーケーステスト:**
   - 不正なURLが渡された場合の動作
   - APIからエラーレスポンスが返された場合の動作

## 注意点

- ElevenLabs APIは、`cloud_storage_url`パラメータを使用する場合、URLが公開アクセス可能である必要がありますが、署名付きURL（pre-signed URL）を使用することでセキュリティを確保しつつ、この要件を満たすことができます。
- AWS S3の署名付きURLの有効期限（現在は1時間）が、文字起こし処理に十分な長さであることを確認してください。 