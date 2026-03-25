"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getActiveProvider,
  getPreferredProviderId,
  listInjectedProviders,
  setActiveProvider,
  type WalletOption
} from "../../lib/wallet";
import { authenticateWallet, clearAuthToken } from "../../lib/api";

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
      const next = accounts?.[0] || null;
      setWalletAddress(next);
      if (!next) {
        clearAuthToken();
      }
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
    if (!window.isSecureContext) {
      throw new Error("Wallet connection requires a secure context (HTTPS or localhost).");
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

      const accounts = (await Promise.race([
        selection.provider.request({ method: "eth_requestAccounts" }) as Promise<string[]>,
        new Promise<string[]>((_, reject) =>
          window.setTimeout(() => reject(new Error("Wallet did not respond. Open this site inside your wallet browser and try again.")), 12000)
        )
      ])) as string[];
      const account = accounts?.[0] || null;
      if (!account) {
        throw new Error("No account returned. Make sure you are using the wallet’s in-app browser and approve the connection.");
      }
      setWalletAddress(account);
      await authenticateWallet(selection.provider, account);
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
    clearAuthToken();
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
