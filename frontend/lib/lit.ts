import { LitNodeClient } from "@lit-protocol/lit-node-client";
import { LitAccessControlConditionResource } from "@lit-protocol/auth-helpers";
import { LitAbility } from "@lit-protocol/types";
import { checkAndSignAuthMessage } from "@lit-protocol/auth-browser";
import { encryptToJson, decryptFromJson } from "@lit-protocol/encryption";

export type LitEvmChain = "amoy";
export type LitSessionChain = "ethereum";
export type LitNetworkName = "datil-dev" | "datil-test" | "datil";

export interface EncryptWithLitParams {
  poolAddress: string;
  payload: string | Uint8Array;
  evmChain?: LitEvmChain;
  litNetwork?: LitNetworkName;
}

export interface DecryptWithLitParams {
  encryptedKeyBlob: string;
  contributorAddress?: string;
  sessionChain?: LitSessionChain;
  litNetwork?: LitNetworkName;
}

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
  returnValueTest: {
    key: "";
    comparator: "=";
    value: "true";
  };
};

let litClient: LitNodeClient | null = null;
let litClientConnectPromise: Promise<void> | null = null;

function getLitNetwork(): LitNetworkName {
  const value = String(process.env.NEXT_PUBLIC_LIT_NETWORK || "datil-dev").toLowerCase();
  if (value === "datil" || value === "datil-test" || value === "datil-dev") {
    return value as LitNetworkName;
  }
  return "datil-dev";
}

function getEvmChain(): LitEvmChain {
  const chain = String(process.env.NEXT_PUBLIC_LIT_EVM_CHAIN || "amoy").toLowerCase();
  return chain === "amoy" ? "amoy" : "amoy";
}

function getSessionChain(): LitSessionChain {
  const chain = String(process.env.NEXT_PUBLIC_LIT_SESSION_CHAIN || "ethereum").toLowerCase();
  return chain === "ethereum" ? "ethereum" : "ethereum";
}

function isDebugEnabled(): boolean {
  return String(process.env.NEXT_PUBLIC_LIT_DEBUG || "false").toLowerCase() === "true";
}

function shouldCheckNodeAttestation(): boolean {
  return String(process.env.NEXT_PUBLIC_LIT_CHECK_NODE_ATTESTATION || "false").toLowerCase() === "true";
}

async function getClient(litNetwork?: LitNetworkName) {
  if (!litClient) {
    litClient = new LitNodeClient({
      litNetwork: (litNetwork || getLitNetwork()) as any,
      checkNodeAttestation: shouldCheckNodeAttestation(),
      debug: isDebugEnabled()
    });
  }

  if (!litClientConnectPromise) {
    litClientConnectPromise = litClient.connect();
  }
  await litClientConnectPromise;
  return litClient;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizePayload(payload: string | Uint8Array): string {
  if (typeof payload === "string") return payload;
  return `0x${bytesToHex(payload)}`;
}

function parseDecryptedResult(value: string | Uint8Array): string {
  if (typeof value === "string") return value;
  return `0x${bytesToHex(value)}`;
}

export function buildLitEvmContractConditions(
  poolAddress: string,
  evmChain: LitEvmChain = getEvmChain()
): LitContractCondition[] {
  return [
    {
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
      returnValueTest: {
        key: "",
        comparator: "=",
        value: "true"
      }
    }
  ];
}

async function getSessionSigsForDecrypt(client: LitNodeClient, sessionChain: LitSessionChain) {
  const wildcardDecryptResource = new LitAccessControlConditionResource("*");

  const sessionSigs = await client.getSessionSigs({
    chain: sessionChain,
    expiration: new Date(Date.now() + 1000 * 60 * 15).toISOString(),
    resourceAbilityRequests: [
      {
        resource: wildcardDecryptResource,
        ability: LitAbility.AccessControlConditionDecryption
      }
    ],
    authNeededCallback: async (params: any) => {
      const authSig = await checkAndSignAuthMessage({
        chain: sessionChain,
        resources: params?.resources,
        expiration: params?.expiration,
        uri: params?.uri,
        nonce: params?.nonce
      });
      return authSig as any;
    }
  } as any);

  return sessionSigs;
}

export async function encryptWithLit({
  poolAddress,
  payload,
  evmChain = getEvmChain(),
  litNetwork
}: EncryptWithLitParams): Promise<string> {
  if (!poolAddress) throw new Error("encryptWithLit: poolAddress is required");

  const litNodeClient = await getClient(litNetwork);
  const accs = buildLitEvmContractConditions(poolAddress, evmChain);

  const encryptedJson = await encryptToJson({
    chain: evmChain,
    string: normalizePayload(payload),
    evmContractConditions: accs as any,
    litNodeClient: litNodeClient as any
  } as any);

  return encryptedJson;
}

export async function decryptWithLit({
  encryptedKeyBlob,
  sessionChain = getSessionChain(),
  litNetwork
}: DecryptWithLitParams): Promise<string> {
  if (!encryptedKeyBlob) throw new Error("decryptWithLit: encryptedKeyBlob is required");

  const litNodeClient = await getClient(litNetwork);
  const sessionSigs = await getSessionSigsForDecrypt(litNodeClient, sessionChain);

  const parsedJsonData = JSON.parse(encryptedKeyBlob);
  const decrypted = await decryptFromJson({
    sessionSigs,
    litNodeClient: litNodeClient as any,
    parsedJsonData
  } as any);

  return parseDecryptedResult(decrypted as string | Uint8Array);
}
