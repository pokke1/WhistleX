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

export function describePolicy(policy?: TacoPolicy) {
  if (!policy) return "No TACo policy bound yet.";
  const isUnlocked = policy.conditions.find((c) => c.functionName === "isUnlocked");
  const contribution = policy.conditions.find((c) => c.functionName === "contributionOf");

  return [
    `Policy ${policy.hash.slice(0, 10)}… for pool ${policy.poolAddress}`,
    isUnlocked ? `• ${isUnlocked.functionName} must be ${isUnlocked.value}` : null,
    contribution
      ? `• contributionOf(user) ${contribution.comparator} ${contribution.value} ETH`
      : null
  ]
    .filter(Boolean)
    .join("\n");
}
