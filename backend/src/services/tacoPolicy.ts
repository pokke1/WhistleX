import { ethers } from "ethers";

export interface TacoCondition {
  poolAddress: string;
  minContribution: string;
}

export function buildCanonicalPolicy(poolAddress: string, minContributionWei: bigint): TacoCondition {
  return {
    poolAddress,
    minContribution: ethers.formatEther(minContributionWei)
  };
}
