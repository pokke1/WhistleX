# WhistleX Contracts

Hardhat project containing the `IntelPoolFactory` and `IntelPool` smart contracts used by the WhistleX marketplace.

## Setup

- Node.js 20+ and npm 10+
- Install dependencies:

```sh
cd contracts
npm install
```

## Useful scripts

- `npm run build` - compile the contracts
- `npm test` - run the Hardhat test suite
- `npm run deploy -- --network localhost` - deploy to a running Hardhat node
- `npm run deploy:amoy` - deploy the factory and an initial pool to Polygon Amoy

## Local workflow

1) Start a local node:

```sh
npx hardhat node
```

2) In another terminal, deploy to localhost:

```sh
npm run deploy -- --network localhost
```

3) Copy the printed `IntelPoolFactory` address into the backend/frontend environment files so they can index and transact against the local chain.

## Polygon Amoy deployment

- Set `AMOY_RPC_URL` and `DEPLOYER_KEY` in your environment (copy the demo key from `../shared/testnet.ts` for quick tests, but use your own funded key for real deployments).
- Deploy the mock USDC currency (6 decimals, 1,000,000 minted to the deployer) and copy its address:

```sh
npm run deploy:usdc:amoy
```

- Export `CURRENCY_ADDRESS` (or `USDC_ADDRESS`) to the token address from the previous step, then run:

```sh
npm run deploy:amoy
```

The script deploys the `IntelPoolFactory` (wired to your mock USDC) and creates an initial pool in one run. Save the factory address for the backend and frontend configuration.
