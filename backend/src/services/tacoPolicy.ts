import { ethers } from "ethers";

export interface TacoContractCondition {
  type: "contract";
  chain: string;
  address: string;
  functionName: string;
  args: (string | boolean)[];
  comparator: "==" | ">=";
  value: string | boolean;
}

export interface TacoPolicy {
  label: string;
  poolAddress: string;
  minContributionWei: string;
  minContributionEther: string;
  conditions: TacoContractCondition[];
  hash: string;
}

const chainName = process.env.CHAIN_NAME || "base";

export function buildCanonicalPolicy(poolAddress: string, minContributionWei: bigint): TacoPolicy {
  const minContributionEther = ethers.formatEther(minContributionWei);

  const conditions: TacoContractCondition[] = [
    {
      type: "contract",
      chain: chainName,
      address: poolAddress,
      functionName: "isUnlocked",
      args: [],
      comparator: "==",
      value: true
    },
    {
      type: "contract",
      chain: chainName,
      address: poolAddress,
      functionName: "contributionOf",
      args: [":userAddress"],
      comparator: ">=",
      value: minContributionEther
    }
  ];

  const policyWithoutHash = {
    label: `whistlex-${poolAddress}`,
    poolAddress,
    minContributionWei: minContributionWei.toString(),
    minContributionEther,
    conditions
  } satisfies Omit<TacoPolicy, "hash">;

  return {
    ...policyWithoutHash,
    hash: ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(policyWithoutHash)))
  };
}
