export interface TacoPolicy {
  poolAddress: string;
  minContribution: string;
}

export function describePolicy(policy?: TacoPolicy) {
  if (!policy) return "No TACo policy bound yet.";
  return `Unlocks when pool ${policy.poolAddress} is open and contribution >= ${policy.minContribution} ETH.`;
}
