# 月間リセット機能 統合チェックリスト

`release/cac` ブランチから「組織の残り使用時間の月間リセット機能」を取り込むためのタスクリストです。
現在のブランチ (`feat/delete-files-with-lambda`) の実装を優先し、機能追加に必要な最小限の変更のみを行います。

## 1. Lambda関数ディレクトリの取り込み

- [ ] `updateOrgMinutes` ディレクトリを `release/cac` からチェックアウトする。
  ```bash
  git checkout release/cac -- amplify/backend/function/updateOrgMinutes/
  ```

- [ ] `resetRemainingMinutesFunction` ディレクトリを `release/cac` からチェックアウトする。
  ```bash
  git checkout release/cac -- amplify/backend/function/resetRemainingMinutesFunction/
  ```

## 2. Amplify設定ファイルの手動マージ

**注意:** `release/cac` 側の変更に追従して、既存の定義を削除しないように注意してください。

- [ ] `amplify/backend/backend-config.json` を編集する。
    - `function` オブジェクトに `updateOrgMinutes` と `resetRemainingMinutesFunction` の定義を追加する。
    - `parameters` オブジェクトに上記2つの関数に対応するパラメータ定義を追加する。

- [ ] `amplify/backend/api/transcriptminute/schema.graphql` を編集する。
    - `Mutation` 型に `decreaseOrganizationRemainingMinutes` を追加する。
    - `DecreaseOrganizationRemainingMinutesInput` input型を新しく定義する。
    - 既存の `deleteGeneratedFiles` ミューテーションや `getAudioPresignedUrl` クエリは変更・削除しない。

## 3. Amplifyへの反映とデプロイ

- [ ] `amplify status` を実行し、変更内容を確認する。
    - **期待される結果:**
        - `Function`: `updateOrgMinutes` (Create)
        - `Function`: `resetRemainingMinutesFunction` (Create)
        - `Api`: `transcriptminute` (Update)

- [ ] `amplify push` を実行して、変更をクラウド環境にデプロイする。

## 4. デプロイ後の動作確認

- [ ] AWSマネジメントコンソールにログインする。
- [ ] EventBridge のルールを確認し、`resetRemainingMinutesFunction` のスケジュールが正しく設定されていることを確認する。
- [ ] （可能であれば）`decreaseOrganizationRemainingMinutes` ミューテーションをテスト実行し、組織の残り時間が減少することを確認する。

## 5. トラブルシューティング（実際に発生した問題）

### 問題: CloudFormationエクスポート参照エラー

**エラー内容:**
```
No export named apitranscriptminuteGraphQLAPIIdOutput:GetAtt:OrganizationTable:Name found
```

**根本原因:**
新しいLambda関数が参照しようとしているCloudFormationエクスポート値が、現在の環境では利用可能でない、または異なる名前でエクスポートされている可能性。

**調査結果:**
- 既存の `transcriptionProcessor` Lambda関数は同じエクスポート値を参照して正常に動作している
- 新しいLambda関数のCloudFormationテンプレートは `release/cac` ブランチから取り込んだもので、現在の環境と微妙に異なる可能性がある

**解決アプローチ:**
1. 既存の動作しているLambda関数の設定を参考にする
2. 段階的デプロイ（GraphQLスキーマ → Lambda関数）を試す
3. CloudFormationテンプレートの環境変数参照方法を統一する 