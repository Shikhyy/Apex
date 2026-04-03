"use client";

import { useEffect, useRef, useState } from "react";

export default function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const ringPos = useRef({ x: 0, y: 0 });
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    setIsTouch("ontouchstart" in window);
    if ("ontouchstart" in window) return;

    const move = (e: MouseEvent) => {
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${e.clientX - 6}px, ${e.clientY - 6}px)`;
      }
      ringPos.current = { x: e.clientX - 20, y: e.clientY - 20 };
    };

    const over = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("a, button, [role=button], input, [data-interactive]")) {
        setHovering(true);
      }
    };

    const out = () => setHovering(false);

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseover", over);
    window.addEventListener("mouseout", out);

    const animate = () => {
      if (ringRef.current) {
        const current = ringRef.current.style.transform;
        const match = current.match(/translate\((.+)px, (.+)px\)/);
        const cx = match ? parseFloat(match[1]) : 0;
        const cy = match ? parseFloat(match[2]) : 0;
        const nx = cx + (ringPos.current.x - cx) * 0.14;
        const ny = cy + (ringPos.current.y - cy) * 0.14;
        ringRef.current.style.transform = `translate(${nx}px, ${ny}px)`;
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseover", over);
      window.removeEventListener("mouseout", out);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  if (isTouch) return null;

  return (
    <>
      <div
        ref={dotRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: hovering ? 60 : 12,
          height: hovering ? 60 : 12,
          borderRadius: "999px",
          background: "var(--amber)",
          mixBlendMode: "difference",
          pointerEvents: "none",
          zIndex: 10000,
          transition: "width 200ms var(--ease-out), height 200ms var(--ease-out)",
        }}
      />
      <div
        ref={ringRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 40,
          height: 40,
          borderRadius: "999px",
          border: `1px solid ${hovering ? "transparent" : "var(--amber)"}`,
          mixBlendMode: "difference",
          pointerEvents: "none",
          zIndex: 10000,
          opacity: hovering ? 0 : 1,
          transition: "opacity 200ms var(--ease-out), border-color 200ms var(--ease-out)",
        }}
      />
    </>
  );
}
