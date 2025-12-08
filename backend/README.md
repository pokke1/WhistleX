# WhistleX Backend

Express + TypeScript service for handling intel uploads, TACo policy generation, and indexing on-chain events into Supabase.

## Development

```sh
cd backend
npm install
npm run dev
```

Environment variables live in `.env` (see `.env.example`). The dev server fails fast with a clear error if
`SUPABASE_URL` or `SUPABASE_ANON_KEY` are missing so you know configuration needs to be set before running.

`.env.example` is prefilled with the Sepolia defaults from the TACo CLI sample (DRPC Sepolia RPC + demo deployer/TACo key). Leave `.env` empty to reuse those, or populate it with your own RPC/key when moving to another network.
