"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getActiveProvider,
  getPreferredProviderId,
  listInjectedProviders,
  setActiveProvider,
  type WalletOption
} from "../../lib/wallet";

interface WalletContextValue {
  walletAddress: string | null;
  walletLabel: string | null;
  providers: WalletOption[];
  activeProviderId: string | null;
  isConnecting: boolean;
  connectWallet: (providerId?: string) => Promise<string | null>;
  disconnectWallet: () => void;
  refreshProviders: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [providers, setProviders] = useState<WalletOption[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletLabel, setWalletLabel] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const refreshProviders = () => {
    const detected = listInjectedProviders();
    setProviders(detected);

    const preferredId = getPreferredProviderId();
    if (preferredId) {
      const preferred = detected.find((option) => option.id === preferredId);
      if (preferred) {
        setActiveProviderId(preferredId);
        setWalletLabel(preferred.name);
      }
    }
  };

  useEffect(() => {
    refreshProviders();
  }, []);

  useEffect(() => {
    const provider = getActiveProvider();
    if (!provider?.request) return;

    let cancelled = false;

    provider
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        if (cancelled) return;
        const list = Array.isArray(accounts) ? (accounts as string[]) : [];
        setWalletAddress(list[0] || null);
      })
      .catch(() => {});

    const handleAccountsChanged = (accounts: string[]) => {
      setWalletAddress(accounts?.[0] || null);
    };

    provider.on?.("accountsChanged", handleAccountsChanged);
    return () => {
      cancelled = true;
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, [activeProviderId]);

  const connectWallet = async (providerId?: string) => {
    if (typeof window === "undefined") {
      throw new Error("window is not available");
    }

    const detected = providers.length ? providers : listInjectedProviders();
    let selection = providerId
      ? detected.find((option) => option.id === providerId)
      : detected.find((option) => option.id === activeProviderId);

    if (!selection && detected.length > 0) {
      selection = detected[0];
    }

    if (!selection) {
      throw new Error("No wallet detected. Install MetaMask, Phantom, or another EVM wallet.");
    }

    setIsConnecting(true);
    try {
      setActiveProvider(selection.provider, selection.id);
      setActiveProviderId(selection.id);
      setWalletLabel(selection.name);

      const accounts = (await selection.provider.request({
        method: "eth_requestAccounts"
      })) as string[];
      const account = accounts?.[0] || null;
      setWalletAddress(account);
      return account;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setWalletLabel(null);
    setActiveProviderId(null);
    setActiveProvider(null, null);
  };

  const value = useMemo(
    () => ({
      walletAddress,
      walletLabel,
      providers,
      activeProviderId,
      isConnecting,
      connectWallet,
      disconnectWallet,
      refreshProviders
    }),
    [walletAddress, walletLabel, providers, activeProviderId, isConnecting]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return ctx;
}
