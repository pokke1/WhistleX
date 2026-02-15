import express, { Request, Response } from "express";
import { ethers } from "ethers";
import { supabase } from "../db/supabase.js";

const DEFAULT_POLYGON_AMOY_RPC_URL = "https://polygon-amoy.drpc.org";
const poolAbi = ["function canDecrypt(address contributor) view returns (bool)"];

const router = express.Router();

router.get("/pools/:poolId", async (req: Request, res: Response) => {
  const poolId = req.params?.poolId;
  if (!poolId) {
    return res.status(400).json({ error: "poolId is required" });
  }

  const poolResult = await supabase.from("pools").select("id, investigator").eq("id", poolId).maybeSingle();
  if (poolResult.error) {
    return res.status(500).json({ error: poolResult.error.message });
  }
  if (!poolResult.data) {
    return res.status(404).json({ error: "Pool not found" });
  }

  const votesResult = await supabase.from("pool_votes").select("voteraddress, vote").eq("poolid", poolId);
  if (votesResult.error) {
    return res.status(500).json({ error: votesResult.error.message });
  }

  const summary = summarizeVotes(votesResult.data || []);
  const voterParam = extractQueryString(req.query?.voter);

  let myVote: number | null = null;
  let canVote: boolean | null = null;
  let reason: string | null = null;

  if (voterParam) {
    const voterAddress = voterParam.toLowerCase();
    const investigator = String(poolResult.data.investigator || "").toLowerCase();
    myVote = getMyVote(votesResult.data || [], voterAddress);

    if (voterAddress === investigator) {
      canVote = false;
      reason = "Investigators cannot rate their own pools";
    } else {
      const eligible = await getCanDecrypt(poolId, voterAddress).catch(() => false);
      canVote = eligible;
      reason = eligible ? null : "Only contributors with current decrypt rights can vote";
    }
  }

  return res.json({
    poolId,
    ...summary,
    myVote,
    canVote,
    reason
  });
});

router.post("/pools/:poolId", async (req: Request, res: Response) => {
  const poolId = req.params?.poolId;
  const voterAddressRaw = req.body?.voterAddress;
  const voteRaw = req.body?.vote;

  if (!poolId || !voterAddressRaw || (voteRaw !== 1 && voteRaw !== -1)) {
    return res.status(400).json({ error: "poolId, voterAddress and vote (-1 or 1) are required" });
  }

  const voterAddress = String(voterAddressRaw).toLowerCase();
  const vote = Number(voteRaw);

  const poolResult = await supabase.from("pools").select("id, investigator").eq("id", poolId).maybeSingle();
  if (poolResult.error) {
    return res.status(500).json({ error: poolResult.error.message });
  }
  if (!poolResult.data) {
    return res.status(404).json({ error: "Pool not found" });
  }

  const investigator = String(poolResult.data.investigator || "").toLowerCase();
  if (investigator === voterAddress) {
    return res.status(403).json({ error: "Investigators cannot rate their own pools" });
  }

  const eligible = await getCanDecrypt(poolId, voterAddress).catch(() => false);
  if (!eligible) {
    return res.status(403).json({ error: "Only contributors with current decrypt rights can vote" });
  }

  const upsertResult = await supabase.from("pool_votes").upsert(
    {
      poolid: poolId,
      voteraddress: voterAddress,
      vote
    },
    { onConflict: "poolid,voteraddress" }
  );
  if (upsertResult.error) {
    return res.status(500).json({ error: upsertResult.error.message });
  }

  const votesResult = await supabase.from("pool_votes").select("voteraddress, vote").eq("poolid", poolId);
  if (votesResult.error) {
    return res.status(500).json({ error: votesResult.error.message });
  }

  const summary = summarizeVotes(votesResult.data || []);
  return res.json({
    poolId,
    ...summary,
    myVote: getMyVote(votesResult.data || [], voterAddress),
    canVote: true,
    reason: null
  });
});

function extractQueryString(value?: string | string[]) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] : value;
}

function summarizeVotes(rows: any[]) {
  let upvotes = 0;
  let downvotes = 0;
  let score = 0;

  for (const row of rows) {
    const vote = Number(row.vote || 0);
    if (vote === 1) upvotes += 1;
    if (vote === -1) downvotes += 1;
    score += vote;
  }

  const totalVotes = upvotes + downvotes;
  const average = totalVotes > 0 ? score / totalVotes : 0;
  return { upvotes, downvotes, score, average, totalVotes };
}

function getMyVote(rows: any[], voterAddress: string) {
  const match = rows.find((row) => String(row.voteraddress || "").toLowerCase() === voterAddress);
  return match ? Number(match.vote || 0) : null;
}

async function getCanDecrypt(poolAddress: string, contributor: string) {
  const rpcUrl = process.env.RPC_URL || process.env.AMOY_RPC_URL || DEFAULT_POLYGON_AMOY_RPC_URL;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const pool = new ethers.Contract(poolAddress, poolAbi, provider);
  return Boolean(await pool.canDecrypt(contributor));
}

export default router;
