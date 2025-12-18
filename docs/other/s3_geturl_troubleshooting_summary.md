# S3からのファイル取得に関するトラブルシューティングまとめ

## 1. 初期問題: 文字起こし実行後のS3オブジェクト取得エラー (404 Not Found)

### 現象
フロントエンドから文字起こしを実行後、結果ファイル（トランスクリプトJSON）をS3から取得しようとする際に404エラーが発生。

### 原因調査
- **フロントエンドログ**:
    - リクエスト先のS3 URLが `transcriptminutee59b87753a5a45619813e746bd1335d4d612-dev` バケットを指していた。
- **Lambdaログ**:
    - 文字起こし結果のJSONファイルは `transcriptminutee59b87753a5a45619813e746bd1335d4d612-output-dev` バケットに保存されていた。
- **特定された原因**:
    - フロントエンドが参照しているS3バケット名と、Lambdaが実際にファイルを保存しているバケット名が異なっていた。
    - フロントエンドの環境変数 `NEXT_PUBLIC_OUTPUT_BUCKET` が正しく設定されていなかった（または設定が反映されていなかった）。

---

## 2. 第二の問題: `NEXT_PUBLIC_OUTPUT_BUCKET` 設定後のCORSエラーとS3 ListBucket権限エラー

### 現象
`NEXT_PUBLIC_OUTPUT_BUCKET` を正しい出力バケット名に修正後、以下のエラーが順番に発生。

1.  **CORSエラー**:
    - ブラウザコンソールに `Access to fetch at 'https://<output-bucket-name>.s3...' from origin 'https://<amplify-app-domain>' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present...` が表示された。
2.  **S3 ListBucket権限エラー (403 Forbidden)**:
    - CORS設定を修正後、S3から `403 Forbidden` エラー。
    - 詳細: `User: arn:aws:sts::...:assumed-role/.../CognitoIdentityCredentials is not authorized to perform: s3:ListBucket on resource: "arn:aws:s3:::<output-bucket-name>" because no identity-based policy allows the s3:ListBucket action`

### 原因調査と対策

- **CORS設定**:
    - S3バケット (`-output-dev`) のCORS設定を見直し。
        - `AllowedOrigins` にフロントエンドのドメイン (`https://dev.d2k538y05nu5le.amplifyapp.com`) を指定。末尾のスラッシュは削除。
        - `AllowedMethods` に `GET`, `HEAD` を指定（当初 `OPTIONS` も試したがS3側で非対応エラーが出たため除外）。
- **IAMポリシー (`s3:ListBucket` 関連)**:
    - Cognitoユーザーグループに紐づくIAMロールのポリシーには、`s3:ListBucket` アクションが含まれていたが、`Condition` 句で `s3:prefix` が `private/${cognito-identity.amazonaws.com:sub}/*` に限定されていた。
    - この `Condition` が原因で `ListBucket` が拒否されている可能性が浮上。

---

## 3. 第三の問題: IAMポリシー修正後のS3 NoSuchKeyエラー (404 Not Found)

### 現象
デバッグのため、IAMポリシーの `s3:ListBucket` アクションから `Condition` 句を一時的に削除。その結果、`403 Forbidden (ListBucket)` エラーは解消されたが、新たにS3から `404 Not Found (NoSuchKey)` エラーが発生。

- **S3エラー詳細**: `<Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message><Key>sessionId/filename.json</Key>...</Error>`
    - このエラーは、S3バケット内に `sessionId/filename.json` という形式のキーのオブジェクトが存在しないことを示す。

### 原因特定と解決策

- **フロントエンドコードの確認 (`src/components/TranscriptionResult.tsx`)**:
    - Amplify Storageの `getUrl` API (v6以降) を使用してS3オブジェクトの署名付きURLを取得していた。
    - `currentSession.transcriptKey` には、`private/${identityId}/${sessionId}/${filename}.json` という形式の完全なS3キーが格納されていた。
    - **問題点**: `getUrl` を呼び出す際に、この完全なキーから `private/${identityId}/` というプレフィックスを**削除**し、`sessionId/filename.json` という加工後のキーを `path` オプションに渡していた。
    - **`getUrl` APIの挙動**: `options.bucket` でカスタムバケットを指定した場合、`path` オプションにはそのバケット内での**完全なオブジェクトキー**を指定する必要がある。Amplifyが自動で `level` (e.g., `private`) に基づくプレフィックスを付加するのは、主にAmplify管理のデフォルトバケットに対する操作時。
- **解決策**:
    - `getUrl` の `path` オプションに、プレフィックスを削除する前の**完全なS3オブジェクトキー** (`currentSession.transcriptKey` の元の値) を渡すように修正。
    - `options.bucket` には `process.env.NEXT_PUBLIC_OUTPUT_BUCKET` と `process.env.NEXT_PUBLIC_AWS_REGION` を指定。
    - `options.validateObjectExistence: true` と `options.expiresIn` を追加して堅牢性を向上。

```typescript
// 修正前 (問題のあったコードの一部)
// let s3Key = currentSession.transcriptKey;
// const identityId = currentSession.identityId;
// if (identityId) {
//   const keyPrefixToRemove = `private/${identityId}/`;
//   if (s3Key.startsWith(keyPrefixToRemove)) {
//     s3Key = s3Key.substring(keyPrefixToRemove.length); // ここでキーが不完全になっていた
//   }
// }
// const transcriptUrl = await getUrl({ 
//   path: s3Key, // 不完全なキー
//   options: {
//     bucket: { /* ... */ }
//   }
// });

// 修正後
const s3KeyFullPath = currentSession.transcriptKey; // 完全なキー
const transcriptUrlResult = await getUrl({ 
  path: s3KeyFullPath, // 完全なキーを渡す
  options: {
    bucket: {
      bucketName: process.env.NEXT_PUBLIC_OUTPUT_BUCKET!,
      region: process.env.NEXT_PUBLIC_AWS_REGION!
    },
    validateObjectExistence: true,
    expiresIn: 600
  }
});
```

---

## 4. 横展開と最終確認

### 対応
- `transcriptKey` を使った文字起こし結果の取得処理を上記のように修正し、問題が解決。
- 同様の `getUrl` 呼び出しパターンが、`bulletPointsKey`（箇条書き）と `minutesKey`（議事録）の取得処理 (`loadResults` 関数および `fetchResultFiles` 関数内) にも存在したため、これらも同様に完全なS3キーと適切なオプションを使用するように修正。

### 今後の推奨事項
- **IAMポリシー**: 
    - 当初のトラブルシューティング過程で `s3:ListBucket` の `Condition` を一時的に緩めましたが、最終的に `ListBucket` 権限自体がアプリケーションの動作に必須ではないことが確認されました。
    - **対応**: IAMポリシーから `s3:ListBucket` 権限を削除し、アプリケーションが正常動作することを確認。これにより、最小権限の原則に従い、セキュリティが向上しました。
    - もし将来的にファイル一覧表示などの機能で `ListBucket` が必要になった場合は、その時点で必要な最小限のプレフィックスを指定した `Condition` と共に権限を再付与することを検討します。
- **Amplify Storage APIの理解**: カスタムバケットを使用する場合の `getUrl` (または他の Amplify Storage API) の `path` や `key` の扱いに注意する。ドキュメントを再確認し、`level` オプションの有無による挙動の違いを理解する。

--- 

この経緯で、S3からのファイル取得に関する一連の問題が解決されました。 