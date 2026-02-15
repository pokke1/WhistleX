"use client";

import Link from "next/link";
import { useWallet } from "../components/WalletProvider";
import ProfileContent from "./ProfileContent";

export default function ProfilePage() {
  const { walletAddress } = useWallet();

  if (!walletAddress) {
    return (
      <main className="app-shell">
        <div className="panel">
          <h2 className="section-title">Connect wallet to open your profile</h2>
          <p className="muted">
            You can still visit any vendor by address at
            {" "}
            <code>/profile/&lt;wallet-address&gt;</code>.
          </p>
          <Link className="button" href="/">
            Back to marketplace
          </Link>
        </div>
      </main>
    );
  }

  return <ProfileContent address={walletAddress} isOwnProfile={true} />;
}
