import "./globals.css";
import type { ReactNode } from "react";
import AppNav from "./components/AppNav";
import { TickerProvider } from "./components/TickerProvider";
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
          <TickerProvider>
            <AppNav />
            {children}
          </TickerProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
