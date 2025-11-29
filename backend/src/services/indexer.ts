import { ethers } from "ethers";
import dotenv from "dotenv";
import IntelPoolFactoryAbi from "../../contracts/IntelPoolFactory.json" with { type: "json" };
import IntelPoolAbi from "../../contracts/IntelPool.json" with { type: "json" };
import { supabase } from "../db/supabase.js";
import { PoolRecord, ContributionRecord } from "../types/models.js";

const DEFAULT_SEPOLIA_RPC_URL = "https://sepolia.drpc.org";

dotenv.config();

export async function startIndexer(factoryAddress: string) {
  const rpcUrl = process.env.RPC_URL || process.env.SEPOLIA_RPC_URL || DEFAULT_SEPOLIA_RPC_URL;
  if (!rpcUrl) {
    console.warn("RPC_URL is not set; skipping indexer startup.");
    return;
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const factory = new ethers.Contract(factoryAddress, IntelPoolFactoryAbi.abi, provider);

  factory.on("PoolCreated", async (investigator, pool, threshold, minContributionForDecrypt, deadline, ciphertext, event) => {
    const payload: PoolRecord = {
      id: pool,
      investigator,
      threshold: threshold.toString(),
      minContributionForDecrypt: minContributionForDecrypt.toString(),
      factoryAddress: factoryAddress,
      deadline: deadline.toString(),
      ciphertext: ethers.hexlify(ciphertext)
    };
    await supabase.from("pools").upsert(payload);
    console.log("Indexed PoolCreated", payload, event?.transactionHash);

    attachPoolListeners(pool, provider);
  });

  const existingPools = (await supabase.from("pools").select("id")).data || [];
  existingPools.forEach(({ id }) => attachPoolListeners(id, provider));
}

function attachPoolListeners(address: string, provider: ethers.Provider) {
  const pool = new ethers.Contract(address, IntelPoolAbi.abi, provider);

  pool.on("Contributed", async (contributor, amount) => {
    const payload: ContributionRecord = {
      id: `${address}-${contributor}-${Date.now()}`,
      contributor,
      amount: amount.toString(),
      poolId: address
    };
    await supabase.from("contributions").upsert(payload);
    console.log("Indexed contribution", payload);
  });
}
