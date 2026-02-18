export interface ParsedPolymarketReference {
  cleanDescription: string;
  marketId: string | null;
  marketSlug: string | null;
  eventSlug: string | null;
  marketUrl: string | null;
}

const POLYMARKET_ID_REGEX = /<!--\s*polymarket_id:([0-9]+)\s*-->/i;
const POLYMARKET_SLUG_REGEX = /<!--\s*polymarket_slug:([a-z0-9-]+)\s*-->/i;
const POLYMARKET_EVENT_SLUG_REGEX = /<!--\s*polymarket_event_slug:([a-z0-9-]+)\s*-->/i;
const POLYMARKET_URL_REGEX = /<!--\s*polymarket_url:(https?:\/\/[^>\s]+)\s*-->/i;
const POLYMARKET_MARKER_REGEX = /<!--\s*polymarket_[a-z_]+:[^>]+-->/gi;

export function parsePolymarketReference(description?: string | null): ParsedPolymarketReference {
  const source = description || "";
  const idMatch = source.match(POLYMARKET_ID_REGEX);
  const slugMatch = source.match(POLYMARKET_SLUG_REGEX);
  const eventSlugMatch = source.match(POLYMARKET_EVENT_SLUG_REGEX);
  const urlMatch = source.match(POLYMARKET_URL_REGEX);
  const marketId = idMatch?.[1] || null;
  const marketSlug = slugMatch?.[1] || null;
  const eventSlug = eventSlugMatch?.[1] || null;
  const cleanDescription = source.replace(POLYMARKET_MARKER_REGEX, "").replace(/\n{3,}/g, "\n\n").trim();
  const marketUrlFromMarkers =
    eventSlug && marketSlug && eventSlug !== marketSlug
      ? `https://polymarket.com/event/${eventSlug}/${marketSlug}`
      : eventSlug
        ? `https://polymarket.com/event/${eventSlug}`
        : marketSlug
          ? `https://polymarket.com/event/${marketSlug}`
          : null;
  const marketUrl = urlMatch?.[1] || marketUrlFromMarkers;
  return { cleanDescription, marketId, marketSlug, eventSlug, marketUrl };
}
