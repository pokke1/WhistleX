import { BrowserProvider, Contract, Interface, getBytes, parseUnits } from "ethers";

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
  if (typeof window === "undefined") {
    throw new Error("window is not available");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ethereum = (window as any).ethereum;
  if (!ethereum) {
    throw new Error("Wallet provider not found");
  }

  const factoryAddress = process.env.NEXT_PUBLIC_FACTORY_ADDRESS;
  if (!factoryAddress) {
    throw new Error("NEXT_PUBLIC_FACTORY_ADDRESS is not configured");
  }

  const provider = new BrowserProvider(ethereum);
  const signer = await provider.getSigner();

  const threshold = parseUnits(params.threshold, 6);
  const minContribution = parseUnits(params.minContributionForDecrypt, 6);
  const ciphertext = getBytes(normalizeHex(params.ciphertext));
  const deadline = BigInt(params.deadline);

  const factory = new Contract(factoryAddress, factoryAbi, signer);
  const tx = await factory.createPool(threshold, minContribution, deadline, ciphertext);
  const receipt = await tx.wait();
  const iface = new Interface(factoryAbi);

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
    poolAddress = await factory.allPools(count - 1n);
  }

  return { poolAddress, investigator: await signer.getAddress(), txHash: receipt?.hash };
}

export function normalizeHex(value: string) {
  return value.startsWith("0x") ? value : `0x${value}`;
}
