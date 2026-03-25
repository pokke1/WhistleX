import express, { Request, Response } from "express";
import morgan from "morgan";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import poolsRouter from "./routes/pools.js";
import intelRouter from "./routes/intel.js";
import profilesRouter from "./routes/profiles.js";
import votesRouter from "./routes/votes.js";
import polymarketRouter from "./routes/polymarket.js";
import authRouter from "./routes/auth.js";
import { startIndexer } from "./services/indexer.js";

dotenv.config();

console.log("Starting backend server...");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));
app.use(helmet());

const normalizeOrigin = (value: string) => value.trim().replace(/\/$/, "");

const configuredOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((v) => normalizeOrigin(v))
  .filter(Boolean);

const netlifyPreviewOriginRegex = /^https:\/\/deploy-preview-\d+--whistlex\.netlify\.app$/;

if (configuredOrigins.length === 0 && process.env.NODE_ENV === "production") {
  throw new Error("FRONTEND_ORIGIN is required in production");
}

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true);
    const normalizedIncomingOrigin = normalizeOrigin(origin);

    if (configuredOrigins.length === 0 && process.env.NODE_ENV !== "production") {
      return callback(null, true);
    }
    if (configuredOrigins.includes(normalizedIncomingOrigin)) {
      return callback(null, true);
    }
    if (netlifyPreviewOriginRegex.test(normalizedIncomingOrigin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${normalizedIncomingOrigin}`));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};
app.use(cors(corsOptions));

const defaultWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const defaultMax = Number(process.env.RATE_LIMIT_MAX || 120);
const rpcMax = Number(process.env.RPC_RATE_LIMIT_MAX || 30);

app.use(
  rateLimit({
    windowMs: defaultWindowMs,
    max: defaultMax,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.use(
  "/rpc",
  rateLimit({
    windowMs: defaultWindowMs,
    max: rpcMax,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.get("/health", (_req: Request, res: Response) => res.json({ status: "ok" }));

app.post("/rpc", async (req: Request, res: Response) => {
  const rpcUrl = process.env.AMOY_RPC_URL || process.env.RPC_URL;
  if (!rpcUrl) {
    return res.status(500).json({ error: "RPC URL not configured" });
  }

  try {
    const upstream = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req.body)
    });
    const body = await upstream.text();
    res.status(upstream.status).set("content-type", "application/json").send(body);
  } catch (error: any) {
    res.status(502).json({ error: error?.message || "RPC proxy failed" });
  }
});

app.use("/auth", authRouter);
app.use("/pools", poolsRouter);
app.use("/intel", intelRouter);
app.use("/profiles", profilesRouter);
app.use("/votes", votesRouter);
app.use("/polymarket", polymarketRouter);

const port = Number.parseInt(process.env.PORT ?? "8080", 10);

app.listen(port, () => {
  console.log(`backend listening on 0.0.0.0:${port}`);
  if (process.env.FACTORY_ADDRESS) {
    startIndexer(process.env.FACTORY_ADDRESS);
  }
});
