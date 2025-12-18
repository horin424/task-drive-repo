# タスク一覧生成回数制限機能 実装方針書

## 1. 概要

本ドキュメントは、既存の「transcript-minute」アプリケーションに「タスク一覧生成の回数制限」機能を追加するための実装方針を定義する。

この機能により、組織ごとにタスク一覧生成の月間利用回数を制限し、適切なリソース管理とコスト制御を実現する。

## 2. 設計方針サマリー

| 項目 | 選択した方針 | 詳細 |
|------|-------------|------|
| **データ構造** | `remainingTaskGenerations` フィールド追加 | `Organization` モデルに新しいフィールドを追加 |
| **減算処理** | 新しい `decreaseOrganizationTaskGenerations` ミューテーション | 既存の時間減算処理と同様のパターンで実装 |
| **減算タイミング** | タスク一覧生成完了時 | `TASKS_COMPLETED` ステータス時に回数を減算 |
| **初期値** | タスク生成: 月50回、使用時間: 1000分 | 既存組織にも自動的に初期値を適用 |
| **リセット値** | 組織ごとに設定可能 | `monthlyTaskGenerations` フィールドで管理 |
| **エラーハンドリング** | フロントエンド + バックエンド二重チェック | UI無効化 + APIレベルでの検証 |
| **表示場所** | `AppHeader` の組織情報 | 残り使用時間の下に表示 |
| **月間リセット** | `resetRemainingMinutesFunction` を拡張 | 関数名は `monthlyReset` に変更（Functionサフィックス削除） |

## 3. データモデル設計

### 3.1. Organization モデルの拡張

```graphql
type Organization @model {
  id: ID!
  name: String!
  remainingMinutes: Int!
  remainingTaskGenerations: Int!           # 新規追加: 残りタスク生成回数
  monthlyMinutes: Int                      # 新規追加: 月間リセット用の使用時間値
  monthlyTaskGenerations: Int              # 新規追加: 月間リセット用のタスク生成回数値
  users: [User] @hasMany(indexName: "byOrganization", fields: ["id"])
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
}
```

### 3.2. 既存組織への初期値適用

**課題**: 既存の組織データに新しいフィールドがない場合の対処

**解決策**: GraphQL リゾルバーまたはアプリケーションレベルでのデフォルト値処理

**デフォルト値設定**:
- `remainingTaskGenerations`: `null` または未定義の場合 → `100` として扱う
- `monthlyTaskGenerations`: `null` または未定義の場合 → `100` として扱う  
- `remainingMinutes`: 既存値を維持、ただし `null` の場合 → `6000` として扱う
- `monthlyMinutes`: `null` または未定義の場合 → `6000` として扱う

**実装方法**:
```javascript
// Lambda関数内での組織データ正規化
const normalizeOrganizationData = (orgData) => ({
  ...orgData,
  remainingTaskGenerations: orgData.remainingTaskGenerations ?? 100,
  monthlyTaskGenerations: orgData.monthlyTaskGenerations ?? 100,
  remainingMinutes: orgData.remainingMinutes ?? 6000,
  monthlyMinutes: orgData.monthlyMinutes ?? 6000
});
```

**適用箇所**:
- `transcriptionProcessor`: 文字起こし前の使用時間チェック時（初回正規化）
- ~~`generationWorker`~~: フロー分析により不要と判断（`transcriptionProcessor`で正規化済み）
- `decreaseOrgTaskGenerations`: 回数減算処理時（独立呼び出しのため正規化必要）
- `monthlyReset`: 月間リセット処理時
- フロントエンドの組織データ処理（`sessionStore`, `useAuthInit`）

## 4. GraphQL API 設計

### 4.1. 新しいミューテーション

```graphql
type Mutation {
  decreaseOrganizationTaskGenerations(input: DecreaseOrganizationTaskGenerationsInput!): Organization 
    @function(name: "decreaseOrgTaskGenerations-${env}")
}

input DecreaseOrganizationTaskGenerationsInput {
  id: ID!
  decreaseBy: Int!
}
```

### 4.2. 組織設定更新用ミューテーション（管理者用）

```graphql
type Mutation {
  updateOrganizationLimits(input: UpdateOrganizationLimitsInput!): Organization
    @function(name: "updateOrgLimits-${env}")
}

input UpdateOrganizationLimitsInput {
  id: ID!
  monthlyMinutes: Int
  monthlyTaskGenerations: Int
}
```

## 5. Lambda 関数設計

### 5.1. 新しい Lambda 関数

#### `decreaseOrgTaskGenerations`
- **目的**: タスク生成回数をアトミックに減算
- **処理内容**:
  1. DynamoDB の `UpdateCommand` でアトミック減算
  2. `ConditionExpression` で残り回数が十分かチェック
  3. 回数不足時は `ConditionalCheckFailedException` を発生

```javascript
const command = new UpdateCommand({
    TableName: organizationTableName,
    Key: { id },
    UpdateExpression: "SET remainingTaskGenerations = remainingTaskGenerations - :val",
    ConditionExpression: "remainingTaskGenerations >= :val",
    ExpressionAttributeValues: {
        ":val": decreaseBy
    },
    ReturnValues: "ALL_NEW"
});
```

