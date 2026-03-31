import { buildCanonicalPolicy } from "./accessPolicy.js";

const DEFAULT_API_BASE_URL = "https://api.dev.litprotocol.com";
const DEFAULT_ENCRYPT_PATH = "/v1/access-control/encrypt";
const DEFAULT_DECRYPT_PATH = "/v1/access-control/decrypt";
const DEFAULT_TIMEOUT_MS = 30_000;

function getConfig() {
  const apiKey = process.env.LIT_API_KEY || "";
  const apiBaseUrl = process.env.LIT_API_BASE_URL || DEFAULT_API_BASE_URL;
  const encryptPath = process.env.LIT_ENCRYPT_PATH || DEFAULT_ENCRYPT_PATH;
  const decryptPath = process.env.LIT_DECRYPT_PATH || DEFAULT_DECRYPT_PATH;
  const timeoutMs = Number(process.env.LIT_API_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return { apiKey, apiBaseUrl, encryptPath, decryptPath, timeoutMs };
}

function assertConfigured() {
  const { apiKey } = getConfig();
  if (!apiKey) {
    throw new Error("LIT_API_KEY is not configured");
  }
}

async function litPost(path: string, payload: any) {
  const { apiKey, apiBaseUrl, timeoutMs } = getConfig();
  assertConfigured();

  const url = new URL(path, apiBaseUrl).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const text = await res.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }

    if (!res.ok) {
      throw new Error(body?.error || body?.message || `Lit API request failed (${res.status})`);
    }

    return body;
  } finally {
    clearTimeout(timer);
  }
}

function pickString(body: any, candidates: string[]) {
  for (const key of candidates) {
    const value = key.split(".").reduce((acc: any, part) => (acc ? acc[part] : undefined), body);
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return "";
}

export async function encryptKeyWithLitManaged(params: { poolAddress: string; payloadHex: string; userAddress: string }) {
  const { encryptPath } = getConfig();
  const policy = buildCanonicalPolicy(params.poolAddress);

  const body = await litPost(encryptPath, {
    chain: "amoy",
    userAddress: params.userAddress,
    poolAddress: params.poolAddress,
    payload: params.payloadHex,
    accessPolicy: policy,
    conditions: policy.conditions
  });

  const encryptedKeyBlob = pickString(body, [
    "encryptedKeyBlob",
    "messageKit",
    "ciphertext",
    "data.encryptedKeyBlob",
    "data.messageKit",
    "data.ciphertext"
  ]);

  if (!encryptedKeyBlob) {
    throw new Error("Lit encrypt response missing encrypted key blob");
  }

  return { encryptedKeyBlob, raw: body };
}

export async function decryptKeyWithLitManaged(params: {
  poolAddress: string;
  encryptedKeyBlob: string;
  userAddress: string;
}) {
  const { decryptPath } = getConfig();
  const policy = buildCanonicalPolicy(params.poolAddress);

  const body = await litPost(decryptPath, {
    chain: "amoy",
    userAddress: params.userAddress,
    poolAddress: params.poolAddress,
    encryptedKeyBlob: params.encryptedKeyBlob,
    accessPolicy: policy,
    conditions: policy.conditions
  });

  const plaintext = pickString(body, [
    "plaintext",
    "decryptedKey",
    "payload",
    "data.plaintext",
    "data.decryptedKey",
    "data.payload"
  ]);

  if (!plaintext) {
    throw new Error("Lit decrypt response missing plaintext key");
  }

  return { plaintext, raw: body };
}
