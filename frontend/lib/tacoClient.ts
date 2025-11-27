export interface TacoContractClause {
  contract: {
    chain: string;
    address: string;
    function: string;
    args: unknown[];
    returnValue?: boolean;
    comparator?: string;
    value?: string;
  };
}

export interface TacoPolicy {
  and: [TacoContractClause, TacoContractClause];
}

export function describePolicy(policy?: TacoPolicy | string | null) {
  if (!policy) return "No TACo policy bound yet.";

  const parsed: TacoPolicy = typeof policy === "string" ? (JSON.parse(policy) as TacoPolicy) : policy;
  const unlockFn = parsed?.and?.[0]?.contract?.function || "isUnlocked";
  const contributionClause = parsed?.and?.[1]?.contract;
  const minContribution = contributionClause?.value || contributionClause?.args?.[1];
  return `Unlocks when ${unlockFn} returns true and contribution >= ${minContribution || "threshold"}.`;
}
