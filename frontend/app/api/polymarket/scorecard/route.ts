import { NextResponse } from "next/server";
import { buildPolymarketScorecard } from "../../../../lib/polymarket";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  const limit = Number(searchParams.get("limit") || "100");

  if (!address) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }

  try {
    const data = await buildPolymarketScorecard(address, Number.isFinite(limit) ? limit : 100);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "failed to fetch Polymarket scorecard" }, { status: 500 });
  }
}
