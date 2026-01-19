"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "./WalletProvider";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function AppNav() {
  const pathname = usePathname();
  const {
    walletAddress,
    walletLabel,
    providers,
    activeProviderId,
    isConnecting,
    connectWallet,
    disconnectWallet,
    refreshProviders
  } = useWallet();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navLinks = useMemo(
    () => [
      { href: "/", label: "Marketplace" },
      { href: "/create", label: "Create" },
      { href: "/profile", label: "Profile" }
    ],
    []
  );

  const handleConnect = async (providerId?: string) => {
    setError(null);
    try {
      await connectWallet(providerId);
      setIsModalOpen(false);
    } catch (err: any) {
      setError(err?.message || "Failed to connect wallet");
    }
  };

  return (
    <>
      <header className="app-nav">
        <div className="nav-left">
          <Link className="nav-brand" href="/">
            WhistleX
          </Link>
          <nav className="nav-links">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link key={link.href} className={`nav-link ${isActive ? "active" : ""}`} href={link.href}>
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <button className="wallet-button" onClick={() => {
          refreshProviders();
          setIsModalOpen(true);
        }}>
          {walletAddress ? shortAddress(walletAddress) : "Connect wallet"}
        </button>
      </header>

      {isModalOpen && (
        <div className="wallet-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="wallet-modal" onClick={(event) => event.stopPropagation()}>
            <div className="wallet-modal-header">
              <div>
                <p className="muted" style={{ margin: 0 }}>Wallet</p>
                <h3 style={{ margin: "4px 0 0" }}>Connect</h3>
              </div>
              <button className="icon-button" onClick={() => setIsModalOpen(false)} aria-label="Close wallet modal">
                x
              </button>
            </div>

            {walletAddress && (
              <div className="wallet-status">
                <div>
                  <p className="muted" style={{ margin: 0 }}>Connected</p>
                  <p style={{ margin: "4px 0 0", fontWeight: 600 }}>
                    {shortAddress(walletAddress)}
                  </p>
                  {walletLabel && <p className="muted" style={{ margin: "4px 0 0" }}>{walletLabel}</p>}
                </div>
                <button className="button" onClick={disconnectWallet}>
                  Disconnect
                </button>
              </div>
            )}

            <div className="wallet-options">
              {providers.length === 0 ? (
                <div className="message">
                  No injected wallet found. Install MetaMask, Phantom, Coinbase Wallet, or another EVM wallet to continue.
                </div>
              ) : (
                providers.map((option) => (
                  <button
                    key={option.id}
                    className={`wallet-option ${option.id === activeProviderId ? "active" : ""}`}
                    onClick={() => handleConnect(option.id)}
                    disabled={isConnecting}
                  >
                    <span>{option.name}</span>
                    <span className="muted">{option.id === activeProviderId ? "Selected" : "Connect"}</span>
                  </button>
                ))
              )}
            </div>

            {error && <div className="message">{error}</div>}
          </div>
        </div>
      )}
    </>
  );
}
