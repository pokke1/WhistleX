import { expect } from "chai";
import { ethers } from "hardhat";

describe("IntelPool", function () {
  it("tracks contributions and unlocks at threshold", async function () {
    const [investigator, contributor] = await ethers.getSigners();
    const token = await ethers.deployContract("MockUSDC");
    const tokenAddress = await token.getAddress();

    const factory = await ethers.deployContract("IntelPoolFactory", [tokenAddress]);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 60;
    const ciphertext = ethers.toUtf8Bytes("demo ciphertext");

    const tx = await factory
      .connect(investigator)
      .createPool(ethers.parseUnits("1", 6), ethers.parseUnits("0.1", 6), deadline, ciphertext);
    await tx.wait();

    const poolAddress = await factory.allPools(0);
    const pool = await ethers.getContractAt("IntelPool", poolAddress);

    await token.transfer(contributor.address, ethers.parseUnits("2", 6));
    await token.connect(contributor).approve(poolAddress, ethers.parseUnits("2", 6));

    await expect(pool.connect(contributor).contribute(ethers.parseUnits("0.4", 6))).to.emit(
      pool,
      "Contributed"
    );
    expect(await pool.contributionOf(contributor.address)).to.equal(ethers.parseUnits("0.4", 6));
    expect(await pool.unlocked()).to.equal(false);

    await expect(pool.connect(contributor).contribute(ethers.parseUnits("0.6", 6))).to.emit(
      pool,
      "Unlocked"
    );
    expect(await pool.unlocked()).to.equal(true);
  });

  it("checks decrypt eligibility", async function () {
    const [investigator, contributor] = await ethers.getSigners();
    const token = await ethers.deployContract("MockUSDC");
    const tokenAddress = await token.getAddress();

    const factory = await ethers.deployContract("IntelPoolFactory", [tokenAddress]);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 60;
    const ciphertext = ethers.toUtf8Bytes("demo ciphertext");

    await factory
      .connect(investigator)
      .createPool(ethers.parseUnits("1", 6), ethers.parseUnits("0.5", 6), deadline, ciphertext);
    const poolAddress = await factory.allPools(0);
    const pool = await ethers.getContractAt("IntelPool", poolAddress);

    await token.transfer(contributor.address, ethers.parseUnits("1", 6));
    await token.connect(contributor).approve(poolAddress, ethers.parseUnits("1", 6));

    await pool.connect(contributor).contribute(ethers.parseUnits("1", 6));
    expect(await pool.canDecrypt(contributor.address)).to.equal(true);
    expect(await pool.canDecrypt(investigator.address)).to.equal(false);
  });

  it("allows refunds after deadline if threshold not met", async function () {
    const [investigator, contributor] = await ethers.getSigners();
    const token = await ethers.deployContract("MockUSDC");
    const tokenAddress = await token.getAddress();

    const factory = await ethers.deployContract("IntelPoolFactory", [tokenAddress]);
    const deadline = Math.floor(Date.now() / 1000) + 60;
    const ciphertext = ethers.toUtf8Bytes("demo ciphertext");

    await factory
      .connect(investigator)
      .createPool(ethers.parseUnits("10", 6), ethers.parseUnits("1", 6), deadline, ciphertext);
    const poolAddress = await factory.allPools(0);
    const pool = await ethers.getContractAt("IntelPool", poolAddress);

    await token.transfer(contributor.address, ethers.parseUnits("2", 6));
    await token.connect(contributor).approve(poolAddress, ethers.parseUnits("2", 6));
    await pool.connect(contributor).contribute(ethers.parseUnits("2", 6));

    await ethers.provider.send("evm_increaseTime", [120]);
    await ethers.provider.send("evm_mine", []);

    const balanceBefore = await token.balanceOf(contributor.address);
    await expect(pool.connect(contributor).refund()).to.emit(pool, "Refunded");
    const balanceAfter = await token.balanceOf(contributor.address);

    expect(balanceAfter - balanceBefore).to.equal(ethers.parseUnits("2", 6));
    expect(await pool.contributionOf(contributor.address)).to.equal(0);
  });
});
