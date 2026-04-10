import { useCurrentFrame, interpolate } from 'remotion';
import React from 'react';

interface OverlayProps {
  text: string;
  startFrame: number;
  endFrame: number;
}

export const Overlay: React.FC<OverlayProps> = ({ text, startFrame, endFrame }) => {
  const frame = useCurrentFrame();

  const progress = interpolate(
    frame,
    [startFrame, startFrame + 10, endFrame - 10, endFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  if (progress === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 120,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(10, 10, 10, 0.85)',
          padding: '12px 24px',
          borderLeft: '3px solid #e8ff00',
        }}
      >
        <span
          style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: 18,
            color: '#f0ede8',
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
};