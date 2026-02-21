const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

async function proxy(req: Request, params: { path?: string[] }) {
  const path = (params.path || []).join("/");
  const url = new URL(backendBase.replace(/\/$/, "") + "/" + path);
  const incomingUrl = new URL(req.url);
  incomingUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  const init: RequestInit = {
    method: req.method,
    headers: req.headers
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  const upstream = await fetch(url.toString(), init);
  const body = await upstream.arrayBuffer();

  const headers = new Headers(upstream.headers);
  headers.set("x-whistlex-proxy", "1");
  return new Response(body, { status: upstream.status, headers });
}

export async function GET(req: Request, context: { params: { path?: string[] } }) {
  return proxy(req, context.params);
}
export async function POST(req: Request, context: { params: { path?: string[] } }) {
  return proxy(req, context.params);
}
export async function PUT(req: Request, context: { params: { path?: string[] } }) {
  return proxy(req, context.params);
}
export async function PATCH(req: Request, context: { params: { path?: string[] } }) {
  return proxy(req, context.params);
}
export async function DELETE(req: Request, context: { params: { path?: string[] } }) {
  return proxy(req, context.params);
}
