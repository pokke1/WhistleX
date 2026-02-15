"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchPoolVotes, fetchPools, submitPoolVote, type PoolVoteSummary } from "../../../lib/api";
import { describePolicy } from "../../../lib/tacoClient";
import { fetchPoolState } from "../../../lib/onchain";
import { utils } from "ethers";
import { useWallet } from "../../components/WalletProvider";

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
  const [voteSummary, setVoteSummary] = useState<PoolVoteSummary | null>(null);
  const [voteStatus, setVoteStatus] = useState<string | null>(null);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [canDecrypt, setCanDecrypt] = useState<boolean | null>(null);
  const { walletAddress, connectWallet } = useWallet();

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

  useEffect(() => {
    if (!poolId) return;
    fetchPoolVotes(poolId, walletAddress || undefined)
      .then(setVoteSummary)
      .catch((err: any) => setVoteStatus(err?.message || "Failed to load vote stats"));
  }, [poolId, walletAddress]);

  useEffect(() => {
    if (!poolId || !walletAddress) {
      setCanDecrypt(null);
      return;
    }
    fetchPoolState(poolId, walletAddress)
      .then((state) => setCanDecrypt(Boolean(state.canDecrypt)))
      .catch(() => setCanDecrypt(null));
  }, [poolId, walletAddress]);

  async function handleVote(vote: 1 | -1) {
    if (!pool) return;
    try {
      setVoteStatus(null);
      setIsSubmittingVote(true);
      let voterAddress = walletAddress;
      if (!voterAddress) {
        voterAddress = await connectWallet();
      }
      if (!voterAddress) {
        throw new Error("Wallet connection is required");
      }
      const updated = await submitPoolVote(pool.id, voterAddress, vote);
      setVoteSummary(updated);
      setVoteStatus("Feedback submitted");
    } catch (err: any) {
      setVoteStatus(err?.message || "Failed to submit vote");
    } finally {
      setIsSubmittingVote(false);
    }
  }

  const poolAverage = voteSummary ? ((voteSummary.average + 1) / 2) * 5 : 0;
  const isOwnPool = Boolean(walletAddress && pool && walletAddress.toLowerCase() === pool.investigator.toLowerCase());
  const uiCanVote = Boolean(walletAddress && !isOwnPool && canDecrypt);

  if (error) return <main className="app-shell">{error}</main>;
  if (!pool) return <main className="app-shell">Loading...</main>;

  return (
    <main className="app-shell space-y-4">
      <div className="panel space-y-2">
        <h1 className="title">{pool.title || `Pool ${pool.id}`}</h1>
        {!pool.title && <p className="muted">{pool.id}</p>}
        {pool.description && <p className="muted">{pool.description}</p>}
        <p className="muted">
          Investigator:
          {" "}
          <Link href={`/profile/${pool.investigator.toLowerCase()}`}>{pool.investigator}</Link>
        </p>
        <p className="muted">Threshold: {formatAmount(pool.threshold)} {CURRENCY_SYMBOL}</p>
        <p className="muted">Contribution to decrypt: {formatAmount(pool.minContributionForDecrypt)} {CURRENCY_SYMBOL}</p>
        <p className="muted">{describePolicy(pool.policyId as any)}</p>
      </div>

      <section className="panel space-y-2">
        <h2 className="section-title">Pool feedback</h2>
        <p className="muted">
          Votes: {voteSummary?.upvotes || 0} up / {voteSummary?.downvotes || 0} down
          {" "}
          ({(Math.max(0, Math.min(5, poolAverage))).toFixed(2)} / 5 stars)
        </p>
        <div className="input-row">
          <button
            className="button cta"
            disabled={isSubmittingVote || !uiCanVote}
            onClick={() => handleVote(1)}
          >
            Upvote
          </button>
          <button
            className="button"
            disabled={isSubmittingVote || !uiCanVote}
            onClick={() => handleVote(-1)}
          >
            Downvote
          </button>
          {voteSummary?.myVote !== null && (
            <span className="pill">Your vote: {voteSummary?.myVote === 1 ? "Upvote" : "Downvote"}</span>
          )}
        </div>
        {!walletAddress && <p className="muted">Connect a wallet to vote.</p>}
        {walletAddress && isOwnPool && <p className="muted">You cannot vote on your own pool.</p>}
        {walletAddress && !isOwnPool && canDecrypt === false && (
          <p className="muted">Only contributors with current decrypt rights can vote.</p>
        )}
        {voteSummary?.reason && <p className="muted">{voteSummary.reason}</p>}
        {voteStatus && <p className="muted">{voteStatus}</p>}
      </section>

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
