import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("Deploying MockUSDC with account:", deployer.address);
  console.log("Network:", network.name || "polygon-amoy", "(chain id:", network.chainId, ")");

  const token = await ethers.deployContract("MockUSDC");
  await token.waitForDeployment();

  const address = await token.getAddress();
  const supply = await token.totalSupply();
  const balance = await token.balanceOf(deployer.address);

  console.log("MockUSDC deployed to:", address);
  console.log("Total supply:", ethers.formatUnits(supply, await token.decimals()), "mUSDC");
  console.log("Deployer balance:", ethers.formatUnits(balance, await token.decimals()), "mUSDC");
  console.log("Set CURRENCY_ADDRESS/USDC_ADDRESS to this token address before deploying pools.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
