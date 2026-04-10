import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import React from 'react';

const SECTION_START = 0;
const SECTION_END = 12;

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = interpolate(
    frame,
    [SECTION_START, SECTION_END],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const logoScale = spring({
    frame: frame - SECTION_START,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const opacity = interpolate(
    progress,
    [0, 0.3, 0.7, 1],
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
      <div
        style={{
          transform: `scale(${0.5 + logoScale * 0.5})`,
        }}
      >
        <svg width="120" height="120" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="30" stroke="#e8ff00" strokeWidth="2" fill="none" />
          <path
            d="M20 32 L32 20 L44 32 L32 44 Z"
            fill="#e8ff00"
          />
        </svg>
      </div>
      <h1
        style={{
          fontFamily: 'Bebas Neue, sans-serif',
          fontSize: 64,
          color: '#f0ede8',
          marginTop: 24,
          letterSpacing: 4,
        }}
      >
        APEX
      </h1>
      <p
        style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: 20,
          color: '#e8ff00',
          marginTop: 8,
        }}
      >
        Self-Certifying Yield Optimizer
      </p>
    </div>
  );
};