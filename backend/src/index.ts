import express, { Request, Response } from "express";
import morgan from "morgan";
import dotenv from "dotenv";
import poolsRouter from "./routes/pools.js";
import intelRouter from "./routes/intel.js";
import { startIndexer } from "./services/indexer.js";

dotenv.config();

console.log("Starting backend server...");

const app = express();
app.use(express.json());
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
app.use("/pools", poolsRouter);
app.use("/intel", intelRouter);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`backend listening on ${port}`);
  if (process.env.FACTORY_ADDRESS) {
    startIndexer(process.env.FACTORY_ADDRESS);
  }
});
