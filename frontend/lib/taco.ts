import { providers, Wallet } from "ethers";

import {
  DEFAULT_POLYGON_AMOY_RPC_URL,
  DEFAULT_TACO_RITUAL_ID,
  TESTNET_PRIVATE_KEY
} from "../../shared/testnet";

const DEFAULT_CONDITION_CHAIN_ID = 80002; // Polygon Amoy

interface EncryptWithTacoParams {
  privateKey?: string;
  poolAddress: string; // IntelPool address
  minContributionForDecrypt: string; // kept for API compatibility, not used in TACo condition
  dkgRpcUrl?: string;
  conditionRpcUrl?: string;
  conditionChainId?: number;
  ritualId?: number;
  messageKit?: string;
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

function toHexString(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("hex");
}

function parseMessageKitBytes(serialized: string) {
  const normalized = serialized.trim();

  const fromHex = normalized.startsWith("0x") ? normalized.slice(2) : normalized;
  try {
    return Uint8Array.from(Buffer.from(fromHex, "hex"));
  } catch (err) {
    console.warn("Failed to parse messageKit as hex; trying base64", err);
  }

  try {
    return Uint8Array.from(Buffer.from(normalized, "base64"));
  } catch (err) {
    console.warn("Failed to parse messageKit as base64", err);
    throw new Error("Unsupported messageKit encoding; expected hex or base64");
  }
}

/**
 * Debug helper: JSON representation of the TACo condition.
 * Uses IntelPool.canDecrypt(address) -> bool
 */
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
    parameters: [":contributor"],
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
  minContributionForDecrypt, // not used in condition; enforced by canDecrypt()
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

  // ABI for IntelPool.canDecrypt(address) -> bool
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

  // Single contract condition: IntelPool.canDecrypt(:contributor) == true
  const conditionInstance = new ContractCondition({
    method: "canDecrypt",
    parameters: [":contributor"],
    functionAbi: canDecryptAbi,
    contractAddress,
    chain: conditionChain,
    returnValueTest: {
      comparator: "==",
      value: true
    }
  });

  if (process.env.NODE_ENV !== "production") {
    // conditionInstance should have toObj()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // Prefer a deterministic hex encoding that can be rehydrated for decrypt
  if (kit?.toBytes) return toHexString(kit.toBytes());
  if (kit?.toString) return kit.toString();
  return JSON.stringify(kit);
}

export async function decryptWithTaco({
  privateKey,
  dkgRpcUrl,
  conditionRpcUrl,
  conditionChainId,
  ritualId,
  messageKit
}: EncryptWithTacoParams & { messageKit: string }) {
  if (!messageKit) {
    throw new Error("decryptWithTaco: messageKit is required");
  }

  const taco = (await import("@nucypher/taco")) as any;
  const initialize = taco.initialize;
  const decrypt = taco.decrypt;
  const domains = taco.domains;
  const conditions = taco.conditions;
  const ThresholdMessageKit = taco.ThresholdMessageKit;
  const ConditionContext = conditions?.context?.ConditionContext;

  if (!initialize || !decrypt || !domains || !ThresholdMessageKit || !ConditionContext) {
    throw new Error(
      `decryptWithTaco: missing TACo SDK exports. initialize=${!!initialize}, decrypt=${!!decrypt}, domains=${!!domains}, ` +
        `ThresholdMessageKit=${!!ThresholdMessageKit}, ConditionContext=${!!ConditionContext}`
    );
  }

  const { key, condition } = resolveTacoConfig({
    privateKey,
    conditionRpcUrl,
    conditionChainId,
    ritualId,
    dkgRpcUrl
  });

  await initialize();

  const conditionProvider = new providers.JsonRpcProvider(
    condition || DEFAULT_POLYGON_AMOY_RPC_URL
  );
  const decryptorWallet = new Wallet(key, conditionProvider);

  const kitBytes = parseMessageKitBytes(messageKit);
  const kit = ThresholdMessageKit.fromBytes(kitBytes);

  const context = ConditionContext.fromMessageKit(kit);
  context.addCustomContextParameterValues({
    ":contributor": decryptorWallet.address
  });

  const decryptedBytes: Uint8Array = await decrypt(
    conditionProvider,
    domains.TESTNET || domains.tapir,
    kit,
    context,
    domains.TESTNET?.porterUris
  );

  return new TextDecoder().decode(decryptedBytes);
}
