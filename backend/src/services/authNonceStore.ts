import crypto from "crypto";

interface NonceEntry {
  nonce: string;
  message: string;
  expiresAt: number;
}

const DEFAULT_TTL_MS = Number(process.env.AUTH_NONCE_TTL_MS || 5 * 60 * 1000);
const nonceStore = new Map<string, NonceEntry>();

function keyForAddress(address: string) {
  return address.toLowerCase();
}

function cleanupExpired() {
  const now = Date.now();
  for (const [key, entry] of nonceStore.entries()) {
    if (entry.expiresAt <= now) {
      nonceStore.delete(key);
    }
  }
}

function createMessage(address: string, nonce: string) {
  return [
    "WhistleX authentication",
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    "Sign this message to authenticate to WhistleX.",
    "No gas fees are required."
  ].join("\n");
}

export function issueAuthChallenge(address: string) {
  cleanupExpired();
  const normalized = keyForAddress(address);
  const nonce = crypto.randomBytes(16).toString("hex");
  const message = createMessage(address, nonce);
  const expiresAt = Date.now() + DEFAULT_TTL_MS;
  nonceStore.set(normalized, { nonce, message, expiresAt });
  return { nonce, message, expiresAt };
}

export function consumeAuthChallenge(address: string) {
  cleanupExpired();
  const normalized = keyForAddress(address);
  const entry = nonceStore.get(normalized);
  if (!entry) return null;
  nonceStore.delete(normalized);
  if (entry.expiresAt <= Date.now()) return null;
  return entry;
}
