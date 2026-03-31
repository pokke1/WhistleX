import { litDecryptKey, litEncryptKey } from "./api";

export type LitEvmChain = "amoy";

type LitContractCondition = {
  conditionType: "evmContract";
  contractAddress: string;
  chain: string;
  functionName: "canDecrypt";
  functionParams: string[];
  functionAbi: {
    name: "canDecrypt";
    type: "function";
    stateMutability: "view";
    inputs: [{ name: "contributor"; type: "address"; internalType: "address" }];
    outputs: [{ name: ""; type: "bool"; internalType: "bool" }];
  };
  returnValueTest: { key: ""; comparator: "="; value: "true" };
};

export interface EncryptWithLitParams {
  poolAddress: string;
  payload: string | Uint8Array;
  evmChain?: LitEvmChain;
}

export interface DecryptWithLitParams {
  poolAddress?: string;
  encryptedKeyBlob: string;
  contributorAddress?: string;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizePayload(payload: string | Uint8Array): string {
  if (typeof payload === "string") return payload;
  return `0x${bytesToHex(payload)}`;
}

export function buildLitEvmContractConditions(poolAddress: string, evmChain: LitEvmChain = "amoy"): LitContractCondition[] {
  return [{
    conditionType: "evmContract",
    contractAddress: poolAddress,
    chain: evmChain,
    functionName: "canDecrypt",
    functionParams: [":userAddress"],
    functionAbi: {
      name: "canDecrypt",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "contributor", type: "address", internalType: "address" }],
      outputs: [{ name: "", type: "bool", internalType: "bool" }]
    },
    returnValueTest: { key: "", comparator: "=", value: "true" }
  }];
}

export async function encryptWithLit({ poolAddress, payload }: EncryptWithLitParams): Promise<string> {
  const result = await litEncryptKey({
    poolAddress,
    payload: normalizePayload(payload)
  });
  return String(result?.encryptedKeyBlob || "");
}

export async function decryptWithLit({ poolAddress, encryptedKeyBlob }: DecryptWithLitParams): Promise<string> {
  if (!poolAddress) {
    throw new Error("decryptWithLit: poolAddress is required");
  }
  const result = await litDecryptKey({ poolAddress, encryptedKeyBlob });
  return String(result?.plaintext || "");
}
