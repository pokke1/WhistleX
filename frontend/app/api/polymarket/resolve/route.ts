import { NextResponse } from "next/server";

const GAMMA_API = "https://gamma-api.polymarket.com";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Polymarket request failed: ${res.status}`);
  return res.json();
}

function buildMarketUrl(eventSlug: string | null, marketSlug: string | null) {
  if (eventSlug && marketSlug && eventSlug !== marketSlug) {
    return `https://polymarket.com/event/${eventSlug}/${marketSlug}`;
  }
  if (eventSlug) return `https://polymarket.com/event/${eventSlug}`;
  if (marketSlug) return `https://polymarket.com/event/${marketSlug}`;
  return null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const marketId = searchParams.get("marketId")?.trim() || "";
    const marketSlugParam = searchParams.get("marketSlug")?.trim() || "";
    const eventSlugParam = searchParams.get("eventSlug")?.trim() || "";

    let marketSlug: string | null = marketSlugParam || null;
    let eventSlug: string | null = eventSlugParam || null;

    if (marketId) {
      const url = new URL(`${GAMMA_API}/markets`);
      url.searchParams.set("id", marketId);
      const markets = await fetchJson<any[]>(url.toString());
      const market = Array.isArray(markets) ? markets[0] : null;
      marketSlug = market?.slug || marketSlug;
      eventSlug = market?.events?.[0]?.slug || eventSlug;
    } else if (marketSlug && !eventSlug) {
      const url = new URL(`${GAMMA_API}/markets`);
      url.searchParams.set("slug", marketSlug);
      const markets = await fetchJson<any[]>(url.toString());
      const market = Array.isArray(markets) ? markets[0] : null;
      eventSlug = market?.events?.[0]?.slug || null;
    }

    const marketUrl = buildMarketUrl(eventSlug, marketSlug);
    return NextResponse.json({ marketId: marketId || null, marketSlug, eventSlug, marketUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "failed to resolve polymarket link" }, { status: 500 });
  }
}

