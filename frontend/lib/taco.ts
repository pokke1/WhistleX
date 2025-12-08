import { providers, Wallet } from "ethers";

import {
  DEFAULT_POLYGON_AMOY_RPC_URL,
  DEFAULT_TACO_RITUAL_ID,
  TESTNET_PRIVATE_KEY
} from "../../shared/testnet";

const DEFAULT_CONDITION_CHAIN_ID = 80002;

interface EncryptWithTacoParams {
  privateKey?: string;
  poolAddress: string;
  minContributionForDecrypt: string;
  dkgRpcUrl?: string;
  conditionRpcUrl?: string;
  conditionChainId?: number;
  ritualId?: number;
}

export const DEFAULT_TACO_PRIVATE_KEY = TESTNET_PRIVATE_KEY;

function resolveTacoConfig({
  privateKey,
  dkgRpcUrl,
  conditionRpcUrl,
  conditionChainId,
  ritualId
}: Partial<EncryptWithTacoParams>) {
  const key =
    privateKey ||
    process.env.NEXT_PUBLIC_TACO_PRIVATE_KEY ||
    DEFAULT_TACO_PRIVATE_KEY;

  const dkg =
    dkgRpcUrl ||
    process.env.NEXT_PUBLIC_TACO_DKG_RPC_URL ||
    DEFAULT_POLYGON_AMOY_RPC_URL;

  const condition =
    conditionRpcUrl ||
    process.env.NEXT_PUBLIC_TACO_CONDITION_RPC_URL ||
    process.env.NEXT_PUBLIC_AMOY_RPC_URL ||
    DEFAULT_POLYGON_AMOY_RPC_URL;

  const conditionChain =
    conditionChainId ||
    Number(process.env.NEXT_PUBLIC_TACO_CONDITION_CHAIN_ID) ||
    DEFAULT_CONDITION_CHAIN_ID;

  const ritual =
    ritualId ||
    Number(process.env.NEXT_PUBLIC_TACO_RITUAL_ID) ||
    DEFAULT_TACO_RITUAL_ID;

  return { key, dkg, condition, conditionChain, ritual };
}


export function buildTacoCondition(
  poolAddress: string,
  _minContributionForDecrypt: string,
  conditionChainId: number = DEFAULT_CONDITION_CHAIN_ID
) {
  const contractAddress = poolAddress;

  const canDecryptAbi = {
    name: "canDecrypt",
    type: "function",
    stateMutability: "view",
    inputs: [
      {
        internalType: "address",
        name: "contributor",
        type: "address"
      }
    ],
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool"
      }
    ]
  };

  return {
    method: "canDecrypt",
    parameters: [":userAddress"],
    functionAbi: canDecryptAbi,
    contractAddress,
    chain: conditionChainId,
    returnValueTest: {
      comparator: "==",
      value: true
    }
  };
}

export async function encryptWithTaco({
  privateKey,
  poolAddress,
  minContributionForDecrypt,
  dkgRpcUrl,
  conditionRpcUrl,
  conditionChainId,
  ritualId
}: EncryptWithTacoParams) {
  if (!poolAddress) {
    throw new Error("encryptWithTaco: poolAddress is required");
  }

  const contractAddress = poolAddress;

  const taco = (await import("@nucypher/taco")) as any;
  const initialize = taco.initialize;
  const encrypt = taco.encrypt;
  const domains = taco.domains;
  const conditions = taco.conditions;

  if (!initialize || !encrypt || !domains || !conditions) {
    throw new Error(
      `encryptWithTaco: TACo SDK core exports missing. ` +
        `initialize=${!!initialize}, encrypt=${!!encrypt}, domains=${!!domains}, conditions=${!!conditions}`
    );
  }

  const ContractCondition = conditions?.base?.contract?.ContractCondition;
  if (!ContractCondition) {
    throw new Error(
      "encryptWithTaco: conditions.base.contract.ContractCondition not available."
    );
  }

  const { key, dkg, condition, conditionChain, ritual } = resolveTacoConfig({
    privateKey,
    dkgRpcUrl,
    conditionRpcUrl,
    conditionChainId,
    ritualId
  });

  await initialize();

  const dkgProvider = new providers.JsonRpcProvider(dkg);
  const conditionProvider = new providers.JsonRpcProvider(
    condition || DEFAULT_POLYGON_AMOY_RPC_URL
  );
  const encryptorWallet = new Wallet(key, conditionProvider);

  const canDecryptAbi: any = {
    name: "canDecrypt",
    type: "function",
    stateMutability: "view",
    inputs: [
      {
        internalType: "address",
        name: "contributor",
        type: "address"
      }
    ],
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool"
      }
    ]
  };

  const conditionInstance = new ContractCondition({
    method: "canDecrypt",
    parameters: [":userAddress"],
    functionAbi: canDecryptAbi,
    contractAddress,
    chain: conditionChain,
    returnValueTest: {
      comparator: "==",
      value: true
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const obj = (conditionInstance as any).toObj?.();
    console.log(
      "[TACO] conditionInstance (toObj):",
      JSON.stringify(obj ?? {}, null, 2)
    );
  }

  const kit = await encrypt(
    dkgProvider,
    domains.TESTNET || domains.tapir,
    key,
    conditionInstance,
    ritual,
    encryptorWallet
  );

  if (typeof kit === "string") return kit;
  if (kit?.toString) return kit.toString();
  return JSON.stringify(kit);
}
