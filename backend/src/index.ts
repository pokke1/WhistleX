import express, { Request, Response } from "express";
import morgan from "morgan";
import dotenv from "dotenv";
import poolsRouter from "./routes/pools.js";
import intelRouter from "./routes/intel.js";
import profilesRouter from "./routes/profiles.js";
import votesRouter from "./routes/votes.js";
import { startIndexer } from "./services/indexer.js";

dotenv.config();

console.log("Starting backend server...");

const app = express();
app.use(express.json({ limit: "25mb" }));
app.use(morgan("dev"));

// Lightweight CORS handler so the Next.js frontend (localhost:3000) can call the API
const allowedOrigin = process.env.FRONTEND_ORIGIN || "*";
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  if (next) next();
});

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
app.use("/pools", poolsRouter);
app.use("/intel", intelRouter);
app.use("/profiles", profilesRouter);
app.use("/votes", votesRouter);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`backend listening on ${port}`);
  if (process.env.FACTORY_ADDRESS) {
    startIndexer(process.env.FACTORY_ADDRESS);
  }
});
