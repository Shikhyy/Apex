"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface PnLChartProps {
  data: Array<{ time: string; pnl: number }>;
}

export default function PnLChart({ data }: PnLChartProps) {
  if (data.length === 0) {
    return (
      <div
        style={{
          padding: 40,
          background: "var(--deep)",
          border: "1px solid var(--dim)",
          textAlign: "center",
          fontFamily: "var(--font-display)",
          fontSize: 24,
          letterSpacing: 3,
          color: "var(--text-ghost)",
        }}
      >
        NO PNL DATA YET
      </div>
    );
  }

  return (
    <div style={{ background: "var(--deep)", border: "1px solid var(--dim)", padding: 24 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--mid)", marginBottom: 16, textTransform: "uppercase" }}>
        Cumulative PnL
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--amber)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--amber)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--dim)" />
          <XAxis dataKey="time" tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--muted)" }} />
          <YAxis tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--muted)" }} />
          <Tooltip
            contentStyle={{
              background: "var(--deep)",
              border: "1px solid var(--dim)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--muted)" }}
            itemStyle={{ color: "var(--amber)" }}
          />
          <Area type="monotone" dataKey="pnl" stroke="var(--amber)" fill="url(#pnlGradient)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
