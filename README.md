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

``` sh
git clone https://github.com/YOUR_USERNAME/whistlex.git
cd whistlex
```

## 🧭 Project Structure

    contracts/
    backend/
    frontend/
    shared/
    supabase/
    infra/

## 🧪 Local Development

``` sh
npx hardhat node
npx hardhat run scripts/deploy.ts --network localhost
npm run dev
```

## 📝 License

MIT
