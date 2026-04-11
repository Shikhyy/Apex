"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";

interface HeroProps {
  show: boolean;
}

const lines = ["MULTI-AGENT", "YIELD", "OPTIMIZER"];

export default function Hero({ show }: HeroProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 20,
        y: (e.clientY / window.innerHeight - 0.5) * 20,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <section
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 40px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Premium Static Grid Background */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
          pointerEvents: "none",
          backgroundImage: `
            linear-gradient(to right, rgba(213, 62, 15, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(213, 62, 15, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(circle at 50% 50%, black 0%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 50%, black 0%, transparent 70%)",
        }}
      >
        <motion.div
          animate={{
            x: mousePos.x * -1,
            y: mousePos.y * -1,
          }}
          transition={{ type: "spring", stiffness: 50, damping: 30 }}
          style={{
            position: "absolute",
            top: "-10%",
            left: "-10%",
            right: "-10%",
            bottom: "-10%",
            background: "radial-gradient(circle at 50% 50%, rgba(213, 62, 15, 0.1) 0%, transparent 40%)",
          }}
        />
      </div>

      <div style={{ overflow: "hidden", position: "relative", zIndex: 1 }}>
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
          position: "relative",
        }}
      >
        ERC-8004 self-certifying yield optimization. Four agents. One rule:
        earn reputation by knowing when not to trade.
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={show ? { opacity: 1 } : {}}
        transition={{ delay: 0.8, duration: 0.6 }}
        style={{ marginTop: 48, position: "relative" }}
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
            backdropFilter: "blur(10px)",
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
