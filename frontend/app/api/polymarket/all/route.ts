import { NextResponse } from "next/server";

const GAMMA_API = "https://gamma-api.polymarket.com";

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

function parseArrayField(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET() {
  try {
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
          const eventSlug = event?.slug || null;
          const marketSlug = market?.slug || null;
          const optionsCount = parseArrayField(market?.outcomes).length;
          const marketUrl =
            eventSlug && marketSlug && eventSlug !== marketSlug
              ? `https://polymarket.com/event/${eventSlug}/${marketSlug}`
              : eventSlug
                ? `https://polymarket.com/event/${eventSlug}`
                : marketSlug
                  ? `https://polymarket.com/event/${marketSlug}`
                  : null;
          markets.push({
            id: market?.id,
            slug: marketSlug,
            eventSlug,
            marketUrl,
            optionsCount,
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

    return NextResponse.json({ markets });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "failed to fetch markets" }, { status: 500 });
  }
}
