import express, { Request, Response } from "express";
import { supabase } from "../db/supabase.js";
import { buildCanonicalPolicy } from "../services/tacoPolicy.js";

const router = express.Router();

router.post("/", async (req: Request, res: Response) => {
  const { poolId, cid, dekCiphertext, policyId } = req.body;
  if (!poolId || !cid || !dekCiphertext || !policyId) {
    return res.status(400).json({ error: "poolId, cid, dekCiphertext and policyId are required" });
  }

  const { data: pool, error: poolError } = await supabase
    .from("pools")
    .select("minContributionForDecrypt, policyId")
    .eq("id", poolId)
    .maybeSingle();

  if (poolError) {
    return res.status(500).json({ error: poolError.message });
  }

  if (!pool) {
    return res.status(404).json({ error: "Pool not found" });
  }

  const canonicalPolicy = buildCanonicalPolicy(poolId, BigInt(pool.minContributionForDecrypt));
  if (policyId !== canonicalPolicy.hash) {
    return res
      .status(400)
      .json({ error: "policyId does not match canonical TACo policy for this pool" });
  }

  const { error } = await supabase.from("intel_blobs").insert({ poolId, cid, dekCiphertext });
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ poolId, cid, dekCiphertext });
});

export default router;
