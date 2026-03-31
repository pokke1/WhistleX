# Lit Resume Runbook (post-connectivity outage)

Use this runbook to resume validation and finalize the Lit migration PR once Lit network connectivity is restored.

## 1) Prerequisites

- Branch checked out: `feat/lit-v6-migration`
- Backend `.env` populated (Supabase + RPC + FACTORY + developer test key)
- Frontend `.env` populated for local app usage
- Dependencies installed:
  - `backend`: `npm install`
  - `frontend`: `npm install`

## 2) Start backend

```bash
cd backend
npm run dev
```

Health check:

```bash
curl -s http://localhost:8080/health
```

## 3) Sanity build frontend

```bash
cd ../frontend
npm run build
```

## 4) Run integration harness

```bash
cd frontend
node scripts/lit-integration-check.js
```

This script attempts to:

1. Create a pool on-chain with `AMOY_TEST_DEVELOPER_KEY`
2. Authenticate against backend (`/auth/nonce` + `/auth/verify`)
3. Save pool metadata in backend
4. Encrypt DEK with Lit (`encryptToJson`) and store as `messageKit`
5. Verify decrypt fails before unlock
6. Contribute to unlock
7. Verify decrypt succeeds after unlock
8. Check decrypted DEK equals original payload

Expected output includes a JSON summary with flags:

- `createPoolSucceeded`
- `messageKitStored`
- `beforeUnlockDecryptFailed`
- `unlocked`
- `afterUnlockDecryptSucceeded`
- `decryptedEqualsPayload`

## 5) Manual UI verification (recommended)

- Open app, create a pool
- Confirm backend `intel_blobs.messagekit` is populated
- Verify "Request key" fails before unlock
- Contribute enough to unlock
- Verify key retrieval works and intel decrypts locally

## 6) Legacy TACo pools decision

Before marking PR ready, explicitly decide and document one of:

- Supported via fallback/shim
- Unsupported (document clearly in PR notes)

## 7) PR completion checklist

- [ ] Create pool succeeds
- [ ] DEK encrypt via Lit returns blob, saved to `intel_blobs.messagekit`
- [ ] Before unlock, decrypt request fails
- [ ] After threshold + min contribution, decrypt succeeds
- [ ] Returned DEK decrypts ciphertext locally
- [ ] Legacy TACo pools support policy documented (fallback or unsupported)

## 8) Mark PR ready

Once checks pass:

- Update draft PR description with evidence/results
- Switch Draft -> Ready for Review
