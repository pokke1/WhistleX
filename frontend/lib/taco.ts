import { providers, Wallet } from "ethers";
import { normalizeHex } from "./onchain";
import { TacoPolicy } from "./tacoClient";

interface EncryptWithTacoParams {
  privateKey: string;
  poolAddress: string;
  minContributionForDecrypt: string;
  dkgRpcUrl?: string;
  ritualId?: number;
  policy?: TacoPolicy | string;
  secretMessageHex: string;
}

function parsePolicy(policy?: TacoPolicy | string): TacoPolicy | undefined {
  if (!policy) return undefined;
  return typeof policy === "string" ? (JSON.parse(policy) as TacoPolicy) : policy;
}

function buildPredefinedCondition(policy: TacoPolicy, predefinedConditions: any) {
  if (!predefinedConditions) return policy;

  const clauses = policy.and || [];
  const contractConditions = clauses.map((clause) => {
    return new predefinedConditions.ContractCondition({
      chain: clause.contract.chain,
      address: clause.contract.address,
      function: clause.contract.function,
      args: clause.contract.args,
      comparator: clause.contract.comparator,
      value: clause.contract.value,
      returnValue: clause.contract.returnValue
    });
  });

  return new predefinedConditions.LogicalCondition({
    operator: "and",
    conditions: contractConditions
  });
}

export function buildTacoCondition(poolAddress: string, minContributionForDecrypt: string) {
  return {
    and: [
      {
        contract: {
          chain: "polygon-amoy",
          address: poolAddress,
          function: "isUnlocked",
          args: [],
          returnValue: true
        }
      },
      {
        contract: {
          chain: "polygon-amoy",
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
  ritualId = 6,
  policy,
  secretMessageHex
}: EncryptWithTacoParams) {
  const taco = (await import("@nucypher/taco")) as any;
  if (taco.initialize) {
    await taco.initialize();
  }

  const encrypt = taco.encrypt;
  const domains = taco.domains;
  const predefinedConditions = taco.conditions?.predefined;
  const polygonProvider = new providers.JsonRpcProvider(dkgRpcUrl || process.env.NEXT_PUBLIC_TACO_DKG_RPC_URL);

  if (!encrypt || !domains) {
    throw new Error("TACO SDK is not available");
  }

  const parsedPolicy = parsePolicy(policy);
  const condition = parsedPolicy
    ? buildPredefinedCondition(parsedPolicy, predefinedConditions)
    : predefinedConditions
      ? new predefinedConditions.LogicalCondition({
          operator: "and",
          conditions: [
            new predefinedConditions.ContractCondition({
              chain: "polygon-amoy",
              address: poolAddress,
              function: "isUnlocked",
              args: [],
              returnValue: true
            }),
            new predefinedConditions.ContractCondition({
              chain: "polygon-amoy",
              address: poolAddress,
              function: "contributionOf",
              args: [":userAddress"],
              comparator: ">=",
              value: minContributionForDecrypt
            })
          ]
        })
      : buildTacoCondition(poolAddress, minContributionForDecrypt);

  const encryptorWallet = new Wallet(privateKey, polygonProvider);
  const normalizedMessage = normalizeHex(secretMessageHex || "0xdeadbeef");

  const kit = await encrypt(
    polygonProvider,
    domains.TESTNET || domains.tapir,
    normalizedMessage,
    condition,
    ritualId,
    encryptorWallet
  );

  if (typeof kit === "string") return kit;
  if (kit?.toString) return kit.toString();
  return JSON.stringify(kit);
}
