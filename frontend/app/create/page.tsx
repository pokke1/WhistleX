"use client";

import { useState } from "react";
import { createPool, uploadIntel } from "../../lib/api";
import { createPoolOnchain, normalizeHex } from "../../lib/onchain";
import { buildTacoCondition, encryptWithTaco } from "../../lib/taco";

function toUnixTimestamp(input: string) {
  const value = Date.parse(input);
  if (Number.isNaN(value)) return "";
  return Math.floor(value / 1000).toString();
}

export default function CreatePoolPage() {
  const [poolId, setPoolId] = useState("");
  const [investigator, setInvestigator] = useState("");
  const [threshold, setThreshold] = useState("0");
  const [minContribution, setMinContribution] = useState("0");
  const [ciphertext, setCiphertext] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [messageKit, setMessageKit] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Submitting pool to Base Sepolia...");
    setMessageKit(null);

    const deadlineTimestamp = toUnixTimestamp(deadline);
    if (!deadlineTimestamp) {
      setStatus("Deadline is invalid");
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
      setStatus("Recording pool metadata and policy...");

      const poolRecord = await createPool({
        id: onchain.poolAddress,
        investigator: onchain.investigator,
        threshold,
        minContributionForDecrypt: minContribution,
        deadline: deadlineTimestamp,
        ciphertext: normalizedCipher
      });

      const policy = poolRecord.policy || buildTacoCondition(onchain.poolAddress, minContribution);
      setStatus("Encrypting ciphertext with TACo...");

      const kit = await encryptWithTaco({
        privateKey,
        poolAddress: onchain.poolAddress,
        minContributionForDecrypt: minContribution,
        policy,
        secretMessageHex: normalizedCipher
      });

      setMessageKit(kit);

      await uploadIntel({ poolId: onchain.poolAddress, ciphertext: normalizedCipher, messageKit: kit });

      setStatus("Pool created, TACo policy recorded, and intel stored");
      console.log("Stored policy", policy);
    } catch (err: any) {
      setStatus(err.message || "Failed to create pool");
    }
  }

  return (
    <main className="p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Investigator: create a TACo-protected Intel Pool</h1>
      <p className="text-sm text-gray-700 max-w-3xl">
        This flow creates a pool on Base Sepolia, embeds the encrypted ciphertext into the transaction calldata, and uses TACo on
        Polygon Amoy to encrypt the investigator private key. The backend only indexes the ciphertext and MessageKit; the private
        key never leaves the browser.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3 max-w-3xl">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm">Funding threshold (USDC, 6 decimals)</span>
            <input
              className="border rounded p-2 w-full"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm">Minimum contribution to decrypt (USDC, 6 decimals)</span>
            <input
              className="border rounded p-2 w-full"
              value={minContribution}
              onChange={(e) => setMinContribution(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              required
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm">Deadline</span>
          <input
            className="border rounded p-2 w-full"
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            required
          />
        </label>

        <label className="block">
          <span className="text-sm">Ciphertext (hex-encoded intel blob)</span>
          <textarea
            className="border rounded p-2 w-full min-h-[120px]"
            value={ciphertext}
            onChange={(e) => setCiphertext(e.target.value)}
            placeholder="0x..."
            required
          />
        </label>

        <label className="block">
          <span className="text-sm">Investigator private key (used as DEK for TACo)</span>
          <input
            className="border rounded p-2 w-full"
            type="password"
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            placeholder="0x..."
            required
          />
        </label>

        <button className="bg-blue-600 text-white px-4 py-2 rounded" type="submit">
          Create pool and encrypt
        </button>
      </form>

      {poolId && (
        <div className="bg-gray-100 rounded p-3 text-sm">
          <p className="font-semibold">Pool deployed</p>
          <p>Address: {poolId}</p>
          <p>Investigator: {investigator}</p>
        </div>
      )}

      {messageKit && (
        <div className="bg-gray-50 border rounded p-3 text-sm">
          <p className="font-semibold">TACo MessageKit</p>
          <textarea className="w-full min-h-[100px] text-xs" readOnly value={messageKit} />
        </div>
      )}

      {status && <p className="text-sm text-gray-700">{status}</p>}
    </main>
  );
}
