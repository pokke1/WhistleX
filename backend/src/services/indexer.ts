import { ethers, EventLog } from "ethers";
import dotenv from "dotenv";
import IntelPoolFactoryAbi from "../../contracts/IntelPoolFactory.json" with { type: "json" };
import IntelPoolAbi from "../../contracts/IntelPool.json" with { type: "json" };
import { supabase } from "../db/supabase.js";
import { PoolRecord, ContributionRecord } from "../types/models.js";

const DEFAULT_POLYGON_AMOY_RPC_URL = "https://polygon-amoy.drpc.org";

dotenv.config();

type PoolListenerState = {
  contract: ethers.Contract;
  lastSeenBlock: number;
};

export async function startIndexer(factoryAddress: string) {
  const rpcUrl = process.env.RPC_URL || process.env.AMOY_RPC_URL || DEFAULT_POLYGON_AMOY_RPC_URL;
  if (!rpcUrl) {
    console.warn("RPC_URL is not set; skipping indexer startup.");
    return;
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const factory = new ethers.Contract(factoryAddress, IntelPoolFactoryAbi.abi, provider);
  const poolListeners = new Map<string, PoolListenerState>();

  let lastFactoryBlock = await provider.getBlockNumber();

  const existingPools = (await supabase.from("pools").select("id")).data || [];
  existingPools.forEach(({ id }) => {
    poolListeners.set(id, {
      contract: new ethers.Contract(id, IntelPoolAbi.abi, provider),
      lastSeenBlock: lastFactoryBlock
    });
  });

  provider.on("block", async (blockNumber: number) => {
    await handleFactoryEvents(provider, factory, factoryAddress, poolListeners, blockNumber, lastFactoryBlock);
    lastFactoryBlock = blockNumber;

    for (const [address, state] of poolListeners.entries()) {
      await handlePoolEvents(address, state, blockNumber);
    }
  });
}

async function handleFactoryEvents(
  provider: ethers.Provider,
  factory: ethers.Contract,
  factoryAddress: string,
  poolListeners: Map<string, PoolListenerState>,
  currentBlock: number,
  lastFactoryBlock: number
) {
  const fromBlock = lastFactoryBlock + 1;
  if (fromBlock > currentBlock) return;

  try {
    const events = await factory.queryFilter(factory.filters.PoolCreated(), fromBlock, currentBlock);
    for (const rawEvent of events) {
      if (!("args" in rawEvent)) continue;

      const event = rawEvent as EventLog;
      const [investigator, pool, threshold, minContributionForDecrypt, deadline, ciphertext] = event.args || [];
      const payload: PoolRecord = {
        id: pool,
        investigator,
        threshold: threshold.toString(),
        minContributionForDecrypt: minContributionForDecrypt.toString(),
        factoryAddress: factoryAddress,
        deadline: deadline.toString(),
        ciphertext: ethers.hexlify(ciphertext)
      };

      await supabase.from("pools").upsert({
        id: payload.id,
        investigator: payload.investigator,
        threshold: payload.threshold,
        mincontributionfordecrypt: payload.minContributionForDecrypt,
        factoryaddress: payload.factoryAddress,
        deadline: payload.deadline,
        ciphertext: payload.ciphertext
      });
      console.log("Indexed PoolCreated", payload, event?.transactionHash);

      if (!poolListeners.has(pool)) {
        poolListeners.set(pool, {
          contract: new ethers.Contract(pool, IntelPoolAbi.abi, provider),
          lastSeenBlock: currentBlock
        });
      }
    }
  } catch (error) {
    console.error("Failed to query PoolCreated events", { fromBlock, currentBlock, error });
  }
}

async function handlePoolEvents(address: string, state: PoolListenerState, currentBlock: number) {
  const fromBlock = state.lastSeenBlock + 1;
  if (fromBlock > currentBlock) return;

  try {
    const events = await state.contract.queryFilter(state.contract.filters.Contributed(), fromBlock, currentBlock);
    for (const rawEvent of events) {
      if (!("args" in rawEvent)) continue;

      const event = rawEvent as EventLog;
      const [contributor, amount] = event.args || [];
      const logIndex = (event as Partial<EventLog>).index ?? (event as any).logIndex;
      const payload: ContributionRecord = {
        id: `${address}-${contributor}-${event.blockNumber}-${logIndex}`,
        contributor,
        amount: amount.toString(),
        poolId: address
      };
      await supabase.from("contributions").upsert({
        id: payload.id,
        contributor: payload.contributor,
        amount: payload.amount,
        poolid: payload.poolId
      });
      console.log("Indexed contribution", payload);
    }

    state.lastSeenBlock = currentBlock;
  } catch (error) {
    console.error("Failed to query contribution events", { address, fromBlock, currentBlock, error });
  }
}
