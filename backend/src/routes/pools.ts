import express, { Request, Response } from "express";
import { supabase } from "../db/supabase.js";
import { buildCanonicalPolicy } from "../services/tacoPolicy.js";
import { requireAuth } from "../services/auth.js";
import { getCachedPoolState } from "../services/poolStateCache.js";

const router = express.Router();

router.get("/", async (_req: Request, res: Response) => {
  const { data, error } = await supabase.from("pools").select("*");
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  const poolIds = (data || []).map((row) => row.id).filter(Boolean);
  const attachmentsByPool = new Map<string, any[]>();
  if (poolIds.length > 0) {
    const filesResult = await supabase
      .from("pool_files")
      .select("id, poolid, public_url, mime_type, size_bytes, path, created_at")
      .in("poolid", poolIds);
    if (!filesResult.error) {
      for (const file of filesResult.data || []) {
        const poolId = String(file.poolid || "");
        if (!attachmentsByPool.has(poolId)) {
          attachmentsByPool.set(poolId, []);
        }
        attachmentsByPool.get(poolId)?.push({
          id: file.id,
          publicUrl: file.public_url,
          mimeType: file.mime_type,
          sizeBytes: file.size_bytes,
          path: file.path,
          createdAt: file.created_at
        });
      }
    }
  }

  const normalized = (data || []).map((row) => {
    const pool = fromDbPool(row);
    const attachments = attachmentsByPool.get(String(pool.id)) || [];
    return { ...pool, attachments };
  });
  return res.json(normalized);
});

router.get("/comments/counts", async (req: Request, res: Response) => {
  const idsParam = typeof req.query?.ids === "string" ? req.query.ids : "";
  const ids = idsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (ids.length === 0) {
    return res.json({});
  }

  const { data, error } = await supabase
    .from("pool_comments")
    .select("poolid")
    .in("poolid", ids);
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const counts: Record<string, number> = {};
  for (const row of data || []) {
    const poolId = String(row.poolid || "");
    if (poolId) {
      counts[poolId] = (counts[poolId] || 0) + 1;
    }
  }

  return res.json(counts);
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

router.get("/:poolId/state", async (req: Request, res: Response) => {
  const poolId = req.params?.poolId;
  if (!poolId) {
    return res.status(400).json({ error: "poolId is required" });
  }

  const address = typeof req.query?.address === "string" ? req.query.address : undefined;
  try {
    const state = await getCachedPoolState(poolId, address);
    return res.json(state);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "failed to fetch pool state" });
  }
});

router.get("/:poolId/comments", async (req: Request, res: Response) => {
  const poolId = req.params?.poolId;
  if (!poolId) {
    return res.status(400).json({ error: "poolId is required" });
  }

  const { data, error } = await supabase
    .from("pool_comments")
    .select("id, poolid, author, message, created_at")
    .eq("poolid", poolId)
    .order("created_at", { ascending: true });
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ poolId, comments: data || [] });
});

router.post("/:poolId/comments", requireAuth, async (req: Request, res: Response) => {
  const poolId = req.params?.poolId;
  const author = String(req.body?.author || "").trim();
  const message = String(req.body?.message || "").trim();
  if (!poolId) {
    return res.status(400).json({ error: "poolId is required" });
  }
  if (!author || !message) {
    return res.status(400).json({ error: "author and message are required" });
  }
  if (req.userAddress && req.userAddress.toLowerCase() !== author.toLowerCase()) {
    return res.status(403).json({ error: "author must match authenticated address" });
  }

  const { error } = await supabase.from("pool_comments").insert({
    poolid: poolId,
    author,
    message
  });
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ ok: true });
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const { id, investigator, threshold, minContributionForDecrypt, deadline, ciphertext, title, description } = req.body;
  if (!id || !investigator || !threshold || !minContributionForDecrypt || !deadline || !ciphertext) {
    return res
      .status(400)
      .json({ error: "id, investigator, threshold, minContributionForDecrypt, deadline, ciphertext are required" });
  }
  if (req.userAddress && req.userAddress.toLowerCase() !== String(investigator).toLowerCase()) {
    return res.status(403).json({ error: "investigator must match authenticated address" });
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

router.post("/:poolId/files", async (req: Request, res: Response) => {
  const poolId = req.params?.poolId;
  if (!poolId) {
    return res.status(400).json({ error: "poolId is required" });
  }

  const { data: poolRow, error: poolError } = await supabase
    .from("pools")
    .select("id")
    .eq("id", poolId)
    .maybeSingle();
  if (poolError) {
    return res.status(500).json({ error: poolError.message });
  }
  if (!poolRow) {
    return res.status(404).json({ error: "pool not found" });
  }

  const files = Array.isArray(req.body?.files) ? req.body.files : [];
  const MAX_FILES = 3;
  const MAX_BYTES = 5 * 1024 * 1024;
  if (files.length === 0) {
    return res.status(400).json({ error: "files are required" });
  }
  if (files.length > MAX_FILES) {
    return res.status(400).json({ error: "too many files (max 3)" });
  }

  const attachments = [];
  for (const file of files) {
    const name = String(file?.name || "attachment");
    const type = String(file?.type || "");
    const size = Number(file?.size || 0);
    const data = String(file?.data || "");
    if (!data) {
      return res.status(400).json({ error: "file data missing" });
    }
    if (!(type.startsWith("image/") || type === "application/pdf")) {
      return res.status(400).json({ error: `unsupported file type: ${type}` });
    }
    if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) {
      return res.status(400).json({ error: "file size exceeds 5MB limit" });
    }

    const buffer = Buffer.from(data, "base64");
    if (buffer.length > MAX_BYTES) {
      return res.status(400).json({ error: "file size exceeds 5MB limit" });
    }

    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${poolId}/${Date.now()}-${safeName}`;
    const uploadResult = await supabase.storage.from("pool-attachments").upload(path, buffer, {
      contentType: type,
      upsert: false
    });
    if (uploadResult.error) {
      return res.status(500).json({ error: uploadResult.error.message });
    }

    const publicUrl = supabase.storage.from("pool-attachments").getPublicUrl(path).data.publicUrl;
    const insertResult = await supabase.from("pool_files").insert({
      poolid: poolId,
      path,
      public_url: publicUrl,
      mime_type: type,
      size_bytes: buffer.length
    });
    if (insertResult.error) {
      return res.status(500).json({ error: insertResult.error.message });
    }

    attachments.push({
      path,
      publicUrl,
      mimeType: type,
      sizeBytes: buffer.length
    });
  }

  return res.json({ poolId, attachments });
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
