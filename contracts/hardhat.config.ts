import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

import { DEFAULT_POLYGON_AMOY_RPC_URL, TESTNET_PRIVATE_KEY } from "../shared/testnet";

const amoyRpc =
  process.env.AMOY_RPC_URL || process.env.POLYGON_RPC_URL || DEFAULT_POLYGON_AMOY_RPC_URL;
const defaultDeployerKey = process.env.DEPLOYER_KEY || TESTNET_PRIVATE_KEY;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.21",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    amoy: {
      url: amoyRpc,
      accounts: [defaultDeployerKey],
      chainId: 80002
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};

export default config;
