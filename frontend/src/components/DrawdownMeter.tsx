import React from "react";
import { motion } from "framer-motion";

interface DrawdownMeterProps {
  currentDrawdown: number; // 0-100
  maxDrawdownThreshold: number; // 8
}

/**
 * Drawdown Meter Component
 * Shows current drawdown as a colored bar (green/amber/red)
 */
export const DrawdownMeter: React.FC<DrawdownMeterProps> = ({
  currentDrawdown,
  maxDrawdownThreshold,
}) => {
  const percentage = Math.min(100, (currentDrawdown / maxDrawdownThreshold) * 100);
  
  let color = "bg-green-500";
  let textColor = "text-green-600";
  if (currentDrawdown >= maxDrawdownThreshold * 0.75) {
    color = "bg-red-500";
    textColor = "text-red-600";
  } else if (currentDrawdown >= maxDrawdownThreshold * 0.5) {
    color = "bg-amber-500";
    textColor = "text-amber-600";
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <p className="text-sm font-medium text-gray-700">Session Drawdown</p>
        <motion.span
          key={currentDrawdown}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          className={`text-lg font-bold ${textColor}`}
        >
          {currentDrawdown.toFixed(1)}%
        </motion.span>
      </div>
      
      <div className="relative w-full bg-gray-200 rounded-full h-4 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ type: "spring", stiffness: 50 }}
          className={`${color} h-full rounded-full`}
        />
      </div>
      
      <div className="flex justify-between text-xs text-gray-500">
        <span>0%</span>
        <span>Halt Threshold: {maxDrawdownThreshold}%</span>
        <span>100%</span>
      </div>

      {currentDrawdown >= maxDrawdownThreshold && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 font-medium">
          ⚠️ Drawdown limit exceeded - trading halted
        </div>
      )}
    </div>
  );
};
