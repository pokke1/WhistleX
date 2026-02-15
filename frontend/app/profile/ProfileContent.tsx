"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { utils } from "ethers";
import { fetchProfile, type PoolSummary, type ProfilePayload } from "../../lib/api";

const CURRENCY_SYMBOL = "USDC";
const DEFAULT_DECIMALS = Number(process.env.NEXT_PUBLIC_USDC_DECIMALS || "6");

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

function toStars(average: number) {
  const raw = ((average + 1) / 2) * 5;
  return Math.max(0, Math.min(5, raw));
}

export default function ProfileContent({
  address,
  isOwnProfile
}: {
  address: string;
  isOwnProfile: boolean;
}) {
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setStatus(null);
    fetchProfile(address)
      .then(setProfile)
      .catch((err: any) => setStatus(err?.message || "Failed to load profile"));
  }, [address]);

  const averageStars = useMemo(() => toStars(profile?.vendorRating?.average || 0), [profile?.vendorRating?.average]);

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <h1 className="title">{isOwnProfile ? "Your profile" : "Vendor profile"}</h1>
          <p className="subtitle">Track created pools, contributions, and marketplace reputation.</p>
        </div>
        <div className="pill">{shortAddress(address)}</div>
      </header>

      {status && <div className="message">{status}</div>}
      {!profile && !status && <div className="message">Loading profile...</div>}

      {profile && (
        <>
          <section className="panel">
            <div className="section-header">
              <h2 className="section-title">Vendor rating</h2>
              <span className="pill">{averageStars.toFixed(2)} / 5 stars</span>
            </div>
            <div className="dashboard-grid">
              <div className="dashboard-card">
                <p className="muted">Average rating</p>
                <h3 className="metric">{averageStars.toFixed(2)} / 5</h3>
              </div>
              <div className="dashboard-card">
                <p className="muted">Total votes</p>
                <h3 className="metric">{profile.vendorRating.totalVotes}</h3>
              </div>
              <div className="dashboard-card">
                <p className="muted">Rating score</p>
                <h3 className="metric">{profile.vendorRating.score}</h3>
              </div>
              <div className="dashboard-card">
                <p className="muted">Pools created</p>
                <h3 className="metric">{profile.createdPools.length}</h3>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="section-header">
              <h2 className="section-title">Pools contributed to</h2>
              <span className="pill">{profile.contributedPools.length}</span>
            </div>
            {profile.contributedPools.length === 0 ? (
              <div className="message">No contributions indexed for this wallet.</div>
            ) : (
              <div className="list-grid">
                {profile.contributedPools.map((pool) => (
                  <PoolCard key={pool.id} pool={pool} />
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="section-header">
              <h2 className="section-title">Pools created</h2>
              <span className="pill">{profile.createdPools.length}</span>
            </div>
            {profile.createdPools.length === 0 ? (
              <div className="message">No pools created yet.</div>
            ) : (
              <div className="list-grid">
                {profile.createdPools.map((pool) => (
                  <PoolCard key={pool.id} pool={pool} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function PoolCard({ pool }: { pool: PoolSummary }) {
  return (
    <div className="list-card">
      <div>
        <p className="muted">Pool</p>
        <h3>{pool.title || shortAddress(pool.id)}</h3>
        {pool.description && <p className="muted">{pool.description}</p>}
        {pool.contributedAmount && (
          <div className="stat-row" style={{ marginTop: 8 }}>
            <span className="stat">
              Contribution: {formatAmount(pool.contributedAmount)} {CURRENCY_SYMBOL}
            </span>
          </div>
        )}
      </div>
      <Link className="button" href={`/pool/${pool.id}`}>
        View pool
      </Link>
    </div>
  );
}
