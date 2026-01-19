"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BigNumber, utils } from "ethers";
import { fetchPools } from "../../lib/api";
import { fetchPoolState, PoolOnchainState } from "../../lib/onchain";
import { useWallet } from "../components/WalletProvider";

const CURRENCY_SYMBOL = "USDC";
const DEFAULT_DECIMALS = Number(process.env.NEXT_PUBLIC_USDC_DECIMALS || "6");

interface Pool {
  id: string;
  investigator: string;
  threshold: string;
  minContributionForDecrypt: string;
  policyId?: string;
  deadline?: string;
  ciphertext?: string;
  title?: string;
  description?: string;
}

function formatAmount(value?: string, decimals: number = DEFAULT_DECIMALS) {
  if (!value) return "-";
  try {
    return utils.formatUnits(value, decimals);
  } catch {
    return value;
  }
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function ProfilePage() {
  const { walletAddress } = useWallet();
  const [pools, setPools] = useState<Pool[]>([]);
  const [onchainStateByPool, setOnchainStateByPool] = useState<Record<string, PoolOnchainState>>({});
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchPools()
      .then(setPools)
      .catch((err) => setStatus(err?.message || "Failed to load pools"));
  }, []);

  useEffect(() => {
    if (!walletAddress || pools.length === 0) return;
    let mounted = true;
    setStatus(null);

    Promise.all(
      pools.map(async (pool) => ({
        id: pool.id,
        state: await fetchPoolState(pool.id, walletAddress)
      }))
    )
      .then((results) => {
        if (!mounted) return;
        const nextState: Record<string, PoolOnchainState> = {};
        results.forEach(({ id, state }) => {
          nextState[id] = state;
        });
        setOnchainStateByPool(nextState);
      })
      .catch((err) => {
        if (!mounted) return;
        setStatus(err?.message || "Failed to load on-chain stats");
      });

    return () => {
      mounted = false;
    };
  }, [walletAddress, pools]);

  const createdPools = useMemo(() => {
    if (!walletAddress) return [];
    const lower = walletAddress.toLowerCase();
    return pools.filter((pool) => pool.investigator?.toLowerCase() === lower);
  }, [pools, walletAddress]);

  const contributedPools = useMemo(() => {
    if (!walletAddress) return [];
    return pools.filter((pool) => {
      const contribution = onchainStateByPool[pool.id]?.userContribution;
      return contribution && BigNumber.from(contribution).gt(0);
    });
  }, [pools, onchainStateByPool, walletAddress]);

  const unlockablePools = useMemo(() => {
    if (!walletAddress) return [];
    return pools.filter((pool) => onchainStateByPool[pool.id]?.canDecrypt);
  }, [pools, onchainStateByPool, walletAddress]);

  const totalContributed = useMemo(() => {
    return contributedPools.reduce((acc, pool) => {
      const contribution = onchainStateByPool[pool.id]?.userContribution;
      if (!contribution) return acc;
      return acc.add(contribution);
    }, BigNumber.from(0));
  }, [contributedPools, onchainStateByPool]);

  const totalContributedDisplay = formatAmount(totalContributed.toString(), DEFAULT_DECIMALS);

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <h1 className="title">Profile dashboard</h1>
          <p className="subtitle">
            Track your wallet activity, unlock status, and investigator pools in one place.
          </p>
        </div>
        <div className="pill">Wallet</div>
      </header>

      {!walletAddress && (
        <div className="panel">
          <h2 className="section-title">Connect to view your dashboard</h2>
          <p className="muted">
            Use the wallet button in the navigation bar to connect MetaMask, Phantom, or another EVM wallet.
          </p>
        </div>
      )}

      {walletAddress && (
        <>
          <section className="panel">
            <div className="section-header">
              <h2 className="section-title">Wallet overview</h2>
              <span className="pill">{shortAddress(walletAddress)}</span>
            </div>
            <div className="dashboard-grid">
              <div className="dashboard-card">
                <p className="muted">Total contributed</p>
                <h3 className="metric">{totalContributedDisplay} {CURRENCY_SYMBOL}</h3>
              </div>
              <div className="dashboard-card">
                <p className="muted">Pools funded</p>
                <h3 className="metric">{contributedPools.length}</h3>
              </div>
              <div className="dashboard-card">
                <p className="muted">Unlock rights</p>
                <h3 className="metric">{unlockablePools.length}</h3>
              </div>
              <div className="dashboard-card">
                <p className="muted">Pools created</p>
                <h3 className="metric">{createdPools.length}</h3>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="section-header">
              <h2 className="section-title">Pools you can unlock</h2>
              <span className="pill">{unlockablePools.length}</span>
            </div>
            {unlockablePools.length === 0 ? (
              <div className="message">No pools meet the decrypt threshold yet.</div>
            ) : (
              <div className="list-grid">
                {unlockablePools.map((pool) => (
                  <div key={pool.id} className="list-card">
                    <div>
                      <p className="muted">Pool</p>
                      <h3>{pool.title || shortAddress(pool.id)}</h3>
                      {pool.description && <p className="muted">{pool.description}</p>}
                    </div>
                    <Link className="button cta" href={`/pool/${pool.id}`}>
                      Open pool
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="section-header">
              <h2 className="section-title">Your contributions</h2>
              <span className="pill">{contributedPools.length}</span>
            </div>
            {contributedPools.length === 0 ? (
              <div className="message">No contributions yet. Explore pools to start backing intel.</div>
            ) : (
              <div className="list-grid">
                {contributedPools.map((pool) => {
                  const state = onchainStateByPool[pool.id];
                  const decimals = state?.currencyDecimals ?? DEFAULT_DECIMALS;
                  const contribution = formatAmount(state?.userContribution, decimals);
                  const raised = formatAmount(state?.totalContributions, decimals);
                  return (
                    <div key={pool.id} className="list-card">
                      <div>
                        <p className="muted">Pool</p>
                        <h3>{pool.title || shortAddress(pool.id)}</h3>
                        <div className="stat-row" style={{ marginTop: 8 }}>
                          <span className="stat">Your contribution: {contribution} {CURRENCY_SYMBOL}</span>
                          <span className="stat">Raised: {raised} {CURRENCY_SYMBOL}</span>
                        </div>
                      </div>
                      <Link className="button" href={`/pool/${pool.id}`}>
                        View activity
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="section-header">
              <h2 className="section-title">Pools you created</h2>
              <span className="pill">{createdPools.length}</span>
            </div>
            {createdPools.length === 0 ? (
              <div className="message">No investigator pools yet. Create your first intel pool.</div>
            ) : (
              <div className="list-grid">
                {createdPools.map((pool) => (
                  <div key={pool.id} className="list-card">
                    <div>
                      <p className="muted">Pool</p>
                      <h3>{pool.title || shortAddress(pool.id)}</h3>
                      {pool.description && <p className="muted">{pool.description}</p>}
                    </div>
                    <Link className="button" href={`/pool/${pool.id}`}>
                      Manage
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {status && <div className="message">{status}</div>}
    </main>
  );
}
