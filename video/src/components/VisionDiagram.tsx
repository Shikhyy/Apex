import { useCurrentFrame, interpolate } from 'remotion';
import React from 'react';

const SECTION_START = 12;
const SECTION_END = 45;

const AGENTS = [
  { name: 'Scout', color: '#60a5fa', y: 0 },
  { name: 'Strategist', color: '#a78bfa', y: 1 },
  { name: 'Guardian', color: '#f59e0b', y: 2 },
  { name: 'Executor', color: '#34d399', y: 3 },
];

export const VisionDiagram: React.FC = () => {
  const frame = useCurrentFrame();

  const progress = interpolate(
    frame,
    [SECTION_START, SECTION_END],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const opacity = interpolate(
    progress,
    [0, 0.1, 0.9, 1],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
      }}
    >
      <h2
        style={{
          fontFamily: 'Bebas Neue, sans-serif',
          fontSize: 48,
          color: '#f0ede8',
          marginBottom: 40,
        }}
      >
        The Agent Pipeline
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {AGENTS.map((agent, i) => {
          const agentProgress = interpolate(
            frame,
            [SECTION_START + i * 5, SECTION_START + i * 5 + 10],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );

          return (
            <div
              key={agent.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                transform: `translateX(${(1 - agentProgress) * -100}px)`,
                opacity: agentProgress,
              }}
            >
              <div
                style={{
                  width: 140,
                  height: 60,
                  backgroundColor: agent.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    fontFamily: 'DM Mono, monospace',
                    fontSize: 16,
                    fontWeight: 'bold',
                    color: '#0a0a0a',
                  }}
                >
                  {agent.name}
                </span>
              </div>
              <span style={{ color: '#666', fontFamily: 'DM Mono, monospace', fontSize: 14 }}>
                {i === 0 && 'Market Intelligence'}
                {i === 1 && 'Trade Intent Generation'}
                {i === 2 && 'Risk Management & Veto'}
                {i === 3 && 'On-Chain Execution'}
              </span>
            </div>
          );
        })}
      </div>

      <p
        style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: 18,
          color: '#e8ff00',
          marginTop: 48,
          textAlign: 'center',
        }}
      >
        Agents earn reputation by refusing bad trades
      </p>
    </div>
  );
};