"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPool, requestPolicyPreview, uploadIntel } from "../../lib/api";
import { describePolicy, TacoPolicy } from "../../lib/tacoClient";
import { connectWallet, WalletConnection } from "../../lib/wallet";

export default function CreatePoolPage() {
  const [poolId, setPoolId] = useState("");
  const [threshold, setThreshold] = useState("0");
  const [minContribution, setMinContribution] = useState("0");
  const [cid, setCid] = useState("");
  const [dek, setDek] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletConnection | null>(null);
  const [policy, setPolicy] = useState<TacoPolicy | null>(null);
  const [loadingPolicy, setLoadingPolicy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleConnectWallet() {
    try {
      const connection = await connectWallet();
      setWallet(connection);
      setStatus(`Connected as ${connection.account}`);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to connect wallet");
    }
  }

  async function previewPolicy(currentPoolId: string, min: string) {
    if (!currentPoolId || !min) {
      setPolicy(null);
      return;
    }
    setLoadingPolicy(true);
    try {
      const response = await requestPolicyPreview({
        poolId: currentPoolId,
        minContributionForDecrypt: min
      });
      setPolicy(response);
    } catch (err: any) {
      setError(err.message || "Unable to build TACo policy");
    } finally {
      setLoadingPolicy(false);
    }
  }

  useEffect(() => {
    previewPolicy(poolId, minContribution);
  }, [poolId, minContribution]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setSubmitting(true);

    try {
      const activeWallet = wallet ?? (await connectWallet());
      setWallet(activeWallet);

      const ensuredPolicy =
        policy ??
        (await requestPolicyPreview({ poolId, minContributionForDecrypt: minContribution }));
      setPolicy(ensuredPolicy);

      if (!cid || !dek) {
        throw new Error("Provide the encrypted intel CID and DEK ciphertext to publish");
      }

      await createPool({
        id: poolId,
        investigator: activeWallet.account,
        threshold,
        minContributionForDecrypt: minContribution
      });

      await uploadIntel({ poolId, cid, dekCiphertext: dek, policyId: ensuredPolicy.hash });

      setStatus("Pool created, TACo policy bound, and intel registered with one click.");
    } catch (err: any) {
      setError(err.message || "Failed to create pool");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="p-8 space-y-5">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Investigator one-click submission</h1>
        <p className="text-gray-700">
          Connect your wallet, preview the canonical TACo access policy, and publish encrypted intel
          with a single submission.
        </p>
      </div>

      <div className="flex items-center gap-3 p-4 border rounded">
        <div className="flex-1">
          <p className="font-semibold">Wallet</p>
          <p className="text-sm text-gray-700">
            {wallet?.account ? `Connected as ${wallet.account}` : "No wallet connected"}
          </p>
        </div>
        <button
          className="bg-gray-900 text-white px-4 py-2 rounded"
          type="button"
          onClick={handleConnectWallet}
        >
          {wallet?.account ? "Reconnect" : "Connect wallet"}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 max-w-2xl">
        <fieldset className="space-y-2 border rounded p-4">
          <legend className="px-1 text-sm font-semibold">Pool configuration</legend>
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
        </fieldset>

        <fieldset className="space-y-2 border rounded p-4">
          <legend className="px-1 text-sm font-semibold">Encrypted intel</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label className="block">
              <span className="text-sm">Intel CID (encrypted blob)</span>
              <input
                className="border rounded p-2 w-full"
                value={cid}
                onChange={(e) => setCid(e.target.value)}
                placeholder="ipfs://..."
                required
              />
            </label>
            <label className="block">
              <span className="text-sm">Encrypted DEK</span>
              <input
                className="border rounded p-2 w-full"
                value={dek}
                onChange={(e) => setDek(e.target.value)}
                placeholder="base64 ciphertext"
                required
              />
            </label>
          </div>
          <p className="text-xs text-gray-700">
            We only store encrypted artifacts. TACo will release the DEK client-side once the pool is
            unlocked and the contribution threshold is met.
          </p>
        </fieldset>

        <div className="border rounded p-4 space-y-2 bg-gray-50">
          <p className="font-semibold">Canonical TACo policy</p>
          <p className="text-sm text-gray-700 whitespace-pre-line">
            {loadingPolicy ? "Loading policy preview…" : describePolicy(policy)}
          </p>
          {policy && <p className="text-xs text-gray-600">Policy hash: {policy.hash}</p>}
        </div>

        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Submitting…" : "Publish encrypted intel"}
        </button>
      </form>

      {status && <p className="text-sm text-green-700">{status}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </main>
  );
}
