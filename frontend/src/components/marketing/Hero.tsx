"use client";

import { motion } from "framer-motion";
import Link from "next/link";

interface HeroProps {
  show: boolean;
}

const lines = ["MULTI-AGENT", "YIELD", "OPTIMIZER"];

export default function Hero({ show }: HeroProps) {
  return (
    <section
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 40px",
        position: "relative",
      }}
    >
      <div style={{ overflow: "hidden" }}>
        {lines.map((line, i) => (
          <motion.div
            key={line}
            initial={{ y: "100%" }}
            animate={show ? { y: 0 } : {}}
            transition={{
              delay: i * 0.1,
              duration: 0.8,
              ease: [0.76, 0, 0.24, 1],
            }}
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(48px, 13vw, 200px)",
              lineHeight: 0.9,
              letterSpacing: 4,
              color: "var(--white)",
            }}
          >
            {line}
          </motion.div>
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={show ? { opacity: 1 } : {}}
        transition={{ delay: 0.6, duration: 0.6 }}
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 16,
          color: "var(--muted)",
          marginTop: 32,
          maxWidth: 480,
          lineHeight: 1.6,
        }}
      >
        ERC-8004 self-certifying yield optimization. Four agents. One rule:
        earn reputation by knowing when not to trade.
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={show ? { opacity: 1 } : {}}
        transition={{ delay: 0.8, duration: 0.6 }}
        style={{ marginTop: 48 }}
      >
        <Link
          href="/dashboard"
          data-interactive
          style={{
            display: "inline-block",
            padding: "16px 40px",
            border: "1px solid var(--amber)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: "var(--amber)",
            transition: "all var(--fast) var(--ease-out)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--amber)";
            e.currentTarget.style.color = "var(--void)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--amber)";
          }}
        >
          Launch Dashboard
        </Link>
      </motion.div>
    </section>
  );
}
