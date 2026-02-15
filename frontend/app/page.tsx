"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchIntel, fetchPoolVotes, fetchPools, fetchProfile } from "../lib/api";
import { claimPoolFunds, claimRefund, contributeToPool, fetchPoolState, PoolOnchainState } from "../lib/onchain";
import { decryptWithTaco } from "../lib/taco";
import { describePolicy } from "../lib/tacoClient";
import { utils } from "ethers";
import { decryptIntelWithKey, parseSymmetricKey } from "../lib/symmetricCrypto";
import { useWallet } from "./components/WalletProvider";

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

interface IntelPayload {
  ciphertext: string;
  messageKit: string;
}

export default function HomePage() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [intelByPool, setIntelByPool] = useState<Record<string, IntelPayload | null>>({});
  const [decryptedByPool, setDecryptedByPool] = useState<Record<string, string>>({});
  const [plaintextByPool, setPlaintextByPool] = useState<Record<string, string>>({});
  const [statusByPool, setStatusByPool] = useState<Record<string, string>>({});
  const [onchainStateByPool, setOnchainStateByPool] = useState<Record<string, PoolOnchainState>>({});
  const [contributionInputs, setContributionInputs] = useState<Record<string, string>>({});
  const [cipherExpandedByPool, setCipherExpandedByPool] = useState<Record<string, boolean>>({});
  const [investigatorExpandedByPool, setInvestigatorExpandedByPool] = useState<Record<string, boolean>>({});
  const [poolVisibilityFilter, setPoolVisibilityFilter] = useState<"all" | "open" | "closed">("all");
  const [ratingByInvestigator, setRatingByInvestigator] = useState<Record<string, number>>({});
  const [voteSummaryByPool, setVoteSummaryByPool] = useState<Record<string, { upvotes: number; downvotes: number }>>({});
  const { walletAddress, connectWallet } = useWallet();
  const unlockedPools = pools.filter((pool) => onchainStateByPool[pool.id]?.unlocked);
  const recentlyListed = pools.slice(-6).reverse();
  const tickerItems = [
    ...recentlyListed.map((pool) => `Listed: ${pool.title || shortAddress(pool.id)}`),
    ...unlockedPools.slice(0, 6).map((pool) => `Unlocked: ${pool.title || shortAddress(pool.id)}`)
  ];

  useEffect(() => {
    fetchPools()
      .then(setPools)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    pools.forEach((pool) => refreshPoolState(pool.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pools, walletAddress]);

  useEffect(() => {
    const uniqueInvestigators = [...new Set(pools.map((pool) => pool.investigator?.toLowerCase()).filter(Boolean))];
    if (uniqueInvestigators.length === 0) {
      setRatingByInvestigator({});
      return;
    }

    Promise.all(
      uniqueInvestigators.map(async (address) => {
        try {
          const profile = await fetchProfile(address);
          const stars = Math.max(0, Math.min(5, ((profile.vendorRating.average + 1) / 2) * 5));
          return [address, stars] as const;
        } catch {
          return [address, 0] as const;
        }
      })
    ).then((pairs) => {
      setRatingByInvestigator(Object.fromEntries(pairs));
    });
  }, [pools]);

  useEffect(() => {
    if (pools.length === 0) {
      setVoteSummaryByPool({});
      return;
    }

    Promise.all(
      pools.map(async (pool) => {
        try {
          const summary = await fetchPoolVotes(pool.id);
          return [pool.id, { upvotes: summary.upvotes || 0, downvotes: summary.downvotes || 0 }] as const;
        } catch {
          return [pool.id, { upvotes: 0, downvotes: 0 }] as const;
        }
      })
    ).then((entries) => {
      setVoteSummaryByPool(Object.fromEntries(entries));
    });
  }, [pools]);

  useEffect(() => {
    const rails = Array.from(document.querySelectorAll<HTMLElement>(".pool-slider-rail"));
    if (rails.length === 0) return;

    const handleWheel = (event: WheelEvent) => {
      const rail = event.currentTarget as HTMLElement;
      const slider = rail.querySelector<HTMLElement>(".pool-slider-track");
      if (!slider) return;
      if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
      event.preventDefault();
      slider.scrollLeft += event.deltaY;
    };

    rails.forEach((rail) => rail.addEventListener("wheel", handleWheel, { passive: false }));
    return () => {
      rails.forEach((rail) => rail.removeEventListener("wheel", handleWheel));
    };
  }, [pools, poolVisibilityFilter]);


  async function refreshPoolState(poolId: string) {
    try {
      const state = await fetchPoolState(poolId, walletAddress ?? undefined);
      setOnchainStateByPool((prev) => ({ ...prev, [poolId]: state }));
    } catch (err: any) {
      setStatusByPool((prev) => ({ ...prev, [poolId]: err?.message || "Failed to load on-chain state" }));
    }
  }

  async function ensureWalletAddress() {
    if (walletAddress) return walletAddress;
    const account = await connectWallet();
    if (!account) throw new Error("No account authorized in wallet");
    return account;
  }

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

  async function handleContribute(pool: Pool) {
    const amount = contributionInputs[pool.id];
    try {
      await ensureWalletAddress();
      setStatusByPool((prev) => ({ ...prev, [pool.id]: "Sending contribution..." }));
      const { txHash } = await contributeToPool(pool.id, amount || "0");
      setStatusByPool((prev) => ({ ...prev, [pool.id]: `Contribution sent. Tx ${txHash}` }));
      await refreshPoolState(pool.id);
    } catch (err: any) {
      setStatusByPool((prev) => ({ ...prev, [pool.id]: err?.message || "Failed to contribute" }));
    }
  }

  async function handleClaimRefund(pool: Pool) {
    try {
      await ensureWalletAddress();
      setStatusByPool((prev) => ({ ...prev, [pool.id]: "Requesting refund..." }));
      const { txHash } = await claimRefund(pool.id);
      setStatusByPool((prev) => ({ ...prev, [pool.id]: `Refund claimed. Tx ${txHash}` }));
      await refreshPoolState(pool.id);
    } catch (err: any) {
      setStatusByPool((prev) => ({ ...prev, [pool.id]: err?.message || "Failed to claim refund" }));
    }
  }

  async function handleClaimPoolFunds(pool: Pool) {
    try {
      await ensureWalletAddress();
      setStatusByPool((prev) => ({ ...prev, [pool.id]: "Claiming pool funds..." }));
      const { txHash } = await claimPoolFunds(pool.id);
      setStatusByPool((prev) => ({ ...prev, [pool.id]: `Pool funds claimed. Tx ${txHash}` }));
      await refreshPoolState(pool.id);
    } catch (err: any) {
      setStatusByPool((prev) => ({ ...prev, [pool.id]: err?.message || "Failed to claim pool funds" }));
    }
  }

  async function handleDecrypt(pool: Pool) {
    const account = await ensureWalletAddress().catch((err) => {
      setStatusByPool((prev) => ({ ...prev, [pool.id]: err?.message || "Wallet required for TACo decryption" }));
      return null;
    });
    if (!account) return;

    const intel = intelByPool[pool.id];
    if (!intel) {
      setStatusByPool((prev) => ({ ...prev, [pool.id]: "Load intel first" }));
      return;
    }

    const state = onchainStateByPool[pool.id];
    if (state && !state.unlocked) {
      setStatusByPool((prev) => ({ ...prev, [pool.id]: "Pool not unlocked yet" }));
      return;
    }
    if (state && state.canDecrypt === false) {
      setStatusByPool((prev) => ({ ...prev, [pool.id]: "Contribution below decrypt minimum" }));
      return;
    }
    setStatusByPool((prev) => ({ ...prev, [pool.id]: "Requesting decryption from TACo..." }));
    try {
      const plaintext = await decryptWithTaco({
        poolAddress: pool.id,
        minContributionForDecrypt: pool.minContributionForDecrypt,
        messageKit: intel.messageKit,
        contributorAddress: account
      });
      setDecryptedByPool((prev) => ({ ...prev, [pool.id]: plaintext }));
      setStatusByPool((prev) => ({ ...prev, [pool.id]: "Decrypted with TACo" }));
    } catch (err: any) {
      setStatusByPool((prev) => ({ ...prev, [pool.id]: err.message || "Failed to decrypt" }));
    }
  }

  async function handleDecryptIntel(pool: Pool) {
    const intel = intelByPool[pool.id];
    const key = decryptedByPool[pool.id];
    if (!intel) {
      setStatusByPool((prev) => ({ ...prev, [pool.id]: "Load intel first" }));
      return;
    }
    if (!key) {
      setStatusByPool((prev) => ({ ...prev, [pool.id]: "Request TACo key first" }));
      return;
    }
    try {
      setStatusByPool((prev) => ({ ...prev, [pool.id]: "Decrypting intel locally..." }));
      const keyBytes = parseSymmetricKey(key);
      const plaintext = await decryptIntelWithKey({ ciphertext: intel.ciphertext, keyBytes });
      setPlaintextByPool((prev) => ({ ...prev, [pool.id]: plaintext }));
      setStatusByPool((prev) => ({ ...prev, [pool.id]: "Intel decrypted" }));
    } catch (err: any) {
      setStatusByPool((prev) => ({ ...prev, [pool.id]: err?.message || "Failed to decrypt intel" }));
    }
  }

  function isPoolClosed(pool: Pool) {
    const onchain = onchainStateByPool[pool.id];
    const thresholdMet = Boolean(onchain?.unlocked);
    const deadlineValue = onchain?.deadline ?? pool.deadline;
    const deadlineTimestamp = deadlineValue ? Number(deadlineValue) * 1000 : undefined;
    const deadlinePassed = deadlineTimestamp ? Date.now() > deadlineTimestamp : false;
    return thresholdMet || deadlinePassed;
  }

  const openPools = pools.filter((pool) => !isPoolClosed(pool));
  const closedPools = pools.filter((pool) => isPoolClosed(pool));
  const visibleOpenPools = poolVisibilityFilter === "closed" ? [] : openPools;
  const visibleClosedPools = poolVisibilityFilter === "open" ? [] : closedPools;

  function renderPoolCard(pool: Pool) {
    const intel = intelByPool[pool.id];
    const decrypted = decryptedByPool[pool.id];
    const status = statusByPool[pool.id];
    const onchain = onchainStateByPool[pool.id];
    const decimals = onchain?.currencyDecimals ?? DEFAULT_DECIMALS;
    const thresholdDisplay = onchain ? formatAmount(onchain.threshold, decimals) : pool.threshold;
    const minContributionDisplay = onchain
      ? formatAmount(onchain.minContributionForDecrypt, decimals)
      : pool.minContributionForDecrypt;
    const raisedDisplay = onchain ? formatAmount(onchain.totalContributions, decimals) : "-";
    const deadlineValue = onchain?.deadline ?? pool.deadline;
    const deadlineTimestamp = deadlineValue ? Number(deadlineValue) * 1000 : undefined;
    const deadlineLabel = deadlineTimestamp ? new Date(deadlineTimestamp).toLocaleString() : "-";
    const deadlinePassed = deadlineTimestamp ? Date.now() > deadlineTimestamp : false;
    const thresholdMet = Boolean(onchain?.unlocked);
    const isClosed = thresholdMet || deadlinePassed;
    const hasContribution = onchain?.userContribution
      ? BigInt(onchain.userContribution) > BigInt(0)
      : false;
    const canClaimRefund = Boolean(deadlinePassed && !thresholdMet && !onchain?.unlocked && hasContribution);
    const isCreator = Boolean(walletAddress && walletAddress.toLowerCase() === pool.investigator.toLowerCase());
    const canClaimCreatorFunds = Boolean(thresholdMet && isCreator);
    const investigatorStars = ratingByInvestigator[pool.investigator.toLowerCase()] ?? 0;
    const statusLabel = thresholdMet ? "Unlocked" : isClosed ? "Expired" : "Locked";
    const voteSummary = voteSummaryByPool[pool.id] || { upvotes: 0, downvotes: 0 };
    const voteDelta = voteSummary.upvotes - voteSummary.downvotes;
    const voteTone = voteDelta > 0 ? "pill-positive" : voteDelta < 0 ? "pill-negative" : "pill-neutral";
    const ratingTone = investigatorStars > 0 ? "pill-positive" : investigatorStars < 0 ? "pill-negative" : "pill-neutral";
    const ratingNormalized = Math.max(0, Math.min(1, investigatorStars / 5));
    const ratingBg = `rgba(${Math.round(12 + ratingNormalized * 78)}, ${Math.round(
      18 + ratingNormalized * 190
    )}, ${Math.round(28 + ratingNormalized * 130)}, 0.22)`;
    const ratingBorder = `rgba(${Math.round(12 + ratingNormalized * 78)}, ${Math.round(
      18 + ratingNormalized * 190
    )}, ${Math.round(28 + ratingNormalized * 130)}, 0.55)`;
    const ratingText = `rgb(${Math.round(120 + ratingNormalized * 50)}, ${Math.round(
      120 + ratingNormalized * 90
    )}, ${Math.round(140 + ratingNormalized * 40)})`;
    const thresholdValue = onchain ? Number(utils.formatUnits(onchain.threshold, decimals)) : Number(pool.threshold);
    const raisedValue = onchain ? Number(utils.formatUnits(onchain.totalContributions, decimals)) : 0;
    const minContributionValue = onchain
      ? Number(utils.formatUnits(onchain.minContributionForDecrypt, decimals))
      : Number(pool.minContributionForDecrypt);
    const progressPercent =
      thresholdValue > 0 && Number.isFinite(raisedValue)
        ? Math.min(100, Math.max(0, (raisedValue / thresholdValue) * 100))
        : 0;
    const minContributionPercent =
      thresholdValue > 0 && Number.isFinite(minContributionValue)
        ? Math.min(100, Math.max(0, (minContributionValue / thresholdValue) * 100))
        : 0;

    return (
      <article key={pool.id} className="card pool-card">
        <div className="pool-card-header">
          <div className="pool-card-header-left">
            <span className="tag">{statusLabel}</span>
            <button
              className="investigator-toggle pill investigator-pill"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setInvestigatorExpandedByPool((prev) => ({ ...prev, [pool.id]: !prev[pool.id] }));
              }}
            >
              {investigatorExpandedByPool[pool.id] && <span className="muted">Investigator:</span>}
              <Link
                className="stat-link"
                href={`/profile/${pool.investigator.toLowerCase()}`}
                onClick={(event) => event.stopPropagation()}
              >
                {investigatorExpandedByPool[pool.id] ? pool.investigator : shortAddress(pool.investigator)}
              </Link>
            </button>
            {onchain?.canDecrypt !== undefined && !isClosed && (
              <div className="decrypt-fold-wrap">
                <div
                  className={`decrypt-fold ${onchain.canDecrypt ? "decrypt-fold-ok" : "decrypt-fold-warn"}`}
                />
                <div className="decrypt-fold-tooltip">
                  {onchain.canDecrypt
                    ? "Eligible to decrypt once the pool unlocks."
                    : "Your contribution is below the decrypt floor. Contribute to get access to the secret."}
                </div>
              </div>
            )}
          </div>
          <div className="pool-card-header-right">
            {!isClosed && (
              <>
                <span className="pill deadline-pill">Deadline: {deadlineLabel}</span>
                <span
                  className={`pill ${ratingTone}`}
                  style={{ background: ratingBg, borderColor: ratingBorder, color: ratingText }}
                >
                  Investigator rating: {investigatorStars.toFixed(2)} / 5
                </span>
              </>
            )}
            {isClosed && (
              <>
                <span className="pill deadline-pill">Deadline: {deadlineLabel}</span>
                <span className={`pill vote-pill ${voteTone}`}>
                  ^ {voteSummary.upvotes} / v {voteSummary.downvotes}
                </span>
              </>
            )}
          </div>
        </div>

        <div
          className="pool-card-body"
          onClick={() => (window.location.href = `/pool/${pool.id}`)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              window.location.href = `/pool/${pool.id}`;
            }
          }}
          role="link"
          tabIndex={0}
        >
          <p className="muted">Pool</p>
          <h3>{pool.title || pool.id}</h3>
          {pool.description && <p className="muted" style={{ marginTop: 4 }}>{pool.description}</p>}
          {!pool.title && <p className="muted" style={{ fontSize: 12 }}>{pool.id}</p>}

          <div className="pool-progress">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
              <div className="progress-marker" style={{ left: `${minContributionPercent}%` }} />
            </div>
          </div>

          <div className="pool-meta" />
        </div>

        <div className="progress-meta">
          <span className="stat">Raised: {raisedDisplay} {CURRENCY_SYMBOL}</span>
          <span className="stat">Threshold: {thresholdDisplay} {CURRENCY_SYMBOL}</span>
          <span className="stat">Decrypt floor: {minContributionDisplay} {CURRENCY_SYMBOL}</span>
        </div>

        <p className="muted">
          Policy: {describePolicy(pool.policyId as any)}
        </p>
        {pool.ciphertext && (
          <div className="pool-ciphertext">
            <button
              className="cipher-toggle"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setCipherExpandedByPool((prev) => ({ ...prev, [pool.id]: !prev[pool.id] }));
              }}
            >
              <span className="muted">Ciphertext</span>
              <span className="pill">{cipherExpandedByPool[pool.id] ? "Hide" : "Show"}</span>
            </button>
            {cipherExpandedByPool[pool.id] && <span className="mono">{pool.ciphertext}</span>}
          </div>
        )}

        {isClosed && onchain?.canDecrypt !== undefined && (
          <div className="decrypt-fold-wrap">
            <div
              className={`decrypt-fold ${onchain.canDecrypt ? "decrypt-fold-ok" : "decrypt-fold-warn"}`}
            />
            <div className="decrypt-fold-tooltip">
              {onchain.canDecrypt
                ? "Eligible to decrypt: you contributed enough."
                : "Your contribution is below the decrypt floor and the pool is closed. You cannot decrypt."}
            </div>
          </div>
        )}

        <div
          className="input-row"
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {deadlinePassed && !thresholdMet ? (
            <button
              className="button tiny"
              onClick={() => handleClaimRefund(pool)}
              disabled={!canClaimRefund}
            >
              Claim refund
            </button>
          ) : (
            <>
              {!thresholdMet && (
                <>
                  <input
                    className="input"
                    placeholder={`Amount (${CURRENCY_SYMBOL})`}
                    type="number"
                    min="0"
                    step="1"
                    value={contributionInputs[pool.id] || ""}
                    onChange={(e) => setContributionInputs((prev) => ({ ...prev, [pool.id]: e.target.value }))}
                  />
                  <button
                    className="button cta"
                    onClick={() => handleContribute(pool)}
                    disabled={!contributionInputs[pool.id]}
                  >
                    Contribute
                  </button>
                </>
              )}
              {canClaimCreatorFunds && (
                <button className="button tiny" onClick={() => handleClaimPoolFunds(pool)}>
                  Claim funds
                </button>
              )}
              {onchain?.canDecrypt && !deadlinePassed && (
                <>
                  <button className="button" onClick={() => handleFetchIntel(pool.id)}>
                    Load intel
                  </button>
                  {thresholdMet && (
                    <button
                      className="button"
                      disabled={!intel || (onchain && !onchain.unlocked)}
                      onClick={() => handleDecrypt(pool)}
                    >
                      Request TACo key
                    </button>
                  )}
                  <button
                    className="button"
                    disabled={!intel || !decrypted}
                    onClick={() => handleDecryptIntel(pool)}
                  >
                    Decrypt intel
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {status && <span className="muted">{status}</span>}

        {intel && (
          <div className="panel">
            <p className="muted">MessageKit</p>
            <textarea className="input" style={{ width: "100%", minHeight: 80 }} readOnly value={intel.messageKit} />
          </div>
        )}

        {decrypted && (
          <div className="panel" style={{ borderColor: "rgba(90, 212, 172, 0.5)" }}>
            <p className="muted">Decrypted TACo key</p>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12 }}>{decrypted}</pre>
          </div>
        )}

        {plaintextByPool[pool.id] && (
          <div className="panel" style={{ borderColor: "rgba(77, 163, 255, 0.5)" }}>
            <p className="muted">Intel plaintext</p>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12 }}>
              {plaintextByPool[pool.id]}
            </pre>
          </div>
        )}
      </article>
    );
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <h1 className="title">WhistleX</h1>
          <p className="subtitle">
            TACo-secured marketplace for encrypted intelligence. Fund, unlock, and decrypt once the crowd meets the goal.
          </p>
        </div>
        <div className="input-row">
          <Link className="primary-btn" href="/create">
            Create pool
          </Link>
        </div>
      </header>

      {error && <div className="message"> {error} </div>}

      <section className="ticker" aria-label="Live pool updates">
        <div className="ticker-track">
          <div className="ticker-group">
            {(tickerItems.length ? tickerItems : ["Live updates will appear as pools list and unlock."]).map(
              (item, index) => (
                <span key={`ticker-${index}`} className="ticker-item">
                  {item}
                </span>
              )
            )}
          </div>
          <div className="ticker-group" aria-hidden="true">
            {(tickerItems.length ? tickerItems : ["Live updates will appear as pools list and unlock."]).map(
              (item, index) => (
                <span key={`ticker-ghost-${index}`} className="ticker-item">
                  {item}
                </span>
              )
            )}
          </div>
        </div>
      </section>


      <section className="panel">
        <div className="section-header">
          <div className="section-title-row">
            <h2 className="section-title">Marketplace filters</h2>
            <span className="pill">{pools.length} total</span>
          </div>
          <div className="input-row">
            <button
              className={`button ${poolVisibilityFilter === "all" ? "cta" : ""}`}
              onClick={() => setPoolVisibilityFilter("all")}
            >
              All
            </button>
            <button
              className={`button ${poolVisibilityFilter === "open" ? "cta" : ""}`}
              onClick={() => setPoolVisibilityFilter("open")}
            >
              Open
            </button>
            <button
              className={`button ${poolVisibilityFilter === "closed" ? "cta" : ""}`}
              onClick={() => setPoolVisibilityFilter("closed")}
            >
              Closed
            </button>
          </div>
        </div>
      </section>

      {poolVisibilityFilter !== "closed" && (
        <section className="panel">
          <div className="section-header">
            <h2 className="section-title">Open pools</h2>
            <span className="pill">{visibleOpenPools.length} listed</span>
          </div>

          {visibleOpenPools.length === 0 && <div className="message">No open pools for the selected filter.</div>}
          <div className="grid">{visibleOpenPools.map(renderPoolCard)}</div>
        </section>
      )}

      {poolVisibilityFilter !== "open" && (
        <section className="panel">
          <div className="section-header">
            <h2 className="section-title">Closed pools</h2>
            <span className="pill">{visibleClosedPools.length} listed</span>
          </div>
          {visibleClosedPools.length === 0 && <div className="message">No closed pools for the selected filter.</div>}
          <div className="pool-slider-rail">
            <div className="pool-slider-track">{visibleClosedPools.map(renderPoolCard)}</div>
          </div>
        </section>
      )}
    </main>
  );
}
