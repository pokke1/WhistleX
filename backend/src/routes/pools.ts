import express, { Request, Response } from "express";
import { supabase } from "../db/supabase.js";
import { buildCanonicalPolicy } from "../services/tacoPolicy.js";

const router = express.Router();

router.get("/", async (_req: Request, res: Response) => {
  const { data, error } = await supabase.from("pools").select("*");
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  const normalized = (data || []).map(fromDbPool);
  return res.json(normalized);
});

router.post("/", async (req: Request, res: Response) => {
  const { id, investigator, threshold, minContributionForDecrypt, deadline, ciphertext, title, description } = req.body;
  if (!id || !investigator || !threshold || !minContributionForDecrypt || !deadline || !ciphertext) {
    return res
      .status(400)
      .json({ error: "id, investigator, threshold, minContributionForDecrypt, deadline, ciphertext are required" });
  }

  const policy = buildCanonicalPolicy(id, minContributionForDecrypt);
  const { error } = await supabase
    .from("pools")
    .upsert(
      toDbPool({
        id,
        investigator,
        threshold,
        minContributionForDecrypt,
        policyId: JSON.stringify(policy),
        deadline,
        ciphertext,
        title,
        description
      })
    );

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ id, investigator, threshold, minContributionForDecrypt, deadline, ciphertext, policy, title, description });
});

function toDbPool(payload: {
  id: string;
  investigator: string;
  threshold: string;
  minContributionForDecrypt: string;
  policyId?: string;
  deadline?: string;
  ciphertext?: string;
  factoryAddress?: string;
  title?: string;
  description?: string;
}) {
  const { minContributionForDecrypt, factoryAddress, policyId, ...rest } = payload;
  return {
    ...rest,
    mincontributionfordecrypt: minContributionForDecrypt,
    factoryaddress: factoryAddress,
    policyid: policyId
  };
}

function fromDbPool(row: any) {
  if (!row) return row;
  const {
    mincontributionfordecrypt,
    factoryaddress,
    policyid,
    ...rest
  } = row;
  return {
    ...rest,
    minContributionForDecrypt: mincontributionfordecrypt,
    factoryAddress: factoryaddress,
    policyId: policyid
  };
}

export default router;
