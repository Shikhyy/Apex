import React from "react";
import { motion } from "framer-motion";

interface Position {
  pair: string;
  entry_price: number;
  current_price: number;
  amount: number;
  amount_usd: number;
  unrealized_pnl: number;
  pnl_percent: number;
}

interface OpenPositionsProps {
  positions: Position[];
  totalUnrealizedPnL: number;
}

/**
 * Open Positions Component
 * Shows currently open positions with unrealized P&L
 */
export const OpenPositions: React.FC<OpenPositionsProps> = ({
  positions,
  totalUnrealizedPnL,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-800">Open Positions</h3>
        <motion.div
          key={totalUnrealizedPnL}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          className={`text-sm font-semibold ${totalUnrealizedPnL >= 0 ? "text-green-600" : "text-red-600"}`}
        >
          {totalUnrealizedPnL >= 0 ? "+" : ""}${totalUnrealizedPnL.toFixed(2)}
        </motion.div>
      </div>

      {positions.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg text-gray-500">
          <p>No open positions</p>
        </div>
      ) : (
        <div className="space-y-3">
          {positions.map((pos, idx) => (
            <motion.div
              key={pos.pair}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-gray-800">{pos.pair}</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    {pos.amount.toFixed(6)} @ ${pos.entry_price.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${pos.unrealized_pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {pos.unrealized_pnl >= 0 ? "+" : ""}${pos.unrealized_pnl.toFixed(2)}
                  </p>
                  <p className={`text-xs ${pos.pnl_percent >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {pos.pnl_percent >= 0 ? "+" : ""}{pos.pnl_percent.toFixed(2)}%
                  </p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-600">
                <span>Position: ${pos.amount_usd.toFixed(2)}</span>
                <span>Current: ${pos.current_price.toFixed(2)}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
