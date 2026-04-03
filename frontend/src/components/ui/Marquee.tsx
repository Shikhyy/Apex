interface MarqueeProps {
  items: string[];
}

export default function Marquee({ items }: MarqueeProps) {
  const doubled = [...items, ...items];

  return (
    <div
      style={{
        overflow: "hidden",
        borderTop: "1px solid var(--dim)",
        borderBottom: "1px solid var(--dim)",
        padding: "16px 0",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 32,
          width: "max-content",
          animation: "marquee 18s linear infinite",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.animationPlayState = "paused")}
        onMouseLeave={(e) => (e.currentTarget.style.animationPlayState = "running")}
      >
        {doubled.map((item, i) => (
          <span
            key={i}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--mid)",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 32,
            }}
          >
            {item}
            <span
              style={{
                display: "inline-block",
                width: 4,
                height: 4,
                borderRadius: "999px",
                background: "var(--amber)",
                flexShrink: 0,
              }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}
