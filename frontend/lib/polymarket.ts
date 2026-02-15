const DATA_API = "https://data-api.polymarket.com";
const GAMMA_API = "https://gamma-api.polymarket.com";
const CLOB_API = "https://clob.polymarket.com";

export interface PolymarketActivityItem {
  proxyWallet?: string;
  timestamp: number;
  conditionId: string;
  type: string;
  size: number | string;
  usdcSize?: number | string;
  transactionHash?: string;
  price: number | string;
  asset?: string;
  side?: "BUY" | "SELL";
  outcomeIndex?: number;
  title?: string;
  slug?: string;
  icon?: string;
  eventSlug?: string;
  outcome?: string;
}

export interface PolymarketTradeItem {
  timestamp: number;
  side: "BUY" | "SELL";
  size: number;
  price: number;
  usdcSize: number;
  asset: string;
  marketSlug?: string;
  eventSlug?: string;
  title?: string;
  outcome?: string;
  resolvedOutcome?: string | null;
  result?: "Won" | "Lost" | "Open";
  category: string;
  tags: string[];
  pnl: number | null;
}

export interface PolymarketCategoryScore {
  category: string;
  trades: number;
  volumeUsdc: number;
  pnl: number | null;
  pnlPartial: boolean;
  pnlKnownCount: number;
  pnlMissingCount: number;
}

export interface PolymarketScorecardData {
  totalTrades: number;
  totalVolumeUsdc: number;
  totalPnl: number | null;
  totalPnlPartial: boolean;
  categories: PolymarketCategoryScore[];
  trades: PolymarketTradeItem[];
  pricingNote: string;
}

