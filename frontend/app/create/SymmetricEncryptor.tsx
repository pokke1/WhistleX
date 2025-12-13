"use client";

import { useState } from "react";
import { encryptIntelWithKey, generateSymmetricKey, parseSymmetricKey } from "../../lib/symmetricCrypto";

interface SymmetricEncryptorProps {
  onCiphertextReady?: (ciphertextHex: string) => void;
}

export default function SymmetricEncryptor({ onCiphertextReady }: SymmetricEncryptorProps) {
  const [plaintext, setPlaintext] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [ciphertext, setCiphertext] = useState("");
  const [ivHex, setIvHex] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keyBase64, setKeyBase64] = useState("");

  async function handleGenerateKey() {
    setError(null);
    setStatus("Generating 256-bit key...");
    try {
      const generated = await generateSymmetricKey();
      setKeyInput(generated.keyHex);
      setKeyBase64(generated.keyBase64);
      setStatus("New symmetric key generated locally. Keep it safe and never upload it.");
    } catch (err: any) {
      setStatus(null);
      setError(err?.message || "Failed to generate key");
    }
  }

  async function handleEncrypt() {
    setError(null);
    setStatus("Encrypting intel with AES-GCM...");

    try {
      const keyBytes = parseSymmetricKey(keyInput || keyBase64);
      const { ciphertextHex, ivHex: generatedIvHex } = await encryptIntelWithKey({
        plaintext,
        keyBytes
      });

      setCiphertext(ciphertextHex);
      setIvHex(generatedIvHex);
      setStatus("Intel encrypted. Ciphertext is ready to include in the pool creation form.");
      onCiphertextReady?.(ciphertextHex);
    } catch (err: any) {
      setStatus(null);
      setError(err?.message || "Failed to encrypt intel");
    }
  }

  return (
    <section className="space-y-3 border rounded p-4 bg-gray-50">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Encrypt intel locally</h2>
          <p className="text-sm text-gray-700">
            Generate a symmetric key, encrypt your intel in the browser, and paste the ciphertext into the pool form. The key
            stays local; wrap it with TACo after the backend returns a policy.
          </p>
        </div>
        <button className="bg-gray-800 text-white px-3 py-1 rounded" onClick={handleGenerateKey} type="button">
          Generate key
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm">Symmetric key (hex or base64)</span>
          <textarea
            className="border rounded p-2 w-full min-h-[80px] font-mono text-xs"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="0x..."
          />
          {keyBase64 && (
            <p className="text-xs text-gray-600 break-all mt-1">
              Base64 version (copy if needed for TACo wrapping): {keyBase64}
            </p>
          )}
        </label>
        <label className="block">
          <span className="text-sm">Intel to encrypt</span>
          <textarea
            className="border rounded p-2 w-full min-h-[80px]"
            value={plaintext}
            onChange={(e) => setPlaintext(e.target.value)}
            placeholder="Paste the plaintext intel here. It never leaves your browser."
          />
        </label>
      </div>

      <div className="flex gap-3">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={!plaintext || !(keyInput || keyBase64)}
          onClick={handleEncrypt}
          type="button"
        >
          Encrypt intel
        </button>
        {status && <span className="text-sm text-gray-700">{status}</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {ciphertext && (
        <div className="space-y-2">
          <div>
            <p className="text-sm font-semibold">Ciphertext (hex, IV prefixed; paste into pool creation)</p>
            <textarea className="w-full min-h-[80px] text-xs font-mono" readOnly value={ciphertext} />
          </div>
          <p className="text-xs text-gray-700">
            IV (hex): <span className="font-mono break-all">{ivHex}</span>
          </p>
          <p className="text-xs text-gray-700">
            Reminder: store the symmetric key securely and only send it to TACo once you receive the policy from the backend.
          </p>
        </div>
      )}
    </section>
  );
}
