import "./globals.css";
import type { ReactNode } from "react";
import AppNav from "./components/AppNav";
import { TickerProvider } from "./components/TickerProvider";
import { WalletProvider } from "./components/WalletProvider";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://wstlx.com";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: "WhistleX",
  description: "The Trustless Intel Marketplace",
  openGraph: {
    title: "WhistleX",
    description: "The Trustless Intel Marketplace",
    images: ["/marble-bg.jpg"],
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "WhistleX",
    description: "The Trustless Intel Marketplace",
    images: ["/marble-bg.jpg"]
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/whistlex-logo-192.png", sizes: "192x192", type: "image/png" }
    ],
    shortcut: "/favicon-32.png",
    apple: "/apple-touch-icon.png"
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('whistlex:theme');
                if (theme === 'gold') document.documentElement.setAttribute('data-theme','gold');
              } catch {}
            `
          }}
        />
      </head>
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
