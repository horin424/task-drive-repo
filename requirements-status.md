# Requirements Coverage Snapshot (vs requirements.md)

## Core Features & Flows
- Upload/transcription/speaker edit/generation (bullets/minutes/tasks): **Implemented** (Azure Functions + Dify; status tracking + Web PubSub updates).
- Supported formats (MP3/M4A/WAV/MP4/OGG/AAC/WEBM/FLAC): **Partially verified** (Whisper supports; app side not exhaustively tested).
- Speaker editing UI: **Implemented** (JSON transcript edit and save via SAS).
- Bulk download (ZIP): **Not implemented** (pending).
- Real-time status updates: **Implemented** (Web PubSub).

## Auth / Users / Orgs
- Auth method (email/password) & social login: **Not in current Azure build** (using Entra ID tokens instead).
- Password reset / 2FA: **Not implemented**.
- Org/user model: **Implemented** (Cosmos org/user/session); admin flag present.
- Org-based access control: **Implemented** (owner/admin/org guard in `api/shared/sessionUtils.ts` and all session APIs).

## Storage
- Input: `private/{oid}/{sessionId}/...` in `transcripts`: **Implemented**.
- Output: `private/{oid}/{sessionId}/...` in `outputs`: **Implemented** (server-driven blob names, SAS uploads).
- SAS issuance (acw-only, short-lived): **Implemented** for inputs/outputs; front end uses SAS (no AccountKey).
- CORS/public access hardening: **Portal check pending**.
- Temporary URLs with expiry: **Implemented** (read SAS 10 min).

## Processing & APIs
- Transcription flow (queue + Whisper): **Implemented**.
- Generation flow (POST /generate/process-all + Dify): **Implemented** (async-style statuses, though single function handles generation).
- REST endpoint per spec: **Implemented** (`POST /generate/process-all` 202 semantics).
- Worker split/parallel: **Partially** (single function orchestrates; background worker not fully separated).

## Frontend
- Next.js/TS/CSS modules: **Implemented**.
- MediaUploader (drag/drop, language, progress): **Implemented**.
- ProgressIndicator: **Implemented**.
- Generation options/result display: **Implemented**.
- Responsive/mobile: **Not fully validated**.
- Dark mode: **Not implemented**.

## Config / Environment / Security
- Maintenance mode/version hooks: **Present** (needs content).
- Env isolation: **Supported** (env files), but portal alignment pending.
- Key management via Key Vault/managed identity: **Not configured** (env secrets).
- Rate limiting/WAF/APIM: **Not configured**.
- Audit logging: **Partial** (delete/log correlation; download audit not comprehensive).
- Monitoring/alerts: **Not configured**.

## Monitoring / Ops
- App Insights/alerts/backups/DR: **Not configured** in codebase (portal/IaC task).
- CI/CD/rollback: **Not covered** here.

## AI Integration
- Azure OpenAI Whisper: **Implemented**.
- Dify workflow for bullets/minutes/tasks: **Implemented** (local/cloud configurable).
- Task quota decrement: **Implemented** (tasks).

## Gaps vs requirements.md
- Bulk ZIP download, dark mode, social login/password reset/2FA, portal CORS/public access hardening, Key Vault/managed identity, rate limiting/WAF, monitoring/alerts/backups/DR remain **open**.

## Quick next actions
1) Portal hardening: storage public access off, minimal CORS, redirect URIs/authority alignment, consider private endpoints + Key Vault/managed identity.  
2) Implement bulk ZIP download endpoint/UI.  
3) Decide auth path (keep Entra or add email/password) and address password reset/2FA if required.  
4) Add monitoring/alerts (App Insights) and rate limits/WAF if going to prod.  
5) Add dark mode/responsive QA and formal device test sweep.
