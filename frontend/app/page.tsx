"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchIntel, fetchPools } from "../lib/api";
import { contributeToPool, fetchPoolState, PoolOnchainState } from "../lib/onchain";
import { decryptWithTaco } from "../lib/taco";
import { describePolicy } from "../lib/tacoClient";
import { utils } from "ethers";

const CURRENCY_SYMBOL = "USDC";
const DEFAULT_DECIMALS = Number(process.env.NEXT_PUBLIC_USDC_DECIMALS || "6");

function formatAmount(value?: string, decimals: number = DEFAULT_DECIMALS) {
  if (!value) return "–";
  try {
    return utils.formatUnits(value, decimals);
  } catch {
    return value;
  }
}

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
  const [onchainStateByPool, setOnchainStateByPool] = useState<Record<string, PoolOnchainState>>({});
  const [contributionInputs, setContributionInputs] = useState<Record<string, string>>({});
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    fetchPools()
      .then(setPools)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ethereum = (window as any).ethereum;
    if (!ethereum?.request) return;
    ethereum
      .request({ method: "eth_accounts" })
      .then((accounts: string[]) => setWalletAddress(accounts?.[0] || null))
      .catch(() => {});
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
    if (typeof window === "undefined") throw new Error("window is not available");
    const ethereum = (window as any).ethereum;
    if (!ethereum?.request) throw new Error("Wallet provider not found. Please install MetaMask.");
    const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
    const account = accounts?.[0];
    if (!account) throw new Error("No account authorized in wallet");
    setWalletAddress(account);
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
            const onchain = onchainStateByPool[pool.id];
            const decimals = onchain?.currencyDecimals ?? DEFAULT_DECIMALS;
            const thresholdDisplay = onchain ? formatAmount(onchain.threshold, decimals) : pool.threshold;
            const minContributionDisplay = onchain
              ? formatAmount(onchain.minContributionForDecrypt, decimals)
              : pool.minContributionForDecrypt;
            const raisedDisplay = onchain ? formatAmount(onchain.totalContributions, decimals) : "-";
            return (
              <li key={pool.id} className="border rounded p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Pool {pool.id}</p>
                    <p className="text-sm text-gray-700">Investigator: {pool.investigator}</p>
                    <p className="text-sm text-gray-700">Threshold: {thresholdDisplay} {CURRENCY_SYMBOL}</p>
                    <p className="text-sm text-gray-700">
                      Contribution to decrypt: {minContributionDisplay} {CURRENCY_SYMBOL}
                    </p>
                    {pool.deadline && (
                      <p className="text-sm text-gray-700">Deadline: {new Date(Number(pool.deadline) * 1000).toLocaleString()}</p>
                    )}
                    {pool.ciphertext && <p className="text-xs text-gray-600 truncate">Ciphertext: {pool.ciphertext}</p>}
                    <p className="text-xs text-gray-600 mt-1">Policy: {describePolicy(pool.policyId as any)}</p>
                    <p className="text-sm text-gray-700 mt-1">
                      On-chain status: {onchain?.unlocked ? "Unlocked" : "Locked"} - Raised {raisedDisplay} {CURRENCY_SYMBOL}
                    </p>
                    {onchain?.canDecrypt !== undefined && (
                      <p className="text-xs text-gray-600">
                        Eligibility: {onchain.canDecrypt ? "meets decrypt floor" : "needs to contribute more"}
                      </p>
                    )}
                  </div>
                  <Link className="text-blue-600 underline" href={`/pool/${pool.id}`}>
                    View details
                  </Link>
                </div>

                <div className="flex gap-3 flex-wrap">
                  <input
                    className="border rounded p-2 w-32"
                    placeholder={`Amount (${CURRENCY_SYMBOL})`}
                    type="number"
                    min="0"
                    step="0.000001"
                    value={contributionInputs[pool.id] || ""}
                    onChange={(e) => setContributionInputs((prev) => ({ ...prev, [pool.id]: e.target.value }))}
                  />
                  <button
                    className="bg-green-600 text-white px-3 py-1 rounded disabled:opacity-50"
                    onClick={() => handleContribute(pool)}
                    disabled={!contributionInputs[pool.id]}
                  >
                    Contribute
                  </button>
                  <button
                    className="bg-gray-200 px-3 py-1 rounded"
                    onClick={() => handleFetchIntel(pool.id)}
                  >
                    Load intel
                  </button>
                  <button
                    className="bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50"
                    disabled={!intel || (onchain && !onchain.unlocked)}
                    onClick={() => handleDecrypt(pool)}
                  >
                    Request TACo key
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
