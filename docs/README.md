## 仕様書索引（docs/specs）

仕様書・API仕様・設計資料は `docs/specs/` に集約されています。

### バックエンド（Lambda / API）

- `specs/lambda_transcriptionProcessor_api_spec.md`: transcriptionProcessor API 仕様
- `specs/lambda_generationProcessor_api_spec.md`: generationProcessor API 仕様（入口）
- `specs/lambda_generationWorker_api_spec.md`: generationWorker API 仕様（非同期処理）
- `specs/lambda_getAudioPresignedUrl_api_spec.md`: getAudioPresignedUrl API 仕様（署名URL発行）
- `specs/lambda_deleteGeneratedFiles_api_spec.md`: deleteGeneratedFiles API 仕様（一括削除）
- `specs/lambda_cleanupExpiredFiles_api_spec.md`: cleanupExpiredFiles 仕様（定期削除）
- `specs/lambda_monthlyReset_api_spec.md`: monthlyReset 仕様（月次リセット）
- `specs/lambda_decreaseOrgTaskGenerations_api_spec.md`: decreaseOrganizationTaskGenerations 仕様（回数減算）
- `specs/lambda_updateOrgMinutes_api_spec.md`: decreaseOrganizationRemainingMinutes 仕様（時間減算）
- `specs/lambda_environment_variables.md`: Lambda 環境変数一覧
- `specs/processing_session_status.md`: ProcessingSession ステータス仕様

### フロントエンド

- `specs/frontend_ui_ux_spec.md`: フロントエンド UI/UX 仕様（フロー、編集、選択式生成、DL/削除、状態管理）

### スキーマ概観

- `specs/graphql_schema_overview.md`: GraphQL スキーマ仕様（全体）


