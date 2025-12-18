# Final Changes Checklist

Legend: \[x] Completed / \[~] In Progress / \[!] Needs Fixing / \[ ] Not Started

## 1. Authentication & Authorization (Entra ID / B2C / MSAL)
- \[x] (Portal) Align authority / knownAuthorities / redirectUri with production CIAM/B2C domain and registration URI.
- \[x] (Code) Unify loginRequest / tokenRequest scopes to include `access_as_user`.
- \[x] (Code) Inject `Authorization: Bearer <token>` on every API request.
- \[x] (Code) Implement silent 401 retry (re-acquire token → retry once → logout if still failing).
- \[x] (Code) Suppress detailed authentication logs in production.
- \[x] (Code) Unify role/group decisions to roles/appRoles.
- \[x] (Code) Validate JWT in backend HTTP functions (iss/aud/scp/exp) and authorize per Admin/Owner/Org.
- \[x] (Code) Remove anonymous SAS issuance; GetUploadSasUrl requires JWT.
- \[x] (Code) Replace function-key reliance (create/update/get/delete session, user/org) with JWT checks.
- \[~] (Portal/Policy) Evaluate EasyAuth/APIM policy options (currently using in-function validation only).

## 2. Storage (Azure Blob)
- \[x] (Code) Align containers (`transcripts` input, `outputs` output) across FE/Functions.
- \[x] (Code) Enforce `private/{oid}/{sessionId}/…` hierarchy; server assigns blobName.
- \[ ] (Portal) Reconfigure Blob CORS/Privacy on the account.
- \[ ] (Portal) Disable public access on containers/blobs.
- \[x] (Code) Upload SAS: JWT required, permissions `acw`, ≤10 min expiry with `startsOn`, client retry on SAS errors.
- \[x] (Code) Download API issues read-only SAS ≤10 min with owner validation; Delete API enforces JWT + audit.
- \[x] (Code) Audit logging: delete endpoint logs correlation ID + user/session metadata.
- \[x] (Code) OID/session validation prevents traversal.

## 3. Backend / Azure Functions
- \[x] (Code) Session APIs (create/update/get/delete) now JWT-protected.
- \[x] (Code) SAS issuance uses JWT + server-determined hierarchy.
- \[x] (Code/Infra) Processing workers implemented (Whisper transcription queue + Azure OpenAI generation endpoint).
- \[x] (Code/Infra) Scheduled cleanup implemented (daily timer deletes old transcripts/outputs and marks sessions).

## 4. AI Integration (Azure OpenAI / Dify)
- \[x] (Code/Services) Whisper transcription wired in queue worker (Azure OpenAI audio transcription) for uploads.
- \[x] (Code/Services) Bullet/minute/task generation endpoint implemented using Azure OpenAI (chat completions) via `generate-process-all`.
- \[x] (Code/Services) Generated outputs are written to Azure `outputs` container and session keys updated.

## 5. Front-end / UI
- \[x] (Code/Test) Media upload covers format detection, language selection, progress & SAS retry; large-file testing recommended.
- \[x] (Code/Backend) Speaker editing/audio preview saves transcripts to Azure outputs; recognition follows Azure pipeline.
- \[x] (Code/Backend) Generation options UI targets Azure generation endpoint.
- \[x] (Code/Services) Real-time updates use Web PubSub tokens (JWT-protected) with reconnect handling.
- \[x] (Code/Content) Maintenance banner/version hooks already present but need prod content.

## 6. Security & Network
- \[ ] (Portal/Infra) Key Vault + Managed Identity not configured (still using env secrets).
- \[x] (Code) API protection now requires access tokens for all touched endpoints.
- \[ ] (Portal/Policy) APIM rate limiting / WAF rules not configured yet.
- \[x] (Code) Delete API logs correlation IDs; extendable to downloads if desired.

## 7. Monitoring / Logging
- \[x] (Code) Correlation IDs returned/logged for key Functions (SAS/audio/output/generation/token).
- \[ ] (Portal/Monitoring) Fault/perf alert rules pending.

## 8. Data Layer / Model
- \[x] (Code) Sessions/users/orgs stored via Cosmos wrappers; SAS issuance validates org, transcription decrements minutes atomically.
- \[x] (Code) Task generation quota decremented atomically with ETag check when generation is requested (Azure OpenAI generation endpoint).

## Phase 2 Priority Fixes
- \[x] (Code) Grant access tokens on every request + 401 retry.
- \[x] (Code) Backend JWT validation + Admin/Owner/Org authorization on critical endpoints.
- \[x] (Code) Upload SAS: auth required, ACW-only, ≤10 min, server-defined blobName.
- \[x] (Code) Download/Delete APIs secured with JWT + audit logging.
- \[~] (Portal) Unify containers/hierarchy done; CORS/privacy hardening requires Azure portal changes.
