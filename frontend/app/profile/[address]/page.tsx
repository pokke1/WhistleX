"use client";

import { useParams } from "next/navigation";
import ProfileContent from "../ProfileContent";
import { useWallet } from "../../components/WalletProvider";

export default function PublicProfilePage() {
  const params = useParams();
  const rawAddress = String(params?.address || "");
  const targetAddress = rawAddress.toLowerCase();
  const { walletAddress } = useWallet();
  const isOwnProfile = Boolean(walletAddress && walletAddress.toLowerCase() === targetAddress);

  if (!targetAddress) {
    return (
      <main className="app-shell">
        <div className="message">Profile address is required.</div>
      </main>
    );
  }

  return <ProfileContent address={targetAddress} isOwnProfile={isOwnProfile} />;
}
