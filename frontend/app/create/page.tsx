"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createPool, uploadIntel, uploadPoolFiles } from "../../lib/api";
import { createPoolOnchain, normalizeHex } from "../../lib/onchain";
import { buildTacoCondition, encryptWithTaco } from "../../lib/taco";
import SymmetricEncryptor from "./SymmetricEncryptor";

function toUnixTimestamp(input: string) {
  const value = Date.parse(input);
  if (Number.isNaN(value)) return "";
  return Math.floor(value / 1000).toString();
}

export default function CreatePoolPage() {
  const CURRENCY_SYMBOL = "USDC";
  const searchParams = useSearchParams();
  const [poolId, setPoolId] = useState("");
  const [investigator, setInvestigator] = useState("");
  const [pmCategory, setPmCategory] = useState("");
  const [pmMarketId, setPmMarketId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [userDescription, setUserDescription] = useState("");
  const [threshold, setThreshold] = useState("0");
  const [minContribution, setMinContribution] = useState("0");
  const [ciphertext, setCiphertext] = useState("");
  const [intelKey, setIntelKey] = useState("");
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [messageKit, setMessageKit] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentStatus, setAttachmentStatus] = useState<string | null>(null);
  const thresholdValue = Number(threshold);
  const minContributionValue = Number(minContribution);
  const progressPercent =
    thresholdValue > 0 && Number.isFinite(thresholdValue)
      ? Math.min(100, Math.max(0, (0 / thresholdValue) * 100))
      : 0;
  const minContributionPercent =
    thresholdValue > 0 && Number.isFinite(minContributionValue)
      ? Math.min(100, Math.max(0, (minContributionValue / thresholdValue) * 100))
      : 0;

  useEffect(() => {
    if (!searchParams) return;
    const category = (searchParams.get("pm_category") || "").trim();
    const marketId = (searchParams.get("pm_id") || "").trim();
    const slug = (searchParams.get("pm_slug") || "").trim();
    const endDate = (searchParams.get("pm_end") || "").trim();

    if (category && !pmCategory) setPmCategory(category);
    if (marketId && !pmMarketId) setPmMarketId(marketId);
    if (!title) setTitle("");
    if (endDate && !deadline) {
      const dt = new Date(endDate);
      if (!Number.isNaN(dt.getTime())) {
        const iso = dt.toISOString().slice(0, 16);
        setDeadline(iso);
      }
    }
    if (marketId) {
      const marker = `<!-- polymarket_id:${marketId} -->`;
      const slugMarker = slug ? `<!-- polymarket_slug:${slug} -->` : "";
      const combined = [marker, slugMarker].filter(Boolean).join("\n");
      if (!description.includes(marker)) {
        const next = description ? `${description}\n\n${combined}` : combined;
        setDescription(next);
      }
    }
  }, [searchParams, title, description, pmCategory, pmMarketId]);

  async function fileToBase64(file: File) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
    const [, base64] = dataUrl.split(",");
    return base64 || "";
  }

  function handleAttachmentSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files) return;
    const next = [...attachments];
    let message = "";
    for (const file of Array.from(files)) {
      if (next.length >= 3) {
        message = "Max 3 files per pool.";
        break;
      }
      if (!(file.type.startsWith("image/") || file.type === "application/pdf")) {
        message = "Only images and PDF files are supported.";
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        message = "Each file must be 5MB or less.";
        continue;
      }
      next.push(file);
    }
    setAttachments(next);
    setAttachmentStatus(message || null);
    event.target.value = "";
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Submitting pool to Polygon Amoy...");
    setMessageKit(null);
    setAttachmentStatus(null);

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

      const finalDescription = [userDescription.trim(), description.trim()].filter(Boolean).join("\n\n");
      await createPool({
        id: onchain.poolAddress,
        investigator: onchain.investigator,
        threshold,
        minContributionForDecrypt: minContribution,
        deadline: deadlineTimestamp,
        ciphertext: normalizedCipher,
        title,
        description: finalDescription
      });

      if (attachments.length > 0) {
        setStatus("Uploading attachments...");
        const payload = await Promise.all(
          attachments.map(async (file) => ({
            name: file.name,
            type: file.type,
            size: file.size,
            data: await fileToBase64(file)
          }))
        );
        await uploadPoolFiles(onchain.poolAddress, payload);
      }

      await uploadIntel({ poolId: onchain.poolAddress, ciphertext: normalizedCipher, messageKit: kit });

      setStatus("Pool created, attachments stored, TACo policy recorded, and intel stored");
      console.log("Stored policy", policy);
    } catch (err: any) {
      setStatus(err.message || "Failed to create pool");
    }
  }

  return (
    <main className="app-shell space-y-5">
      <header className="top-bar">
        <div>
          <h1 className="title">Create a secret intel pool</h1>
          <p className="subtitle">
            Encrypt your intel locally in your browser, set funding rules, and publish a pool. Only eligible contributors can decrypt once unlocked.
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

        <div className="create-details-row">
          <label className="block">
            <span className="muted">Title</span>
            <div className="input-row" style={{ alignItems: "center" }}>
              {pmCategory && <span className="pill">{pmCategory}</span>}
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Insider report on protocol XYZ"
                required
                style={{ flex: 1 }}
              />
            </div>
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
            value={userDescription}
            onChange={(e) => setUserDescription(e.target.value)}
            placeholder="Context, scope, and what contributors can expect once unlocked."
            required
          />
          {(pmCategory || pmMarketId) && (
            <div className="input-row" style={{ marginTop: 8 }}>
              {pmCategory && <span className="pill">Category: {pmCategory}</span>}
              {pmMarketId && <span className="pill">Polymarket ID: {pmMarketId}</span>}
            </div>
          )}
        </label>

        <div className="panel" style={{ padding: 16 }}>
          <div className="section-header">
            <h3 className="section-title">Attachments</h3>
            <span className="pill">Images + PDF · Max 3</span>
          </div>
          <p className="muted" style={{ marginTop: 6 }}>
            Add up to three files (5MB each). Attachments appear as previews on the pool card.
          </p>
          <div className="input-row" style={{ marginTop: 10 }}>
            <input
              className="input"
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={handleAttachmentSelect}
            />
            <span className="pill">{attachments.length}/3</span>
          </div>
          {attachmentStatus && <div className="message" style={{ marginTop: 8 }}>{attachmentStatus}</div>}
          {attachments.length > 0 && (
            <div className="attachment-list" style={{ marginTop: 10 }}>
              {attachments.map((file, index) => (
                <div className="attachment-item" key={`${file.name}-${index}`}>
                  <span className="pill">{file.type.startsWith("image/") ? "Image" : "PDF"}</span>
                  <span className="muted">{file.name}</span>
                  <span className="muted">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  <button type="button" className="button tiny" onClick={() => removeAttachment(index)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel" style={{ padding: 16 }}>
          <div className="section-header">
            <h3 className="section-title">Funding rules</h3>
            <span className="pill">Threshold + floor</span>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <label className="block">
              <span className="muted">Funding threshold (USDC, 6 decimals)</span>
              <input
                className="input"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                type="number"
                min="0"
                step="1"
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
                step="1"
                required
              />
            </label>
          </div>

          <div className="pool-progress" style={{ marginTop: 12 }}>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
              <div className="progress-marker" style={{ left: `${minContributionPercent}%` }} />
            </div>
            <div className="progress-meta">
              <span className="stat">Raised: 0 {CURRENCY_SYMBOL}</span>
              <span className="stat">Threshold: {threshold || "0"} {CURRENCY_SYMBOL}</span>
              <span className="stat">Decrypt floor: {minContribution || "0"} {CURRENCY_SYMBOL}</span>
            </div>
          </div>
        </div>

        <div className="panel" style={{ padding: 16 }}>
          <div className="section-header">
            <h3 className="section-title">Encrypted intel</h3>
            <span className="pill">Step 2</span>
          </div>
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
        </div>

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
