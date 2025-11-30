# WhistleX Frontend

Next.js 14 UI for the WhistleX marketplace. Includes investigator pool creation and contributor viewing flows.

## Development

```sh
cd frontend
npm install
npm run dev
```

Set `NEXT_PUBLIC_BACKEND_URL` to point at the Express service.

## TACo + Polygon Amoy test key

The app uses the shared Polygon Amoy TACo/deployer private key defined in `../shared/testnet.ts` when encrypting investigator keys. Update that file (and redeploy contracts) before moving beyond testnet. The frontend still requires `NEXT_PUBLIC_FACTORY_ADDRESS` to know which factory to call on Amoy.

`frontend/.env.example` is prefilled with the sample CLI settings (Polygon Amoy RPC for TACo + ritual ID 6 + the demo private key). If you leave `.env` empty, those values are used automatically; populate `.env` to override them for mainnet or a different key.
