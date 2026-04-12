import React from "react";
import { motion } from "framer-motion";

interface SessionStatsProps {
  winRate: number; // 0-100
  sharpeRatio: number | null;
  bestTrade: number;
  worstTrade: number;
  avgTradePnL: number;
  totalTrades: number;
}

/**
 * Session Stats Component
 * Displays key trading metrics in a 2x3 grid
 */
export const SessionStats: React.FC<SessionStatsProps> = ({
  winRate,
  sharpeRatio,
  bestTrade,
  worstTrade,
  avgTradePnL,
  totalTrades,
}) => {
  const stats = [
    { label: "Win Rate", value: `${winRate.toFixed(1)}%`, color: "text-blue-600" },
    { label: "Sharpe Ratio", value: sharpeRatio?.toFixed(2) ?? "—", color: "text-purple-600" },
    { label: "Best Trade", value: `+$${bestTrade.toFixed(2)}`, color: "text-green-600" },
    { label: "Worst Trade", value: `$${worstTrade.toFixed(2)}`, color: worstTrade < 0 ? "text-red-600" : "text-green-600" },
    { label: "Avg Trade P&L", value: `${avgTradePnL > 0 ? "+" : "$"}${avgTradePnL.toFixed(2)}`, color: avgTradePnL > 0 ? "text-green-600" : "text-red-600" },
    { label: "Total Trades", value: totalTrades.toString(), color: "text-gray-600" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {stats.map((stat, idx) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05 }}
          className="bg-white border border-gray-200 rounded-lg p-4"
        >
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">{stat.label}</p>
          <p className={`text-2xl font-bold ${stat.color} mt-2`}>{stat.value}</p>
        </motion.div>
      ))}
    </div>
  );
};
