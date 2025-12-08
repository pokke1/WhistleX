"use client";

import { useState } from "react";
import { runTacoTestFlow, TacoTestResult } from "../../lib/tacoTestFlow";

export default function TacoTestPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<TacoTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setStatus("Running TACo test flow...");
    setError(null);
    setResult(null);

    try {
      const output = await runTacoTestFlow();
      setResult(output);
      setStatus("Completed TACo flow.");
    } catch (err: any) {
      setStatus(null);
      setError(err?.message || "Failed to run flow");
    }
  }

  return (
    <main className="p-8 space-y-4">
      <h1 className="text-2xl font-semibold">TACo request test harness</h1>
      <p className="text-sm text-gray-700 max-w-3xl">
        This helper spins up a fresh IntelPool with an extremely low threshold, retrieves the TACo message kit, and validates
        decryption before and after the contribution threshold is reached using the developer key configured in the environment.
      </p>

      <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={handleRun}>
        Run TACo flow
      </button>

      {status && <p className="text-sm text-gray-800">{status}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <section className="space-y-2 border rounded p-4 bg-gray-50">
          <h2 className="text-lg font-semibold">Flow output</h2>
          <p className="text-xs break-all">Pool address: {result.poolAddress}</p>
          <p className="text-xs break-all">Factory tx hash: {result.factoryTxHash}</p>
          <p className="text-xs break-all">Contribution tx hash: {result.contributionTxHash}</p>
          <p className="text-xs break-all">Contributor address: {result.contributorAddress}</p>
          <p className="text-xs">Threshold (wei): {result.thresholdWei}</p>
          <p className="text-xs">Min contribution (wei): {result.minContributionWei}</p>
          <p className="text-xs">Unlocked after contribute: {String(result.unlockedAfterContribute)}</p>
          {result.initialDecryptError && (
            <p className="text-xs text-amber-700">Pre-unlock decrypt error: {result.initialDecryptError}</p>
          )}
          <div className="space-y-1">
            <p className="text-sm font-semibold">Message kit</p>
            <textarea className="w-full min-h-[120px] text-xs" readOnly value={result.messageKit} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">Decrypted intel after unlock</p>
            <textarea
              className="w-full min-h-[120px] text-xs"
              readOnly
              value={result.decryptedPlaintext || "(no plaintext returned)"}
            />
          </div>
        </section>
      )}
    </main>
  );
}
