"use client"

import { motion } from "framer-motion"
import { scaleIn } from "@/lib/animations"

interface DecisionBannerProps {
  decision: "APPROVED" | "VETOED" | null
  txHash?: string
}

export function DecisionBanner({ decision, txHash }: DecisionBannerProps) {
  if (!decision) return null

  const isVeto = decision === "VETOED"
  const textColor = isVeto ? "var(--vetoed)" : "var(--approved)"
  const icon = isVeto ? "✕" : "✓"
  const subtitle = isVeto
    ? "On-chain attestation posted to ERC-8004 Reputation Registry"
    : "Executing via Surge Risk Router + Kraken CLI"

  return (
    <motion.div
      variants={scaleIn}
      initial="hidden"
      animate="visible"
      className="decision-banner"
      style={{ borderLeftColor: isVeto ? "var(--vetoed)" : "var(--approved)" }}
    >
      <div className="decision-banner-header">
        <span className="decision-banner-icon">{icon}</span>
        <span className="decision-banner-title" style={{ color: textColor }}>
          {decision}
        </span>
      </div>
      <div className="decision-banner-subtitle">
        {subtitle}
        {txHash && (
          <a
            href={`https://sepolia.basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="decision-banner-link"
          >
            BaseScan ↗
          </a>
        )}
      </div>
    </motion.div>
  )
}
