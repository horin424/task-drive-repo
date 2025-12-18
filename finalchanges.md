# Final Change Log

- **Org-based authorization added**: `api/shared/sessionUtils.ts:32-45` now allows Admin, owner, or matching organization for session access (used across all session APIs).
- **Output upload via SAS**: New endpoint `api/get-output-upload-sas/index.ts:1-165` issues short-lived `acw` SAS with server-defined blob paths.
- **Frontend output uploads moved to SAS**:
  - `src/lib/storage-azure.ts:1-63` now uploads via SAS (no AccountKey).
  - `src/components/TranscriptionResult.tsx:136-154` sends tasks/information files through server SAS.
  - `src/hooks/useSpeakerEditing.ts:213-220` saves edited transcripts via SAS.
  - `src/lib/azureApi.ts:209-246` adds `getOutputUploadSasUrl` client helper.
  - `src/azure-config.ts:80-103` exposes the new output upload SAS endpoint.
- **Documentation status updated**: `newchanges.md` and `newchnages1.md` now mark 1.4 and 2.2 as completed, reflecting the above code changes.
- **Portal/IaC actions still required**:
  - Confirm SPA redirect/post-logout URIs and authority/knownAuthorities in Entra/B2C app registrations match the deployed frontend.
  - Lock down Blob Storage: disable public access on account/containers, and set minimal CORS (origins/methods/headers/expose/maxAge) for transcripts/outputs.
  - If applicable, enable private endpoints/VNet integration for Storage/Functions/Key Vault and capture evidence (screenshots or JSON export).
