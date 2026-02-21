import express, { Request, Response } from "express";
import { issueNonce, verifySignature } from "../services/auth.js";

const router = express.Router();

router.get("/nonce", async (req: Request, res: Response) => {
  const address = String(req.query?.address || "").trim();
  if (!address) {
    return res.status(400).json({ error: "address is required" });
  }
  const { nonce, message, issuedAt, expiresAt } = issueNonce(address);
  return res.json({ address: address.toLowerCase(), nonce, message, issuedAt, expiresAt });
});

router.post("/verify", async (req: Request, res: Response) => {
  const address = String(req.body?.address || "").trim();
  const signature = String(req.body?.signature || "").trim();
  if (!address || !signature) {
    return res.status(400).json({ error: "address and signature are required" });
  }

  const result = verifySignature(address, signature);
  if (!result.ok) {
    return res.status(401).json({ error: result.error });
  }

  return res.json({ ok: true, token: result.token, address: address.toLowerCase() });
});

export default router;
