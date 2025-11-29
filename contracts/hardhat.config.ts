import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

import { DEFAULT_SEPOLIA_RPC_URL, TESTNET_PRIVATE_KEY } from "../shared/testnet";

const sepoliaRpc = process.env.SEPOLIA_RPC_URL || DEFAULT_SEPOLIA_RPC_URL;
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
    sepolia: {
      url: sepoliaRpc,
      accounts: [defaultDeployerKey],
      chainId: 11155111
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || sepoliaRpc,
      accounts: [defaultDeployerKey],
      chainId: 84532
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
