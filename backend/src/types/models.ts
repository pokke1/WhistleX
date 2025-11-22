export interface PoolRecord {
  id: string;
  investigator: string;
  threshold: string;
  minContributionForDecrypt: string;
  factoryAddress: string;
  policyId?: string;
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
  cid: string;
  dekCiphertext: string;
}
