import express, { Request, Response } from "express";
import { supabase } from "../db/supabase.js";

const router = express.Router();

router.post("/", async (req: Request, res: Response) => {
  const { poolId, ciphertext, messageKit } = req.body;
  if (!poolId || !ciphertext || !messageKit) {
    return res.status(400).json({ error: "poolId, ciphertext and messageKit are required" });
  }

  const { error } = await supabase.from("intel_blobs").insert({ poolId, ciphertext, messageKit });
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ poolId, ciphertext, messageKit });
});

export default router;
