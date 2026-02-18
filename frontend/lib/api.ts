const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export interface PoolPayload {
  id: string;
  investigator: string;
  threshold: string;
  minContributionForDecrypt: string;
  deadline: string;
  ciphertext: string;
  title?: string;
  description?: string;
}

export interface PoolSummary {
  id: string;
  investigator: string;
  threshold: string;
  minContributionForDecrypt: string;
  deadline?: string;
  ciphertext?: string;
  policyId?: string;
  title?: string;
  description?: string;
  contributedAmount?: string;
  attachments?: PoolAttachment[];
}

export interface ProfilePayload {
  address: string;
  createdPools: PoolSummary[];
  contributedPools: PoolSummary[];
  vendorRating: {
    average: number;
    score: number;
    totalVotes: number;
    poolsCount: number;
  };
}

export interface PoolVoteSummary {
  poolId: string;
  upvotes: number;
  downvotes: number;
  score: number;
  average: number;
  totalVotes: number;
  myVote: number | null;
  canVote: boolean | null;
  reason: string | null;
}

export interface PoolContributor {
  address: string;
  amount: string;
  vote: number | null;
  txHash?: string | null;
}

export interface PoolComment {
  id?: string;
  poolid: string;
  author: string;
  message: string;
  created_at?: string;
}

export interface PoolAttachment {
  id?: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
  path?: string;
  createdAt?: string;
}

export async function fetchPools() {
  const res = await fetch(`${backend}/pools`);
  if (!res.ok) throw new Error("failed to load pools");
  return res.json();
}

export async function createPool(payload: PoolPayload) {
  const res = await fetch(`${backend}/pools`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("failed to create pool");
  return res.json();
}

export async function uploadPoolFiles(
  poolId: string,
  files: { name: string; type: string; size: number; data: string }[]
) {
  const res = await fetch(`${backend}/pools/${poolId}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files })
  });
  if (!res.ok) throw new Error("failed to upload attachments");
  return res.json();
}

export async function uploadIntel(body: { poolId: string; ciphertext: string; messageKit: string }) {
  const res = await fetch(`${backend}/intel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("failed to upload intel");
  return res.json();
}

export async function fetchIntel(poolId: string) {
  const res = await fetch(`${backend}/intel/${poolId}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("failed to fetch intel");
  return res.json();
}

export async function fetchProfile(address: string): Promise<ProfilePayload> {
  const res = await fetch(`${backend}/profiles/${address}`);
  if (!res.ok) throw new Error("failed to fetch profile");
  return res.json();
}

export async function fetchPoolVotes(poolId: string, voterAddress?: string): Promise<PoolVoteSummary> {
  const url = new URL(`${backend}/votes/pools/${poolId}`);
  if (voterAddress) {
    url.searchParams.set("voter", voterAddress);
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("failed to fetch pool votes");
  return res.json();
}

export async function submitPoolVote(poolId: string, voterAddress: string, vote: 1 | -1): Promise<PoolVoteSummary> {
  const res = await fetch(`${backend}/votes/pools/${poolId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voterAddress, vote })
  });
  if (!res.ok) {
    let message = "failed to submit vote";
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  return res.json();
}

export async function fetchPoolContributors(poolId: string): Promise<{ poolId: string; contributors: PoolContributor[] }> {
  const res = await fetch(`${backend}/pools/${poolId}/contributors`);
  if (!res.ok) throw new Error("failed to fetch contributors");
  return res.json();
}

export async function fetchPoolCommentCounts(poolIds: string[]): Promise<Record<string, number>> {
  if (poolIds.length === 0) return {};
  const url = new URL(`${backend}/pools/comments/counts`);
  url.searchParams.set("ids", poolIds.join(","));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("failed to fetch comment counts");
  return res.json();
}

export async function fetchPoolComments(poolId: string): Promise<{ poolId: string; comments: PoolComment[] }> {
  const res = await fetch(`${backend}/pools/${poolId}/comments`);
  if (!res.ok) throw new Error("failed to fetch comments");
  return res.json();
}

export async function postPoolComment(poolId: string, author: string, message: string) {
  const res = await fetch(`${backend}/pools/${poolId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ author, message })
  });
  if (!res.ok) throw new Error("failed to post comment");
  return res.json();
}
