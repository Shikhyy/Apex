import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";

type SlideConfig = {
  route: string;
  image: string;
  kicker: string;
  title: string;
  summary: string;
  bullets: string[];
  accent: string;
};

const SLIDES: SlideConfig[] = [
  {
    route: "Home",
    image: "/demo/home.png",
    kicker: "Landing page",
    title: "APEX is built to explain itself",
    summary: "The homepage frames the product in one sentence: a DeFi system that only earns reputation when it refuses risky trades.",
    bullets: ["Brutalist marketing shell", "Clear launch path into the dashboard", "Agent pipeline explained upfront"],
    accent: "#e8ff00",
  },
  {
    route: "Dashboard",
    image: "/demo/dashboard.png",
    kicker: "Live cycle monitor",
    title: "Scout, Strategist, Guardian, Executor",
    summary: "The dashboard is the control room. A live SSE cycle updates the pipeline and keeps the verdict history visible.",
    bullets: ["Streaming agent events", "Guardian vetoes are first-class", "Session metrics update from the cycle log"],
    accent: "#60a5fa",
  },
  {
    route: "Agents",
    image: "/demo/agents.png",
    kicker: "On-chain registry",
    title: "Every agent has identity and reputation",
    summary: "The registry view ties each agent to an ERC-8004 identity and a live reputation score, so trust is measurable.",
    bullets: ["Agent wallet resolution", "Feedback and reputation scores", "Base Sepolia contract links"],
    accent: "#a78bfa",
  },
  {
    route: "Veto log",
    image: "/demo/veto-log.png",
    kicker: "Safety record",
    title: "Refusing bad trades is the feature",
    summary: "The veto log keeps the Guardian accountable. Users can filter by reason, review confidence, and export the audit trail.",
    bullets: ["Reason filters", "Confidence controls", "CSV export for auditability"],
    accent: "#f59e0b",
  },
  {
    route: "Portfolio",
    image: "/demo/portfolio.png",
    kicker: "Performance view",
    title: "PnL, positions, and risk in one place",
    summary: "The portfolio page turns cycle output into an operational view with allocation, trade history, and cumulative PnL.",
    bullets: ["PnL chart and position table", "Risk labels by pool", "Win rate and session summary"],
    accent: "#34d399",
  },
  {
    route: "Settings",
    image: "/demo/settings.png",
    kicker: "Control plane",
    title: "Operators can tune the guardrails",
    summary: "Risk thresholds, agent models, API keys, and cycle behavior all live in one settings screen.",
    bullets: ["Guardian thresholds", "Model selection", "Auto-run and retry controls"],
    accent: "#f87171",
  },
];

const INTRO_DURATION = 180;
const SLIDE_DURATION = 390;
const OUTRO_DURATION = 180;
const SLIDE_STARTS = SLIDES.map((_, index) => INTRO_DURATION + index * SLIDE_DURATION);

function panelStyle(accent: string): React.CSSProperties {
  return {
    background: "rgba(10, 10, 10, 0.82)",
    border: "1px solid rgba(240, 237, 232, 0.12)",
    boxShadow: `0 28px 80px rgba(0, 0, 0, 0.45), inset 0 0 0 1px ${accent}22`,
    backdropFilter: "blur(18px)",
  };
}

function CaptionChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontFamily: "DM Mono, monospace", fontSize: 10, letterSpacing: 2, color: "rgba(240,237,232,0.58)", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontFamily: "DM Mono, monospace", fontSize: 13, color: "#f0ede8" }}>{value}</div>
    </div>
  );
}

