"use client";

import { useEffect, useState } from "react";

interface LoaderProps {
  onComplete: () => void;
}

export default function Loader({ onComplete }: LoaderProps) {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const duration = 1800;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const raw = Math.min(elapsed / duration, 1);
      const jump = Math.random() * 9 + 3;
      const next = Math.min(Math.floor(raw * 100) + Math.floor(jump * raw), 100);
      setProgress(Math.min(next, 100));

      if (raw < 1) {
        requestAnimationFrame(tick);
      } else {
        setProgress(100);
        setDone(true);
        setTimeout(onComplete, 300);
      }
    };

    requestAnimationFrame(tick);
  }, [onComplete]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "var(--void)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
        opacity: done ? 0 : 1,
        transition: "opacity 300ms var(--ease-out)",
        pointerEvents: done ? "none" : "auto",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 72,
          letterSpacing: 8,
          color: "var(--amber)",
        }}
      >
        {progress}
      </div>
      <div
        style={{
          width: 200,
          height: 2,
          background: "var(--dim)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${progress}%`,
            background: "var(--amber)",
            transition: "width 100ms linear",
          }}
        />
      </div>
    </div>
  );
}
