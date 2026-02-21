export const dynamic = "force-static";

const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

const index = {
  name: "WhistleX API",
  backendBase,
  proxyBase: "/api/whistlex",
  docs: "https://wstlx.com/skill.md",
  routes: {
    auth: {
      nonce: "GET /api/whistlex/auth/nonce?address=0x...",
      verify: "POST /api/whistlex/auth/verify { address, signature }"
    },
    pools: {
      list: "GET /api/whistlex/pools",
      create: "POST /api/whistlex/pools",
      state: "GET /api/whistlex/pools/:poolId/state?address=0x...",
      contributors: "GET /api/whistlex/pools/:poolId/contributors",
      comments: "GET /api/whistlex/pools/:poolId/comments",
      commentPost: "POST /api/whistlex/pools/:poolId/comments",
      commentCounts: "GET /api/whistlex/pools/comments/counts?ids=0x1,0x2"
    },
    votes: {
      get: "GET /api/whistlex/votes/pools/:poolId?voter=0x...",
      post: "POST /api/whistlex/votes/pools/:poolId"
    },
    profiles: {
      get: "GET /api/whistlex/profiles/:address"
    },
    polymarket: {
      markets: "GET /api/whistlex/polymarket/markets"
    }
  }
};

export async function GET() {
  return new Response(JSON.stringify(index, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