function Slide({ slide, index }: { slide: SlideConfig; index: number }) {
  const frame = useCurrentFrame();
  const localFrame = frame - SLIDE_STARTS[index];
  const visibleProgress = interpolate(localFrame, [0, 24, SLIDE_DURATION - 24, SLIDE_DURATION], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const imageZoom = interpolate(localFrame, [0, SLIDE_DURATION], [1.06, 1]);
  const textShift = interpolate(localFrame, [0, 18], [28, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        opacity: visibleProgress,
        background: "radial-gradient(circle at top left, rgba(232,255,0,0.08), transparent 38%), linear-gradient(135deg, #090909, #111111 60%, #0c0f16)",
      }}
    >
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <Img
          src={staticFile(slide.image)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "blur(22px) brightness(0.28) saturate(0.95)",
            transform: `scale(${imageZoom})`,
          }}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(9,9,9,0.9), rgba(9,9,9,0.56) 55%, rgba(9,9,9,0.18))" }} />
      </div>

      <div
        style={{
          position: "absolute",
          left: 80,
          top: 74,
          width: 560,
          padding: 28,
          ...panelStyle(slide.accent),
          transform: `translateY(${textShift}px)`,
        }}
      >
        <div style={{ fontFamily: "DM Mono, monospace", fontSize: 10, letterSpacing: 3, color: slide.accent, textTransform: "uppercase", marginBottom: 18 }}>
          {slide.route}
        </div>
        <div style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 66, lineHeight: 0.95, letterSpacing: 3, color: "#f0ede8", marginBottom: 16 }}>
          {slide.title}
        </div>
        <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 24, lineHeight: 1.45, color: "rgba(240,237,232,0.88)", marginBottom: 22 }}>
          {slide.summary}
        </div>
        <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
          {slide.bullets.map((bullet) => (
            <div key={bullet} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 10, height: 10, marginTop: 8, background: slide.accent, boxShadow: `0 0 16px ${slide.accent}` }} />
              <div style={{ fontFamily: "DM Mono, monospace", fontSize: 18, lineHeight: 1.35, color: "#f0ede8" }}>{bullet}</div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: 80,
          top: 88,
          width: 1010,
          height: 726,
          padding: 18,
          ...panelStyle(slide.accent),
          transform: `translateY(${interpolate(localFrame, [0, 20], [24, 0], { extrapolateRight: "clamp" })}px)`,
        }}
      >
        <Img
          src={staticFile(slide.image)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: index === 0 ? "center top" : "center center",
            transform: `scale(${imageZoom})`,
            border: `1px solid ${slide.accent}22`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 18,
            top: 18,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            background: "rgba(10,10,10,0.82)",
            border: `1px solid ${slide.accent}`,
          }}
        >
          <div style={{ width: 8, height: 8, background: slide.accent, boxShadow: `0 0 12px ${slide.accent}` }} />
          <div style={{ fontFamily: "DM Mono, monospace", fontSize: 11, letterSpacing: 2, color: "#f0ede8", textTransform: "uppercase" }}>
            Real app screenshot
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 80,
          bottom: 64,
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 18,
          width: 640,
          padding: 22,
          ...panelStyle(slide.accent),
        }}
      >
        <CaptionChip label="Focus" value={slide.route} />
        <CaptionChip label="Why it matters" value={slide.route === "Dashboard" ? "Live SSE + verdicts" : slide.route === "Agents" ? "Trust at the agent level" : slide.route === "Veto log" ? "Safety is auditable" : slide.route === "Portfolio" ? "Risk and PnL in one place" : slide.route === "Settings" ? "Operators can tune guardrails" : "Product narrative"} />
        <CaptionChip label="Signal" value={slide.accent} />
      </div>
    </AbsoluteFill>
  );
}

export function ApexDemo90() {
  const outroStart = INTRO_DURATION + SLIDES.length * SLIDE_DURATION;

  return (
    <AbsoluteFill style={{ backgroundColor: "#090909" }}>
      <Sequence from={0} durationInFrames={INTRO_DURATION}>
        <AbsoluteFill style={{ background: "linear-gradient(135deg, #070707, #121212 52%, #0a0a0a)" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at center, rgba(232,255,0,0.12), transparent 28%)" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 18 }}>
            <div style={{ fontFamily: "DM Mono, monospace", fontSize: 12, letterSpacing: 4, color: "#e8ff00", textTransform: "uppercase" }}>
              90-second product walkthrough
            </div>
            <div style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 112, lineHeight: 0.9, letterSpacing: 6, color: "#f0ede8" }}>
              APEX
            </div>
            <div style={{ width: 860, fontFamily: "DM Sans, sans-serif", fontSize: 28, lineHeight: 1.45, color: "rgba(240,237,232,0.9)" }}>
              A self-certifying yield optimizer where the Guardian can veto a trade and still improve the system's reputation.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 24, width: 920 }}>
              {["Live dashboard", "ERC-8004 reputation", "Risk-first execution"].map((item) => (
                <div key={item} style={{ padding: "18px 20px", border: "1px solid rgba(232,255,0,0.32)", background: "rgba(10,10,10,0.7)", fontFamily: "DM Mono, monospace", fontSize: 14, letterSpacing: 1, color: "#f0ede8" }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>

      {SLIDES.map((slide, index) => (
        <Sequence key={slide.route} from={SLIDE_STARTS[index]} durationInFrames={SLIDE_DURATION}>
          <Slide slide={slide} index={index} />
        </Sequence>
      ))}

      <Sequence from={outroStart} durationInFrames={OUTRO_DURATION}>
        <AbsoluteFill
          style={{
            background: "linear-gradient(135deg, #080808, #111111 52%, #0b0b0b)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div style={{ fontFamily: "DM Mono, monospace", fontSize: 12, letterSpacing: 4, color: "#e8ff00", textTransform: "uppercase" }}>
            Ready to run
          </div>
          <div style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 92, letterSpacing: 5, color: "#f0ede8" }}>
            APEX IS LIVE
          </div>
          <div style={{ width: 980, fontFamily: "DM Sans, sans-serif", fontSize: 26, lineHeight: 1.45, color: "rgba(240,237,232,0.88)", textAlign: "center" }}>
            The app connects market data, reputation, risk controls, and execution into one traceable workflow.
          </div>
          <div style={{ padding: "14px 22px", border: "1px solid #e8ff00", fontFamily: "DM Mono, monospace", fontSize: 18, letterSpacing: 2, color: "#e8ff00" }}>
            Launch the dashboard, trigger a cycle, and watch the Guardian decide.
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
}
