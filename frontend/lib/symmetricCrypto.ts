function getCrypto(): Crypto {
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    return window.crypto;
  }

  if (typeof globalThis !== "undefined" && (globalThis.crypto as Crypto | undefined)?.subtle) {
    return globalThis.crypto as Crypto;
  }

  throw new Error("Web Crypto API is not available in this environment");
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim().toLowerCase().replace(/^0x/, "");
  if (normalized.length % 2 !== 0) {
    throw new Error("Hex string must have an even length");
  }
  const pairs = normalized.match(/.{1,2}/g);
  if (!pairs) {
    return new Uint8Array();
  }
  return new Uint8Array(pairs.map((byte) => parseInt(byte, 16)));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  if (typeof btoa !== "function") {
    throw new Error("Base64 encoding is not available in this environment");
  }
  return btoa(binary);
}

function base64ToBytes(encoded: string): Uint8Array {
  const normalized = encoded.trim();
  if (typeof atob !== "function") {
    throw new Error("Base64 decoding is not available in this environment");
  }
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function parseSymmetricKey(input: string): Uint8Array {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Symmetric key is empty");
  }

  if (/^[0-9a-fA-FxX]+$/.test(trimmed)) {
    return hexToBytes(trimmed);
  }

  // Fallback to base64 for users who paste that format.
  return base64ToBytes(trimmed);
}

export async function generateSymmetricKey(): Promise<{
  keyBytes: Uint8Array;
  keyHex: string;
  keyBase64: string;
}> {
  const cryptoApi = getCrypto();
  const subtle = cryptoApi.subtle;

  const cryptoKey = await subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const raw = new Uint8Array(await subtle.exportKey("raw", cryptoKey));
  return {
    keyBytes: raw,
    keyHex: bytesToHex(raw),
    keyBase64: bytesToBase64(raw)
  };
}

export async function encryptIntelWithKey(params: {
  plaintext: string;
  keyBytes: Uint8Array;
  iv?: Uint8Array;
}): Promise<{
  ciphertextHex: string;
  ciphertextBase64: string;
  ivHex: string;
  ivBase64: string;
}> {
  const { plaintext, keyBytes, iv } = params;
  if (!plaintext) {
    throw new Error("Plaintext is empty");
  }
  if (!keyBytes?.length) {
    throw new Error("Symmetric key is missing");
  }
  if (![16, 24, 32].includes(keyBytes.length)) {
    throw new Error("Symmetric key must be 128, 192, or 256 bits (16, 24, or 32 bytes)");
  }

  const cryptoApi = getCrypto();
  const subtle = cryptoApi.subtle;

  const aesKey = await subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
  const ivBytes = iv || cryptoApi.getRandomValues(new Uint8Array(12));
  const encodedPlaintext = new TextEncoder().encode(plaintext);

  const cipherBuffer = await subtle.encrypt({ name: "AES-GCM", iv: ivBytes }, aesKey, encodedPlaintext);
  const ciphertext = new Uint8Array(cipherBuffer);
  // Prefix IV so the stored ciphertext blob is self contained.
  const packed = new Uint8Array(ivBytes.length + ciphertext.length);
  packed.set(ivBytes, 0);
  packed.set(ciphertext, ivBytes.length);

  return {
    ciphertextHex: `0x${bytesToHex(packed)}`,
    ciphertextBase64: bytesToBase64(packed),
    ivHex: bytesToHex(ivBytes),
    ivBase64: bytesToBase64(ivBytes)
  };
}

export const symmetricEncoding = {
  bytesToHex,
  hexToBytes,
  bytesToBase64,
  base64ToBytes
};

export async function decryptIntelWithKey(params: {
  ciphertext: string;
  keyBytes: Uint8Array;
}): Promise<string> {
  const { ciphertext, keyBytes } = params;
  if (!ciphertext) {
    throw new Error("Ciphertext is empty");
  }
  if (!keyBytes?.length) {
    throw new Error("Symmetric key is missing");
  }
  if (![16, 24, 32].includes(keyBytes.length)) {
    throw new Error("Symmetric key must be 128, 192, or 256 bits (16, 24, or 32 bytes)");
  }

  const packed = hexToBytes(ciphertext);
  if (packed.length <= 12) {
    throw new Error("Ciphertext is too short to contain IV + data");
  }

  const ivBytes = packed.slice(0, 12);
  const cipherBytes = packed.slice(12);

  const cryptoApi = getCrypto();
  const subtle = cryptoApi.subtle;
  const aesKey = await subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const plainBuffer = await subtle.decrypt({ name: "AES-GCM", iv: ivBytes }, aesKey, cipherBytes);
  return new TextDecoder().decode(plainBuffer);
}
