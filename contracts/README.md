# WhistleX Contracts

Hardhat project containing the IntelPoolFactory and IntelPool smart contracts used by the WhistleX marketplace MVP.

## Getting started

```sh
cd contracts
npm install
npm run build
npm test
```

## Deploying locally

```sh
npx hardhat node
npm run deploy -- --network localhost
```

## Deploying to Polygon Amoy

A shared Amoy deployer key lives in `../shared/testnet.ts` for testing and TACo integration. **It ships unfunded**—top it up with at least ~0.05 Amoy MATIC via a faucet before running the deployment script, or export `DEPLOYER_KEY` to use your own funded wallet. You can also set `AMOY_RPC_URL` if you prefer a custom RPC endpoint (defaults to `https://polygon-amoy.drpc.org`).

```sh
cd contracts
npm run deploy:amoy
```

The script deploys the `IntelPoolFactory` and creates an initial pool in one run. Copy the printed factory address into the frontend/backend environment files.
