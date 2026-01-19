import { ethers } from "hardhat";

const DEFAULT_THRESHOLD = ethers.parseUnits("1000", 6);
const DEFAULT_MIN_CONTRIBUTION = ethers.parseUnits("100", 6);
const ONE_WEEK_IN_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_DEADLINE = Math.floor(Date.now() / 1000) + ONE_WEEK_IN_SECONDS;
const DEFAULT_CIPHERTEXT = ethers.toUtf8Bytes("placeholder ciphertext for TACo demo");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  const currencyAddress = process.env.CURRENCY_ADDRESS || process.env.USDC_ADDRESS;
  if (!currencyAddress) {
    throw new Error("Set CURRENCY_ADDRESS (or USDC_ADDRESS) to your MockUSDC token before deploying pools.");
  }

  console.log("Deploying contracts with account:", deployer.address);
  console.log("Network:", network.name || "polygon-amoy", "(chain id:", network.chainId, ")");
  console.log("Using currency:", currencyAddress);

  const factory = await ethers.deployContract("IntelPoolFactory", [currencyAddress]);
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
