# ~~Dify会話ログ削除機能 実装方針書~~ ❌実装取り消し

> **⚠️ 実装取り消し通知**  
> 調査の結果、Dify APIがソフトデリート（論理削除）のみを提供しており、完全削除の要件を満たさないことが判明。  
> 2025年7月30日に機能実装を取り消し。

## 1. 概要

本ドキュメントは、既存の「transcript-minute」アプリケーションに「Dify会話ログ削除機能」を追加するための実装方針を定義する。

この機能は、箇条書き・議事録・タスク一覧の各生成処理完了後に、Dify側に残存する会話ログ（conversation）を自動削除することで、プライバシー保護とデータ管理の向上を目的とする。

## 2. 現在の実装状況

### 2.1 既存のDify統合

- **実装場所**: `amplify/backend/function/generationWorker/src/lib/difyClient.js`
- **対象処理**: 
  - 箇条書き生成（`generateBulletPoints`）
  - 議事録生成（`generateMinutes`）
  - タスク一覧生成（`generateTasks`）
- **使用API**: `POST /chat-messages`（response_mode: 'blocking' または 'streaming'）

### 2.2 現在のレスポンス処理

```javascript
// 箇条書き・議事録の場合
return response.data.answer.trim();

// タスク一覧の場合
return fileResponse.data; // xlsxファイルのバイナリデータ
```

## 3. 実装要件

### 3.1 基本方針

- **削除タイミング**: 各生成処理（箇条書き・議事録・タスク）の直後に個別削除
- **エラーハンドリング**: 削除API失敗時はエラーログ出力のみで、後続処理は継続
- **制御**: 環境変数によるON/OFF制御機能

### 3.2 Dify API仕様

#### 生成API（既存）
- **エンドポイント**: `POST /chat-messages`
- **レスポンス**: `conversation_id`フィールドを含む

#### 削除API（新規実装）
- **エンドポイント**: `DELETE /conversations/:conversation_id`
- **リクエストボディ**: `{ "user": "abc-123" }`
- **レスポンス**: `{ "result": "success" }`

### 3.3 環境変数

- **変数名**: `DIFY_DELETE_CONVERSATIONS`
- **値**: `"true"` / `"false"`
- **デフォルト**: `"true"`（削除有効）

## 4. 実装変更点

### 4.1 difyClient.js の修正

#### 4.1.1 新規関数の追加

```javascript
// Dify会話を削除する関数
async function deleteConversation(conversationId, apiUrl, apiKey, userId) {
  try {
    const response = await axios.delete(
      `${apiUrl}/conversations/${conversationId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        data: {
          user: userId
        }
      }
    );
    
    if (response.data.result === 'success') {
      console.log(`Dify会話削除成功: conversation_id=${conversationId}`);
      return true;
    } else {
      console.error(`Dify会話削除失敗: conversation_id=${conversationId}`, response.data);
      return false;
    }
  } catch (error) {
    console.error(`Dify会話削除エラー: conversation_id=${conversationId}`, 
                  error.response ? JSON.stringify(error.response.data) : error.message);
    return false;
  }
}
```

#### 4.1.2 既存関数の修正

**generateBulletPoints関数**
```javascript
// 修正前
return allBulletPoints.trim();

// 修正後
const shouldDeleteConversations = process.env.DIFY_DELETE_CONVERSATIONS !== 'false';
if (shouldDeleteConversations && conversationIds.length > 0) {
  // 各conversation_idを削除（並列実行）
  await Promise.all(
    conversationIds.map(id => deleteConversation(id, apiUrl, apiKey, userId))
  );
}
return allBulletPoints.trim();
```

**generateMinutes関数**
```javascript
// conversation_id取得と削除処理を追加
const conversationId = response.data.conversation_id;
const result = response.data.answer.trim();

const shouldDeleteConversations = process.env.DIFY_DELETE_CONVERSATIONS !== 'false';
if (shouldDeleteConversations && conversationId) {
  await deleteConversation(conversationId, apiUrl, apiKey, userId);
}
return result;
```

**generateTasks関数**
```javascript
// ストリーム処理中にconversation_idを抽出し、ファイルダウンロード後に削除
let conversationId = '';
// ストリーム処理でconversation_idも取得
// ファイルダウンロード後
const shouldDeleteConversations = process.env.DIFY_DELETE_CONVERSATIONS !== 'false';
if (shouldDeleteConversations && conversationId) {
  await deleteConversation(conversationId, apiUrl, apiKey, userId);
}
return fileResponse.data;
```

### 4.2 環境変数設定

各Lambda関数のCloudFormationテンプレートに環境変数を追加：

```json
"Environment": {
  "Variables": {
    "DIFY_DELETE_CONVERSATIONS": {
      "Ref": "difyDeleteConversations"
    }
  }
}
```

### 4.3 パラメータファイル更新

`parameters.json`に新しいパラメータを追加：

```json
{
  "difyDeleteConversations": "true"
}
```

## 5. 実装ステップ

### Step 1: difyClient.js の修正
1. `deleteConversation`関数の実装
2. 既存の生成関数（3つ）の修正
3. conversation_id抽出ロジックの追加

### Step 2: 環境変数設定
1. CloudFormationテンプレートの更新
2. パラメータファイルの更新
3. team-provider-info.jsonの更新（必要に応じて）

### Step 3: テスト
1. 各生成処理でconversation_id が正しく取得されることの確認
2. 削除APIが正常に動作することの確認
3. 環境変数OFF時に削除が実行されないことの確認
4. 削除失敗時でも後続処理が継続されることの確認

## 6. 注意事項・制約事項

### 6.1 既存機能への影響
- 生成処理の戻り値は変更されません（後方互換性維持）
- 処理時間が若干増加します（削除API呼び出し分）

### 6.2 エラー処理方針
- 削除API失敗は致命的エラーとして扱わない
- ログ出力のみで処理継続
- ユーザーには削除失敗を通知しない

### 6.3 セキュリティ考慮事項
- conversation_idは機密情報として扱う
- ログ出力時は適切にマスキング検討

### 6.4 パフォーマンス考慮事項
- 箇条書き生成では複数チャンク処理により複数のconversation_idが発生
- 削除処理は並列実行でパフォーマンス最適化

## 7. 今後の拡張可能性

- バッチ削除機能の実装
- 削除成功率の監視機能
- 削除失敗時のリトライ機能
- 削除ログの詳細分析機能 