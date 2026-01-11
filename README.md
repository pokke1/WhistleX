# WhistleX --- MVP (TACo-secured Intel Marketplace)

WhistleX is a decentralized Web3 marketplace for publishing encrypted
intelligence. Investigators upload encrypted intel, set a funding
threshold, and contributors collectively unlock the material by meeting
the goal.

This MVP integrates:

-   **Threshold Access Control (TACo)** for conditional decryption
-   **EVM Smart Contracts** for escrow logic
-   **Next.js Frontend**
-   **Express Backend + Supabase**
-   **Hardhat deployment scripts**

## 🚀 MVP Architecture Overview

### 1. Contracts (`/contracts`)

Smart contracts implement:

-   Pool creation via `IntelPoolFactory`
-   Escrow logic in `IntelPool`
-   Tracking contributions & unlock conditions
-   View helpers for TACo:
    -   `isUnlocked()`
    -   `contributionOf(address)`
    -   `minContributionForDecrypt()`
    -   `canDecrypt(address)`

### 2. Frontend (`/frontend`)

Next.js 14 + React app:

-   Investigator flow:
    -   generate DEK
    -   encrypt intel
    -   upload to backend
    -   create pool
    -   initialize TACo policy
-   Contributor flow:
    -   connect wallet
    -   contribute
    -   if unlocked & contribution ≥ n → TACo decrypts DEK → decrypt
        intel blob

### 3. Backend API (`/backend`)

Express server that:

-   Stores encrypted intel blobs & metadata
-   Validates investigator's TACo policy setup
-   Generates canonical TACo access conditions per pool
-   Indexes Ethereum events
-   Synchronizes state to Supabase

### 4. Supabase (`/supabase`)

Stores:

-   Pools
-   Contributions
-   Encrypted blobs
-   TACo policy IDs
-   Identity mappings

### 5. TACo Access Control

    IntelPool(pool).isUnlocked() == true AND
    IntelPool(pool).contributionOf(user) >= minContributionForDecrypt

## 📦 Installation

### Prerequisites

- Node.js **22.x** (Hardhat 3 warns on Node 20)
- `npm` 10+
- Optional: a Base Sepolia RPC endpoint and funded deployer key for testnet deployments

### Clone the repo

```sh
git clone https://github.com/YOUR_USERNAME/whistlex.git
cd whistlex
```

## 🧭 Project Structure

    contracts/   # Hardhat contracts + deployment scripts
    backend/     # Express API + indexer
    frontend/    # Next.js app
    shared/      # Shared TS types
    supabase/    # SQL schema + migrations
    infra/       # Infra tooling

## 🧪 Local Development (localhost chain)

1) **Install dependencies**

```sh
cd contracts && npm install
cd ../backend && npm install
cd ../frontend && npm install
# if you previously installed with an unpublished TACo version, clear old deps:
# rm -rf node_modules package-lock.json && npm install
```

The frontend is pinned to the published `@nucypher/taco@0.6.0` (with `ethers@^5.7.2`) so a plain `npm install` now succeeds without
extra flags. Removing old `node_modules`/lockfiles avoids the `ETARGET` and peer-dependency errors you may have seen with
`@nucypher/taco@^1.0.0`.

2) **Start a local Hardhat node** (from `contracts/` so the config is picked up):

```sh
cd contracts
npx hardhat node
```

3) **Deploy contracts to localhost** (in a separate shell, also from `contracts/`):

```sh
cd contracts
npx hardhat run scripts/deploy.ts --network localhost
```

The script prints the deployed `IntelPoolFactory` address. Copy it for the backend env. On a fresh Hardhat localhost run, it will typically be `0x5FbDB2315678afecb367f032d93F642f64180aa3`, but always rely on the address printed by your own deploy run.

4) **Configure backend env**

Create `backend/.env` from `backend/.env.example` and set:

```ini
SUPABASE_URL=...              # your Supabase project URL
SUPABASE_ANON_KEY=...         # anon key
RPC_URL=http://127.0.0.1:8545 # Hardhat node URL
FACTORY_ADDRESS=0x...         # value from deploy step
PORT=4000                     # optional override
```

The backend uses `FACTORY_ADDRESS` for indexing only. The frontend cannot read this value; it must be exposed separately as `NEXT_PUBLIC_FACTORY_ADDRESS` because it needs the address in the browser when sending the `createPool` transaction.

5) **Run backend**

```sh
cd backend
npm run dev
```

6) **Configure frontend env**

Create `frontend/.env` from `frontend/.env.example` and set:

```ini
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_FACTORY_ADDRESS=0x... # same value you set for FACTORY_ADDRESS
```

7) **Run frontend**

```sh
cd frontend
npm run dev
```

The app is now reachable at `http://localhost:3000` against the local contracts + backend.

## 🌐 Sepolia Deployment (shared test key)

For end-to-end TACo + Sepolia testing, the repo now uses the same demo values as the provided CLI sample:

- RPC: `https://sepolia.drpc.org`
- DKG RPC: `https://polygon-amoy.drpc.org`
- Ritual ID: `6`
- Demo private key: Hardhat default account 0 (`0xac0974...ff80`, stored in `shared/testnet.ts`)

Environment variables in `frontend/.env.example` and `backend/.env.example` are prefilled with these values. If you populate `.env` files, those overrides are used; if you leave them empty, the hardcoded Sepolia defaults remain in effect for fast testing.

1) (Optional) Override the default RPC or key by exporting env vars or editing `.env` files:

```sh
export SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
export NEXT_PUBLIC_TACO_PRIVATE_KEY=0xyour_own_test_key
export DEPLOYER_KEY=0xyour_own_test_key # otherwise the bundled key is used
```

2) Deploy factory + initial pool to Sepolia with the baked-in RPC/key (or your overrides):

```sh
cd contracts
npm run deploy:sepolia
```

3) Point the backend and frontend at the deployed factory:

- `backend/.env`: set `FACTORY_ADDRESS` to the factory address printed by the deploy script (RPC defaults to Sepolia unless you set `RPC_URL`).
- `frontend/.env`: set `NEXT_PUBLIC_BACKEND_URL` to your backend and `NEXT_PUBLIC_FACTORY_ADDRESS` to the same factory address. The frontend automatically reuses the shared TACo private key from `shared/testnet.ts` when encrypting unless you override it via env vars.


