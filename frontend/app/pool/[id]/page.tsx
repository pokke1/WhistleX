"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchPools } from "../../../lib/api";
import { describePolicy } from "../../../lib/tacoClient";
import { utils } from "ethers";

const CURRENCY_SYMBOL = "USDC";
const DEFAULT_DECIMALS = Number(process.env.NEXT_PUBLIC_USDC_DECIMALS || "6");

function formatAmount(value: string) {
  try {
    return utils.formatUnits(value, DEFAULT_DECIMALS);
  } catch {
    return value;
  }
}

interface Pool {
  id: string;
  investigator: string;
  threshold: string;
  minContributionForDecrypt: string;
  title?: string;
  description?: string;
  policyId?: string;
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

  if (error) return <main className="app-shell">{error}</main>;
  if (!pool) return <main className="app-shell">Loading...</main>;

  return (
    <main className="app-shell space-y-4">
      <div className="panel space-y-2">
        <h1 className="title">{pool.title || `Pool ${pool.id}`}</h1>
        {!pool.title && <p className="muted">{pool.id}</p>}
        {pool.description && <p className="muted">{pool.description}</p>}
        <p className="muted">Investigator: {pool.investigator}</p>
        <p className="muted">Threshold: {formatAmount(pool.threshold)} {CURRENCY_SYMBOL}</p>
        <p className="muted">Contribution to decrypt: {formatAmount(pool.minContributionForDecrypt)} {CURRENCY_SYMBOL}</p>
        <p className="muted">{describePolicy(pool.policyId as any)}</p>
      </div>

      <section className="panel space-y-2">
        <h2 className="section-title">Contributor actions</h2>
        <div className="muted">
          <ol className="list-decimal list-inside space-y-1">
            <li>Contribute via the IntelPool contract.</li>
            <li>Wait for the pool to reach the funding threshold.</li>
            <li>Use TACo client-side to decrypt the DEK when eligible.</li>
          </ol>
        </div>
      </section>
    </main>
  );
}
