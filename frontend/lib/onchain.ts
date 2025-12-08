import { BigNumber, Contract, providers, utils } from "ethers";

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

const AMOY_CHAIN_ID_DEC = 80002;
const AMOY_CHAIN_ID_HEX = '0x13882'; 

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

export function normalizeHex(value: string) {
  return value.startsWith("0x") ? value : `0x${value}`;
}
