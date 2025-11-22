import express from "express";
import { supabase } from "../db/supabase.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { poolId, cid, dekCiphertext } = req.body;
  if (!poolId || !cid || !dekCiphertext) {
    return res.status(400).json({ error: "poolId, cid and dekCiphertext are required" });
  }

  const { error } = await supabase.from("intel_blobs").insert({ poolId, cid, dekCiphertext });
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ poolId, cid, dekCiphertext });
});

export default router;
