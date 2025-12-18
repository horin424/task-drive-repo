# Azure開発 中間レビュー総評（フェーズ2まで）

本書は「Azure議事録アプリ新規実装要件定義書」を基準に、現時点（フェーズ1・2の範囲：認証・認可構築／ストレージ・アップロード）で到達しているべき内容と実装状況を整理した中間レビュー報告です。根拠は「進捗確認チェックリスト」「実装問題詳細」の最新内容に基づきます。

- 参照資料
  - 要件: `docs/azure/Azure議事録アプリ新規実装要件定義書.md`
  - 到達度: `docs/azure/進捗確認チェックリスト.md`
  - 問題詳細: `docs/azure/実装問題詳細.md`

---

## フェーズ定義（本レビュー対象）
- フェーズ1（Step 1）: 認証・認可の基盤整備（MSAL 導入、Access Token 取得、バックエンドJWT検証の前提）
- フェーズ2（Step 2）: ストレージとアップロード（入力/出力コンテナ分離、短期SASによる安全なPUT、基本CORS/非公開設定）
- フェーズ3・4は集計外（参考チェックのみ）

---

## 到達度サマリ（フェーズ1・2）

- 認証/トークン取得・検証（MSAL/redirect/knownAuthorities/Access Token 付与/401再試行）: 要修正 [!]
  - 現状: Access Token をAPIに付与していない、`authority/knownAuthorities`/`redirectUri` の整合未確認、401時の再取得/再試行なし
  - 影響: バックエンド保護が不能、認可/監査が機能しない
  - 参考: `進捗確認チェックリスト 1.` / `実装問題詳細 統合版-認証`

- 認可/API保護（roles/groups統一・JWT検証・エンドポイント認可）: 要修正 [!]
  - 現状: `roles` と `groups` が混在、HTTP関数でのJWT検証/認可未実装、SAS発行関数が匿名/関数キー依存
  - 影響: UIガードとAPI権限が不整合、誰でも/他人の資産にアクセスできるリスク
  - 参考: `進捗確認チェックリスト 1.` / `実装問題詳細 統合版-認可`

- ストレージ構成（コンテナ分離/階層/CORS/非公開）: 要修正 [!]
  - 現状: `transcripts`/`outputs` と関数側 `uploads` が不一致、`private/{oid}/{sessionId}/…` 階層に未準拠、CORS/非公開の最小化未確認
  - 影響: 動線・権限分離・運用（削除/監査）が破綻しやすい
  - 参考: `進捗確認チェックリスト 2.` / `実装問題詳細 11・14`

- アップロードSASフロー（サーバ発行/最小権限・短期/PUTブロックアップロード/クォータ連動）: 要修正 [!]
  - 現状: SAS発行関数が `anonymous`、権限に `read` を含む、期限1時間、サーバ主導の `blobName` 統一なし、クォータ連動なし
  - 影響: 不正アップロード/漏洩リスク、追跡・クリーンアップが困難
  - 参考: `進捗確認チェックリスト 2.` / `実装問題詳細 12`

- ダウンロード/削除フロー（read-only SAS/短期/Functions 経由/冪等削除/監査）: 未着手 [ ]（一部設計要修正）
  - 現状: ダウンロードSAS発行API/削除API が未実装、JWT検証/所有者・組織検証/監査未整備
  - 影響: 出力物の安全な配布・削除ができない
  - 参考: `進捗確認チェックリスト 2.` / `実装問題詳細 13`

---

## 項目別 詳細評価（フェーズ1・2）

### 1) 認証/トークン取得・検証（MSAL）
- 期待（要件）
  - SPA（MSAL）で PKCE＋Redirect もしくは Popup を用い、`api://{APIアプリID}/access_as_user` を含む Access Token を取得
  - `authority`/`knownAuthorities`/`redirectUri` は実運用（CIAM/B2C/Entra ID）のドメイン/登録URIに厳密一致
  - API呼出時は常に Bearer を付与、401時は silent→一度だけ再試行→失敗はサインアウト誘導
