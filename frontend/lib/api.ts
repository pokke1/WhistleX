const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export interface PoolPayload {
  id: string;
  investigator: string;
  threshold: string;
  minContributionForDecrypt: string;
  deadline: string;
  ciphertext: string;
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

export async function uploadIntel(body: { poolId: string; ciphertext: string; messageKit: string }) {
  const res = await fetch(`${backend}/intel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("failed to upload intel");
  return res.json();
}
