import * as dotenv from 'dotenv'
dotenv.config()

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const defaultDeployerKey = process.env.DEPLOYER_KEY;
const amoyRpc = process.env.AMOY_RPC_URL;

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
