import express, { Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth.js";
import { getCachedPoolState } from "../services/poolStateCache.js";
import { decryptKeyWithLitManaged, encryptKeyWithLitManaged } from "../services/litService.js";

const router = express.Router();

const encryptSchema = z.object({
  poolAddress: z.string().min(1),
  payload: z.string().min(1)
});

const decryptSchema = z.object({
  poolAddress: z.string().min(1),
  encryptedKeyBlob: z.string().min(1)
});

router.post("/encrypt-key", requireAuth, async (req: Request, res: Response) => {
  const parsed = encryptSchema.safeParse(req.body || {});
  const userAddress = String(req.auth?.address || "").toLowerCase();
  if (!parsed.success || !userAddress) {
    return res.status(400).json({ error: "poolAddress and payload are required" });
  }

  try {
    const { encryptedKeyBlob } = await encryptKeyWithLitManaged({
      poolAddress: parsed.data.poolAddress,
      payloadHex: parsed.data.payload,
      userAddress
    });
    return res.json({ encryptedKeyBlob });
  } catch (error: any) {
    return res.status(502).json({ error: error?.message || "Lit encrypt failed" });
  }
});

router.post("/decrypt-key", requireAuth, async (req: Request, res: Response) => {
  const parsed = decryptSchema.safeParse(req.body || {});
  const userAddress = String(req.auth?.address || "").toLowerCase();
  if (!parsed.success || !userAddress) {
    return res.status(400).json({ error: "poolAddress and encryptedKeyBlob are required" });
  }

  try {
    const state = await getCachedPoolState(parsed.data.poolAddress, userAddress);
    if (!state.unlocked || !state.canDecrypt) {
      return res.status(403).json({ error: "Not eligible to decrypt this pool" });
    }

    const { plaintext } = await decryptKeyWithLitManaged({
      poolAddress: parsed.data.poolAddress,
      encryptedKeyBlob: parsed.data.encryptedKeyBlob,
      userAddress
    });

    return res.json({ plaintext });
  } catch (error: any) {
    return res.status(502).json({ error: error?.message || "Lit decrypt failed" });
  }
});

export default router;
