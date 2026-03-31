## Summary
- Migrates threshold access handling from TACo to Lit Protocol v6 using wallet/session auth flow.
- Keeps frontend keyless (no Lit API key in frontend env).
- Adds compatibility-oriented policy description handling and integration harness.
- Adds outage resume runbook for completing validations when Lit connectivity is restored.

## Current status
- Build/sanity checks pass.
- Final Lit runtime E2E checks are blocked by temporary Lit connectivity outage (per Lit team update).

## Pending validation checklist (required before merge)
- [ ] Create pool succeeds
- [ ] DEK encrypt via Lit returns blob, saved to `intel_blobs.messagekit`
- [ ] Before unlock, decrypt request fails
- [ ] After threshold + min contribution, decrypt succeeds
- [ ] Returned DEK decrypts ciphertext locally
- [ ] Existing pools with older TACo payloads are either:
  - [ ] readable via shim/fallback, or
  - [ ] clearly marked unsupported in PR notes

## Resume instructions
See `RUNBOOK_LIT_RESUME.md` and run:

```bash
cd frontend
node scripts/lit-integration-check.js
```
