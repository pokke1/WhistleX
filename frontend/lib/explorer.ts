const POLYGON_MAINNET_CHAIN_ID = 137;
const POLYGON_AMOY_CHAIN_ID = 80002;

function getChainId() {
  const fromEnv = process.env.NEXT_PUBLIC_CHAIN_ID || "80002";
  const parsed = Number(fromEnv);
  return Number.isFinite(parsed) ? parsed : POLYGON_AMOY_CHAIN_ID;
}

export function getExplorerBaseUrl() {
  const chainId = getChainId();
  if (chainId === POLYGON_MAINNET_CHAIN_ID) {
    return "https://polygonscan.com";
  }
  return "https://amoy.polygonscan.com";
}

export function getAddressExplorerUrl(address: string) {
  return `${getExplorerBaseUrl()}/address/${address}`;
}

export function getTxExplorerUrl(txHash: string) {
  return `${getExplorerBaseUrl()}/tx/${txHash}`;
}