- 現状
  - Bearer 未付与、401再試行なし、authority/knownAuthorities/redirectUri の整合未確認
- ステータス: 要修正 [!]
- 主要修正
  - `azure-config.ts` の `msalConfig` 整合、`tokenRequest` スコープ統一、HTTPクライアントで Bearer 付与＋401再試行

### 2) 認可/API保護（バックエンドJWT検証・roles/groups 統一）
- 期待（要件）
  - 全HTTP関数で JWT（iss/aud/scp/exp/署名）検証、エンドポイント認可（Admin/一般、所有者/組織）
  - フロント/バックで同一クレーム（`roles` 推奨）に統一、UIガードとAPI権限を一致
- 現状
  - `roles`/`groups` 混在、JWT検証なし、SAS発行関数が匿名/関数キー依存
- ステータス: 要修正 [!]
- 主要修正
  - EasyAuth/APIM もしくは関数内 JWT 検証を導入、`roles` に統一、関数の `authLevel`/ポリシー見直し

### 3) ストレージ構成（コンテナ分離/階層/CORS/非公開）
- 期待（要件）
  - 入力: `transcripts`、出力: `outputs`、キーは `private/{oid}/{sessionId}/…`
  - CORS は最小権限、Public access は無効
- 現状
  - `uploads` 使用、階層未準拠、CORS/非公開の最小化未確認
- ステータス: 要修正 [!]
- 主要修正
  - コンテナ名の統一、階層規約の徹底（サーバで `blobName` 決定）、CORS/非公開の再設定

### 4) アップロードSASフロー
- 期待（要件）
  - サーバ（Functions）で JWT 検証後、`acw`（add/create/write）のみ/短期（≦10分）SAS発行
  - `blobName` はサーバで `private/{oid}/{sessionId}/original.ext` を返却、クライアントはそのままPUT
- 現状
  - `anonymous`、`read` 権限を含む、期限1時間、`uuid-ファイル名`、クォータ連動無し
- ステータス: 要修正 [!]
- 主要修正
  - 認証必須化、権限/期限の最小化、`blobName` サーバ主導、クォータ/組織整合チェック

### 5) ダウンロード/削除フロー
- 期待（要件）
  - 出力は `read` のみ/短期 SAS、削除は必ず Functions 経由（JWT＋所有者/組織検証）、監査/相関ID
- 現状
  - API未実装（ダウンロードSAS/削除）、認可/監査なし
- ステータス: 未着手 [ ]（要設計/実装）
- 主要修正
  - `/api/get-audio-url`/`/api/delete-files` 実装、認可/監査整備、`outputs` 限定・階層準拠

---

## 総合所見
- 進捗: フロントのMSAL導入とSASアップロードの体験は芽が出ているものの、セキュリティ要件（JWT検証/認可/権限最小化/短期SAS/階層準拠）が未充足。
- リスク: 未認証SAS発行・Bearer未送信に起因する不正利用、他者資産アクセス、監査不可が最重要リスク。
- 結論: フェーズ2を完了とみなすには、下記「優先修正」を実施・検証のうえで再評価が必要。

### 優先修正（フェーズ2完了条件）
1) HTTPクライアントに Access Token 付与＋401再試行を実装（MSAL設定整合含む）
2) Functions 側で JWT 検証（iss/aud/scp/exp）と認可（roles/所有者/組織）を導入
3) アップロードSAS: 認証必須・`acw` のみ・短期（≦10分）・サーバ主導の `blobName`（階層準拠）
4) ダウンロード/削除API を新設（readのみ/短期、削除は関数経由、監査/相関ID）
5) ストレージ構成の統一（`transcripts`/`outputs`、CORS最小化、非公開化の明示）

---

## 付録（抜粋リンク）
- 進捗チェック: `docs/azure/進捗確認チェックリスト.md`
- 問題詳細: `docs/azure/実装問題詳細.md`
- 要件定義: `docs/azure/Azure議事録アプリ新規実装要件定義書.md`


