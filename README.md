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
```

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

The script prints the deployed `IntelPoolFactory` address. Copy it for the backend env.

4) **Configure backend env**

Create `backend/.env` from `backend/.env.example` and set:

```ini
SUPABASE_URL=...              # your Supabase project URL
SUPABASE_ANON_KEY=...         # anon key
RPC_URL=http://127.0.0.1:8545 # Hardhat node URL
FACTORY_ADDRESS=0x...         # value from deploy step
PORT=4000                     # optional override
```

5) **Run backend**

```sh
cd backend
npm run dev
```

6) **Configure frontend env**

Create `frontend/.env` from `frontend/.env.example` and set `NEXT_PUBLIC_BACKEND_URL` (default `http://localhost:4000`).

7) **Run frontend**

```sh
cd frontend
npm run dev
```

The app is now reachable at `http://localhost:3000` against the local contracts + backend.

## 🌐 Base Sepolia Deployment (testnet)

1) Export a funded deployer key and RPC URL before running Hardhat:

```sh
export BASE_SEPOLIA_RPC_URL=https://base-sepolia.example
export DEPLOYER_KEY=0xyour_private_key
```

2) Deploy from `contracts/`:

```sh
cd contracts
npx hardhat run scripts/deploy.ts --network baseSepolia
```

3) Update `backend/.env` `RPC_URL` to the Base Sepolia endpoint and `FACTORY_ADDRESS` to the deployed factory address. The frontend will reuse the backend API and on-chain config automatically.


