import express, { Request, Response } from "express";
import { supabase } from "../db/supabase.js";

const router = express.Router();

router.post("/", async (req: Request, res: Response) => {
  const { poolId, ciphertext, messageKit } = req.body;
  if (!poolId || !ciphertext || !messageKit) {
    return res.status(400).json({ error: "poolId, ciphertext and messageKit are required" });
  }

  const { error } = await supabase
    .from("intel_blobs")
    .insert({ poolid: poolId, ciphertext, messagekit: messageKit });
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ poolId, ciphertext, messageKit });
});

router.get("/:poolId", async (req: Request, res: Response) => {
  const { poolId } = req.params as { poolId?: string };
  const { data, error } = await supabase
    .from("intel_blobs")
    .select("ciphertext, messagekit")
    .eq("poolid", poolId)
    .order("created_at", { ascending: false })
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
