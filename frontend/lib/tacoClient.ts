type LegacyTacoPolicy = {
  and?: Array<{
    contract?: {
      function?: string;
      value?: string;
      args?: unknown[];
    };
  }>;
};

type LitAccessPolicy = {
  provider?: string;
  version?: string;
  conditions?: Array<{
    functionName?: string;
    chain?: string;
    returnValueTest?: { comparator?: string; value?: string };
  }>;
};

export function describePolicy(policy?: LegacyTacoPolicy | LitAccessPolicy | string | null) {
  if (!policy) return "No access policy bound yet.";

  const parsed = (typeof policy === "string" ? JSON.parse(policy) : policy) as LegacyTacoPolicy & LitAccessPolicy;

  if (parsed.conditions?.length) {
    const condition = parsed.conditions[0];
    const fn = condition?.functionName || "canDecrypt";
    const chain = condition?.chain || "amoy";
    return `Lit v6 policy: ${fn}(user) must return true on ${chain}.`;
  }

  const unlockFn = parsed?.and?.[0]?.contract?.function || "isUnlocked";
  const contributionClause = parsed?.and?.[1]?.contract;
  const minContribution = contributionClause?.value || contributionClause?.args?.[1];
  return `Legacy policy: ${unlockFn} must be true and contribution >= ${minContribution || "threshold"}.`;
}
