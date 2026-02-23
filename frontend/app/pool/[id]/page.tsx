"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  fetchPoolComments,
  fetchPoolContributors,
  fetchPoolVotes,
  fetchPools,
  postPoolComment,
  submitPoolVote,
  type PoolContributor,
  type PoolComment,
  type PoolVoteSummary
} from "../../../lib/api";
import { describePolicy } from "../../../lib/tacoClient";
import { fetchPoolState, type PoolOnchainState } from "../../../lib/onchain";
import { getAddressExplorerUrl, getTxExplorerUrl } from "../../../lib/explorer";
import { parsePolymarketReference } from "../../../lib/polymarketRef";
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

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

interface Pool {
  id: string;
  investigator: string;
  threshold: string;
  minContributionForDecrypt: string;
  title?: string;
  description?: string;
  policyId?: string;
  attachments?: {
    id?: string;
    publicUrl: string;
    mimeType: string;
    sizeBytes: number;
    path?: string;
  }[];
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
  const [onchainState, setOnchainState] = useState<PoolOnchainState | null>(null);
  const [contributors, setContributors] = useState<PoolContributor[]>([]);
  const [contributorsStatus, setContributorsStatus] = useState<string | null>(null);
  const [comments, setComments] = useState<PoolComment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentStatus, setCommentStatus] = useState<string | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"image" | "pdf" | null>(null);
  const [resolvedPolymarketUrl, setResolvedPolymarketUrl] = useState<string | null>(null);
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
    if (!poolId) return;
    loadContributors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolId]);

  useEffect(() => {
    if (!poolId) return;
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolId]);

  useEffect(() => {
    if (!poolId || !walletAddress) {
      setCanDecrypt(null);
      return;
    }
    fetchPoolState(poolId, walletAddress)
      .then((state) => {
        setOnchainState(state);
        setCanDecrypt(Boolean(state.canDecrypt));
      })
      .catch(() => {
        setCanDecrypt(null);
        setOnchainState(null);
      });
  }, [poolId, walletAddress]);

  useEffect(() => {
    if (!pool) {
      setResolvedPolymarketUrl(null);
      return;
    }

    const ref = parsePolymarketReference(pool.description);
    if (!ref.marketId && !ref.marketSlug && !ref.eventSlug) {
      setResolvedPolymarketUrl(null);
      return;
    }

    let cancelled = false;
    const params = new URLSearchParams();
    if (ref.marketId) params.set("marketId", ref.marketId);
    if (ref.marketSlug) params.set("marketSlug", ref.marketSlug);
    if (ref.eventSlug) params.set("eventSlug", ref.eventSlug);

    fetch(`/api/polymarket/resolve?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        setResolvedPolymarketUrl(data?.marketUrl || ref.marketUrl || null);
      })
      .catch(() => {
        if (!cancelled) setResolvedPolymarketUrl(ref.marketUrl || null);
      });

    return () => {
      cancelled = true;
    };
  }, [pool]);

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
      await loadContributors();
      setVoteStatus("Feedback submitted");
    } catch (err: any) {
      setVoteStatus(err?.message || "Failed to submit vote");
    } finally {
      setIsSubmittingVote(false);
    }
  }

  async function loadContributors() {
    if (!poolId) return;
    try {
      setContributorsStatus(null);
      const data = await fetchPoolContributors(poolId);
      setContributors(data.contributors || []);
    } catch (err: any) {
      setContributorsStatus(err?.message || "Failed to load contributors");
    }
  }

  async function loadComments() {
    if (!poolId) return;
    try {
      setCommentStatus(null);
      const data = await fetchPoolComments(poolId);
      setComments(data.comments || []);
    } catch (err: any) {
      setCommentStatus(err?.message || "Failed to load comments");
    }
  }

  async function handleSubmitComment() {
    if (!poolId) return;
    if (!commentInput.trim()) {
      setCommentStatus("Comment cannot be empty");
      return;
    }
    try {
      setIsSubmittingComment(true);
      setCommentStatus(null);
      let author = walletAddress;
      if (!author) {
        author = await connectWallet();
      }
      if (!author) {
        throw new Error("Wallet connection is required");
      }
      await postPoolComment(poolId, author, commentInput.trim());
      setCommentInput("");
      await loadComments();
      setCommentStatus("Comment posted");
    } catch (err: any) {
      setCommentStatus(err?.message || "Failed to post comment");
    } finally {
      setIsSubmittingComment(false);
    }
  }

  const poolAverage = voteSummary ? ((voteSummary.average + 1) / 2) * 5 : 0;
  const isOwnPool = Boolean(walletAddress && pool && walletAddress.toLowerCase() === pool.investigator.toLowerCase());
  const uiCanVote = Boolean(walletAddress && !isOwnPool && canDecrypt);
  const decimals = onchainState?.currencyDecimals ?? DEFAULT_DECIMALS;
  const thresholdValue = onchainState ? Number(utils.formatUnits(onchainState.threshold, decimals)) : 0;
  const raisedValue = onchainState ? Number(utils.formatUnits(onchainState.totalContributions, decimals)) : 0;
  const minContributionValue = onchainState
    ? Number(utils.formatUnits(onchainState.minContributionForDecrypt, decimals))
    : 0;
  const progressPercent =
    thresholdValue > 0 && Number.isFinite(raisedValue)
      ? Math.min(100, Math.max(0, (raisedValue / thresholdValue) * 100))
      : 0;
  const minContributionPercent =
    thresholdValue > 0 && Number.isFinite(minContributionValue)
      ? Math.min(100, Math.max(0, (minContributionValue / thresholdValue) * 100))
      : 0;

  if (error) return <main className="app-shell">{error}</main>;
  if (!pool) return <main className="app-shell">Loading...</main>;
  const polymarketRef = parsePolymarketReference(pool.description);
  const polymarketUrl = resolvedPolymarketUrl || polymarketRef.marketUrl;

  return (
    <main className="app-shell space-y-4">
      <div className="panel space-y-2">
        <h1 className="title">{pool.title || `Pool ${pool.id}`}</h1>
        {!pool.title && <p className="muted">{pool.id}</p>}
        {polymarketRef.cleanDescription && <p className="muted">{polymarketRef.cleanDescription}</p>}
        {polymarketUrl && (
          <p className="muted">
            <a href={polymarketUrl} target="_blank" rel="noreferrer">
              View related Polymarket bet
            </a>
          </p>
        )}
        {pool.attachments && pool.attachments.length > 0 && (
          <div className="pool-attachments">
            {pool.attachments.slice(0, 3).map((file) => (
              <button
                key={file.id || file.publicUrl}
                type="button"
                className="attachment-thumb"
                onClick={() => {
                  if (file.mimeType.startsWith("image/")) {
                    setPreviewUrl(file.publicUrl);
                    setPreviewType("image");
                  } else {
                    setPreviewUrl(file.publicUrl);
                    setPreviewType("pdf");
                  }
                }}
              >
                {file.mimeType.startsWith("image/") ? (
                  <img src={file.publicUrl} alt="Attachment preview" />
                ) : (
                  <span className="attachment-pdf">PDF</span>
                )}
              </button>
            ))}
          </div>
        )}
        {onchainState && (
          <div className="pool-progress mobile-only" style={{ marginTop: 8 }}>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
              <div className="progress-marker" style={{ left: `${minContributionPercent}%` }} />
            </div>
            <div className="progress-meta">
              <span className="stat">Raised: {formatAmount(onchainState.totalContributions)} {CURRENCY_SYMBOL}</span>
              <span className="stat">Threshold: {formatAmount(onchainState.threshold)} {CURRENCY_SYMBOL}</span>
              <span className="stat">Decrypt floor: {formatAmount(onchainState.minContributionForDecrypt)} {CURRENCY_SYMBOL}</span>
            </div>
          </div>
        )}
        <p className="muted">
          Whistleblower:
          {" "}
          <Link
            href={`/profile/${pool.investigator.toLowerCase()}`}
            onClick={(event) => {
              event.preventDefault();
              window.location.href = `/profile/${pool.investigator.toLowerCase()}`;
            }}
          >
            {pool.investigator}
          </Link>
        </p>
        <p className="muted">Threshold: {formatAmount(pool.threshold)} {CURRENCY_SYMBOL}</p>
        <p className="muted">Contribution to decrypt: {formatAmount(pool.minContributionForDecrypt)} {CURRENCY_SYMBOL}</p>
        {onchainState && (
          <div className="pool-progress desktop-only">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
              <div className="progress-marker" style={{ left: `${minContributionPercent}%` }} />
            </div>
            <div className="progress-meta">
              <span className="stat">Raised: {formatAmount(onchainState.totalContributions)} {CURRENCY_SYMBOL}</span>
              <span className="stat">Threshold: {formatAmount(onchainState.threshold)} {CURRENCY_SYMBOL}</span>
              <span className="stat">Decrypt floor: {formatAmount(onchainState.minContributionForDecrypt)} {CURRENCY_SYMBOL}</span>
            </div>
          </div>
        )}
        <p className="muted">
          Contract:
          {" "}
          <a href={getAddressExplorerUrl(pool.id)} target="_blank" rel="noreferrer">
            View on explorer
          </a>
        </p>
        <p className="muted">{describePolicy(pool.policyId as any)}</p>
      </div>

      <section className="panel space-y-2">
        <h2 className="section-title">Pool feedback</h2>
        <p className="muted">
          Votes: {voteSummary?.upvotes || 0} up / {voteSummary?.downvotes || 0} down
          {" "}
          ({(Math.max(0, Math.min(5, poolAverage))).toFixed(2)} / 5 weighted stars, vote power {formatAmount(voteSummary?.totalVotePower || "0")} {CURRENCY_SYMBOL})
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
        <h2 className="section-title">Contributors</h2>
        {contributorsStatus && <p className="muted">{contributorsStatus}</p>}
        {!contributorsStatus && contributors.length === 0 && (
          <p className="muted">No contributions indexed yet.</p>
        )}
        {contributors.length > 0 && (
          <div className="list-grid contributors-list">
            {contributors.map((contributor) => (
              <div key={contributor.address} className="list-card contributor-card">
                <div>
                  <p className="muted">Contributor</p>
                  <h3>
                    <Link
                      href={`/profile/${contributor.address}`}
                      onClick={(event) => {
                        event.preventDefault();
                        window.location.href = `/profile/${contributor.address}`;
                      }}
                    >
                      {shortAddress(contributor.address)}
                    </Link>
                  </h3>
                  {contributor.txHash && (
                    <p className="muted" style={{ marginTop: 4 }}>
                      <a href={getTxExplorerUrl(contributor.txHash)} target="_blank" rel="noreferrer">
                        View contribution tx
                      </a>
                    </p>
                  )}
                  <div className="stat-row" style={{ marginTop: 8 }}>
                    <span className="stat">
                      Contributed: {formatAmount(contributor.amount)} {CURRENCY_SYMBOL}
                    </span>
                    {contributor.vote === 1 && <span className="pill">Voted: Upvote</span>}
                    {contributor.vote === -1 && <span className="pill">Voted: Downvote</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel space-y-2">
        <h2 className="section-title">Comments</h2>
        {comments.length === 0 && !commentStatus && (
          <p className="muted">No comments yet. Be the first to share a reaction.</p>
        )}
        {comments.length > 0 && (
          <div className="comment-list">
            {comments.map((comment) => (
              <div key={comment.id || `${comment.author}-${comment.created_at}`} className="comment-card">
                <div className="comment-header">
                  <Link
                    className="comment-author"
                    href={`/profile/${comment.author.toLowerCase()}`}
                    onClick={(event) => {
                      event.preventDefault();
                      window.location.href = `/profile/${comment.author.toLowerCase()}`;
                    }}
                  >
                    {shortAddress(comment.author)}
                  </Link>
                  {comment.created_at && (
                    <span className="comment-time">{new Date(comment.created_at).toLocaleString()}</span>
                  )}
                </div>
                <p className="comment-body">{comment.message}</p>
              </div>
            ))}
          </div>
        )}
        <div className="comment-input-row">
          <textarea
            className="input"
            style={{ minHeight: 88, flex: 1 }}
            placeholder="Add a comment..."
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
          />
          <button className="button cta" type="button" disabled={isSubmittingComment} onClick={handleSubmitComment}>
            Post
          </button>
        </div>
        {!walletAddress && <p className="muted">Connect a wallet to comment.</p>}
        {commentStatus && <p className="muted">{commentStatus}</p>}
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

      {previewUrl && (
        <div className="media-modal-backdrop" onClick={() => { setPreviewUrl(null); setPreviewType(null); }}>
          <div className="media-modal" onClick={(event) => event.stopPropagation()}>
            {previewType === "image" ? (
              <img
                className="media-image"
                src={previewUrl}
                alt="Attachment preview"
                onClick={() => {
                  setPreviewUrl(null);
                  setPreviewType(null);
                }}
              />
            ) : (
              <a className="button cta" href={previewUrl} target="_blank" rel="noreferrer">
                Open PDF
              </a>
            )}
            <button className="icon-button media-close" onClick={() => { setPreviewUrl(null); setPreviewType(null); }}>
              x
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
