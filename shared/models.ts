export interface IntelPool {
  id: string;
  investigator: string;
  threshold: string;
  minContributionForDecrypt: string;
  policyId?: string;
  deadline?: string;
  ciphertext?: string;
}

export interface IntelUpload {
  poolId: string;
  ciphertext: string;
  messageKit: string;
}
