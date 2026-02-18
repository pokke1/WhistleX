export interface ParsedPolymarketReference {
  cleanDescription: string;
  marketId: string | null;
  marketSlug: string | null;
  marketUrl: string | null;
}

const POLYMARKET_ID_REGEX = /<!--\s*polymarket_id:([0-9]+)\s*-->/i;
const POLYMARKET_SLUG_REGEX = /<!--\s*polymarket_slug:([a-z0-9-]+)\s*-->/i;
const POLYMARKET_MARKER_REGEX = /<!--\s*polymarket_(?:id|slug):[^>]+-->/gi;

export function parsePolymarketReference(description?: string | null): ParsedPolymarketReference {
  const source = description || "";
  const idMatch = source.match(POLYMARKET_ID_REGEX);
  const slugMatch = source.match(POLYMARKET_SLUG_REGEX);
  const marketId = idMatch?.[1] || null;
  const marketSlug = slugMatch?.[1] || null;
  const cleanDescription = source.replace(POLYMARKET_MARKER_REGEX, "").replace(/\n{3,}/g, "\n\n").trim();
  const marketUrl = marketSlug ? `https://polymarket.com/event/${marketSlug}` : null;
  return { cleanDescription, marketId, marketSlug, marketUrl };
}
