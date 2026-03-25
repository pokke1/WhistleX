# WhistleX

WhistleX is a TACo-secured marketplace MVP for encrypted intelligence. Investigators publish encrypted intel with a funding goal; contributors collectively unlock the data once the threshold is met.

## Components

- `contracts/`: IntelPoolFactory + IntelPool smart contracts and deploy scripts
- `backend/`: Express API for uploads plus a Supabase-backed indexer
- `frontend/`: Next.js UI for investigators and contributors
- `shared/`: Shared TypeScript types and testnet constants
- `supabase/`: SQL schema and migrations
- `infra/`: Infra tooling

## Prerequisites

- Node.js 20+ and npm 10+
- Supabase project (URL + anon key) for indexing
- RPC access: Hardhat localhost for local runs or Polygon Amoy for the shared test flow

## Local quickstart (Hardhat)

1) Install dependencies

```sh
cd contracts && npm install
cd ../backend && npm install
cd ../frontend && npm install
```

2) Start a Hardhat node

```sh
cd contracts
npx hardhat node
```

3) Deploy contracts to localhost and copy the printed `IntelPoolFactory` address

```sh
cd contracts
npx hardhat run scripts/deploy.ts --network localhost
```

4) Configure backend env (`backend/.env`, see `.env.example`)

- `SUPABASE_URL` and `SUPABASE_ANON_KEY` from your project
- `RPC_URL=http://127.0.0.1:8545`
- `FACTORY_ADDRESS=<address from step 3>`

5) Run the backend

```sh
cd backend
npm run dev
```

6) Configure frontend env (`frontend/.env`, see `.env.example`)

- `NEXT_PUBLIC_BACKEND_URL=http://localhost:4000`
- `NEXT_PUBLIC_FACTORY_ADDRESS=<address from step 3>`

7) Run the frontend

```sh
cd frontend
npm run dev
```

The app will be available at `http://localhost:3000` against the local contracts and backend.

## Polygon Amoy test flow

For quick TACo testing:

1) Set deployer env vars with your own funded key (never commit private keys)

```sh
export AMOY_RPC_URL=https://polygon-amoy.drpc.org
export DEPLOYER_KEY=<your-private-key>
```

2) Deploy the factory and initial pool

```sh
cd contracts
npm run deploy:usdc:amoy   # deploys MockUSDC (1,000,000 supply, 6 decimals)
export CURRENCY_ADDRESS=<MockUSDC address from previous command>
npm run deploy:amoy        # deploys IntelPoolFactory bound to MockUSDC and an initial pool
```

3) Point the backend at Polygon Amoy

- `RPC_URL` or `AMOY_RPC_URL` set to your Amoy RPC
- `FACTORY_ADDRESS` set to the deployed factory address
- `USDC_ADDRESS` set to the MockUSDC address (also share as `NEXT_PUBLIC_USDC_ADDRESS` for the frontend)
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` set for your project

4) Point the frontend at Polygon Amoy

- `NEXT_PUBLIC_BACKEND_URL` set to your backend URL
- `NEXT_PUBLIC_FACTORY_ADDRESS` set to the same factory address
- `NEXT_PUBLIC_USDC_ADDRESS` set to the MockUSDC address
- Keep or override TACo RPC values in `frontend/.env.example`
- If a private key is needed for local test flows, set it only in local shell env (`DEVELOPER_KEY`) and never under `NEXT_PUBLIC_*`

## TACo access rule

A contributor can decrypt when `IntelPool(pool).isUnlocked()` is true **and** `IntelPool(pool).contributionOf(user) >= minContributionForDecrypt`.

## Additional docs

- `contracts/README.md`
- `backend/README.md`
- `frontend/README.md`
