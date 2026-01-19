import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  let currencyAddress = process.env.CURRENCY_ADDRESS || process.env.USDC_ADDRESS;

  if (!currencyAddress) {
    console.log("CURRENCY_ADDRESS not set; deploying MockUSDC for local usage...");
    const mockUsdc = await ethers.deployContract("MockUSDC");
    await mockUsdc.waitForDeployment();
    currencyAddress = await mockUsdc.getAddress();
    console.log("MockUSDC deployed to:", currencyAddress);
  } else {
    console.log("Using configured currency:", currencyAddress);
  }

  const factory = await ethers.deployContract("IntelPoolFactory", [currencyAddress]);
  await factory.waitForDeployment();

  console.log("IntelPoolFactory deployed to:", await factory.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
