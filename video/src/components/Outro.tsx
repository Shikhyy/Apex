import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import React from 'react';

const SECTION_START = 240;
const SECTION_END = 255;

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = interpolate(
    frame,
    [SECTION_START, SECTION_END],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const opacity = interpolate(
    progress,
    [0, 0.2, 0.8, 1],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const scale = spring({
    frame: frame - SECTION_START,
    fps,
    config: { damping: 15 },
  });

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
          transform: `scale(${scale})`,
        }}
      >
        Get Started
      </h2>
      <p
        style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: 24,
          color: '#e8ff00',
          marginTop: 24,
        }}
      >
        Visit apex to launch the dashboard
      </p>
      <div
        style={{
          marginTop: 40,
          padding: '16px 32px',
          border: '2px solid #e8ff00',
          fontFamily: 'DM Mono, monospace',
          fontSize: 18,
          color: '#e8ff00',
        }}
      >
        localhost:3000
      </div>
    </div>
  );
};