"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { utils } from "ethers";
import { fetchProfile, type PoolSummary, type ProfilePayload } from "../../lib/api";
import { fetchPolymarketScorecard, type PolymarketScorecardData } from "../../lib/polymarket";

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
  const [polymarket, setPolymarket] = useState<PolymarketScorecardData | null>(null);
  const [polymarketStatus, setPolymarketStatus] = useState<string | null>(null);
  const [vendorTab, setVendorTab] = useState<"created" | "contributed">("created");

  useEffect(() => {
    setStatus(null);
    fetchProfile(address)
      .then(setProfile)
      .catch((err: any) => setStatus(err?.message || "Failed to load profile"));
  }, [address]);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    setPolymarket(null);
    setPolymarketStatus(null);
    fetchPolymarketScorecard(address)
      .then((data) => {
        if (!active) return;
        setPolymarket(data);
      })
      .catch((err: any) => {
        if (!active) return;
        setPolymarketStatus(err?.message || "Failed to load Polymarket history");
      });
    return () => {
      active = false;
    };
  }, [address, profile]);

  const averageStars = useMemo(() => toStars(profile?.vendorRating?.average || 0), [profile?.vendorRating?.average]);
  const formatUsd = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2
      }),
    []
  );
  const formatSignedUsd = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
        signDisplay: "exceptZero"
      }),
    []
  );
  const topCategories = useMemo(() => {
    if (!polymarket) return [];
    return [...polymarket.categories]
      .sort((a, b) => (b.volumeUsdc || 0) - (a.volumeUsdc || 0))
      .slice(0, 3);
  }, [polymarket]);

  return (
    <main className="app-shell profile-shell">
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
            <p className="muted" style={{ marginTop: 6 }}>
              Rating {averageStars.toFixed(2)} / 5 • {profile.vendorRating.totalVotes} votes • Score {profile.vendorRating.score} •{" "}
              {profile.createdPools.length} pools created
            </p>
            <div className="input-row" style={{ marginTop: 12 }}>
              <button
                className={`button ${vendorTab === "created" ? "cta" : ""}`}
                onClick={() => setVendorTab("created")}
              >
                Pools created
              </button>
              <button
                className={`button ${vendorTab === "contributed" ? "cta" : ""}`}
                onClick={() => setVendorTab("contributed")}
              >
                Pools contributed
              </button>
              <span className="pill">
                {vendorTab === "created" ? profile.createdPools.length : profile.contributedPools.length}
              </span>
            </div>
            {vendorTab === "created" ? (
              profile.createdPools.length === 0 ? (
                <div className="message" style={{ marginTop: 12 }}>No pools created yet.</div>
              ) : (
                <div className="list-grid list-scroll" style={{ marginTop: 12 }}>
                  {profile.createdPools.map((pool) => (
                    <PoolCard key={pool.id} pool={pool} />
                  ))}
                </div>
              )
            ) : profile.contributedPools.length === 0 ? (
              <div className="message" style={{ marginTop: 12 }}>No contributions indexed for this wallet.</div>
            ) : (
              <div className="list-grid list-scroll" style={{ marginTop: 12 }}>
                {profile.contributedPools.map((pool) => (
                  <PoolCard key={pool.id} pool={pool} />
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="section-header">
              <h2 className="section-title">Polymarket scorecard</h2>
              <span className="pill">Auto-loaded</span>
            </div>
            {polymarketStatus && <div className="message">{polymarketStatus}</div>}
            {!polymarket && !polymarketStatus && <div className="message">Loading Polymarket history...</div>}
            {polymarket && (
              <>
                <div className="mobile-only polymarket-summary">
                  <div className="polymarket-summary-item">
                    <p className="muted">Trades</p>
                    <p className="metric">{polymarket.totalTrades}</p>
                  </div>
                  <div className="polymarket-summary-item">
                    <p className="muted">Volume</p>
                    <p className="metric">{formatUsd.format(polymarket.totalVolumeUsdc)}</p>
                  </div>
                  <div className="polymarket-summary-item">
                    <p className="muted">PnL</p>
                    <p className={`metric ${polymarket.totalPnl == null ? "" : polymarket.totalPnl >= 0 ? "pnl-positive" : "pnl-negative"}`}>
                      {polymarket.totalPnl == null ? "N/A" : formatSignedUsd.format(polymarket.totalPnl)}
                    </p>
                  </div>
                </div>

                <div className="dashboard-grid desktop-only">
                  <div className="dashboard-card">
                    <p className="muted">Trades tracked</p>
                    <h3 className="metric">{polymarket.totalTrades}</h3>
                  </div>
                  <div className="dashboard-card">
                    <p className="muted">Total volume</p>
                    <h3 className="metric">{formatUsd.format(polymarket.totalVolumeUsdc)}</h3>
                  </div>
                  <div className="dashboard-card">
                    <p className="muted">Total PnL</p>
                    <h3 className={`metric ${polymarket.totalPnl == null ? "" : polymarket.totalPnl >= 0 ? "pnl-positive" : "pnl-negative"}`}>
                      {polymarket.totalPnl == null ? "N/A" : formatSignedUsd.format(polymarket.totalPnl)}
                    </h3>
                    {polymarket.totalPnlPartial && <p className="muted">Partial</p>}
                  </div>
                </div>

                <div className="section-header" style={{ marginTop: 16 }}>
                  <h3 className="section-title">Categories traded</h3>
                  <span className="pill">{topCategories.length}</span>
                </div>
                {topCategories.length === 0 ? (
                  <div className="message">No Polymarket trades found for this address.</div>
                ) : (
                  <div className="dashboard-grid">
                    {topCategories.map((category) => (
                      <div className="dashboard-card" key={category.category}>
                        <p className="muted">{category.category}</p>
                        <h3 className={`metric ${category.pnl == null ? "" : category.pnl >= 0 ? "pnl-positive" : "pnl-negative"}`}>
                          {category.pnl == null ? "N/A" : formatSignedUsd.format(category.pnl)}
                        </h3>
                        {category.pnlPartial && <p className="muted">Partial</p>}
                        <div className="stat-row" style={{ marginTop: 8 }}>
                          <span className="stat">Trades: {category.trades}</span>
                          <span className="stat">Volume: {formatUsd.format(category.volumeUsdc)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {polymarket.trades.length > 0 && (
                  <>
                    <div className="section-header" style={{ marginTop: 16 }}>
                      <h3 className="section-title">Recent trades</h3>
                      <span className="pill">{polymarket.trades.length}</span>
                    </div>
                    <div className="list-grid list-scroll">
                      {polymarket.trades.map((trade, idx) => (
                        <div className="list-card trade-card" key={`${trade.asset}-${trade.timestamp}-${idx}`}>
                          <span
                            className={`trade-dot ${
                              trade.pnl == null ? "trade-dot-neutral" : trade.pnl >= 0 ? "trade-dot-positive" : "trade-dot-negative"
                            }`}
                          />
                          <div>
                            <p className="muted">{trade.title || trade.marketSlug || "Polymarket trade"}</p>
                            <h3>
                              {trade.side} {trade.outcome ? trade.outcome : ""} {trade.size.toFixed(4)}
                            </h3>
                            <div className="stat-row" style={{ marginTop: 8 }}>
                              <span className="stat">Price: {trade.price.toFixed(4)}</span>
                              <span className="stat">Volume: {formatUsd.format(trade.usdcSize)}</span>
                              <span className="stat">
                                PnL:{" "}
                                <span className={trade.pnl == null ? "" : trade.pnl >= 0 ? "pnl-positive" : "pnl-negative"}>
                                  {trade.pnl == null ? "N/A" : formatSignedUsd.format(trade.pnl)}
                                </span>
                              </span>
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div
                              className={`pill ${
                                trade.result === "Won"
                                  ? "pill-positive"
                                  : trade.result === "Lost"
                                    ? "pill-negative"
                                    : "pill-neutral"
                              }`}
                            >
                              {trade.result || "Open"}
                            </div>
                            <p className="muted" style={{ marginTop: 8 }}>
                              Resolved: {trade.resolvedOutcome || "Pending"}
                            </p>
                            <p className="muted" style={{ marginTop: 4 }}>
                              Position: {trade.side} {trade.outcome || ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <p className="muted" style={{ marginTop: 12 }}>
                  {polymarket.pricingNote}
                </p>
              </>
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
      <Link
        className="button"
        href={`/pool/${pool.id}`}
        onClick={(event) => {
          event.preventDefault();
          window.location.href = `/pool/${pool.id}`;
        }}
      >
        View pool
      </Link>
    </div>
  );
}
