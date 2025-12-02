import { BigNumber, Contract, providers, utils, Wallet } from "ethers";

const factoryAbi = [
  "event PoolCreated(address indexed investigator, address pool, uint256 threshold, uint256 minContributionForDecrypt, uint256 deadline, bytes ciphertext)",
  "function createPool(uint256 threshold,uint256 minContributionForDecrypt,uint256 deadline,bytes ciphertext) returns (address)",
  "function poolsCount() view returns (uint256)",
  "function allPools(uint256 index) view returns (address)"
];

export interface CreatePoolOnchainParams {
  threshold: string;
  minContributionForDecrypt: string;
  deadline: string;
  ciphertext: string;
}

export async function createPoolOnchain(params: CreatePoolOnchainParams) {
  const factoryAddress = process.env.NEXT_PUBLIC_FACTORY_ADDRESS;
  if (!factoryAddress) {
    throw new Error("NEXT_PUBLIC_FACTORY_ADDRESS is not configured");
  }

  const rpcUrl = process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC_URL;
  if (!rpcUrl) {
    throw new Error("NEXT_PUBLIC_POLYGON_AMOY_RPC_URL is not configured");
  }

  const signerKey = process.env.NEXT_PUBLIC_POLYGON_AMOY_SIGNER_KEY;
  if (!signerKey) {
    throw new Error("NEXT_PUBLIC_POLYGON_AMOY_SIGNER_KEY is not configured");
  }

  const provider = new providers.JsonRpcProvider(rpcUrl);
  const signer = new Wallet(signerKey, provider);

  const threshold = utils.parseUnits(params.threshold, 6);
  const minContribution = utils.parseUnits(params.minContributionForDecrypt, 6);
  const ciphertext = utils.arrayify(normalizeHex(params.ciphertext));
  const deadline = BigNumber.from(params.deadline);

  const factory = new Contract(factoryAddress, factoryAbi, signer);
  const tx = await factory.createPool(threshold, minContribution, deadline, ciphertext);
  const receipt = await tx.wait();
  const iface = new utils.Interface(factoryAbi);

  let poolAddress = "";
  for (const log of receipt?.logs || []) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "PoolCreated") {
        poolAddress = parsed.args[1];
        break;
      }
    } catch (err) {
      // ignore unrelated logs
    }
  }

  if (!poolAddress) {
    const count = await factory.poolsCount();
    poolAddress = await factory.allPools(count.sub(1));
  }

  return { poolAddress, investigator: await signer.getAddress(), txHash: receipt?.hash };
}

export function normalizeHex(value: string) {
  return value.startsWith("0x") ? value : `0x${value}`;
}
