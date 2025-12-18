# Project End-to-End Flow (Azure)

## 1) Sign-in (MSAL)
- SPA uses MSAL with your tenant authority/knownAuthorities and unified scopes (includes `api://<API_CLIENT_ID>/access_as_user`).
- On login, MSAL acquires an access token; every API call includes `Authorization: Bearer …` and retries once on 401/403.

## 2) Session Creation & Upload
- Front end calls `POST /api/sessions` (JWT required); server assigns blob path `private/{oid}/{sessionId}/…`.
- Front end requests short-lived upload SAS via `POST /api/GetUploadSasUrl`; Function checks JWT/org, enforces hierarchy, returns `acw` SAS for `transcripts`.
- Client uploads media with SAS; Blob trigger creates/updates the session and enqueues a processing job.

## 3) Processing (Queue + Azure OpenAI Whisper)
- Queue worker downloads audio from `transcripts`, transcribes with Whisper, saves transcript to `outputs`, updates session to `PENDING_SPEAKER_EDIT`, decrements minutes.

## 4) Generation (Azure OpenAI Chat)
- Front end calls `POST /api/generate/process-all` with selected types (bullets/minutes/tasks).
- Function validates JWT/ownership, decrements task quota atomically, generates content via Azure OpenAI chat, saves outputs under `outputs/private/{oid}/{sessionId}/…`, updates session keys/status.

## 5) Accessing Results
- `GET /api/sessions/audio-url` and `GET /api/sessions/output-url` issue short-lived read-only SAS for `private/{oid}/{sessionId}/…`.
- `DELETE /api/sessions/delete-files` removes generated files; daily timer cleans old transcripts/outputs and marks sessions cleaned.

## 6) Real-time Updates
- Front end requests a Web PubSub token (`/api/HttpTriggerGetWebPubSubConnection`, JWT-protected), connects, and listens for session/progress messages.
- Processing/generation Functions send session/progress updates via Web PubSub; UI updates status/download links.

## 7) Data & Quotas
- Sessions/users/orgs in Cosmos; transcription decrements minutes, generation decrements task quota with ETag (concurrency-safe).
- SAS issuance validates org existence; further quota checks can be added similarly.

## 8) Security & Logging
- All key Functions require JWT (iss/aud/scope) and enforce owner/admin checks.
- SAS issuance is non-anonymous and least-privilege; correlation IDs returned/logged on SAS/audio/output/generation/token endpoints.

## Local Dev
- Run Functions (`func start` in `api/`) with `local.settings.json` set.
- Run Next.js (`npm run dev`) with `.env.local`, pointing MSAL authority/redirects to `http://localhost:3000`.
- Azure OpenAI, Web PubSub, Storage, and Cosmos need real credentials; Azurite/Cosmos emulator can substitute for storage/db if desired.
