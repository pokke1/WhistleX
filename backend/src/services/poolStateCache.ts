import { ethers } from "ethers";
import IntelPoolAbi from "../../contracts/IntelPool.json" with { type: "json" };
import { supabase } from "../db/supabase.js";

const DEFAULT_PUBLIC_AMOY_RPC_URL = "https://rpc-amoy.polygon.technology";
const DEFAULT_FALLBACK_AMOY_RPC_URL = "https://polygon-amoy.drpc.org";
const CACHE_TTL_MS = 30_000;
const DEFAULT_USDC_DECIMALS = 6;

type CacheRow = {
  poolid: string;
  currency: string | null;
  currency_decimals: number | null;
  total_contributions: string | null;
  threshold: string | null;
  min_contribution_for_decrypt: string | null;
  deadline: string | null;
  unlocked: boolean | null;
  updated_at: string | null;
};

export type PoolStateResponse = {
  currency: string;
  currencyDecimals: number;
  totalContributions: string;
  threshold: string;
  minContributionForDecrypt: string;
  deadline: string;
  unlocked: boolean;
  userContribution?: string;
  canDecrypt?: boolean;
};

function normalizeCache(row: CacheRow): PoolStateResponse {
  return {
    currency: row.currency || "0x0000000000000000000000000000000000000000",
    currencyDecimals: Number.isFinite(row.currency_decimals)
      ? Number(row.currency_decimals)
      : DEFAULT_USDC_DECIMALS,
    totalContributions: row.total_contributions || "0",
    threshold: row.threshold || "0",
    minContributionForDecrypt: row.min_contribution_for_decrypt || "0",
    deadline: row.deadline || "0",
    unlocked: Boolean(row.unlocked)
  };
}

async function fetchOnchainState(poolId: string) {
  const rpcUrl = process.env.PUBLIC_AMOY_RPC_URL || DEFAULT_PUBLIC_AMOY_RPC_URL || DEFAULT_FALLBACK_AMOY_RPC_URL;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(poolId, IntelPoolAbi.abi, provider);

  const [currency, currencyDecimals, totalContributions, threshold, minContributionForDecrypt, deadline, unlocked] =
    await Promise.all([
      contract.currency(),
      contract.currencyDecimals(),
      contract.totalContributions(),
      contract.threshold(),
      contract.minContributionForDecrypt(),
      contract.deadline(),
      contract.unlocked()
    ]);

  return {
    currency: String(currency),
    currencyDecimals: Number(currencyDecimals),
    totalContributions: totalContributions.toString(),
    threshold: threshold.toString(),
    minContributionForDecrypt: minContributionForDecrypt.toString(),
    deadline: deadline.toString(),
    unlocked: Boolean(unlocked)
  };
}

async function fetchUserState(poolId: string, userAddress: string) {
  const rpcUrl = process.env.PUBLIC_AMOY_RPC_URL || DEFAULT_PUBLIC_AMOY_RPC_URL || DEFAULT_FALLBACK_AMOY_RPC_URL;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(poolId, IntelPoolAbi.abi, provider);

  const [contrib, canDecrypt] = await Promise.all([
    contract.contributionOf(userAddress),
    contract.canDecrypt(userAddress)
  ]);

  return {
    userContribution: contrib.toString(),
    canDecrypt: Boolean(canDecrypt)
  };
}

export async function getCachedPoolState(poolId: string, userAddress?: string): Promise<PoolStateResponse> {
  const { data: cached, error } = await supabase
    .from("pool_state_cache")
    .select("poolid, currency, currency_decimals, total_contributions, threshold, min_contribution_for_decrypt, deadline, unlocked, updated_at")
    .eq("poolid", poolId)
    .maybeSingle();

  if (error) {
    console.warn("Failed to read pool_state_cache", { poolId, error: error.message });
  }

  const updatedAt = cached?.updated_at ? new Date(cached.updated_at).getTime() : 0;
  const isFresh = Boolean(cached) && updatedAt > 0 && Date.now() - updatedAt < CACHE_TTL_MS;

  let baseState: PoolStateResponse | null = null;

  if (cached && isFresh) {
    baseState = normalizeCache(cached as CacheRow);
  } else {
    try {
      const fresh = await fetchOnchainState(poolId);
      baseState = fresh;
      await supabase.from("pool_state_cache").upsert({
        poolid: poolId,
        currency: fresh.currency,
        currency_decimals: fresh.currencyDecimals,
        total_contributions: fresh.totalContributions,
        threshold: fresh.threshold,
        min_contribution_for_decrypt: fresh.minContributionForDecrypt,
        deadline: fresh.deadline,
        unlocked: fresh.unlocked,
        updated_at: new Date().toISOString()
      });
    } catch (rpcError) {
      console.warn("Failed to refresh pool state", { poolId, error: rpcError });
      if (cached) {
        baseState = normalizeCache(cached as CacheRow);
      } else {
        throw rpcError;
      }
    }
  }

  if (!baseState) {
    throw new Error("Pool state unavailable");
  }

  if (userAddress) {
    try {
      const userState = await fetchUserState(poolId, userAddress);
      return { ...baseState, ...userState };
    } catch (error) {
      console.warn("Failed to fetch user pool state", { poolId, userAddress, error });
    }
  }

  return baseState;
}
