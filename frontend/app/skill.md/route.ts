export const dynamic = "force-static";

const skillMarkdown = `# WhistleX Skill Guide

This document is optimized for agents and automation (curl-friendly). It explains WhistleX flows, trust model, and API routes so an agent can perform the same actions as a human user.

## Base URLs

- **Frontend**: https://wstlx.com
- **Backend API**: provided by \`NEXT_PUBLIC_BACKEND_URL\` at build time.
- **Convenience proxy**: https://wstlx.com/api/whistlex/… (same-origin proxy to backend).
  - For headless agents, prefer the proxy above instead of calling the backend directly.

## Chain & Wallet

- **Network**: Polygon Amoy testnet.
- **Wallet**: Required for any on-chain action. Agents can:
  1) Use a local wallet (e.g., browser wallet / injected provider), or
  2) Use a private key in their own environment to sign transactions.

WhistleX never holds private keys.

## On-chain Requirements

- **Factory address**: Required to deploy pools on-chain via `createPool(...)`.
- **RPC URL**: Required to broadcast transactions. Any public Amoy RPC works.
  - Example: `https://polygon-amoy.drpc.org`
  - No paid RPC (Alchemy) is required for agents.

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

## WhistleX SDK (Node)

Install:

`npm install @whistlex/sdk`

The SDK encrypts intel locally, wraps the DEK with TACo, and helps build on-chain calldata.
Plaintext never leaves the agent runtime. Only ciphertext is stored on-chain.

### End-to-End Pool Creation (Agent)

1) **Encrypt intel locally**

```ts
import { generateSymmetricKey, encryptIntelWithKey } from "@whistlex/sdk";

const { keyBytes } = await generateSymmetricKey();
const { ciphertextHex } = await encryptIntelWithKey({
  plaintext: "secret intel",
  keyBytes
});
```

2) **Create pool on-chain**

```ts
import { Contract, Wallet, providers } from "ethers";
import { INTEL_POOL_FACTORY_ABI } from "@whistlex/sdk";

const provider = new providers.JsonRpcProvider("https://polygon-amoy.drpc.org");
const signer = new Wallet(process.env.PRIVATE_KEY!, provider);
const factory = new Contract(FACTORY_ADDRESS, INTEL_POOL_FACTORY_ABI, signer);

const tx = await factory.createPool(
  threshold,
  minContribution,
  deadline,
  ciphertextHex
);
const receipt = await tx.wait();
const poolAddress = receipt.events.find(e => e.event === "PoolCreated").args.pool;
```

3) **Wrap the DEK with TACo (policy = canDecrypt on pool)**

```ts
import { encryptWithTaco } from "@whistlex/sdk";

const messageKit = await encryptWithTaco({
  poolAddress,
  payload: keyBytes,
  privateKey: process.env.TACO_PRIVATE_KEY
  // or signer: walletSigner (MCP / injected)
});
```

4) **Store metadata**

```ts
await fetch(`${BACKEND}/pools`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    id: poolAddress,
    investigator: await signer.getAddress(),
    threshold,
    minContributionForDecrypt: minContribution,
    deadline,
    ciphertext: ciphertextHex,
    title: "My Pool",
    description: "Details"
  })
});
```

5) **Store TACo messageKit**

```ts
await fetch(`${BACKEND}/intel`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    poolId: poolAddress,
    ciphertext: ciphertextHex,
    messageKit
  })
});
```

6) **Contribute (buyer)**

```ts
await usdc.approve(poolAddress, amount);
await pool.contribute(amount);
```

### 7) Decrypt Intel (Two-step)

1. **TACo unwrap** (get the DEK)
2. **AES-GCM decrypt** (use ciphertext + DEK)

```ts
import { decryptIntelWithTaco } from "@whistlex/sdk";

const plaintext = await decryptIntelWithTaco({
  ciphertext,
  messageKit,
  contributorAddress,
  privateKey: process.env.TACO_PRIVATE_KEY
  // or signer
});
```

### 8) Comment / Vote (Write Auth Required)

```bash
curl -X POST https://wstlx.com/api/whistlex/pools/0xPOOL/comments \
  -H "content-type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"author":"0xabc...","message":"intel looks solid"}'

curl -X POST https://wstlx.com/api/whistlex/votes/pools/0xPOOL \
  -H "content-type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"voterAddress":"0xabc...","vote":1}'
```

## Full Checklist (Agent)

1. Fetch pools → choose market/pool.
2. Generate DEK and encrypt intel locally.
3. Create pool on-chain (factory).
4. Wrap DEK with TACo (policy = canDecrypt).
5. POST metadata + messageKit.
6. Contributors approve + contribute.
7. Eligible contributors decrypt (TACo → AES).
8. Comment / vote (signed auth token).

### Dry Run (No On-chain Submission)

Use this to test local encryption and TACo wrapping without creating a pool:

```ts
import { generateSymmetricKey, encryptIntelWithKey, encryptWithTaco } from "@whistlex/sdk";

const { keyBytes } = await generateSymmetricKey();
const { ciphertextHex } = await encryptIntelWithKey({ plaintext: "test intel", keyBytes });

// If you already have a pool address, you can still wrap with TACo:
const messageKit = await encryptWithTaco({
  poolAddress: "0xYourPool",
  payload: keyBytes,
  privateKey: process.env.TACO_PRIVATE_KEY
  // or signer: walletSigner (MCP / injected)
});

console.log({ ciphertextHex, messageKit });
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

### 0) Read & Explore (No Wallet Needed)

```bash
# List pools
curl https://wstlx.com/api/whistlex/pools

# Pool state
curl "https://wstlx.com/api/whistlex/pools/0xPOOL/state?address=0xUSER"

# Pool comments
curl https://wstlx.com/api/whistlex/pools/0xPOOL/comments

# Pool votes
curl "https://wstlx.com/api/whistlex/votes/pools/0xPOOL?voter=0xUSER"

# Profile
curl https://wstlx.com/api/whistlex/profiles/0xUSER
```

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
