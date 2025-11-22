import { expect } from "chai";
import { ethers } from "hardhat";

describe("IntelPool", function () {
  it("tracks contributions and unlocks at threshold", async function () {
    const [investigator, contributor] = await ethers.getSigners();

    const factory = await ethers.deployContract("IntelPoolFactory");
    const tx = await factory.connect(investigator).createPool(
      ethers.parseEther("1"),
      ethers.parseEther("0.1")
    );
    const receipt = await tx.wait();
    const event = receipt!.logs.find((log) => log.fragment?.name === "PoolCreated");
    expect(event).to.not.be.undefined;

    const poolAddress = event!.args![1];
    const pool = await ethers.getContractAt("IntelPool", poolAddress);

    await expect(
      pool.connect(contributor).contribute({ value: ethers.parseEther("0.4") })
    ).to.emit(pool, "Contributed");
    expect(await pool.contributionOf(contributor.address)).to.equal(
      ethers.parseEther("0.4")
    );
    expect(await pool.unlocked()).to.equal(false);

    await expect(
      pool.connect(contributor).contribute({ value: ethers.parseEther("0.6") })
    ).to.emit(pool, "Unlocked");
    expect(await pool.unlocked()).to.equal(true);
  });

  it("checks decrypt eligibility", async function () {
    const [investigator, contributor] = await ethers.getSigners();

    const factory = await ethers.deployContract("IntelPoolFactory");
    const receipt = await (
      await factory.createPool(ethers.parseEther("1"), ethers.parseEther("0.5"))
    ).wait();
    const poolAddress = receipt!.logs[0].args![1];
    const pool = await ethers.getContractAt("IntelPool", poolAddress);

    await pool.connect(contributor).contribute({ value: ethers.parseEther("1") });
    expect(await pool.canDecrypt(contributor.address)).to.equal(true);
    expect(await pool.canDecrypt(investigator.address)).to.equal(false);
  });
});
