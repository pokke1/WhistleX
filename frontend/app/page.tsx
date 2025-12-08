"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchIntel, fetchPools } from "../lib/api";
import { decryptWithTaco } from "../lib/taco";
import { describePolicy } from "../lib/tacoClient";

interface Pool {
  id: string;
  investigator: string;
  threshold: string;
  minContributionForDecrypt: string;
  policyId?: string;
  deadline?: string;
  ciphertext?: string;
}

interface IntelPayload {
  ciphertext: string;
  messageKit: string;
}

export default function HomePage() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [intelByPool, setIntelByPool] = useState<Record<string, IntelPayload | null>>({});
  const [decryptedByPool, setDecryptedByPool] = useState<Record<string, string>>({});
  const [statusByPool, setStatusByPool] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchPools()
      .then(setPools)
      .catch((err) => setError(err.message));
  }, []);

  async function handleFetchIntel(poolId: string) {
    setStatusByPool((prev) => ({ ...prev, [poolId]: "Loading intel..." }));
    try {
      const intel = await fetchIntel(poolId);
      setIntelByPool((prev) => ({ ...prev, [poolId]: intel }));
      setStatusByPool((prev) => ({ ...prev, [poolId]: intel ? "Intel loaded" : "No intel uploaded yet" }));
    } catch (err: any) {
      setStatusByPool((prev) => ({ ...prev, [poolId]: err.message || "Failed to fetch intel" }));
    }
  }

  async function handleDecrypt(pool: Pool) {
    const intel = intelByPool[pool.id];
    if (!intel) {
      setStatusByPool((prev) => ({ ...prev, [pool.id]: "Load intel first" }));
      return;
    }

    setStatusByPool((prev) => ({ ...prev, [pool.id]: "Requesting decryption from TACo..." }));
    try {
      const plaintext = await decryptWithTaco({
        poolAddress: pool.id,
        minContributionForDecrypt: pool.minContributionForDecrypt,
        messageKit: intel.messageKit
      });
      setDecryptedByPool((prev) => ({ ...prev, [pool.id]: plaintext }));
      setStatusByPool((prev) => ({ ...prev, [pool.id]: "Decrypted with TACo" }));
    } catch (err: any) {
      setStatusByPool((prev) => ({ ...prev, [pool.id]: err.message || "Failed to decrypt" }));
    }
  }

  return (
    <main className="p-8 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">WhistleX</h1>
        <p className="text-gray-700">
          Decentralized, TACo-protected marketplace for funding encrypted intelligence drops.
        </p>
        <div className="flex gap-4">
          <Link className="text-blue-600 underline" href="/create">
            Create pool
          </Link>
          <a className="text-blue-600 underline" href="https://taco.xyz" target="_blank">
            TACo docs
          </a>
        </div>
      </header>

      {error && <p className="text-red-600">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Open pools</h2>
        {pools.length === 0 && <p className="text-gray-600">No pools indexed yet.</p>}
        <ul className="space-y-2">
          {pools.map((pool) => {
            const intel = intelByPool[pool.id];
            const decrypted = decryptedByPool[pool.id];
            const status = statusByPool[pool.id];
            return (
              <li key={pool.id} className="border rounded p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Pool {pool.id}</p>
                    <p className="text-sm text-gray-700">Investigator: {pool.investigator}</p>
                    <p className="text-sm text-gray-700">Threshold: {pool.threshold} USDC</p>
                    <p className="text-sm text-gray-700">Contribution to decrypt: {pool.minContributionForDecrypt} USDC</p>
                    {pool.deadline && (
                      <p className="text-sm text-gray-700">Deadline: {new Date(Number(pool.deadline) * 1000).toLocaleString()}</p>
                    )}
                    {pool.ciphertext && <p className="text-xs text-gray-600 truncate">Ciphertext: {pool.ciphertext}</p>}
                    <p className="text-xs text-gray-600 mt-1">Policy: {describePolicy(pool.policyId as any)}</p>
                  </div>
                  <Link className="text-blue-600 underline" href={`/pool/${pool.id}`}>
                    View details
                  </Link>
                </div>

                <div className="flex gap-3 flex-wrap">
                  <button
                    className="bg-gray-200 px-3 py-1 rounded"
                    onClick={() => handleFetchIntel(pool.id)}
                  >
                    Load intel
                  </button>
                  <button
                    className="bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50"
                    disabled={!intel}
                    onClick={() => handleDecrypt(pool)}
                  >
                    Decrypt with TACo
                  </button>
                  {status && <span className="text-sm text-gray-700">{status}</span>}
                </div>

                {intel && (
                  <div className="bg-gray-50 border rounded p-2 text-xs space-y-1">
                    <p className="font-semibold">MessageKit</p>
                    <textarea className="w-full min-h-[80px]" readOnly value={intel.messageKit} />
                  </div>
                )}

                {decrypted && (
                  <div className="bg-green-50 border border-green-200 rounded p-2 text-sm space-y-1">
                    <p className="font-semibold">Decrypted intel</p>
                    <pre className="whitespace-pre-wrap break-words text-xs">{decrypted}</pre>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
