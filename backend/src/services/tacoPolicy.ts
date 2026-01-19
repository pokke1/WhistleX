export interface TacoCondition {
  and: [
    {
      contract: {
        chain: string;
        address: string;
        function: string;
        args: unknown[];
        returnValue: boolean;
      };
    },
    {
      contract: {
        chain: string;
        address: string;
        function: string;
        args: unknown[];
        comparator: string;
        value: string;
      };
    }
  ];
}

export function buildCanonicalPolicy(poolAddress: string, minContribution: string): TacoCondition {
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
          args: [":contributor"],
          comparator: ">=",
          value: minContribution
        }
      }
    ]
  };
}
