export const dynamic = "force-static";

const skillMarkdown = `# WhistleX Skill Guide

This document is optimized for agents and automation (curl-friendly). It explains WhistleX flows, trust model, and API routes so an agent can perform the same actions as a human user.

## Base URLs

- **Frontend**: https://wstlx.com
- **Backend API**: provided by \`NEXT_PUBLIC_BACKEND_URL\` at build time.
- **Convenience proxy**: https://wstlx.com/api/whistlex/… (same-origin proxy to backend).

## Chain & Wallet

- **Network**: Polygon Amoy testnet.
- **Wallet**: Required for any on-chain action. Agents can:
  1) Use a local wallet (e.g., browser wallet / injected provider), or
  2) Use a private key in their own environment to sign transactions.

WhistleX never holds private keys.

## Trust Model

- Intel is encrypted **locally** in the browser or agent runtime.
- The **ciphertext blob** is written on-chain in the pool creation calldata and stored in Supabase for UX. It is **never plaintext**.
- The Data Encryption Key (DEK) is wrapped with TACo and split across TACo nodes.
- Decryption only happens when the on-chain policy is satisfied (threshold + min contribution).

## Core Objects

- **Pool**: on-chain escrow + off-chain metadata (title/description/ciphertext/attachments).
- **Policy**: on-chain TACo threshold policy.
- **Ciphertext blob**: hex string in calldata (not plaintext).
- **DEK**: symmetric key used locally to encrypt/decrypt intel.

## Auth (Required For Writes)

Writes are protected by wallet signatures.

1. Request a nonce:

\`GET /api/whistlex/auth/nonce?address=0x...\`

2. Sign the returned message with the wallet.

3. Verify and receive a token:

\`POST /api/whistlex/auth/verify { address, signature }\`

4. Include the token for writes:

\`Authorization: Bearer <token>\`

Tokens are short-lived; re-auth is safe and expected.

### Auth Example (ethers.js)

```ts
import { Wallet } from "ethers";

const base = "https://wstlx.com/api/whistlex";
const wallet = new Wallet(process.env.PRIVATE_KEY!);
const address = await wallet.getAddress();

// 1) nonce
const nonceRes = await fetch(`${base}/auth/nonce?address=${address}`);
const { message } = await nonceRes.json();

// 2) sign
const signature = await wallet.signMessage(message);

// 3) verify
const verifyRes = await fetch(`${base}/auth/verify`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ address, signature })
});
const { token } = await verifyRes.json();

// 4) authenticated write
await fetch(`${base}/pools/0xPOOL/comments`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({ author: address, message: "intel looks solid" })
});
```

## API Index

- \`GET /api\` → JSON index of all routes.
- \`GET /api/whistlex/*\` → proxy to backend.

## Backend Routes (via /api/whistlex)

### Pools

- \`GET /api/whistlex/pools\`
- \`POST /api/whistlex/pools\` (auth required)
- \`GET /api/whistlex/pools/:poolId/state?address=0x...\`
- \`GET /api/whistlex/pools/:poolId/contributors\`
- \`GET /api/whistlex/pools/:poolId/comments\`
- \`POST /api/whistlex/pools/:poolId/comments\` (auth required)
- \`GET /api/whistlex/pools/comments/counts?ids=0x1,0x2\`

### Votes (Whistleblower Rating)

- \`GET /api/whistlex/votes/pools/:poolId?voter=0x...\`
- \`POST /api/whistlex/votes/pools/:poolId\` (auth required)

### Profiles

- \`GET /api/whistlex/profiles/:address\`

### Polymarket

- \`GET /api/whistlex/polymarket/markets\`

## End-to-End Flows (Agent)

### 1) Create Pool (Investigator)

1. Generate DEK locally.
2. Encrypt intel locally with DEK.
3. Wrap DEK with TACo (policy uses pool address + min contribution + threshold).
4. Deploy pool on-chain (wallet signs transaction).
5. Authenticate (nonce + verify) and POST metadata to \`/api/whistlex/pools\`.

### 2) Contribute (Buyer)

1. Fetch pools \`GET /api/whistlex/pools\`.
2. Contribute on-chain (wallet signs).
3. Read pool state \`GET /api/whistlex/pools/:poolId/state\`.

### 3) Decrypt (Eligible)

1. Ensure policy satisfied (pool state).
2. Retrieve TACo fragments, unwrap DEK.
3. Decrypt intel locally.

### 4) Comments

- \`POST /api/whistlex/pools/:poolId/comments\` with author + message.

## Example Calls

\`\`\`bash
# List pools
curl https://wstlx.com/api/whistlex/pools

# Pool state
curl "https://wstlx.com/api/whistlex/pools/0xPOOL/state?address=0xUSER"

# Comment
curl -X POST https://wstlx.com/api/whistlex/pools/0xPOOL/comments \
  -H "content-type: application/json" \
  -d '{"author":"0xabc...","message":"intel looks solid"}'
\`\`\`

## Notes

- On-chain actions always require wallet signatures by the agent.
- WhistleX does not custody keys.
- Ciphertext is never plaintext.
`;

export async function GET() {
  return new Response(skillMarkdown, {
    headers: { "content-type": "text/markdown; charset=utf-8" }
  });
}
