import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface PnLHeaderProps {
  currentPnL: number;
  peakPnL: number;
  totalTrades: number;
}

/**
 * PnL Header Component
 * Displays live session P&L with animated number and trend indicator
 */
export const PnLHeader: React.FC<PnLHeaderProps> = ({
  currentPnL,
  peakPnL,
  totalTrades,
}) => {
  const isPositive = currentPnL >= 0;
  const trend = currentPnL >= peakPnL ? "up" : "down";

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-gradient-to-r from-[#D53E0F] to-[#9B0F06] p-6 rounded-lg text-white"
    >
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm opacity-80">Session P&L</p>
          <motion.div
            key={currentPnL}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            className="text-4xl font-bold tracking-tight"
          >
            ${currentPnL.toFixed(2)}
          </motion.div>
          <p className="text-xs opacity-70 mt-1">{totalTrades} trades executed</p>
        </div>
        <div className="text-right">
          <p className="text-sm opacity-80">Peak P&L</p>
          <p className="text-2xl font-semibold">${peakPnL.toFixed(2)}</p>
          <div className={`text-xs mt-1 ${trend === "up" ? "text-green-300" : "text-red-300"}`}>
            {trend === "up" ? "📈 Rising" : "📉 Drawdown"}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
