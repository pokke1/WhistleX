"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchPools } from "../lib/api";
import { TacoPolicy, describePolicy } from "../lib/tacoClient";

interface Pool {
  id: string;
  investigator: string;
  threshold: string;
  minContributionForDecrypt: string;
  policy?: TacoPolicy;
}

export default function HomePage() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPools()
      .then(setPools)
      .catch((err) => setError(err.message));
  }, []);

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
          {pools.map((pool) => (
            <li key={pool.id} className="border rounded p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Pool {pool.id}</p>
                  <p className="text-sm text-gray-700">Investigator: {pool.investigator}</p>
                  <p className="text-sm text-gray-700">Threshold: {pool.threshold} wei</p>
                  <p className="text-sm text-gray-700">Contribution to decrypt: {pool.minContributionForDecrypt} wei</p>
                  <p className="text-xs text-gray-600 mt-1 whitespace-pre-line">{describePolicy(pool.policy)}</p>
                </div>
                <Link className="text-blue-600 underline" href={`/pool/${pool.id}`}>
                  View details
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
