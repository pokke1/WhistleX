import express, { Request, Response } from "express";
import { supabase } from "../db/supabase.js";

const router = express.Router();

router.get("/:address", async (req: Request, res: Response) => {
  const rawAddress = req.params?.address;
  if (!rawAddress) {
    return res.status(400).json({ error: "address is required" });
  }
  const address = rawAddress.toLowerCase();

  const [createdResult, contributionResult, ratingResult] = await Promise.all([
    supabase.from("pools").select("*").ilike("investigator", address),
    supabase.from("contributions").select("poolid, amount").ilike("contributor", address),
    supabase.from("vendor_rating_stats").select("*").ilike("vendoraddress", address).maybeSingle()
  ]);

  if (createdResult.error) {
    return res.status(500).json({ error: createdResult.error.message });
  }
  if (contributionResult.error) {
    return res.status(500).json({ error: contributionResult.error.message });
  }
  if (ratingResult.error) {
    return res.status(500).json({ error: ratingResult.error.message });
  }

  const contributionByPool = new Map<string, bigint>();
  for (const row of contributionResult.data || []) {
    const poolId = row.poolid as string;
    const amount = row.amount as string;
    const current = contributionByPool.get(poolId) || 0n;
    contributionByPool.set(poolId, current + BigInt(amount || "0"));
  }

  const contributedPoolIds = [...contributionByPool.keys()];
  let contributedPools: any[] = [];
  if (contributedPoolIds.length > 0) {
    const poolsResult = await supabase.from("pools").select("*").in("id", contributedPoolIds);
    if (poolsResult.error) {
      return res.status(500).json({ error: poolsResult.error.message });
    }
    contributedPools = (poolsResult.data || []).map((row) => ({
      ...fromDbPool(row),
      contributedAmount: (contributionByPool.get(row.id) || 0n).toString()
    }));
  }

  return res.json({
    address,
    createdPools: (createdResult.data || []).map(fromDbPool),
    contributedPools,
    vendorRating: {
      average: Number(ratingResult.data?.avgrating || 0),
      score: String(ratingResult.data?.score || "0"),
      totalVotePower: String(ratingResult.data?.votepower || "0"),
      totalVotes: Number(ratingResult.data?.totalvotes || 0),
      poolsCount: Number(ratingResult.data?.poolcount || 0)
    }
  });
});

function fromDbPool(row: any) {
  if (!row) return row;
  const { mincontributionfordecrypt, factoryaddress, policyid, ...rest } = row;
  return {
    ...rest,
    minContributionForDecrypt: mincontributionfordecrypt,
    factoryAddress: factoryaddress,
    policyId: policyid
  };
}

export default router;
