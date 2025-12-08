import { Contract, providers, utils, Wallet, BigNumber } from "ethers";
import { encryptWithTaco, decryptWithTaco, DEFAULT_TACO_PRIVATE_KEY } from "./taco";


const factoryAbi = [
  "event PoolCreated(address indexed investigator, address pool, uint256 threshold, uint256 minContributionForDecrypt, uint256 deadline, bytes ciphertext)",
  "function createPool(uint256 threshold,uint256 minContributionForDecrypt,uint256 deadline,bytes ciphertext) returns (address)"
];

const intelPoolAbi = [
  "function contribute() external payable",
  "function isUnlocked() external view returns (bool)",
  "function contributionOf(address contributor) external view returns (uint256)"
];

export interface TacoTestResult {
  poolAddress: string;
  thresholdWei: string;
  minContributionWei: string;
  contributorAddress: string;
  messageKit: string;
  initialDecryptError?: string;
  unlockedAfterContribute?: boolean;
  contributionTxHash?: string;
  decryptedPlaintext?: string;
  factoryTxHash?: string;
}

function resolveDeveloperKey() {
  return (
    process.env.NEXT_PUBLIC_DEVELOPER_KEY ||
    process.env.NEXT_PUBLIC_TACO_PRIVATE_KEY ||
    DEFAULT_TACO_PRIVATE_KEY
  );
}

export async function runTacoTestFlow(): Promise<TacoTestResult> {
  const rpcUrl = process.env.NEXT_PUBLIC_AMOY_RPC_URL || process.env.AMOY_RPC_URL;
  const factoryAddress = process.env.NEXT_PUBLIC_FACTORY_ADDRESS;
  if (!factoryAddress) {
    throw new Error("NEXT_PUBLIC_FACTORY_ADDRESS is not set");
  }
  if (!rpcUrl) {
    throw new Error("AMOY RPC URL is not set");
  }

  const developerKey = resolveDeveloperKey();
  if (!developerKey) {
    throw new Error("Developer key not configured");
  }

  const provider = new providers.JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(developerKey, provider);
  const contributorAddress = await wallet.getAddress();

  const threshold = BigNumber.from(1); // 1 wei to keep the threshold extremely low for testing
  const minContribution = BigNumber.from(1);
  const deadline = BigNumber.from(Math.floor(Date.now() / 1000) + 60 * 60); // 1 hour from now
  const ciphertext = utils.hexlify(utils.toUtf8Bytes(`debug intel ${Date.now()}`));

  const factory = new Contract(factoryAddress, factoryAbi, wallet);
  const createTx = await factory.createPool(threshold, minContribution, deadline, ciphertext);
  const receipt = await createTx.wait();

  const iface = new utils.Interface(factoryAbi);
  const poolAddress = receipt.logs
    .map((log) => {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === "PoolCreated") return parsed.args.pool as string;
      } catch (err) {
        return "";
      }
      return "";
    })
    .find((addr) => addr);

  if (!poolAddress) {
    throw new Error("Failed to detect pool address from factory event");
  }

  const messageKit = await encryptWithTaco({
    poolAddress,
    minContributionForDecrypt: minContribution.toString()
  });

  let initialDecryptError: string | undefined;
  try {
    await decryptWithTaco({
      poolAddress,
      minContributionForDecrypt: minContribution.toString(),
      messageKit
    });
  } catch (err: any) {
    initialDecryptError = err?.message || String(err);
  }

  const pool = new Contract(poolAddress, intelPoolAbi, wallet);
  const contributeTx = await pool.contribute({ value: threshold });
  const contributeReceipt = await contributeTx.wait();

  const unlockedAfterContribute = await pool.isUnlocked();
  const messageKitPlaintext = await decryptWithTaco({
    poolAddress,
    minContributionForDecrypt: minContribution.toString(),
    messageKit
  });

  return {
    poolAddress,
    thresholdWei: threshold.toString(),
    minContributionWei: minContribution.toString(),
    contributorAddress,
    messageKit,
    initialDecryptError,
    unlockedAfterContribute,
    contributionTxHash: contributeReceipt?.transactionHash,
    decryptedPlaintext: messageKitPlaintext,
    factoryTxHash: receipt?.transactionHash
  };
}
