import express, { Request, Response } from "express";
import { supabase } from "../db/supabase.js";
import { buildCanonicalPolicy } from "../services/tacoPolicy.js";

const router = express.Router();

router.get("/", async (_req: Request, res: Response) => {
  const { data, error } = await supabase.from("pools").select("*");
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  return res.json(data || []);
});

router.post("/", async (req: Request, res: Response) => {
  const { id, investigator, threshold, minContributionForDecrypt, deadline, ciphertext } = req.body;
  if (!id || !investigator || !threshold || !minContributionForDecrypt || !deadline || !ciphertext) {
    return res
      .status(400)
      .json({ error: "id, investigator, threshold, minContributionForDecrypt, deadline, ciphertext are required" });
  }

  const policy = buildCanonicalPolicy(id, minContributionForDecrypt);
  const { error } = await supabase
    .from("pools")
    .upsert({ id, investigator, threshold, minContributionForDecrypt, policyId: JSON.stringify(policy), deadline, ciphertext });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ id, investigator, threshold, minContributionForDecrypt, deadline, ciphertext, policy });
});

export default router;
