import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import React from 'react';

const STATS = [
  { label: 'Base Sepolia', value: 'Testnet', color: '#60a5fa' },
  { label: 'ERC-8004', value: 'Reputation', color: '#a78bfa' },
  { label: 'LangGraph', value: 'Orchestration', color: '#f59e0b' },
  { label: 'PRISM API', value: 'Data', color: '#34d399' },
];

interface StatsCounterProps {
  startFrame: number;
}

export const StatsCounter: React.FC<StatsCounterProps> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = interpolate(
    frame,
    [startFrame, startFrame + 30],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const opacity = interpolate(
    progress,
    [0, 0.2, 0.8, 1],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 80,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        gap: 48,
        opacity,
      }}
    >
      {STATS.map((stat, i) => {
        const itemProgress = interpolate(
          frame,
          [startFrame + i * 5, startFrame + i * 5 + 15],
          [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );

        return (
          <div
            key={stat.label}
            style={{
              textAlign: 'center',
              transform: `scale(${0.8 + itemProgress * 0.2})`,
              opacity: itemProgress,
            }}
          >
            <div
              style={{
                fontFamily: 'Bebas Neue, sans-serif',
                fontSize: 36,
                color: stat.color,
              }}
            >
              {stat.value}
            </div>
            <div
              style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: 14,
                color: '#888',
                marginTop: 4,
              }}
            >
              {stat.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};