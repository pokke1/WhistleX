import { ethers } from "ethers";
import dotenv from "dotenv";
import IntelPoolFactoryAbi from "../../contracts/IntelPoolFactory.json" assert { type: "json" };
import IntelPoolAbi from "../../contracts/IntelPool.json" assert { type: "json" };
import { supabase } from "../db/supabase.js";
import { PoolRecord, ContributionRecord } from "../types/models.js";

dotenv.config();

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

export async function startIndexer(factoryAddress: string) {
  const factory = new ethers.Contract(factoryAddress, IntelPoolFactoryAbi.abi, provider);

  factory.on("PoolCreated", async (investigator, pool, threshold, minContributionForDecrypt, event) => {
    const payload: PoolRecord = {
      id: pool,
      investigator,
      threshold: threshold.toString(),
      minContributionForDecrypt: minContributionForDecrypt.toString(),
      factoryAddress: factoryAddress
    };
    await supabase.from("pools").upsert(payload);
    console.log("Indexed PoolCreated", payload, event?.transactionHash);

    attachPoolListeners(pool);
  });

  const existingPools = (await supabase.from("pools").select("id")).data || [];
  existingPools.forEach(({ id }) => attachPoolListeners(id));
}

function attachPoolListeners(address: string) {
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
