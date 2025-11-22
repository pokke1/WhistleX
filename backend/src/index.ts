import express from "express";
import morgan from "morgan";
import dotenv from "dotenv";
import poolsRouter from "./routes/pools.js";
import intelRouter from "./routes/intel.js";
import { startIndexer } from "./services/indexer.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/pools", poolsRouter);
app.use("/intel", intelRouter);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`backend listening on ${port}`);
  if (process.env.FACTORY_ADDRESS) {
    startIndexer(process.env.FACTORY_ADDRESS);
  }
});
