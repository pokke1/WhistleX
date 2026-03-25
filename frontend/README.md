# WhistleX Frontend

Next.js 14 UI for investigators to create intel pools and for contributors to fund and unlock them.

## Setup

1) Install dependencies:

```sh
cd frontend
npm install
```

2) Configure environment (`frontend/.env`, see `.env.example`):

- `NEXT_PUBLIC_BACKEND_URL` (e.g., `http://localhost:4000`)
- `NEXT_PUBLIC_FACTORY_ADDRESS` from your contract deployment
- `NEXT_PUBLIC_USDC_ADDRESS` and optional `NEXT_PUBLIC_USDC_DECIMALS` (default 6) for the pool currency
- TACo/testnet defaults to keep or override: `NEXT_PUBLIC_AMOY_RPC_URL`, `AMOY_RPC_URL`, `NEXT_PUBLIC_TACO_DKG_RPC_URL`, `NEXT_PUBLIC_TACO_CONDITION_CHAIN_ID`, `NEXT_PUBLIC_TACO_RITUAL_ID`
- If you run signer-based local test helpers, pass `DEVELOPER_KEY` only in local shell env (never `NEXT_PUBLIC_*`).

3) Start the app:

```sh
npm run dev
```

Open `http://localhost:3000` in your browser.

## Notes

- Uses `@nucypher/taco@0.6.0` with `ethers@5.7.2`; no extra install flags are needed.
- `.env.example` contains public network defaults only. Keep secrets/private keys out of the repo and out of `NEXT_PUBLIC_*` variables.
