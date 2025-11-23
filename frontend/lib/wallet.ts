"use client";

import { ethers } from "ethers";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export interface WalletConnection {
  account: string;
  chainId?: string;
}

export async function connectWallet(): Promise<WalletConnection> {
  if (typeof window === "undefined") {
    throw new Error("Wallet connections are only available in the browser");
  }

  if (!window.ethereum) {
    throw new Error("No wallet provider detected. Please install MetaMask or a compatible wallet.");
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const accounts = await provider.send("eth_requestAccounts", []);
  const network = await provider.getNetwork();

  const account = ethers.getAddress(accounts[0]);
  return { account, chainId: network.chainId.toString() };
}
