import React, { useState } from "react";
import { motion } from "framer-motion";

interface Trade {
  trade_id: string;
  timestamp: number;
  source: string;
  pair: string;
  amount_usd: number;
  net_pnl: number;
  tx_hash?: string;
}

interface TradeHistoryProps {
  trades: Trade[];
}

/**
 * Trade History Component
 * Displays sortable table of executed trades
 */
export const TradeHistory: React.FC<TradeHistoryProps> = ({ trades }) => {
  const [sortBy, setSortBy] = useState<"time" | "pnl" | "size">("time");

  const sortedTrades = [...trades].sort((a, b) => {
    switch (sortBy) {
      case "pnl":
        return b.net_pnl - a.net_pnl;
      case "size":
        return b.amount_usd - a.amount_usd;
      case "time":
      default:
        return b.timestamp - a.timestamp;
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-800">Trade History</h3>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="text-sm border border-gray-300 rounded px-2 py-1"
        >
          <option value="time">Sort by Time</option>
          <option value="pnl">Sort by P&L</option>
          <option value="size">Sort by Size</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Pair</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Size</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">P&L</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Source</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Time</th>
            </tr>
          </thead>
          <tbody>
            {sortedTrades.map((trade, idx) => (
              <motion.tr
                key={trade.trade_id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.02 }}
                className="border-b border-gray-100 hover:bg-gray-50"
              >
                <td className="py-3 px-4">
                  <span className="font-semibold text-gray-800">{trade.pair}</span>
                </td>
                <td className="py-3 px-4 text-gray-600">${trade.amount_usd.toFixed(2)}</td>
                <td className={`py-3 px-4 font-semibold ${trade.net_pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {trade.net_pnl >= 0 ? "+" : ""}${trade.net_pnl.toFixed(2)}
                </td>
                <td className="py-3 px-4">
                  <span className={`text-xs uppercase font-bold px-2 py-1 rounded ${
                    trade.source === "kraken" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                  }`}>
                    {trade.source}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-500 text-xs">
                  {new Date(trade.timestamp * 1000).toLocaleTimeString()}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {trades.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No trades yet. System is waiting for optimal conditions...</p>
        </div>
      )}
    </div>
  );
};
