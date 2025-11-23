"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchPools } from "../../../lib/api";
import { TacoPolicy, describePolicy } from "../../../lib/tacoClient";

interface Pool {
  id: string;
  investigator: string;
  threshold: string;
  minContributionForDecrypt: string;
  policy?: TacoPolicy;
}

export default function PoolDetailPage() {
  const params = useParams();
  const poolId = params?.id as string;
  const [pool, setPool] = useState<Pool | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPools()
      .then((data) => {
        const match = data.find((p: Pool) => p.id === poolId);
        if (!match) {
          setError("Pool not found");
        } else {
          setPool(match);
        }
      })
      .catch((err) => setError(err.message));
  }, [poolId]);

  if (error) return <main className="p-8">{error}</main>;
  if (!pool) return <main className="p-8">Loading...</main>;

  return (
    <main className="p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Pool {pool.id}</h1>
      <p>Investigator: {pool.investigator}</p>
      <p>Threshold: {pool.threshold} wei</p>
      <p>Contribution to decrypt: {pool.minContributionForDecrypt} wei</p>
      <p className="text-sm text-gray-700 whitespace-pre-line">{describePolicy(pool.policy)}</p>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Contributor actions</h2>
        <ol className="list-decimal list-inside space-y-1 text-gray-700">
          <li>Contribute via the IntelPool contract.</li>
          <li>Wait for the pool to reach the funding threshold.</li>
          <li>Use TACo client-side to decrypt the DEK when eligible.</li>
        </ol>
      </section>
    </main>
  );
}
