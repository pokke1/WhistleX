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

  const [votesResult, contributionsResult] = await Promise.all([
    supabase.from("pool_votes").select("voteraddress, vote").eq("poolid", poolId),
    supabase.from("contributions").select("contributor, amount").eq("poolid", poolId)
  ]);
  if (votesResult.error) {
    return res.status(500).json({ error: votesResult.error.message });
  }
  if (contributionsResult.error) {
    return res.status(500).json({ error: contributionsResult.error.message });
  }

  const votePowerByAddress = buildVotePowerMap(contributionsResult.data || []);
  const summary = summarizeVotes(votesResult.data || [], votePowerByAddress);
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

  const [votesResult, contributionsResult] = await Promise.all([
    supabase.from("pool_votes").select("voteraddress, vote").eq("poolid", poolId),
    supabase.from("contributions").select("contributor, amount").eq("poolid", poolId)
  ]);
  if (votesResult.error) {
    return res.status(500).json({ error: votesResult.error.message });
  }
  if (contributionsResult.error) {
    return res.status(500).json({ error: contributionsResult.error.message });
  }

  const votePowerByAddress = buildVotePowerMap(contributionsResult.data || []);
  const summary = summarizeVotes(votesResult.data || [], votePowerByAddress);
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

function summarizeVotes(rows: any[], votePowerByAddress: Map<string, bigint>) {
  let upvotes = 0;
  let downvotes = 0;
  let weightedScore = 0n;
  let totalVotePower = 0n;

  for (const row of rows) {
    const vote = Number(row.vote || 0);
    const address = String(row.voteraddress || "").toLowerCase();
    const votePower = votePowerByAddress.get(address) || 0n;
    if (vote === 1) upvotes += 1;
    if (vote === -1) downvotes += 1;
    if (vote === 1 || vote === -1) {
      weightedScore += BigInt(vote) * votePower;
      totalVotePower += votePower;
    }
  }

  const totalVotes = upvotes + downvotes;
  let average = 0;
  if (totalVotePower > 0n) {
    const scoreNum = Number(weightedScore);
    const votePowerNum = Number(totalVotePower);
    if (Number.isFinite(scoreNum) && Number.isFinite(votePowerNum) && votePowerNum !== 0) {
      average = scoreNum / votePowerNum;
    } else {
      average = weightedScore > 0n ? 1 : weightedScore < 0n ? -1 : 0;
    }
  }
  return { upvotes, downvotes, score: weightedScore.toString(), average, totalVotes, totalVotePower: totalVotePower.toString() };
}

function getMyVote(rows: any[], voterAddress: string) {
  const match = rows.find((row) => String(row.voteraddress || "").toLowerCase() === voterAddress);
  return match ? Number(match.vote || 0) : null;
}

function buildVotePowerMap(rows: any[]) {
  const votePowerByAddress = new Map<string, bigint>();
  for (const row of rows) {
    const address = String(row.contributor || "").toLowerCase();
    if (!address) continue;
    const amountRaw = String(row.amount || "0");
    let amount = 0n;
    try {
      amount = BigInt(amountRaw);
    } catch {
      amount = 0n;
    }
    const current = votePowerByAddress.get(address) || 0n;
    votePowerByAddress.set(address, current + amount);
  }
  return votePowerByAddress;
}

async function getCanDecrypt(poolAddress: string, contributor: string) {
  const rpcUrl = process.env.RPC_URL || process.env.AMOY_RPC_URL || DEFAULT_POLYGON_AMOY_RPC_URL;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const pool = new ethers.Contract(poolAddress, poolAbi, provider);
  return Boolean(await pool.canDecrypt(contributor));
}

export default router;
