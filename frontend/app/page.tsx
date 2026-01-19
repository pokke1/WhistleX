"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchIntel, fetchPools } from "../lib/api";
import { contributeToPool, fetchPoolState, PoolOnchainState } from "../lib/onchain";
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

      <RecentUnlocks pools={pools} onchainStateByPool={onchainStateByPool} />

      <section className="panel">
        <div className="section-header">
          <h2 className="section-title">Open pools</h2>
          <span className="pill">{pools.length} listed</span>
        </div>

        {pools.length === 0 && <div className="message">No pools indexed yet.</div>}

        <div className="grid">
          {pools.map((pool) => {
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
            const deadlineLabel = pool.deadline
              ? new Date(Number(pool.deadline) * 1000).toLocaleString()
              : "-";

            return (
              <article key={pool.id} className="card pool-card">
                <div className="stat-row">
                  <span className="tag">{onchain?.unlocked ? "Unlocked" : "Locked"}</span>
                  {onchain?.canDecrypt !== undefined && (
                    <span className={`tag ${onchain.canDecrypt ? "" : "tag-warn"}`}>
                      {onchain.canDecrypt ? "Eligible to decrypt" : "Needs more contribution"}
                    </span>
                  )}
                </div>

                <div>
                  <p className="muted">Pool</p>
                  <h3>{pool.title || pool.id}</h3>
                  {pool.description && <p className="muted" style={{ marginTop: 4 }}>{pool.description}</p>}
                  {!pool.title && <p className="muted" style={{ fontSize: 12 }}>{pool.id}</p>}
                </div>

                <div className="stat-row">
                  <div className="stat">Threshold: {thresholdDisplay} {CURRENCY_SYMBOL}</div>
                  <div className="stat">Decrypt floor: {minContributionDisplay} {CURRENCY_SYMBOL}</div>
                  <div className="stat">Raised: {raisedDisplay} {CURRENCY_SYMBOL}</div>
                </div>

                <div className="stat-row">
                  <div className="stat">Investigator: {pool.investigator}</div>
                  <div className="stat">Deadline: {deadlineLabel}</div>
                </div>

                <p className="muted">Policy: {describePolicy(pool.policyId as any)}</p>
                {pool.ciphertext && (
                  <div className="pool-ciphertext">
                    <span className="muted">Ciphertext</span>
                    <span className="mono">{pool.ciphertext}</span>
                  </div>
                )}

                <div className="input-row">
                  <input
                    className="input"
                    placeholder={`Amount (${CURRENCY_SYMBOL})`}
                    type="number"
                    min="0"
                    step="0.000001"
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
                  <button className="button" onClick={() => handleFetchIntel(pool.id)}>
                    Load intel
                  </button>
                  <button
                    className="button"
                    disabled={!intel || (onchain && !onchain.unlocked)}
                    onClick={() => handleDecrypt(pool)}
                  >
                    Request TACo key
                  </button>
                  <button
                    className="button"
                    disabled={!intel || !decrypted}
                    onClick={() => handleDecryptIntel(pool)}
                  >
                    Decrypt intel
                  </button>
                  <Link className="button" href={`/pool/${pool.id}`}>
                    View details
                  </Link>
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
          })}
        </div>
      </section>
    </main>
  );
}

function RecentUnlocks({
  pools,
  onchainStateByPool
}: {
  pools: Pool[];
  onchainStateByPool: Record<string, PoolOnchainState>;
}) {
  const unlocked = pools.filter((pool) => onchainStateByPool[pool.id]?.unlocked);

  return (
    <section className="panel">
      <div className="section-header">
        <h2 className="section-title">Recently unlocked</h2>
        <span className="pill">{unlocked.length} ready</span>
      </div>
      {unlocked.length === 0 ? (
        <div className="message">No pools unlocked yet. Contribute to push one over the line.</div>
      ) : (
        <div className="slider">
          {unlocked.map((pool) => {
            const onchain = onchainStateByPool[pool.id];
            const decimals = onchain?.currencyDecimals ?? DEFAULT_DECIMALS;
            const raisedDisplay = onchain ? formatAmount(onchain.totalContributions, decimals) : "-";
            return (
              <div key={pool.id} className="slider-card">
                <p className="muted" style={{ margin: 0 }}>Pool</p>
                <p style={{ margin: "4px 0 8px", fontWeight: 600 }}>{pool.id}</p>
                <div className="stat-row">
                  <span className="stat">Raised: {raisedDisplay} {CURRENCY_SYMBOL}</span>
                </div>
                <Link className="button cta" href={`/pool/${pool.id}`} style={{ marginTop: 10, display: "inline-block" }}>
                  View pool
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
