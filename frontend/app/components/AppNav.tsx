"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "./WalletProvider";
import { useTicker } from "./TickerProvider";

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { items } = useTicker();
  const tickerItems = items.length ? items : ["Live updates will appear as pools list and unlock."];
  const navLeftRef = useRef<HTMLDivElement | null>(null);
  const navRightRef = useRef<HTMLButtonElement | null>(null);
  const [navWidths, setNavWidths] = useState({ left: 0, right: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const tickerStyle = {
    "--nav-left-width": "0px",
    "--nav-right-width": "0px"
  } as React.CSSProperties;

  useLayoutEffect(() => {
    const update = () => {
      const left = navLeftRef.current?.offsetWidth || 0;
      const right = navRightRef.current?.offsetWidth || 0;
      setNavWidths((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <>
      <header className="app-nav">
        <div className="nav-left" ref={navLeftRef}>
          <Link
            className="nav-brand"
            href="/"
            onClick={(event) => {
              event.preventDefault();
              window.location.href = "/";
            }}
          >
            WhistleX
          </Link>
          <nav className="nav-links" style={{ position: "relative", zIndex: 10000, pointerEvents: "auto" }}>
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  className={`nav-link ${isActive ? "active" : ""}`}
                  href={link.href}
                  prefetch={false}
                  onClick={(event) => {
                    event.preventDefault();
                    window.location.href = link.href;
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div
          className="ticker nav-ticker"
          aria-label="Live pool updates"
          style={{
            "--nav-left-width": `${navWidths.left}px`,
            "--nav-right-width": `${navWidths.right}px`
          } as React.CSSProperties}
        >
          <div className="ticker-track">
            <div className="ticker-group">
              {tickerItems.map((item, index) => (
                <span key={`nav-ticker-${index}`} className="ticker-item">
                  {item}
                </span>
              ))}
            </div>
            <div className="ticker-group" aria-hidden="true">
              {tickerItems.map((item, index) => (
                <span key={`nav-ticker-ghost-${index}`} className="ticker-item">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
        <button
          className="nav-toggle"
          type="button"
          onClick={() => setIsMenuOpen(true)}
          aria-label="Open navigation menu"
        >
          <span />
          <span />
          <span />
        </button>
        <button
          className="wallet-button"
          ref={navRightRef}
          onClick={() => {
          refreshProviders();
          setIsModalOpen(true);
        }}
        >
          {walletAddress ? shortAddress(walletAddress) : "Connect wallet"}
        </button>
      </header>

      {mounted && isMenuOpen
        ? createPortal(
          <div className="nav-drawer-backdrop" onClick={() => setIsMenuOpen(false)}>
            <div className="nav-drawer" onClick={(event) => event.stopPropagation()}>
              <div className="nav-drawer-header">
                <span className="muted">Menu</span>
                <button className="icon-button" onClick={() => setIsMenuOpen(false)} aria-label="Close menu">
                  x
                </button>
              </div>
              <div className="nav-drawer-links">
                {navLinks.map((link) => {
                  const isActive = pathname === link.href;
                  return (
                    <button
                      key={link.href}
                      className={`button ${isActive ? "cta" : ""}`}
                      onClick={() => {
                        setIsMenuOpen(false);
                        window.location.href = link.href;
                      }}
                    >
                      {link.label}
                    </button>
                  );
                })}
              </div>
              <div className="nav-drawer-footer" style={{ flexDirection: "column", gap: 10 }}>
                {walletAddress ? (
                  <>
                    <div className="pill" style={{ width: "100%", textAlign: "center" }}>
                      Connected: {shortAddress(walletAddress)}
                    </div>
                    <button
                      className="button"
                      onClick={() => {
                        disconnectWallet();
                        setIsMenuOpen(false);
                      }}
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    className="button cta"
                    disabled={isConnecting}
                    onClick={async () => {
                      try {
                        refreshProviders();
                        await connectWallet();
                        setIsMenuOpen(false);
                      } catch (err: any) {
                        setError(err?.message || "Failed to connect wallet");
                      }
                    }}
                  >
                    {isConnecting ? "Connecting..." : "Connect wallet"}
                  </button>
                )}
                {error && <span className="muted" style={{ color: "#ff6f91" }}>{error}</span>}
              </div>
            </div>
          </div>,
          document.body
        )
        : null}

      {mounted && isModalOpen
        ? createPortal(
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
          </div>,
          document.body
        )
        : null}
    </>
  );
}
