const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
const AUTH_TOKEN_KEY = "whistlex:auth-token";

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
    score: string;
    totalVotePower: string;
    totalVotes: number;
    poolsCount: number;
  };
}

export interface PoolVoteSummary {
  poolId: string;
  upvotes: number;
  downvotes: number;
  score: string;
  average: number;
  totalVotes: number;
  totalVotePower: string;
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

interface WalletSignerProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

function getAuthToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

function setAuthToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

export function clearAuthToken() {
  setAuthToken(null);
}

export function hasAuthToken() {
  return Boolean(getAuthToken());
}

function withAuthHeaders(base: HeadersInit = {}) {
  const headers = new Headers(base);
  const token = getAuthToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

async function authJson(path: string, init?: RequestInit) {
  const res = await fetch(`${backend}${path}`, {
    ...init,
    headers: withAuthHeaders(init?.headers)
  });
  if (!res.ok) {
    let message = `request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  return res.json();
}

export async function authenticateWallet(provider: WalletSignerProvider, address: string) {
  const challenge = await authJson(`/auth/nonce?address=${encodeURIComponent(address)}`);
  const signature = (await provider.request({
    method: "personal_sign",
    params: [challenge.message, address]
  })) as string;

  const verified = await authJson("/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, signature })
  });

  setAuthToken(String(verified.token || ""));
  return verified;
}

export async function ensureAuthenticatedWallet(provider: WalletSignerProvider, address: string) {
  if (hasAuthToken()) return;
  await authenticateWallet(provider, address);
}

export async function fetchPools() {
  const res = await fetch(`${backend}/pools`);
  if (!res.ok) throw new Error("failed to load pools");
  return res.json();
}

export async function createPool(payload: PoolPayload) {
  return authJson(`/pools`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function uploadPoolFiles(
  poolId: string,
  files: { name: string; type: string; size: number; data: string }[]
) {
  return authJson(`/pools/${poolId}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files })
  });
}

export async function uploadIntel(body: { poolId: string; ciphertext: string; messageKit: string }) {
  return authJson(`/intel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export async function litEncryptKey(body: { poolAddress: string; payload: string }) {
  return authJson(`/lit/encrypt-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export async function litDecryptKey(body: { poolAddress: string; encryptedKeyBlob: string }) {
  return authJson(`/lit/decrypt-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
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

export async function submitPoolVote(poolId: string, _voterAddress: string, vote: 1 | -1): Promise<PoolVoteSummary> {
  return authJson(`/votes/pools/${poolId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vote })
  });
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

export async function postPoolComment(poolId: string, _author: string, message: string) {
  return authJson(`/pools/${poolId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
  });
}
