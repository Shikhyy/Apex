import { useCurrentFrame, useVideoConfig } from 'remotion';
import React from 'react';
import { Intro } from './components/Intro';
import { VisionDiagram } from './components/VisionDiagram';
import { Overlay } from './components/Overlay';
import { StatsCounter } from './components/StatsCounter';
import { Outro } from './components/Outro';
import { SECTION_TIMINGS } from './utils/timings';

const SCREEN_SECTIONS = [
  { name: 'Landing Page', start: SECTION_TIMINGS.LANDING_PAGE_START, end: SECTION_TIMINGS.LANDING_PAGE_END },
  { name: 'Dashboard', start: SECTION_TIMINGS.DASHBOARD_START, end: SECTION_TIMINGS.DASHBOARD_END },
  { name: 'Agent Cards', start: SECTION_TIMINGS.AGENTS_START, end: SECTION_TIMINGS.AGENTS_END },
  { name: 'Veto Log', start: SECTION_TIMINGS.VETO_LOG_START, end: SECTION_TIMINGS.VETO_LOG_END },
  { name: 'Portfolio', start: SECTION_TIMINGS.PORTFOLIO_START, end: SECTION_TIMINGS.PORTFOLIO_END },
];

export const Root: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const activeSection = SCREEN_SECTIONS.find(
    (s) => frame >= s.start && frame < s.end
  );

  return (
    <div style={{ width, height, backgroundColor: '#0a0a0a' }}>
      <Intro />
      <VisionDiagram />

      {SCREEN_SECTIONS.map((section) => (
        <Overlay
          key={section.name}
          text={section.name}
          startFrame={section.start}
          endFrame={section.end}
        />
      ))}

      <StatsCounter startFrame={SECTION_TIMINGS.TECH_SUMMARY_START} />
      <Outro />

      {activeSection && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            padding: '8px 16px',
            backgroundColor: '#e8ff00',
            color: '#0a0a0a',
            fontFamily: 'DM Mono, monospace',
            fontSize: 14,
          }}
        >
          {activeSection.name}
        </div>
      )}
    </div>
  );
};
