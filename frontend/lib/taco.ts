import { providers, Wallet } from "ethers";

interface EncryptWithTacoParams {
  privateKey: string;
  poolAddress: string;
  minContributionForDecrypt: string;
  dkgRpcUrl?: string;
  ritualId?: number;
}

export function buildTacoCondition(poolAddress: string, minContributionForDecrypt: string) {
  return {
    and: [
      {
        contract: {
          chain: "base",
          address: poolAddress,
          function: "isUnlocked",
          args: [],
          returnValue: true
        }
      },
      {
        contract: {
          chain: "base",
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

export async function encryptWithTaco({ privateKey, poolAddress, minContributionForDecrypt, dkgRpcUrl, ritualId = 6 }: EncryptWithTacoParams) {
  const taco = (await import("@nucypher/taco")) as any;
  const encrypt = taco.encrypt;
  const domains = taco.domains;
  const predefinedConditions = taco.conditions?.predefined;
  const polygonProvider = new providers.JsonRpcProvider(dkgRpcUrl || process.env.NEXT_PUBLIC_TACO_DKG_RPC_URL);

  if (!encrypt || !domains) {
    throw new Error("TACO SDK is not available");
  }

  const condition = predefinedConditions
    ? new predefinedConditions.LogicalCondition({
        operator: "and",
        conditions: [
          new predefinedConditions.ContractCondition({
            chain: "base",
            address: poolAddress,
            function: "isUnlocked",
            args: [],
            returnValue: true
          }),
          new predefinedConditions.ContractCondition({
            chain: "base",
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

  const kit = await encrypt(
    polygonProvider,
    domains.TESTNET || domains.tapir,
    privateKey,
    condition,
    ritualId,
    encryptorWallet
  );

  if (typeof kit === "string") return kit;
  if (kit?.toString) return kit.toString();
  return JSON.stringify(kit);
}
