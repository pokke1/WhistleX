export interface IntelPool {
  id: string;
  investigator: string;
  threshold: string;
  minContributionForDecrypt: string;
  policyId?: string;
}

export interface IntelUpload {
  poolId: string;
  cid: string;
  dekCiphertext: string;
}