#### `updateOrgLimits` (管理者機能)
- **目的**: 組織の月間制限値を更新
- **権限**: 管理者のみ
- **処理内容**: `monthlyMinutes` と `monthlyTaskGenerations` を更新

### 5.2. 既存 Lambda 関数の拡張

#### `generationWorker` の修正
- タスク一覧生成完了時（`TASKS_COMPLETED` ステータス設定時）に `decreaseOrganizationTaskGenerations` を呼び出し

#### `resetRemainingMinutesFunction` の拡張
- **新しい関数名**: `monthlyReset` に変更（Functionサフィックス削除、他のGraphQL関数と統一）
- **処理内容**:
  1. 全組織をスキャン
  2. 各組織の `remainingMinutes` を `monthlyMinutes` にリセット（デフォルト6000）
  3. 各組織の `remainingTaskGenerations` を `monthlyTaskGenerations` にリセット（デフォルト100）
  4. デフォルト値処理を含める（既存組織の `null` フィールド対応）

## 6. フロントエンド実装

### 6.1. AppHeader コンポーネントの拡張

```tsx
<div className={styles.detailsGrid}>
    <span className={styles.label}>ユーザー名：</span>
    <span>{user?.username}</span>
    
    <span className={styles.label}>組織：</span>
    <span>{organization?.name || 'なし'}</span>
    
    <span className={styles.label}>残り使用時間：</span>
    <span>
        {organization?.remainingMinutes !== undefined 
            ? `${organization.remainingMinutes} 分` 
            : '未設定'}
    </span>
    
    <span className={styles.label}>残りタスク生成回数：</span>
    <span>
        {organization?.remainingTaskGenerations !== undefined 
            ? `${organization.remainingTaskGenerations} 回` 
            : '未設定'}
    </span>
</div>
```

### 6.2. GenerationOptions コンポーネントの拡張

タスク生成チェックボックスの無効化処理:

```tsx
const isTaskGenerationDisabled = (organization?.remainingTaskGenerations ?? 0) <= 0;

<input
  type="checkbox"
  checked={options.tasks && !isTaskGenerationDisabled}
  disabled={isTaskGenerationDisabled}
  onChange={(e) => updateGenerationOption('tasks', e.target.checked)}
/>
{isTaskGenerationDisabled && (
  <span className={styles.disabledNote}>（回数上限に達しています）</span>
)}
```

### 6.3. 型定義の拡張

```typescript
export interface Organization {
  id: string;
  name: string;
  remainingMinutes: number;
  remainingTaskGenerations: number;
  monthlyMinutes?: number;
  monthlyTaskGenerations?: number;
}
```

## 7. 組織データ正規化モジュール設計

### 7.1. 独立モジュールとしての実装

**⚠️ 注意: この機能は将来的に削除される可能性があります**

既存組織への初期値適用機能は一時的な措置として実装し、将来的に削除する可能性があります。そのため、以下の設計方針で実装します：

- **独立ファイル**: `lib/organizationDataNormalizer.js` として分離実装
- **明確な責任範囲**: 組織データの初期値チェック・設定のみを担当
- **簡単な削除**: 機能削除時はファイル削除と呼び出し部分の削除のみで対応

### 7.2. organizationDataNormalizer.js の実装

```javascript
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

import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

// デフォルト値定数
const DEFAULT_MONTHLY_MINUTES = 6000;
const DEFAULT_MONTHLY_TASK_GENERATIONS = 100;

/**
 * 組織データの正規化とデフォルト値設定
 * @param {DynamoDBDocumentClient} docClient - DynamoDB Document Client
 * @param {string} tableName - Organization テーブル名
 * @param {string} organizationId - 組織ID
 * @returns {Promise<Object>} 正規化された組織データ
 */
export const normalizeAndEnsureOrganizationDefaults = async (docClient, tableName, organizationId) => {
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
    console.log(`Applying default values to organization ${organizationId}`);
    
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
    return updateResult.Attributes;
  }
  
  // 4. メモリ上での正規化（念のため）
  return {
    ...orgData,
    remainingTaskGenerations: orgData.remainingTaskGenerations ?? DEFAULT_MONTHLY_TASK_GENERATIONS,
    monthlyTaskGenerations: orgData.monthlyTaskGenerations ?? DEFAULT_MONTHLY_TASK_GENERATIONS,
    remainingMinutes: orgData.remainingMinutes ?? DEFAULT_MONTHLY_MINUTES,
    monthlyMinutes: orgData.monthlyMinutes ?? DEFAULT_MONTHLY_MINUTES
  };
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
```

## 8. Lambda関数での呼び出し方法

### 8.1. transcriptionProcessor での実装

**処理タイミング**: `markTranscriptionComplete` 関数で組織情報を取得する際

