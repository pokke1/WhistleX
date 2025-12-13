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
- TACo/testnet defaults to keep or override: `NEXT_PUBLIC_AMOY_RPC_URL`, `AMOY_RPC_URL`, `NEXT_PUBLIC_TACO_DKG_RPC_URL`, `NEXT_PUBLIC_TACO_CONDITION_CHAIN_ID`, `NEXT_PUBLIC_TACO_RITUAL_ID`, `NEXT_PUBLIC_TACO_PRIVATE_KEY`, `NEXT_PUBLIC_DEVELOPER_KEY`

3) Start the app:

```sh
npm run dev
```

Open `http://localhost:3000` in your browser.

## Notes

- Uses `@nucypher/taco@0.6.0` with `ethers@5.7.2`; no extra install flags are needed.
- `.env.example` points to Polygon Amoy and the shared demo key in `../shared/testnet.ts`. Replace these values for any real deployment.
