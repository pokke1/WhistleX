import "./globals.css";
import type { ReactNode } from "react";
import AppNav from "./components/AppNav";
import { WalletProvider } from "./components/WalletProvider";

export const metadata = {
  title: "WhistleX",
  description: "TACo-secured marketplace for encrypted intelligence",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <AppNav />
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
