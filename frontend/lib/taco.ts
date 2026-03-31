import { buildLitEvmContractConditions, decryptWithLit, encryptWithLit } from "./lit";

interface TacoCompatParams {
  privateKey?: string;
  poolAddress: string;
  minContributionForDecrypt?: string;
  dkgRpcUrl?: string;
  conditionRpcUrl?: string;
  conditionChainId?: number;
  ritualId?: number;
  messageKit?: string;
  payload?: string | Uint8Array;
  contributorAddress?: string;
}

// Compatibility layer so the app can migrate call sites incrementally.
export function buildTacoCondition(poolAddress: string, _minContributionForDecrypt: string, _conditionChainId?: number) {
  return buildLitEvmContractConditions(poolAddress);
}

export async function encryptWithTaco({ poolAddress, payload }: TacoCompatParams): Promise<string> {
  return encryptWithLit({
    poolAddress,
    payload: payload ?? "lit-default-payload"
  });
}

export async function decryptWithTaco({ messageKit }: TacoCompatParams & { messageKit: string }): Promise<string> {
  return decryptWithLit({
    encryptedKeyBlob: messageKit
  });
}
