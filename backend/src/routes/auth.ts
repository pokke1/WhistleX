import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { verifyMessage, isAddress, getAddress } from "ethers";
import { consumeAuthChallenge, issueAuthChallenge } from "../services/authNonceStore.js";

const router = express.Router();

function normalizedAddress(value: string) {
  return getAddress(value).toLowerCase();
}

function getJwtSecret() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) {
    throw new Error("AUTH_JWT_SECRET is required");
  }
  return secret;
}

router.get("/nonce", async (req: Request, res: Response) => {
  const raw = typeof req.query?.address === "string" ? req.query.address : "";
  if (!raw || !isAddress(raw)) {
    return res.status(400).json({ error: "Valid wallet address is required" });
  }
  const address = normalizedAddress(raw);
  const challenge = issueAuthChallenge(address);
  return res.json({ address, ...challenge });
});

router.post("/verify", async (req: Request, res: Response) => {
  const rawAddress = String(req.body?.address || "");
  const signature = String(req.body?.signature || "");

  if (!rawAddress || !signature || !isAddress(rawAddress)) {
    return res.status(400).json({ error: "address and signature are required" });
  }

  const address = normalizedAddress(rawAddress);
  const challenge = consumeAuthChallenge(address);
  if (!challenge) {
    return res.status(401).json({ error: "Authentication challenge expired or missing" });
  }

  let recovered = "";
  try {
    recovered = normalizedAddress(verifyMessage(challenge.message, signature));
  } catch {
    return res.status(401).json({ error: "Invalid signature" });
  }

  if (recovered !== address) {
    return res.status(401).json({ error: "Signature does not match address" });
  }

  const secret = getJwtSecret();
  const expiresIn = process.env.AUTH_TOKEN_TTL || "1h";
  const token = jwt.sign({ sub: address }, secret, { expiresIn: expiresIn as any });
  return res.json({ token, address, expiresIn });
});

export default router;
