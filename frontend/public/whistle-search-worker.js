let index = new Map();

self.onmessage = (event) => {
  const payload = event.data;
  if (!payload || !payload.type) return;
  if (payload.type === "init") {
    index = new Map();
    const markets = Array.isArray(payload.markets) ? payload.markets : [];
    for (const market of markets) {
      const q = `${market.question || ""} ${market.slug || ""}`.toLowerCase();
      index.set(String(market.id), q);
    }
    self.postMessage({ type: "ready" });
    return;
  }
  if (payload.type === "search") {
    const query = String(payload.query || "").trim().toLowerCase();
    const baseIds = Array.isArray(payload.baseIds) ? payload.baseIds : [];
    if (!query) {
      self.postMessage({ type: "result", ids: baseIds, token: payload.token });
      return;
    }
    const matched = [];
    for (const id of baseIds) {
      const text = index.get(String(id)) || "";
      if (text.includes(query)) matched.push(id);
    }
    self.postMessage({ type: "result", ids: matched, token: payload.token });
  }
};
