import express, { Request, Response } from "express";
import { supabase } from "../db/supabase.js";
import { buildCanonicalPolicy } from "../services/tacoPolicy.js";

const router = express.Router();

router.get("/", async (_req: Request, res: Response) => {
  const { data, error } = await supabase.from("pools").select("*");
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  const rows =
    data?.map((row) => ({
      ...row,
      policy: buildCanonicalPolicy(row.id, BigInt(row.minContributionForDecrypt))
    })) || [];
  return res.json(rows);
});

router.post("/policy", async (req: Request, res: Response) => {
  const { poolId, minContributionForDecrypt } = req.body;
  if (!poolId || !minContributionForDecrypt) {
    return res.status(400).json({ error: "poolId and minContributionForDecrypt are required" });
  }

  try {
    const policy = buildCanonicalPolicy(poolId, BigInt(minContributionForDecrypt));
    return res.json(policy);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Unable to build policy" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  const { id, investigator, threshold, minContributionForDecrypt } = req.body;
  if (!id || !investigator || !threshold || !minContributionForDecrypt) {
    return res.status(400).json({ error: "id, investigator, threshold, minContributionForDecrypt are required" });
  }

  const policy = buildCanonicalPolicy(id, BigInt(minContributionForDecrypt));
  const { error } = await supabase
    .from("pools")
    .upsert({ id, investigator, threshold, minContributionForDecrypt, policyId: policy.hash });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ id, investigator, threshold, minContributionForDecrypt, policy });
});

router.get("/:id/policy", async (req: Request, res: Response) => {
  const poolId = req.params.id;
  const { data, error } = await supabase
    .from("pools")
    .select("minContributionForDecrypt")
    .eq("id", poolId)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  if (!data) {
    return res.status(404).json({ error: "Pool not found" });
  }

  const policy = buildCanonicalPolicy(poolId, BigInt(data.minContributionForDecrypt));
  return res.json(policy);
});

export default router;
