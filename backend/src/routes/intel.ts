import express, { Request, Response } from "express";
import { z } from "zod";
import { supabase } from "../db/supabase.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

const postIntelSchema = z.object({
  poolId: z.string().min(1),
  ciphertext: z.string().min(1),
  messageKit: z.string().min(1)
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const parsed = postIntelSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: "poolId, ciphertext and messageKit are required" });
  }

  const { poolId, ciphertext, messageKit } = parsed.data;

  const { error } = await supabase
    .from("intel_blobs")
    .insert({ poolid: poolId, ciphertext, messagekit: messageKit });
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ poolId, ciphertext, messageKit });
});

router.get("/:poolId", async (req: Request, res: Response) => {
  const poolId = String(req.params?.poolId || "").trim();
  if (!poolId) {
    return res.status(400).json({ error: "poolId is required" });
  }

  const { data, error } = await supabase
    .from("intel_blobs")
    .select("ciphertext, messagekit")
    .eq("poolid", poolId)
    .limit(1)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  if (!data) {
    return res.status(404).json({ error: "No intel found for this pool" });
  }

  return res.json({ ...data, messageKit: data.messagekit });
});

export default router;
