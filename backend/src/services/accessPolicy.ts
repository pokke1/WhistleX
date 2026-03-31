export interface LitContractCondition {
  conditionType: "evmContract";
  contractAddress: string;
  chain: "amoy";
  functionName: "canDecrypt";
  functionParams: [":userAddress"];
  functionAbi: {
    name: "canDecrypt";
    type: "function";
    stateMutability: "view";
    inputs: [{ name: "contributor"; type: "address"; internalType: "address" }];
    outputs: [{ name: ""; type: "bool"; internalType: "bool" }];
  };
  returnValueTest: {
    key: "";
    comparator: "=";
    value: "true";
  };
}

export interface LitAccessPolicy {
  provider: "lit";
  version: "v6";
  conditions: LitContractCondition[];
}

export function buildCanonicalPolicy(poolAddress: string): LitAccessPolicy {
  return {
    provider: "lit",
    version: "v6",
    conditions: [
      {
        conditionType: "evmContract",
        contractAddress: poolAddress,
        chain: "amoy",
        functionName: "canDecrypt",
        functionParams: [":userAddress"],
        functionAbi: {
          name: "canDecrypt",
          type: "function",
          stateMutability: "view",
          inputs: [
            {
              name: "contributor",
              type: "address",
              internalType: "address"
            }
          ],
          outputs: [
            {
              name: "",
              type: "bool",
              internalType: "bool"
            }
          ]
        },
        returnValueTest: {
          key: "",
          comparator: "=",
          value: "true"
        }
      }
    ]
  };
}
