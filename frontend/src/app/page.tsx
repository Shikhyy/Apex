"use client";

import { useState, useCallback } from "react";
import Loader from "@/components/ui/Loader";
import Cursor from "@/components/ui/Cursor";
import Noise from "@/components/ui/Noise";
import Marquee from "@/components/ui/Marquee";
import Nav from "@/components/shared/Nav";
import Footer from "@/components/shared/Footer";
import Hero from "@/components/marketing/Hero";
import WhatSection from "@/components/marketing/WhatSection";
import AgentsShowcase from "@/components/marketing/AgentsShowcase";
import VetoSection from "@/components/marketing/VetoSection";
import TerminalDemo from "@/components/marketing/TerminalDemo";
import StackSection from "@/components/marketing/StackSection";
import CTASection from "@/components/marketing/CTASection";

const marqueeItems = [
  "ERC-8004 SELF-CERTIFYING",
  "MULTI-AGENT YIELD OPTIMIZER",
  "ON-CHAIN REPUTATION",
  "BUILT FOR LABLAB.AI",
  "BASE SEPOLIA",
  "FOUR AGENTS",
  "VERIFIABLE TRUST",
];

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  const handleLoad = useCallback(() => setLoaded(true), []);

  return (
    <>
      <Loader onComplete={handleLoad} />
      <Cursor />
      <Noise />
      <Nav />

      <main style={{ opacity: loaded ? 1 : 0, transition: "opacity 600ms var(--ease-out)" }}>
        <Hero show={loaded} />
        <Marquee items={marqueeItems} />
        <WhatSection />
        <AgentsShowcase />
        <VetoSection />
        <TerminalDemo />
        <StackSection />
        <CTASection />
        <Footer />
      </main>
    </>
  );
}
