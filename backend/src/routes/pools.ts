import express from "express";
import { supabase } from "../db/supabase.js";
import { buildCanonicalPolicy } from "../services/tacoPolicy.js";

const router = express.Router();

router.get("/", async (_req, res) => {
  const { data, error } = await supabase.from("pools").select("*");
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  return res.json(data || []);
});

router.post("/", async (req, res) => {
  const { id, investigator, threshold, minContributionForDecrypt } = req.body;
  if (!id || !investigator || !threshold || !minContributionForDecrypt) {
    return res.status(400).json({ error: "id, investigator, threshold, minContributionForDecrypt are required" });
  }

  const policy = buildCanonicalPolicy(id, BigInt(minContributionForDecrypt));
  const { error } = await supabase
    .from("pools")
    .upsert({ id, investigator, threshold, minContributionForDecrypt, policyId: JSON.stringify(policy) });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ id, investigator, threshold, minContributionForDecrypt, policy });
});

export default router;