```javascript
// ⚠️ 将来削除予定: 組織データ正規化モジュールのimport
import { normalizeAndEnsureOrganizationDefaults } from './lib/organizationDataNormalizer.js';

// 使用時間チェック時にデフォルト値を適用
const sessionData = await getProcessingSession(appsyncClient, sessionId);
const organizationId = sessionData.organizationID;

// ⚠️ 将来削除予定: 初期値チェック・設定
const normalizedOrg = await normalizeAndEnsureOrganizationDefaults(
  docClient, 
  organizationTableName, 
  organizationId
);

// 使用時間チェック
const usedMinutes = Math.ceil(audioLengthSeconds / 60);
if (normalizedOrg.remainingMinutes < usedMinutes) {
  throw new Error(`使用時間が不足しています。必要: ${usedMinutes}分, 残り: ${normalizedOrg.remainingMinutes}分`);
}
```

### 8.2. generationWorker での実装

**⚠️ 実装不要と判断**: フロー分析により `transcriptionProcessor` で既に組織データが正規化済みのため、`generationWorker` での正規化処理は不要。

**理由**:
- `generationWorker` は必ず `transcriptionProcessor` の後に実行される
- `transcriptionProcessor` で組織データの初期値設定が完了している
- タスク生成回数のチェックは既にフロントエンドで実装済み

### 8.3. decreaseOrgTaskGenerations での実装

**処理タイミング**: 回数減算処理前の組織データ取得時

```javascript
// ⚠️ 将来削除予定: 組織データ正規化モジュールのimport
import { normalizeAndEnsureOrganizationDefaults } from './lib/organizationDataNormalizer.js';

// ⚠️ 将来削除予定: 減算前の初期値チェック・設定
const normalizedOrg = await normalizeAndEnsureOrganizationDefaults(
  docClient,
  organizationTableName,
  id
);

// 通常の減算処理を継続
const command = new UpdateCommand({
  TableName: organizationTableName,
  Key: { id },
  UpdateExpression: "SET remainingTaskGenerations = remainingTaskGenerations - :val",
  ConditionExpression: "remainingTaskGenerations >= :val",
  ExpressionAttributeValues: {
    ":val": decreaseBy
  },
  ReturnValues: "ALL_NEW"
});
```

### 8.4. 機能削除時の手順

将来的にこの機能を削除する場合の手順：

1. **ファイル削除**:
   - `lib/organizationDataNormalizer.js` を削除

2. **各Lambda関数からの呼び出し削除**:
   - `import { normalizeAndEnsureOrganizationDefaults } from './lib/organizationDataNormalizer.js';` を削除
   - `normalizeAndEnsureOrganizationDefaults` の呼び出しを削除
   - 必要に応じて元の処理に戻す

3. **コメント削除**:
   - `⚠️ 将来削除予定:` のコメントを削除

## 8. 実装ステップ

### Phase 1: データモデル拡張
1. **GraphQL スキーマ更新**
   - `Organization` モデルに新しいフィールドを追加
   - 新しいミューテーションを定義

2. **型定義更新**
   - `src/API.ts` の自動生成
   - `src/types/index.ts` の手動更新

### Phase 2: Lambda 関数実装
1. **新しい Lambda 関数作成**
   - `amplify add function` で `decreaseOrgTaskGenerations` を作成
   - 実装とテスト

2. **既存 Lambda 関数拡張**
   - `generationWorker` にタスク生成回数減算処理を追加
   - `resetRemainingMinutesFunction` を `monthlyReset` に改名・拡張

### Phase 3: フロントエンド実装
1. **AppHeader コンポーネント拡張**
   - 残りタスク生成回数の表示追加

2. **GenerationOptions コンポーネント拡張**
   - 回数不足時の UI 無効化

3. **データフェッチング更新**
   - 組織情報取得時に新しいフィールドを含める

### Phase 4: 既存データ対応
1. **デフォルト値処理**
   - アプリケーションレベルでの初期値適用
   - 必要に応じてデータマイグレーションスクリプト

2. **テスト**
   - 既存組織での動作確認
   - 新規組織での動作確認

## 8. 注意事項・課題

### 8.1. 関数名の変更
- `resetRemainingMinutesFunction` → `monthlyReset` への改名実施
- 理由: 他のGraphQL関数と命名規則を統一（Functionサフィックス削除）
- 既存のCloudFormationスタック名との整合性確保が必要
- 改名に伴うスケジュール設定の再構成が必要

### 8.4. バックアップ管理
- 既存の `resetRemainingMinutesFunction` を `backup/resetRemainingMinutesFunction/` にバックアップ済み
- 新しい `monthlyReset` 関数が安定稼働後、バックアップファイルを削除予定
- バックアップには全ての設定ファイル、ソースコード、CloudFormationテンプレートが含まれる

### 8.2. 既存データ対応
- 既存組織の `remainingTaskGenerations` が `null` の場合の処理
- データマイグレーションの必要性検討

### 8.3. 権限管理
- 組織の制限値変更は管理者のみに制限
- 適切な認可処理の実装

## 9. 将来的な拡張可能性

- 箇条書き・議事録生成の回数制限
- 組織ごとの詳細な使用統計
- 使用量アラート機能
- 動的な制限値調整機能

---

**作成日**: 2024年7月23日  
**更新日**: 2024年7月23日  
**ステータス**: 方針確定・実装開始準備完了 