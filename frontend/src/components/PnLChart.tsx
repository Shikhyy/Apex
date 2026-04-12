import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";

interface ChartDataPoint {
  timestamp: number;
  cumulative_pnl: number;
  pair: string;
  pnl: number;
}

interface PnLChartProps {
  data: ChartDataPoint[];
  peak: number;
  current: number;
}

/**
 * PnL Chart Component
 * Displays cumulative P&L over time using Recharts
 */
export const PnLChart: React.FC<PnLChartProps> = ({ data, peak, current }) => {
  // Format data for Recharts
  const chartData = data.map((point) => ({
    time: new Date(point.timestamp * 1000).toLocaleTimeString().slice(0, 5),
    cumulative_pnl: point.cumulative_pnl,
    pair: point.pair,
  }));

  const isPositive = current >= 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="bg-white border border-gray-200 rounded-lg p-4"
    >
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-800">Cumulative P&L</h3>
        <p className="text-xs text-gray-500 mt-1">
          Peak: ${peak.toFixed(2)} | Current: {isPositive ? "+" : ""}${current.toFixed(2)}
        </p>
      </div>

      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded text-gray-500">
          <p>No data yet</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="time"
              stroke="#9ca3af"
              style={{ fontSize: "12px" }}
            />
            <YAxis
              stroke="#9ca3af"
              style={{ fontSize: "12px" }}
              label={{ value: "P&L ($)", angle: -90, position: "insideLeft" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
              }}
              formatter={(value: any) => `$${value.toFixed(2)}`}
              labelFormatter={(label) => `Time: ${label}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="cumulative_pnl"
              stroke={isPositive ? "#10b981" : "#ef4444"}
              strokeWidth={2}
              dot={false}
              isAnimationActive={true}
              name="Cumulative P&L"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
};
