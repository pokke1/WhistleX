import { ethers } from "hardhat";

const DEFAULT_THRESHOLD = ethers.parseEther("1");
const DEFAULT_MIN_CONTRIBUTION = ethers.parseEther("0.1");
const ONE_WEEK_IN_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_DEADLINE = Math.floor(Date.now() / 1000) + ONE_WEEK_IN_SECONDS;
const DEFAULT_CIPHERTEXT = ethers.toUtf8Bytes(
  "placeholder ciphertext for TACo demo"
);

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("Deploying contracts with account:", deployer.address);
  console.log("Network:", network.name || "polygon-amoy", "(chain id:", network.chainId, ")");

  const factory = await ethers.deployContract("IntelPoolFactory");
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();

  console.log("IntelPoolFactory deployed to:", factoryAddress);

  const createTx = await factory.createPool(
    DEFAULT_THRESHOLD,
    DEFAULT_MIN_CONTRIBUTION,
    DEFAULT_DEADLINE,
    DEFAULT_CIPHERTEXT
  );
  const receipt = await createTx.wait();

  if (!receipt) {
    throw new Error("Pool creation transaction did not return a receipt");
  }

  const poolsCount = await factory.poolsCount();
  const poolAddress = await factory.allPools(poolsCount - 1n);

  console.log("Initial IntelPool deployed to:", poolAddress);
  console.log("Deployment complete. Update DEFAULT_* values as needed before mainnet use.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
