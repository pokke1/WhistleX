# WhistleX Backend

Express + TypeScript service for handling intel uploads, TACo policy generation, and indexing on-chain events into Supabase.

## Setup

1) Install dependencies:

```sh
cd backend
npm install
```

2) Configure environment (`backend/.env`, see `.env.example`):

- `SUPABASE_URL` and `SUPABASE_ANON_KEY` (required)
- `RPC_URL` (or `AMOY_RPC_URL`) for the chain you want to index
- `FACTORY_ADDRESS` from your contract deployment
- `USDC_ADDRESS` (optional) to share the pool currency address with other services
- `PORT` optional (defaults to 4000)

3) Run the service:

```sh
npm run dev
```

For production builds: `npm run build` then `npm start`.

## Notes

- The indexer starts only when `FACTORY_ADDRESS` is set; otherwise the API still serves the upload routes.
- Use `RPC_URL=http://127.0.0.1:8545` when working against a local Hardhat node.
- `.env.example` ships with Polygon Amoy defaults and the shared demo TACo/deployer key. Override these values for any non-demo environment.
- Health probe available at `/health`.
