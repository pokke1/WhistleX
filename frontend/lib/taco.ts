import { providers, Wallet } from "ethers";

import {
  DEFAULT_POLYGON_AMOY_RPC_URL,
  DEFAULT_TACO_RITUAL_ID,
  TESTNET_PRIVATE_KEY
} from "../../shared/testnet";

const DEFAULT_CONDITION_CHAIN_ID = 80002; // Polygon Amoy

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
  const key = privateKey || process.env.NEXT_PUBLIC_TACO_PRIVATE_KEY || DEFAULT_TACO_PRIVATE_KEY;
  const dkg = dkgRpcUrl || process.env.NEXT_PUBLIC_TACO_DKG_RPC_URL || DEFAULT_POLYGON_AMOY_RPC_URL;
  const condition =
    conditionRpcUrl ||
    process.env.NEXT_PUBLIC_TACO_CONDITION_RPC_URL ||
    process.env.NEXT_PUBLIC_AMOY_RPC_URL ||
    DEFAULT_POLYGON_AMOY_RPC_URL;
  const conditionChain = conditionChainId || Number(process.env.NEXT_PUBLIC_TACO_CONDITION_CHAIN_ID) || DEFAULT_CONDITION_CHAIN_ID;
  const ritual = ritualId || Number(process.env.NEXT_PUBLIC_TACO_RITUAL_ID) || DEFAULT_TACO_RITUAL_ID;

  return { key, dkg, condition, conditionChain, ritual };
}

export function buildTacoCondition(
  poolAddress: string,
  minContributionForDecrypt: string,
  conditionChainId: number = DEFAULT_CONDITION_CHAIN_ID
) {
  return {
    and: [
      {
        contract: {
          chain: conditionChainId,
          address: poolAddress,
          function: "isUnlocked",
          args: [],
          returnValue: true
        }
      },
      {
        contract: {
          chain: conditionChainId,
          address: poolAddress,
          function: "contributionOf",
          args: [":userAddress"],
          comparator: ">=",
          value: minContributionForDecrypt
        }
      }
    ]
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
  const taco = (await import("@nucypher/taco")) as any;
  const initialize = taco.initialize;
  const encrypt = taco.encrypt;
  const domains = taco.domains;
  const predefinedConditions = taco.conditions?.predefined;

  if (!initialize || !encrypt || !domains) {
    throw new Error("TACO SDK is not available");
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
  const conditionProvider = new providers.JsonRpcProvider(condition || DEFAULT_POLYGON_AMOY_RPC_URL);
  const encryptorWallet = new Wallet(key, conditionProvider);

  const conditionTree = predefinedConditions
    ? new predefinedConditions.LogicalCondition({
        operator: "and",
        conditions: [
          new predefinedConditions.ContractCondition({
            chain: conditionChain,
            address: poolAddress,
            function: "isUnlocked",
            args: [],
            returnValue: true
          }),
          new predefinedConditions.ContractCondition({
            chain: conditionChain,
            address: poolAddress,
            function: "contributionOf",
            args: [":userAddress"],
            comparator: ">=",
            value: minContributionForDecrypt
          })
        ]
      })
    : buildTacoCondition(poolAddress, minContributionForDecrypt, conditionChain);

  const kit = await encrypt(
    dkgProvider,
    domains.TESTNET || domains.tapir,
    key,
    conditionTree,
    ritual,
    encryptorWallet
  );

  if (typeof kit === "string") return kit;
  if (kit?.toString) return kit.toString();
  return JSON.stringify(kit);
}
