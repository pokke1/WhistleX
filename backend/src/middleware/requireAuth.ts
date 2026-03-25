import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

function getJwtSecret() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) {
    throw new Error("AUTH_JWT_SECRET is required");
  }
  return secret;
}

export function requireAuth(req: Request, res: Response, next?: NextFunction) {
  const raw = req.headers?.authorization;
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  const token = header.slice(7).trim();
  try {
    const payload = jwt.verify(token, getJwtSecret()) as { sub?: string };
    if (!payload?.sub) {
      return res.status(401).json({ error: "Invalid token payload" });
    }
    req.auth = { address: String(payload.sub).toLowerCase() };
    if (next) next();
    return;
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
