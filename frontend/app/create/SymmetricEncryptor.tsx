"use client";

import { useState } from "react";
import { encryptIntelWithKey, generateSymmetricKey, parseSymmetricKey } from "../../lib/symmetricCrypto";

interface SymmetricEncryptorProps {
  onCiphertextReady?: (ciphertextHex: string) => void;
  onKeyReady?: (keyHex: string) => void;
}

export default function SymmetricEncryptor({ onCiphertextReady, onKeyReady }: SymmetricEncryptorProps) {
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
      onKeyReady?.(generated.keyHex);
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
      const keyHex = generatedKeyToHex(keyBytes);
      onKeyReady?.(keyHex);
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
    <section className="panel space-y-3">
      <div className="section-header">
        <div>
          <h2 className="section-title">Encrypt intel locally</h2>
          <p className="muted">
            Generate a symmetric key, encrypt your intel in the browser, and paste the ciphertext into the pool form. The key
            stays local; wrap it with TACo after the backend returns a policy.
          </p>
        </div>
        <button className="button" onClick={handleGenerateKey} type="button">
          Generate key
        </button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <label className="block">
          <span className="muted">Symmetric key (hex or base64)</span>
          <textarea
            className="input mono"
            style={{ minHeight: 90, width: "100%" }}
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="0x..."
          />
          {keyBase64 && (
            <p className="muted" style={{ marginTop: 6 }}>
              Base64 version (copy if needed for TACo wrapping): <span className="mono">{keyBase64}</span>
            </p>
          )}
        </label>
        <label className="block">
          <span className="muted">Intel to encrypt</span>
          <textarea
            className="input"
            style={{ minHeight: 90, width: "100%" }}
            value={plaintext}
            onChange={(e) => setPlaintext(e.target.value)}
            placeholder="Paste the plaintext intel here. It never leaves your browser."
          />
        </label>
      </div>

      <div className="input-row">
        <button
          className="button cta"
          disabled={!plaintext || !(keyInput || keyBase64)}
          onClick={handleEncrypt}
          type="button"
        >
          Encrypt intel
        </button>
        {status && <span className="muted">{status}</span>}
        {error && <span className="muted" style={{ color: "#ff6f91" }}>{error}</span>}
      </div>

      {ciphertext && (
        <div className="space-y-2">
          <div>
            <p className="muted" style={{ fontWeight: 600 }}>
              Ciphertext (hex, IV prefixed; paste into pool creation)
            </p>
            <textarea className="input mono" style={{ width: "100%", minHeight: 90 }} readOnly value={ciphertext} />
          </div>
          <p className="muted">
            IV (hex): <span className="mono">{ivHex}</span>
          </p>
          <p className="muted">
            Reminder: store the symmetric key securely and only send it to TACo once you receive the policy from the backend.
          </p>
        </div>
      )}
    </section>
  );
}

function generatedKeyToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