function deriveCategoryFromSlug(slug?: string): string | null {
  if (!slug) return null;
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
    .trim();
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Polymarket request failed: ${res.status}`);
  return res.json();
}

async function fetchActivity(address: string, limit: number): Promise<PolymarketActivityItem[]> {
  const url = new URL(`${DATA_API}/activity`);
  url.searchParams.set("user", address);
  url.searchParams.set("limit", String(limit));
  return fetchJson<PolymarketActivityItem[]>(url.toString());
}

async function fetchEventTags(eventSlug: string): Promise<string[]> {
  const url = new URL(`${GAMMA_API}/events`);
  url.searchParams.set("slug", eventSlug);
  const events = await fetchJson<any[]>(url.toString());
  const event = events?.[0];
  const tags = Array.isArray(event?.tags) ? event.tags : [];
  return tags.map((tag: any) => tag?.label).filter(Boolean);
}

async function fetchEventTagsById(eventId: string): Promise<string[]> {
  const url = new URL(`${GAMMA_API}/events`);
  url.searchParams.set("id", eventId);
  const events = await fetchJson<any[]>(url.toString());
  const event = events?.[0];
  const tags = Array.isArray(event?.tags) ? event.tags : [];
  return tags.map((tag: any) => tag?.label).filter(Boolean);
}

async function fetchMarketBySlug(marketSlug: string): Promise<any | null> {
  const url = new URL(`${GAMMA_API}/markets`);
  url.searchParams.set("slug", marketSlug);
  const markets = await fetchJson<any[]>(url.toString());
  return markets?.[0] || null;
}

function parseArrayField(value: any): any[] | null {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function deriveBaseTitle(title?: string): string | null {
  if (!title) return null;
  return title.split(" - ")[0]?.trim() || null;
}

function resolveOutcome(outcomes: string[] | null, outcomePrices: any[] | null, market: any): string | null {
  if (!outcomes || !outcomePrices || outcomes.length === 0) return null;
  const prices = outcomePrices.map((price) => Number(price));
  if (prices.some((price) => !Number.isFinite(price))) return null;
  const maxPrice = Math.max(...prices);
  const maxIndex = prices.findIndex((price) => price === maxPrice);
  const isResolved = market?.closed === true || maxPrice >= 0.999 || maxPrice <= 0.001;
  if (!isResolved) return null;
  return outcomes[maxIndex] ?? null;
}

async function fetchTokenPrice(tokenId: string): Promise<number | null> {
  const url = new URL(`${CLOB_API}/price`);
  url.searchParams.set("token_id", tokenId);
  url.searchParams.set("side", "buy");
  try {
    const data = await fetchJson<{ price?: string | number }>(url.toString());
    const price = Number(data?.price);
    return Number.isFinite(price) ? price : null;
  } catch {
    return null;
  }
}

export async function buildPolymarketScorecard(address: string, limit = 100): Promise<PolymarketScorecardData> {
  const activity = await fetchActivity(address, limit);
  const trades = activity.filter((item) => item.type === "TRADE" && item.asset && item.side) as PolymarketActivityItem[];

  const eventSlugs = Array.from(new Set(trades.map((item) => item.eventSlug).filter(Boolean))) as string[];
  const marketSlugs = Array.from(new Set(trades.map((item) => item.slug).filter(Boolean))) as string[];
  const tokenIds = Array.from(new Set(trades.map((item) => item.asset).filter(Boolean))) as string[];

  const eventTagsEntries = await Promise.all(
    eventSlugs.map(async (slug) => {
      try {
        const tags = await fetchEventTags(slug);
        return [slug, tags] as const;
      } catch {
        return [slug, [] as string[]] as const;
      }
    })
  );
  const eventTags = new Map(eventTagsEntries);

  const marketEntries = await Promise.all(
    marketSlugs.map(async (slug) => {
      try {
        const market = await fetchMarketBySlug(slug);
        return [slug, market] as const;
      } catch {
        return [slug, null] as const;
      }
    })
  );
  const marketBySlug = new Map(marketEntries);
  const marketEventIds = new Map(
    marketEntries.map(([slug, market]) => [slug, market?.events?.[0]?.id ? String(market.events[0].id) : null])
  );

  const eventIds = Array.from(new Set([...marketEventIds.values()].filter(Boolean))) as string[];
  const eventIdTagsEntries = await Promise.all(
    eventIds.map(async (eventId) => {
      try {
        const tags = await fetchEventTagsById(eventId);
        return [eventId, tags] as const;
      } catch {
        return [eventId, [] as string[]] as const;
      }
    })
  );
  const eventIdTags = new Map(eventIdTagsEntries);

  const tokenPriceEntries = await Promise.all(
    tokenIds.map(async (tokenId) => {
      const price = await fetchTokenPrice(tokenId);
      return [tokenId, price] as const;
    })
  );
  const tokenPrices = new Map(tokenPriceEntries);

  const categoryMap = new Map<string, PolymarketCategoryScore>();
  let totalPnl = 0;
  let totalPnlKnownCount = 0;
  let totalPnlMissingCount = 0;
  let totalVolume = 0;
  let totalTrades = 0;
  const allTrades: PolymarketTradeItem[] = [];

  for (const trade of trades) {
    const size = Number(trade.size || 0);
    const price = Number(trade.price || 0);
    const usdcSize = Number(trade.usdcSize ?? size * price);
    const side = trade.side as "BUY" | "SELL";
    const asset = trade.asset as string;
    if (!Number.isFinite(size) || !Number.isFinite(price) || !asset) continue;

    const tagsFromEventSlug = trade.eventSlug ? eventTags.get(trade.eventSlug) || [] : [];
    const eventId = trade.slug ? marketEventIds.get(trade.slug) : null;
    const tagsFromEventId = eventId ? eventIdTags.get(eventId) || [] : [];
    const tags = tagsFromEventSlug.length > 0 ? tagsFromEventSlug : tagsFromEventId;
    const baseTitle = deriveBaseTitle(trade.title);
    const category = baseTitle || tags[0] || deriveCategoryFromSlug(trade.slug || trade.eventSlug) || "Uncategorized";

    const market = trade.slug ? marketBySlug.get(trade.slug) : null;
    const clobTokenIds = parseArrayField(market?.clobTokenIds);
    const outcomes = parseArrayField(market?.outcomes);
    const outcomePrices = parseArrayField(market?.outcomePrices);
    const outcomeIndexFromAsset =
      clobTokenIds && clobTokenIds.length > 0
        ? clobTokenIds.findIndex((tokenId: string | number) => String(tokenId) === String(asset))
        : -1;
    const outcomeIndexFromLabel =
      outcomes && trade.outcome
        ? outcomes.findIndex((label: string) => String(label).toLowerCase() === String(trade.outcome).toLowerCase())
        : -1;
    const outcomeIndex =
      typeof trade.outcomeIndex === "number"
        ? trade.outcomeIndex
        : outcomeIndexFromAsset >= 0
          ? outcomeIndexFromAsset
          : outcomeIndexFromLabel >= 0
            ? outcomeIndexFromLabel
            : null;

    const priceFromOutcome =
      outcomePrices && outcomeIndex != null && outcomeIndex < outcomePrices.length
        ? Number(outcomePrices[outcomeIndex])
        : null;
    const markPrice =
      priceFromOutcome != null && Number.isFinite(priceFromOutcome)
        ? priceFromOutcome
        : tokenPrices.get(asset);

    const pnl =
      markPrice == null
        ? null
        : side === "BUY"
          ? (markPrice - price) * size
          : (price - markPrice) * size;

    const resolvedOutcome = resolveOutcome(outcomes, outcomePrices, market);
    let result: "Won" | "Lost" | "Open" = "Open";
    if (resolvedOutcome && trade.outcome) {
      result = resolvedOutcome.toLowerCase() === trade.outcome.toLowerCase() ? "Won" : "Lost";
    }

    totalTrades += 1;
    totalVolume += Math.abs(usdcSize);
    allTrades.push({
      timestamp: trade.timestamp,
      side,
      size,
      price,
      usdcSize,
      asset,
      marketSlug: trade.slug,
      eventSlug: trade.eventSlug,
      title: trade.title,
      outcome: trade.outcome,
      resolvedOutcome,
      result,
      category,
      tags,
      pnl
    });

    const existing = categoryMap.get(category);
    const categoryScore = existing || {
      category,
      trades: 0,
      volumeUsdc: 0,
      pnl: 0,
      pnlPartial: false,
      pnlKnownCount: 0,
      pnlMissingCount: 0
    };

    categoryScore.trades += 1;
    categoryScore.volumeUsdc += Math.abs(usdcSize);
    if (pnl != null) {
      categoryScore.pnl = (categoryScore.pnl ?? 0) + pnl;
      categoryScore.pnlKnownCount += 1;
    } else {
      categoryScore.pnlPartial = true;
      categoryScore.pnlMissingCount += 1;
    }

    categoryMap.set(category, categoryScore);

    if (pnl != null) {
      totalPnl += pnl;
      totalPnlKnownCount += 1;
    } else {
      totalPnlMissingCount += 1;
    }
  }

  const categories = Array.from(categoryMap.values())
    .map((item) => ({
      ...item,
      pnl: item.pnlKnownCount > 0 ? item.pnl : null,
      pnlPartial: item.pnlMissingCount > 0 && item.pnlKnownCount > 0
    }))
    .sort((a, b) => (b.pnl ?? 0) - (a.pnl ?? 0));
  const tradesSorted = allTrades.sort((a, b) => b.timestamp - a.timestamp);

  return {
    totalTrades,
    totalVolumeUsdc: totalVolume,
    totalPnl: totalPnlKnownCount > 0 ? totalPnl : null,
    totalPnlPartial: totalPnlMissingCount > 0 && totalPnlKnownCount > 0,
    categories,
    trades: tradesSorted,
    pricingNote:
      "PnL uses resolved outcome prices when available, otherwise CLOB buy prices. Positions without a mark price are excluded."
  };
}

export async function fetchPolymarketScorecard(address: string, limit = 100): Promise<PolymarketScorecardData> {
  if (typeof window === "undefined") {
    return buildPolymarketScorecard(address, limit);
  }
  const url = new URL("/api/polymarket/scorecard", window.location.origin);
  url.searchParams.set("address", address);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("failed to fetch Polymarket scorecard");
  return res.json();
}
