"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { fetchIntel, fetchPoolCommentCounts, fetchPoolVotes, fetchPools, fetchProfile } from "../lib/api";
import { claimPoolFunds, claimRefund, contributeToPool, fetchPoolState, PoolOnchainState } from "../lib/onchain";
import { decryptWithTaco } from "../lib/taco";
import { describePolicy } from "../lib/tacoClient";
import { utils } from "ethers";
import { decryptIntelWithKey, parseSymmetricKey } from "../lib/symmetricCrypto";
import { parsePolymarketReference } from "../lib/polymarketRef";
import { useWallet } from "./components/WalletProvider";
import { useTicker } from "./components/TickerProvider";

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
  attachments?: {
    id?: string;
    publicUrl: string;
    mimeType: string;
    sizeBytes: number;
    path?: string;
  }[];
}

interface IntelPayload {
  ciphertext: string;
  messageKit: string;
}

export default function HomePage() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [poolsLoading, setPoolsLoading] = useState<boolean>(false);
  const [intelByPool, setIntelByPool] = useState<Record<string, IntelPayload | null>>({});
  const [decryptedByPool, setDecryptedByPool] = useState<Record<string, string>>({});
  const [plaintextByPool, setPlaintextByPool] = useState<Record<string, string>>({});
  const [statusByPool, setStatusByPool] = useState<Record<string, string>>({});
  const [onchainStateByPool, setOnchainStateByPool] = useState<Record<string, PoolOnchainState>>({});
  const [contributionInputs, setContributionInputs] = useState<Record<string, string>>({});
  const [cipherExpandedByPool, setCipherExpandedByPool] = useState<Record<string, boolean>>({});
  const [investigatorExpandedByPool, setInvestigatorExpandedByPool] = useState<Record<string, boolean>>({});
  const [statusExpandedByPool, setStatusExpandedByPool] = useState<Record<string, boolean>>({});
  const [poolVisibilityFilter, setPoolVisibilityFilter] = useState<"all" | "open" | "closed">("all");
  const [poolFilterOpen, setPoolFilterOpen] = useState<boolean>(false);
  const [mobilePoolFilterOpen, setMobilePoolFilterOpen] = useState<boolean>(false);
  const [ratingByInvestigator, setRatingByInvestigator] = useState<Record<string, number>>({});
  const [voteSummaryByPool, setVoteSummaryByPool] = useState<Record<string, { upvotes: number; downvotes: number }>>({});
  const [commentCountsByPool, setCommentCountsByPool] = useState<Record<string, number>>({});
  const [allMarkets, setAllMarkets] = useState<
    {
      id: string;
      slug: string | null;
      eventSlug?: string | null;
      marketUrl?: string | null;
      optionsCount?: number;
      question: string;
      endDate: string;
      createdAt: string | null;
      volume24hr: number;
      image: string | null;
      tags: string[];
    }[]
  >([]);
  const [marketsStatus, setMarketsStatus] = useState<string | null>(null);
  const [marketsLoading, setMarketsLoading] = useState<boolean>(false);
  const [hotTag, setHotTag] = useState<string>("all");
  const [whistleSearch, setWhistleSearch] = useState<string>("");
  const whistleWorkerRef = useRef<Worker | null>(null);
  const whistleTokenRef = useRef(0);
  const [searchLimit, setSearchLimit] = useState<number>(60);
  const [expandedMarketTips, setExpandedMarketTips] = useState<Record<string, boolean>>({});
  const whistleRef = useRef<HTMLDivElement | null>(null);
  const whistlePauseRef = useRef<number | null>(null);
  const whistlePausedRef = useRef<boolean>(false);
  const whistleEdgeDirRef = useRef<0 | -1 | 1>(0);
  const whistleEdgeRafRef = useRef<number | null>(null);
  const whistleHoverRef = useRef<boolean>(false);
  const whistleResumeTimeoutRef = useRef<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"image" | "pdf" | null>(null);
  const { walletAddress, connectWallet } = useWallet();
  const { items: tickerItemsFromContext, setItems: setTickerItems } = useTicker();
  const unlockedPools = pools.filter((pool) => onchainStateByPool[pool.id]?.unlocked);
  const recentlyListed = pools.slice(-6).reverse();
  const tickerItems = useMemo(() => {
    return [
      ...recentlyListed.map((pool) => `Listed: ${pool.title || shortAddress(pool.id)}`),
      ...unlockedPools.slice(0, 6).map((pool) => `Unlocked: ${pool.title || shortAddress(pool.id)}`)
    ];
  }, [recentlyListed, unlockedPools]);
  const mobileTickerItems = tickerItemsFromContext.length
    ? tickerItemsFromContext
    : ["Live updates will appear as pools list and unlock."];
  const [mobileTickerReady, setMobileTickerReady] = useState(false);

  useEffect(() => {
    const payload = tickerItems.length ? tickerItems : ["Live updates will appear as pools list and unlock."];
    setTickerItems((prev) => {
      if (prev.length === payload.length && prev.every((item, idx) => item === payload[idx])) {
        return prev;
      }
      return payload;
    });
    return () => setTickerItems([]);
  }, [tickerItems, setTickerItems]);

  useEffect(() => {
    setMobileTickerReady(false);
    const id = window.requestAnimationFrame(() => {
      setMobileTickerReady(true);
    });
    return () => window.cancelAnimationFrame(id);
  }, [mobileTickerItems.join("|")]);

  useEffect(() => {
    setError(null);
    setPoolsLoading(true);
    fetchPools()
      .then((data) => {
        const filtered = (Array.isArray(data) ? data : []).filter((pool: any) => {
          const policy = pool?.policyId;
          return Boolean(policy && String(policy).trim().length > 0);
        });
        const sorted = [...filtered].sort((a: any, b: any) => {
          const aDeadline = Number.parseInt(String(a?.deadline ?? ""), 10);
          const bDeadline = Number.parseInt(String(b?.deadline ?? ""), 10);
          const aValue = Number.isFinite(aDeadline) ? aDeadline : Number.POSITIVE_INFINITY;
          const bValue = Number.isFinite(bDeadline) ? bDeadline : Number.POSITIVE_INFINITY;
          return aValue - bValue;
        });
        setPools(sorted);
      })
      .catch((err) => setError(err.message))
      .finally(() => setPoolsLoading(false));
  }, []);

  useEffect(() => {
    if (pools.length === 0) {
      setCommentCountsByPool({});
      return;
    }
    fetchPoolCommentCounts(pools.map((pool) => pool.id))
      .then(setCommentCountsByPool)
      .catch(() => setCommentCountsByPool({}));
  }, [pools]);

  useEffect(() => {
    pools.forEach((pool) => refreshPoolState(pool.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pools, walletAddress]);

  useEffect(() => {
    const uniqueInvestigators = Array.from(
      new Set(
        pools
          .map((pool) => pool.investigator?.toLowerCase())
          .filter((address): address is string => Boolean(address))
      )
    );
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
    setMarketsStatus(null);
    setMarketsLoading(true);
    fetch("/api/polymarket/all")
      .then((res) => {
        if (!res.ok) throw new Error("failed to load Polymarket markets");
        return res.json();
      })
      .then((data) => setAllMarkets(data?.markets || []))
      .catch((err: any) => setMarketsStatus(err?.message || "Failed to load Polymarket markets"))
      .finally(() => setMarketsLoading(false));
  }, []);

  const hotMarkets = useMemo(() => {
    const scored = [...allMarkets].sort((a, b) => {
      const volumeDelta = (b.volume24hr || 0) - (a.volume24hr || 0);
      if (volumeDelta !== 0) return volumeDelta;
      const endA = Date.parse(a.endDate || "");
      const endB = Date.parse(b.endDate || "");
      if (Number.isNaN(endA) && Number.isNaN(endB)) return 0;
      if (Number.isNaN(endA)) return 1;
      if (Number.isNaN(endB)) return -1;
      return endA - endB;
    });
    return scored.slice(0, 8);
  }, [allMarkets]);

  const polymarketTipsById = useMemo(() => {
    const map: Record<string, Pool[]> = {};
    const idRegex = /polymarket_id:([0-9]+)/i;
    for (const pool of pools) {
      const description = pool.description || "";
      const match = description.match(idRegex);
      if (!match) continue;
      const id = match[1];
      if (!id) continue;
      if (!map[id]) map[id] = [];
      map[id].push(pool);
    }
    return map;
  }, [pools]);

  const searching = whistleSearch.trim().length > 0;
  const baseWhistleMarkets =
    hotTag === "all"
      ? hotMarkets
      : hotTag === "New"
        ? allMarkets.filter((market) => {
          if (!market.createdAt) return false;
          const createdAt = Date.parse(market.createdAt);
          if (Number.isNaN(createdAt)) return false;
          const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
          return createdAt >= cutoff;
        })
        : allMarkets.filter((market) => (market.tags || []).includes(hotTag));
  const [filteredWhistleMarkets, setFilteredWhistleMarkets] = useState<typeof allMarkets>([]);
  const baseWhistleIds = useMemo(() => baseWhistleMarkets.map((market) => String(market.id)), [baseWhistleMarkets]);
  const allMarketIds = useMemo(() => allMarkets.map((market) => String(market.id)), [allMarkets]);
  const marketById = useMemo(() => {
    const map = new Map<string, (typeof allMarkets)[number]>();
    for (const market of allMarkets) {
      map.set(String(market.id), market);
    }
    return map;
  }, [allMarkets]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const worker = new Worker("/whistle-search-worker.js");
    whistleWorkerRef.current = worker;
    worker.postMessage({ type: "init", markets: allMarkets });
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type: string; ids?: string[]; token?: number };
      if (data.type === "result" && data.ids) {
        if (data.token !== whistleTokenRef.current) return;
        const next = data.ids
          .map((id) => marketById.get(String(id)))
          .filter((market): market is (typeof allMarkets)[number] => Boolean(market));
        setFilteredWhistleMarkets(next);
      }
    };
    worker.addEventListener("message", onMessage);
    return () => {
      worker.removeEventListener("message", onMessage);
      worker.terminate();
    };
  }, [allMarkets, marketById]);

  useEffect(() => {
    const worker = whistleWorkerRef.current;
    if (!worker) return;
    const token = whistleTokenRef.current + 1;
    whistleTokenRef.current = token;
    worker.postMessage({
      type: "search",
      query: whistleSearch,
      baseIds: searching ? allMarketIds : baseWhistleIds,
      token
    });
  }, [whistleSearch, baseWhistleIds, allMarketIds, searching]);

  useEffect(() => {
    if (!searching) {
      setFilteredWhistleMarkets(baseWhistleMarkets);
    }
  }, [searching, baseWhistleMarkets]);
  useEffect(() => {
    setSearchLimit(60);
  }, [whistleSearch, hotTag]);

  const visibleWhistleMarkets = searching
    ? filteredWhistleMarkets.slice(0, searchLimit)
    : (filteredWhistleMarkets.length ? filteredWhistleMarkets : baseWhistleMarkets).slice(0, 20);

  useEffect(() => {
    const container = whistleRef.current;
    if (!container) return;
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches) {
      return;
    }

    const speed = 50; // px per second
    let last = performance.now();
    const tick = () => {
      if (!container) return;
      const now = performance.now();
      const delta = (now - last) / 1000;
      last = now;
      const max = container.scrollWidth - container.clientWidth;
      if (max > 0 && !whistlePausedRef.current && !whistleHoverRef.current) {
        const next = container.scrollLeft + speed * delta;
        container.scrollLeft = next >= max ? next % max : next;
      }
    };

    const pause = () => {
      if (!container) return;
      whistlePausedRef.current = true;
      if (whistlePauseRef.current) window.clearTimeout(whistlePauseRef.current);
      whistlePauseRef.current = window.setTimeout(() => {
        if (!whistleHoverRef.current) {
          whistlePausedRef.current = false;
        }
      }, 1400);
    };

    whistlePausedRef.current = false;
    container.addEventListener("wheel", pause, { passive: true });

    const interval = window.setInterval(tick, 16);
    return () => {
      window.clearInterval(interval);
      container.removeEventListener("wheel", pause);
      if (whistlePauseRef.current) window.clearTimeout(whistlePauseRef.current);
      if (whistleResumeTimeoutRef.current) window.clearTimeout(whistleResumeTimeoutRef.current);
    };
  }, [hotMarkets, hotTag, whistleSearch, visibleWhistleMarkets.length]);

  useEffect(() => {
    const container = whistleRef.current;
    if (!container) return;
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches) {
      return;
    }

    const EDGE_ZONE = 36;
    const SPEED = 140; // px per second
    let last = performance.now();

    const step = () => {
      const dir = whistleEdgeDirRef.current;
      if (!container || dir === 0) {
        whistleEdgeRafRef.current = null;
        return;
      }
      const now = performance.now();
      const delta = (now - last) / 1000;
      last = now;
      const max = container.scrollWidth - container.clientWidth;
      if (max > 0) {
        container.scrollLeft = Math.max(0, Math.min(max, container.scrollLeft + dir * SPEED * delta));
      }
      whistleEdgeRafRef.current = requestAnimationFrame(step);
    };

    const onMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const offset = event.clientX - rect.left;
      let dir: 0 | -1 | 1 = 0;
      if (offset <= EDGE_ZONE) dir = -1;
      else if (offset >= rect.width - EDGE_ZONE) dir = 1;

      if (dir !== whistleEdgeDirRef.current) {
        whistleEdgeDirRef.current = dir;
        if (dir !== 0) {
          whistlePausedRef.current = true;
          last = performance.now();
          if (whistleEdgeRafRef.current == null) {
            whistleEdgeRafRef.current = requestAnimationFrame(step);
          }
        }
      }
    };

    const onLeave = () => {
      whistleEdgeDirRef.current = 0;
    };

    container.addEventListener("mousemove", onMove);
    container.addEventListener("mouseleave", onLeave);
    return () => {
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseleave", onLeave);
      if (whistleEdgeRafRef.current != null) cancelAnimationFrame(whistleEdgeRafRef.current);
      whistleEdgeRafRef.current = null;
      whistleEdgeDirRef.current = 0;
    };
  }, [visibleWhistleMarkets.length]);

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
  const mobilePools =
    poolVisibilityFilter === "open"
      ? openPools
      : poolVisibilityFilter === "closed"
        ? closedPools
        : pools;

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
    const commentCount = commentCountsByPool[pool.id] || 0;
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
    const polymarketRef = parsePolymarketReference(pool.description);

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
              {investigatorExpandedByPool[pool.id] && <span className="muted">Whistleblower:</span>}
              <Link
                className="stat-link"
                href={`/profile/${pool.investigator.toLowerCase()}`}
                onClick={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  window.location.href = `/profile/${pool.investigator.toLowerCase()}`;
                }}
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
                  Whistleblower rating: {investigatorStars.toFixed(2)} / 5
                </span>
                <span className="pill mobile-only">Comments: {commentCount}</span>
              </>
            )}
            {isClosed && (
              <>
                <span className="pill deadline-pill">Deadline: {deadlineLabel}</span>
                <span className={`pill vote-pill ${voteTone}`}>
                  ^ {voteSummary.upvotes} / v {voteSummary.downvotes}
                </span>
                <span className="pill mobile-only">Comments: {commentCount}</span>
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
          {polymarketRef.cleanDescription && <p className="muted" style={{ marginTop: 4 }}>{polymarketRef.cleanDescription}</p>}
          {polymarketRef.marketUrl && (
            <p className="muted" style={{ marginTop: 4 }}>
              <a href={polymarketRef.marketUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                View related Polymarket bet
              </a>
            </p>
          )}
          {!pool.title && <p className="muted" style={{ fontSize: 12 }}>{pool.id}</p>}
          {pool.attachments && pool.attachments.length > 0 && (
            <div
              className="pool-attachments"
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
            >
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
          <div className="pool-card-footer desktop-only">
            <span className="muted">Comments: {commentCount}</span>
          </div>

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
              className={`decrypt-fold ${
                onchain.canDecrypt ? "decrypt-fold-ok" : deadlinePassed && !thresholdMet ? "decrypt-fold-expired" : "decrypt-fold-warn"
              }`}
            />
            <div className="decrypt-fold-tooltip">
              {onchain.canDecrypt
                ? "Eligible to decrypt: you contributed enough."
                : deadlinePassed && !thresholdMet
                  ? "Pool expired. Your contribution is below the decrypt floor, so you cannot decrypt."
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

        {status && (
          <div className="pool-status-wrap">
            <span className={`muted pool-status ${statusExpandedByPool[pool.id] ? "expanded" : ""}`}>
              {status}
            </span>
            <button
              className="button tiny pool-status-toggle"
              type="button"
              onClick={() =>
                setStatusExpandedByPool((prev) => ({ ...prev, [pool.id]: !prev[pool.id] }))
              }
            >
              {statusExpandedByPool[pool.id] ? "Hide" : "More"}
            </button>
          </div>
        )}

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
        <div />
        <div />
      </header>

      <div className={`ticker mobile-only mobile-ticker ${mobileTickerReady ? "ready" : ""}`} aria-label="Live pool updates">
        <div className="ticker-track">
          <div className="ticker-group">
            {mobileTickerItems.map((item, index) => (
              <span key={`mobile-ticker-${index}`} className="ticker-item">
                {item}
              </span>
            ))}
          </div>
          <div className="ticker-group" aria-hidden="true">
            {mobileTickerItems.map((item, index) => (
              <span key={`mobile-ticker-ghost-${index}`} className="ticker-item">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className={`ticker desktop-only desktop-ticker ${mobileTickerReady ? "ready" : ""}`} aria-label="Live pool updates">
        <div className="ticker-track">
          <div className="ticker-group">
            {mobileTickerItems.map((item, index) => (
              <span key={`desktop-ticker-${index}`} className="ticker-item">
                {item}
              </span>
            ))}
          </div>
          <div className="ticker-group" aria-hidden="true">
            {mobileTickerItems.map((item, index) => (
              <span key={`desktop-ticker-ghost-${index}`} className="ticker-item">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="message"> {error} </div>}

      <section className="panel desktop-only">
        <div className="section-header">
          <div className="section-title-row">
            <h2 className="section-title">Pools Filters</h2>
            <span className="pill">{pools.length} total</span>
          </div>
          <button
            type="button"
            className="button tiny"
            onClick={() => setPoolFilterOpen((prev) => !prev)}
          >
            {poolFilterOpen ? "Hide filters" : "Show filters"}
          </button>
        </div>
        {poolFilterOpen && (
          <div className="input-row" style={{ marginTop: 8 }}>
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
        )}
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <h2 className="section-title">Whistle</h2>
            <p className="muted">Do you have intel on these markets? Monetize it now.</p>
          </div>
          <button
            type="button"
            className="button tiny mobile-only"
            onClick={() => {
              const el = document.querySelector(".whistle-filters");
              if (el) el.classList.toggle("open");
            }}
          >
            Filters
          </button>
          <span className="pill">Polymarket</span>
        </div>
        {marketsLoading && (
          <div className="message" style={{ marginTop: -6 }}>
            <span className="loading-dot" />
            Loading markets...
          </div>
        )}
        {!marketsLoading && marketsStatus && <div className="message">{marketsStatus}</div>}
        <div className="input-row whistle-filters">
          <button className={`button ${hotTag === "all" ? "cta" : ""}`} onClick={() => setHotTag("all")}>
            Hot
          </button>
          {[
            "New",
            "Politics",
            "Sports",
            "Crypto",
            "Finance",
            "Geopolitics",
            "Earnings",
            "Tech",
            "Culture",
            "World",
            "Economy",
            "Climate & Science",
            "Mentions",
            "Elections"
          ].map((tag) => (
            <button
              key={tag}
              className={`button ${hotTag === tag ? "cta" : ""}`}
              onClick={() => setHotTag(tag)}
            >
              {tag}
            </button>
          ))}
          <input
            className="input"
            placeholder="Search market"
            value={whistleSearch}
            onChange={(event) => setWhistleSearch(event.target.value)}
            style={{ maxWidth: 240 }}
          />
        </div>
        <div className="whistle-rail">
          <div
            className="whistle-track"
            ref={whistleRef}
            onPointerEnter={() => {
              whistleHoverRef.current = true;
              whistlePausedRef.current = true;
              if (whistleResumeTimeoutRef.current) {
                window.clearTimeout(whistleResumeTimeoutRef.current);
                whistleResumeTimeoutRef.current = null;
              }
            }}
            onPointerLeave={() => {
              whistleHoverRef.current = false;
              if (whistleResumeTimeoutRef.current) {
                window.clearTimeout(whistleResumeTimeoutRef.current);
              }
              whistleResumeTimeoutRef.current = window.setTimeout(() => {
                whistlePausedRef.current = false;
                whistleResumeTimeoutRef.current = null;
              }, 220);
            }}
          >
            {!marketsLoading && filteredWhistleMarkets.length === 0 ? (
              <div className="message">No markets found for this {whistleSearch.trim() ? "search" : "filter"}.</div>
            ) : (
              <>
                {visibleWhistleMarkets.map((market) => {
                const tags = Array.isArray(market.tags) ? market.tags : [];
                const category = tags[0] || "Market";
                const tips = polymarketTipsById[String(market.id)] || [];
                const tipsExpanded = expandedMarketTips[String(market.id)];
                const marketSlug = market.slug || "";
                const eventSlug = market.eventSlug || "";
                const marketUrl = market.marketUrl || "";
                const params = new URLSearchParams();
                params.set("pm_category", category);
                params.set("pm_question", market.question || "");
                params.set("pm_slug", marketSlug || eventSlug);
                params.set("pm_event_slug", eventSlug);
                if (marketUrl) params.set("pm_market_url", marketUrl);
                params.set("pm_id", String(market.id || ""));
                params.set("pm_end", market.endDate || "");
                if (tags.length) params.set("pm_tags", tags.join("|"));
                const tipHref = `/create?${params.toString()}`;
                const marketHref = marketUrl || null;
                return (
                  <div
                    key={market.id}
                    className="card whistle-market-card"
                    onClick={() => {
                      if (!marketHref) return;
                      window.location.href = marketHref;
                    }}
                    onKeyDown={(event) => {
                      if (!marketHref) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        window.location.href = marketHref;
                      }
                    }}
                    role="link"
                    tabIndex={0}
                    aria-label={market.question ? `Open Polymarket market: ${market.question}` : "Open Polymarket market"}
                  >
                    <div className="stat-row" style={{ position: "relative" }}>
                      {market.image && (
                        <img
                          src={market.image}
                          alt={market.question}
                          style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover" }}
                        />
                      )}
                      <div>
                        <p className="muted">Polymarket</p>
                        <h3 style={{ margin: 0 }}>{market.question}</h3>
                      </div>
                      {tips.length > 0 && (
                        <div className="tip-indicator">
                          <span className="tip-count">{tips.length}</span>
                          <button
                            type="button"
                            className={`tip-dot ${tipsExpanded ? "active" : ""}`}
                            title="Tips available"
                            onClick={(event) => {
                              event.stopPropagation();
                              setExpandedMarketTips((prev) => ({
                                ...prev,
                                [String(market.id)]: !prev[String(market.id)]
                              }));
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="stat-row">
                      <span className="stat">24h volume: {Number(market.volume24hr || 0).toFixed(0)}</span>
                      <span className="stat">Ends: {new Date(market.endDate).toLocaleDateString()}</span>
                    </div>
                    {tipsExpanded && tips.length > 0 && (
                      <div className="tip-list">
                        <span className="muted">Whistles available:</span>
                        {tips.map((pool) => (
                          <Link
                            key={pool.id}
                            className="tip-link"
                            href={`/pool/${pool.id}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              event.preventDefault();
                              window.location.href = `/pool/${pool.id}`;
                            }}
                          >
                            {pool.title || pool.id}
                          </Link>
                        ))}
                      </div>
                    )}
                    <div className="stat-row">
                      <span className="muted">Have insight on this market? Create a pool.</span>
                      <Link
                        className="button cta"
                        href={tipHref}
                        onClick={(event) => {
                          event.stopPropagation();
                          event.preventDefault();
                          window.location.href = tipHref;
                        }}
                      >
                        Whistle
                      </Link>
                    </div>
                  </div>
                );
              })}
                {searching && filteredWhistleMarkets.length > searchLimit && (
                  <div className="card" style={{ alignItems: "center", justifyContent: "center" }}>
                    <p className="muted">Showing {searchLimit} of {filteredWhistleMarkets.length} results</p>
                    <button className="button" onClick={() => setSearchLimit((prev) => prev + 60)}>
                      Load more
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      <section className="panel mobile-only">
        <div className="section-header">
          <div>
            <h2 className="section-title">Pools</h2>
            <p className="muted">Swipe through pools. Tap to open details.</p>
          </div>
          <button
            type="button"
            className="button tiny"
            onClick={() => setMobilePoolFilterOpen((prev) => !prev)}
          >
            {mobilePoolFilterOpen ? "Hide filters" : "Show filters"}
          </button>
        </div>
        {mobilePoolFilterOpen && (
          <div className="input-row" style={{ marginTop: 8 }}>
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
        )}
        {poolsLoading && (
          <div className="message">
            <span className="loading-dot" />
            Loading pools...
          </div>
        )}
        {!poolsLoading && (
          <div className="pool-carousel">
            {mobilePools.map((pool) => (
              <div key={pool.id} className="pool-snap">
                {renderPoolCard(pool)}
              </div>
            ))}
          </div>
        )}
      </section>

      {poolVisibilityFilter !== "closed" && (
        <section className="panel desktop-only">
          <div className="section-header">
            <h2 className="section-title">Open pools</h2>
            <span className="pill">{visibleOpenPools.length} listed</span>
          </div>
          {poolsLoading && (
            <div className="message">
              <span className="loading-dot" />
              Loading pools...
            </div>
          )}
          {!poolsLoading && visibleOpenPools.length === 0 && (
            <div className="message">No open pools for the selected filter.</div>
          )}
          {!poolsLoading && <div className="grid">{visibleOpenPools.map(renderPoolCard)}</div>}
        </section>
      )}

      {poolVisibilityFilter !== "open" && (
        <section className="panel desktop-only">
          <div className="section-header">
            <h2 className="section-title">Closed pools</h2>
            <span className="pill">{visibleClosedPools.length} listed</span>
          </div>
          {poolsLoading && (
            <div className="message">
              <span className="loading-dot" />
              Loading pools...
            </div>
          )}
          {!poolsLoading && visibleClosedPools.length === 0 && (
            <div className="message">No closed pools for the selected filter.</div>
          )}
          {!poolsLoading && (
            <div className="pool-slider-rail">
              <div className="pool-slider-track">{visibleClosedPools.map(renderPoolCard)}</div>
            </div>
          )}
        </section>
      )}

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
