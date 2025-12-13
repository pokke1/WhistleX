import { BigNumber, Contract, providers, utils } from "ethers";

const factoryAbi = [
  "event PoolCreated(address indexed investigator, address pool, uint256 threshold, uint256 minContributionForDecrypt, uint256 deadline, bytes ciphertext)",
  "function createPool(uint256 threshold,uint256 minContributionForDecrypt,uint256 deadline,bytes ciphertext) returns (address)",
  "function poolsCount() view returns (uint256)",
  "function allPools(uint256 index) view returns (address)"
];

const poolAbi = [
  "function contribute() payable",
  "function totalContributions() view returns (uint256)",
  "function threshold() view returns (uint256)",
  "function minContributionForDecrypt() view returns (uint256)",
  "function unlocked() view returns (bool)",
  "function canDecrypt(address contributor) view returns (bool)",
  "function contributionOf(address contributor) view returns (uint256)"
];

export interface CreatePoolOnchainParams {
  threshold: string;
  minContributionForDecrypt: string;
  deadline: string;
  ciphertext: string;
}

const AMOY_CHAIN_ID_DEC = 80002;
const AMOY_CHAIN_ID_HEX = '0x13882'; 

const DEFAULT_AMOY_RPC_URL = process.env.NEXT_PUBLIC_AMOY_RPC_URL || "https://polygon-amoy.drpc.org";

export interface PoolOnchainState {
  totalContributions: string;
  threshold: string;
  minContributionForDecrypt: string;
  unlocked: boolean;
  userContribution?: string;
  canDecrypt?: boolean;
}

async function ensureAmoyNetwork(ethereum: any, provider: providers.Web3Provider) {
  const { chainId } = await provider.getNetwork();

  if (chainId !== AMOY_CHAIN_ID_DEC) {
    console.log("Incorrect network detected. Attempting to switch to Polygon Amoy...");

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: AMOY_CHAIN_ID_HEX }],
      });

    } catch (switchError: any) {
      if (switchError.code === 4902) {
        console.log("Amoy network not found in wallet, prompting to add it.");
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: AMOY_CHAIN_ID_HEX,
            chainName: 'Polygon Amoy Testnet',
            nativeCurrency: {
                name: 'POL',
                symbol: 'POL',
                decimals: 18
            },
            rpcUrls: ['rpc-amoy.polygon.technology'],
            blockExplorerUrls: ['amoy.polygonscan.com'],
          }],
        });
      } else {
        throw new Error(`Please connect to the Polygon Amoy Testnet in your wallet. Error code: ${switchError.code}`);
      }
    }
  }
}

export async function createPoolOnchain(params: CreatePoolOnchainParams) {
  if (typeof window === "undefined") {
    throw new Error("window is not available");
  }

  const ethereum = (window as any).ethereum;
  if (!ethereum) {
    throw new Error("Wallet provider not found. Please install MetaMask.");
  }

  const factoryAddress = process.env.NEXT_PUBLIC_FACTORY_ADDRESS;
  if (!factoryAddress) {
    throw new Error("NEXT_PUBLIC_FACTORY_ADDRESS is not configured");
  }

  const provider = new providers.Web3Provider(ethereum);
  await ensureAmoyNetwork(ethereum, provider);
  const signer = provider.getSigner();

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
    }
  }

  if (!poolAddress) {
    const count = await factory.poolsCount();
    poolAddress = await factory.allPools(count.sub(1));
  }

  return { poolAddress, investigator: await signer.getAddress(), txHash: receipt?.hash };
}

export async function fetchPoolState(poolAddress: string, userAddress?: string): Promise<PoolOnchainState> {
  const provider = new providers.JsonRpcProvider(DEFAULT_AMOY_RPC_URL);
  const contract = new Contract(poolAddress, poolAbi, provider);

  const [totalContributions, threshold, minContributionForDecrypt, unlocked] = await Promise.all([
    contract.totalContributions(),
    contract.threshold(),
    contract.minContributionForDecrypt(),
    contract.unlocked()
  ]);

  let userContribution: string | undefined;
  let canDecrypt: boolean | undefined;
  if (userAddress) {
    const [contrib, canDecryptResult] = await Promise.all([
      contract.contributionOf(userAddress),
      contract.canDecrypt(userAddress)
    ]);
    userContribution = contrib.toString();
    canDecrypt = canDecryptResult;
  }

  return {
    totalContributions: totalContributions.toString(),
    threshold: threshold.toString(),
    minContributionForDecrypt: minContributionForDecrypt.toString(),
    unlocked,
    userContribution,
    canDecrypt
  };
}

export async function contributeToPool(poolAddress: string, amountEth: string) {
  if (!amountEth || Number(amountEth) <= 0) {
    throw new Error("Contribution amount must be greater than zero");
  }

  if (typeof window === "undefined") {
    throw new Error("window is not available");
  }

  const ethereum = (window as any).ethereum;
  if (!ethereum) {
    throw new Error("Wallet provider not found. Please install MetaMask.");
  }

  const provider = new providers.Web3Provider(ethereum);
  await ensureAmoyNetwork(ethereum, provider);

  const signer = provider.getSigner();
  const contract = new Contract(poolAddress, poolAbi, signer);
  const value = utils.parseEther(amountEth);

  const tx = await contract.contribute({ value });
  const receipt = await tx.wait();
  return { txHash: receipt?.hash || tx.hash };
}

export function normalizeHex(value: string) {
  return value.startsWith("0x") ? value : `0x${value}`;
}
