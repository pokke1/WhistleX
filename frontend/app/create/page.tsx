"use client";

import { useState } from "react";
import { createPool, uploadIntel } from "../../lib/api";

export default function CreatePoolPage() {
  const [poolId, setPoolId] = useState("");
  const [investigator, setInvestigator] = useState("");
  const [threshold, setThreshold] = useState("0");
  const [minContribution, setMinContribution] = useState("0");
  const [cid, setCid] = useState("");
  const [dek, setDek] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    try {
      await createPool({
        id: poolId,
        investigator,
        threshold,
        minContributionForDecrypt: minContribution
      });
      if (cid && dek) {
        await uploadIntel({ poolId, cid, dekCiphertext: dek });
      }
      setStatus("Pool created and intel registered");
    } catch (err: any) {
      setStatus(err.message || "Failed to create pool");
    }
  }

  return (
    <main className="p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Create a new Intel Pool</h1>
      <form onSubmit={handleSubmit} className="space-y-3 max-w-xl">
        <label className="block">
          <span className="text-sm">Pool address / ID</span>
          <input
            className="border rounded p-2 w-full"
            value={poolId}
            onChange={(e) => setPoolId(e.target.value)}
            placeholder="0xpool"
            required
          />
        </label>
        <label className="block">
          <span className="text-sm">Investigator address</span>
          <input
            className="border rounded p-2 w-full"
            value={investigator}
            onChange={(e) => setInvestigator(e.target.value)}
            placeholder="0xinvestigator"
            required
          />
        </label>
        <label className="block">
          <span className="text-sm">Funding threshold (wei)</span>
          <input
            className="border rounded p-2 w-full"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            type="number"
            min="0"
            required
          />
        </label>
        <label className="block">
          <span className="text-sm">Minimum contribution to decrypt (wei)</span>
          <input
            className="border rounded p-2 w-full"
            value={minContribution}
            onChange={(e) => setMinContribution(e.target.value)}
            type="number"
            min="0"
            required
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-sm">Intel CID (encrypted blob)</span>
            <input
              className="border rounded p-2 w-full"
              value={cid}
              onChange={(e) => setCid(e.target.value)}
              placeholder="ipfs://..."
            />
          </label>
          <label className="block">
            <span className="text-sm">Encrypted DEK</span>
            <input
              className="border rounded p-2 w-full"
              value={dek}
              onChange={(e) => setDek(e.target.value)}
              placeholder="base64 ciphertext"
            />
          </label>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded" type="submit">
          Save pool
        </button>
      </form>
      {status && <p className="text-sm text-gray-700">{status}</p>}
    </main>
  );
}
