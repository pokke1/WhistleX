"use client";

import { useState } from "react";
import { createPool, uploadIntel } from "../../lib/api";
import { createPoolOnchain, normalizeHex } from "../../lib/onchain";
import { buildTacoCondition, encryptWithTaco } from "../../lib/taco";
import SymmetricEncryptor from "./SymmetricEncryptor";

function toUnixTimestamp(input: string) {
  const value = Date.parse(input);
  if (Number.isNaN(value)) return "";
  return Math.floor(value / 1000).toString();
}

export default function CreatePoolPage() {
  const [poolId, setPoolId] = useState("");
  const [investigator, setInvestigator] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [threshold, setThreshold] = useState("0");
  const [minContribution, setMinContribution] = useState("0");
  const [ciphertext, setCiphertext] = useState("");
  const [intelKey, setIntelKey] = useState("");
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [messageKit, setMessageKit] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Submitting pool to Polygon Amoy...");
    setMessageKit(null);

    const deadlineTimestamp = toUnixTimestamp(deadline);
    if (!deadlineTimestamp) {
      setStatus("Deadline is invalid");
      return;
    }
    if (!intelKey) {
      setStatus("Symmetric key is missing. Generate or paste it before creating the pool.");
      return;
    }

    try {
      const normalizedCipher = normalizeHex(ciphertext);
      const onchain = await createPoolOnchain({
        threshold,
        minContributionForDecrypt: minContribution,
        deadline: deadlineTimestamp,
        ciphertext: normalizedCipher
      });

      setPoolId(onchain.poolAddress);
      setInvestigator(onchain.investigator);
      setStatus("Encrypting DEK with TACo...");

      const kit = await encryptWithTaco({
        poolAddress: onchain.poolAddress,
        minContributionForDecrypt: minContribution,
        payload: intelKey // wrap the symmetric key with TACo
      });

      const policy = buildTacoCondition(onchain.poolAddress, minContribution);
      setMessageKit(kit);

      await createPool({
        id: onchain.poolAddress,
        investigator: onchain.investigator,
        threshold,
        minContributionForDecrypt: minContribution,
        deadline: deadlineTimestamp,
        ciphertext: normalizedCipher,
        title,
        description
      });

      await uploadIntel({ poolId: onchain.poolAddress, ciphertext: normalizedCipher, messageKit: kit });

      setStatus("Pool created, TACo policy recorded, and intel stored");
      console.log("Stored policy", policy);
    } catch (err: any) {
      setStatus(err.message || "Failed to create pool");
    }
  }

  return (
    <main className="app-shell space-y-5">
      <header className="top-bar">
        <div>
          <h1 className="title">Create a TACo-protected Intel Pool</h1>
          <p className="subtitle">
            Encrypt your intel locally, wrap the symmetric key with TACo, and publish a pool funded in USDC on Polygon Amoy.
          </p>
        </div>
        <div className="pill">Investigator</div>
      </header>

      <div className="panel">
        <SymmetricEncryptor
          onCiphertextReady={(hex) => {
            setCiphertext(hex);
            setStatus("Ciphertext prepared locally. Continue with pool creation.");
          }}
          onKeyReady={(keyHex) => setIntelKey(keyHex)}
        />
      </div>

      <form onSubmit={handleSubmit} className="panel space-y-4">
        <div className="section-header">
          <h2 className="section-title">Pool details</h2>
          <span className="pill">USDC · Polygon Amoy</span>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          <label className="block">
            <span className="muted">Title</span>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Insider report on protocol XYZ"
              required
            />
          </label>
          <label className="block">
            <span className="muted">Funding threshold (USDC, 6 decimals)</span>
            <input
              className="input"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              required
            />
          </label>
          <label className="block">
            <span className="muted">Minimum contribution to decrypt (USDC, 6 decimals)</span>
            <input
              className="input"
              value={minContribution}
              onChange={(e) => setMinContribution(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              required
            />
          </label>
          <label className="block">
            <span className="muted">Deadline</span>
            <input
              className="input"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
            />
          </label>
        </div>

        <label className="block">
          <span className="muted">Description</span>
          <textarea
            className="input"
            style={{ minHeight: 120, width: "100%" }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Context, scope, and what contributors can expect once unlocked."
            required
          />
        </label>

        <label className="block">
          <span className="muted">Ciphertext (hex-encoded intel blob)</span>
          <textarea
            className="input"
            style={{ minHeight: 140, width: "100%" }}
            value={ciphertext}
            onChange={(e) => setCiphertext(e.target.value)}
            placeholder="0x..."
            required
          />
        </label>

        <div className="input-row">
          <button className="button cta" type="submit">
            Create pool and encrypt
          </button>
          {status && <span className="muted">{status}</span>}
        </div>
      </form>

      {poolId && (
        <div className="panel">
          <p className="muted">Pool deployed</p>
          <p className="subtitle">Address: {poolId}</p>
          <p className="muted">Investigator: {investigator}</p>
        </div>
      )}

      {messageKit && (
        <div className="panel">
          <p className="muted">TACo MessageKit</p>
          <textarea className="input" style={{ width: "100%", minHeight: 100 }} readOnly value={messageKit} />
        </div>
      )}
    </main>
  );
}
