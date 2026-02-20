import express, { Request, Response } from "express";

const router = express.Router();
const GAMMA_API = "https://gamma-api.polymarket.com";
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedMarkets: any[] | null = null;
let cachedAt = 0;
let inflight: Promise<any[]> | null = null;

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Polymarket request failed: ${res.status}`);
  return res.json();
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

async function fetchMarkets(): Promise<any[]> {
  const now = Date.now();
  const pageSize = 200;
  let offset = 0;
  const markets: any[] = [];

  while (true) {
    const url = new URL(`${GAMMA_API}/events`);
    url.searchParams.set("limit", String(pageSize));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("active", "true");
    url.searchParams.set("closed", "false");

    const events = await fetchJson(url.toString());
    if (!Array.isArray(events) || events.length === 0) break;

    for (const event of events) {
      const eventEnd = parseDate(event?.endDate);
      if (eventEnd && eventEnd <= now) continue;
      const tags = (event?.tags || []).map((tag: any) => tag?.label).filter(Boolean);
      const eventMarkets = Array.isArray(event?.markets) ? event.markets : [];
      for (const market of eventMarkets) {
        const endDate = parseDate(market?.endDate);
        if (!endDate || endDate <= now) continue;
        if (market?.active === false || market?.closed === true) continue;
        const createdAt = market?.createdAt || event?.createdAt || event?.creationDate || event?.startDate || null;
        markets.push({
          id: market?.id,
          slug: market?.slug,
          question: market?.question,
          endDate: market?.endDate,
          createdAt,
          volume24hr: market?.volume24hr,
          image: market?.icon || market?.image || null,
          tags
        });
      }
    }

    if (events.length < pageSize) break;
    offset += pageSize;
  }

  return markets;
}

async function getCachedMarkets(): Promise<any[]> {
  const now = Date.now();
  if (cachedMarkets && now - cachedAt < CACHE_TTL_MS) {
    return cachedMarkets;
  }
  if (inflight) {
    return inflight;
  }
  inflight = fetchMarkets()
    .then((markets) => {
      cachedMarkets = markets;
      cachedAt = Date.now();
      return markets;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

router.get("/markets", async (_req: Request, res: Response) => {
  try {
    const markets = await getCachedMarkets();
    return res.json({ markets, cachedAt });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "failed to fetch markets" });
  }
});

export default router;
