# Final Change Log (Detailed)

1. **Authorization**

- `api/shared/sessionUtils.ts:32-45` — session access check expanded to Admin/owner/org match; all session-related endpoints now await this guard.

2. **Output Upload Hardening**

- `api/get-output-upload-sas/index.ts:1-165` — issues `acw` SAS for outputs with server-driven blob names and prefix validation.
- `src/lib/storage-azure.ts:1-63` — uploads use SAS URLs (no AccountKey), with progress support.
- `src/lib/azureApi.ts:209-246` — client helper to request output-upload SAS.
- `src/azure-config.ts:80-103` — config maps the new SAS endpoint.
- `src/components/TranscriptionResult.tsx:136-154` — task/information uploads call the SAS path.
- `src/hooks/useSpeakerEditing.ts:213-220` — transcript saves use SAS uploads.

3. **Docs Alignment**

- `newchanges.md` / `newchnages1.md` — statuses updated: 1.4 and 2.2 marked completed; remaining partials limited to portal/IaC confirmations.

4. **Portal/IaC Follow-ups (not in code)**

- Verify app registration settings (redirect/post-logout URI, authority/knownAuthorities) match the deployed frontend.
- Restrict Blob Storage (disable public access; minimal CORS for transcripts/outputs).
- If required, apply private endpoints/VNet integration for Storage/Functions/Key Vault and retain evidence (screenshots/JSON).
