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

## Deploying to Sepolia

A shared Sepolia deployer key (Hardhat default account 0: `0xac0974...ff80`) lives in `../shared/testnet.ts` for testing and TACo integration. Fund it with Sepolia ETH or export `DEPLOYER_KEY` to override. You can also set `SEPOLIA_RPC_URL` if you prefer a custom RPC endpoint (defaults to `https://sepolia.drpc.org`).

```sh
cd contracts
npm run deploy:sepolia
```

The script deploys the `IntelPoolFactory` and creates an initial pool in one run. Copy the printed factory address into the fron
tend/backend environment files.
