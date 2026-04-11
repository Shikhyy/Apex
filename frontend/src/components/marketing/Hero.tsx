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
              background: "linear-gradient(90deg, #EED9B9, #D53E0F, #5E0006)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
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
          color: "#EED9B9",
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
            border: "2px solid #D53E0F",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: "#EED9B9",
            background: "linear-gradient(135deg, rgba(213, 62, 15, 0.15), rgba(94, 0, 6, 0.08))",
            transition: "all var(--fast) var(--ease-out)",
            borderRadius: "8px",
            fontWeight: 600,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "linear-gradient(135deg, #D53E0F, #9B0F06)";
            e.currentTarget.style.boxShadow = "0 12px 40px rgba(213, 62, 15, 0.4)";
            e.currentTarget.style.transform = "translateY(-3px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "linear-gradient(135deg, rgba(213, 62, 15, 0.15), rgba(94, 0, 6, 0.08))";
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          Launch Dashboard
        </Link>
      </motion.div>
    </section>
  );
}
