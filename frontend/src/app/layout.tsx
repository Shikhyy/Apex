import type { Metadata } from "next";
import { Bebas_Neue, DM_Mono, DM_Sans } from "next/font/google";
import "../styles/globals.css";
import { Providers } from "./providers";

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const dmMono = DM_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "APEX — Self-Certifying Yield Optimizer",
  description:
    "Multi-agent DeFi yield optimizer with verifiable ERC-8004 on-chain trust. Built for the lablab.ai AI Trading Agents Hackathon.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "APEX",
    description: "The agent that earns reputation by knowing when NOT to trade.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${bebas.variable} ${dmMono.variable} ${dmSans.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
