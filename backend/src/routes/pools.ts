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

router.get("/:poolId/contributors", async (req: Request, res: Response) => {
  const poolId = req.params?.poolId;
  if (!poolId) {
    return res.status(400).json({ error: "poolId is required" });
  }

  const [contributionsResult, votesResult] = await Promise.all([
    supabase.from("contributions").select("contributor, amount, txhash, blocknumber, logindex").eq("poolid", poolId),
    supabase.from("pool_votes").select("voteraddress, vote").eq("poolid", poolId)
  ]);

  if (contributionsResult.error) {
    return res.status(500).json({ error: contributionsResult.error.message });
  }
  if (votesResult.error) {
    return res.status(500).json({ error: votesResult.error.message });
  }

  const byContributor = new Map<string, { address: string; amount: bigint; txHash: string | null; latestOrder: number }>();
  for (const row of contributionsResult.data || []) {
    const address = String(row.contributor || "").toLowerCase();
    const amount = BigInt(String(row.amount || "0"));
    const txHash = row.txhash ? String(row.txhash) : null;
    const blockNumber = Number(row.blocknumber || 0);
    const logIndex = Number(row.logindex || 0);
    const order = (blockNumber * 1_000_000) + logIndex;
    const current = byContributor.get(address);
    if (current) {
      current.amount += amount;
      if (order >= current.latestOrder && txHash) {
        current.txHash = txHash;
        current.latestOrder = order;
      }
    } else {
      byContributor.set(address, { address, amount, txHash, latestOrder: order });
    }
  }

  const voteByAddress = new Map<string, number>();
  for (const row of votesResult.data || []) {
    const address = String(row.voteraddress || "").toLowerCase();
    const vote = Number(row.vote || 0);
    if (vote === 1 || vote === -1) {
      voteByAddress.set(address, vote);
    }
  }

  const contributors = [...byContributor.values()]
    .map(({ address, amount, txHash }) => ({
      address,
      amount: amount.toString(),
      vote: voteByAddress.get(address) ?? null,
      txHash
    }))
    .sort((a, b) => {
      const left = BigInt(a.amount);
      const right = BigInt(b.amount);
      if (left === right) return 0;
      return left > right ? -1 : 1;
    });

  return res.json({ poolId, contributors });
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
