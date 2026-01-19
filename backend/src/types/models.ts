export interface PoolRecord {
  id: string;
  investigator: string;
  threshold: string;
  minContributionForDecrypt: string;
  factoryAddress: string;
  title?: string;
  description?: string;
  policyId?: string;
  deadline?: string;
  ciphertext?: string;
}

export interface ContributionRecord {
  id: string;
  contributor: string;
  amount: string;
  poolId: string;
}

export interface IntelBlob {
  id: string;
  poolId: string;
  ciphertext: string;
  messageKit: string;
}
