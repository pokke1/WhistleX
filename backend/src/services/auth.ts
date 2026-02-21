import crypto from "node:crypto";
import { ethers } from "ethers";
import type { RequestHandler } from "express";

const NONCE_TTL_MS = 5 * 60 * 1000;
const TOKEN_TTL_MS = 10 * 60 * 1000;
const TOKEN_ISSUER = "whistlex";

const nonces = new Map<string, { nonce: string; message: string; expiresAt: number }>();

function base64url(input: string) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function hmac(payload: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function getSecret() {
  const secret = process.env.AUTH_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "whistlex-dev-secret";
  return secret;
}

export function issueNonce(address: string) {
  const normalized = address.toLowerCase();
  const nonce = crypto.randomUUID();
  const issuedAt = new Date().toISOString();
  const message = [
    "WhistleX wants you to sign in with your Ethereum account:",
    normalized,
    "",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    "Chain: polygon-amoy"
  ].join("\n");

  const expiresAt = Date.now() + NONCE_TTL_MS;
  nonces.set(normalized, { nonce, message, expiresAt });
  return { nonce, message, issuedAt, expiresAt };
}

export function verifySignature(address: string, signature: string) {
  const normalized = address.toLowerCase();
  const entry = nonces.get(normalized);
  if (!entry) {
    return { ok: false, error: "nonce_not_found" } as const;
  }
  if (Date.now() > entry.expiresAt) {
    nonces.delete(normalized);
    return { ok: false, error: "nonce_expired" } as const;
  }

  let recovered: string;
  try {
    recovered = ethers.verifyMessage(entry.message, signature).toLowerCase();
  } catch {
    return { ok: false, error: "invalid_signature" } as const;
  }

  if (recovered !== normalized) {
    return { ok: false, error: "address_mismatch" } as const;
  }

  nonces.delete(normalized);
  const token = issueToken(normalized);
  return { ok: true, token } as const;
}

function issueToken(address: string) {
  const payload = {
    iss: TOKEN_ISSUER,
    sub: address,
    exp: Date.now() + TOKEN_TTL_MS
  };
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = base64url(payloadJson);
  const sig = hmac(payloadB64, getSecret());
  return `${payloadB64}.${sig}`;
}

function verifyToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expected = hmac(payloadB64, getSecret());
  if (sig !== expected) return null;
  let payload: any;
  try {
    payload = JSON.parse(Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  } catch {
    return null;
  }
  if (payload?.iss !== TOKEN_ISSUER) return null;
  if (typeof payload?.exp !== "number" || Date.now() > payload.exp) return null;
  if (typeof payload?.sub !== "string") return null;
  return payload as { sub: string; exp: number; iss: string };
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (!header || typeof header !== "string" || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "missing_auth" });
    return;
  }
  const token = header.slice("Bearer ".length).trim();
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "invalid_auth" });
    return;
  }
  req.userAddress = payload.sub;
  if (next) next();
};
