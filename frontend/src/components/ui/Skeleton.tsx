export function SkeletonCard() {
  return (
    <div
      style={{
        padding: 24,
        background: "var(--deep)",
        border: "1px solid var(--dim)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div
            style={{
              width: 120,
              height: 24,
              background: "var(--dim)",
              marginBottom: 12,
              animation: "shimmer 1.5s infinite",
              backgroundSize: "200% 100%",
              backgroundImage: "linear-gradient(90deg, var(--dim) 25%, var(--raised) 50%, var(--dim) 75%)",
            }}
          />
          <div
            style={{
              width: 80,
              height: 12,
              background: "var(--dim)",
              marginBottom: 8,
              animation: "shimmer 1.5s infinite",
              backgroundSize: "200% 100%",
              backgroundImage: "linear-gradient(90deg, var(--dim) 25%, var(--raised) 50%, var(--dim) 75%)",
            }}
          />
          <div
            style={{
              width: 60,
              height: 10,
              background: "var(--dim)",
              animation: "shimmer 1.5s infinite",
              backgroundSize: "200% 100%",
              backgroundImage: "linear-gradient(90deg, var(--dim) 25%, var(--raised) 50%, var(--dim) 75%)",
            }}
          />
        </div>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "999px",
            background: "var(--dim)",
            animation: "shimmer 1.5s infinite",
            backgroundSize: "200% 100%",
            backgroundImage: "linear-gradient(90deg, var(--dim) 25%, var(--raised) 50%, var(--dim) 75%)",
          }}
        />
      </div>
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div style={{ padding: 20, background: "var(--deep)", border: "1px solid var(--dim)" }}>
      <div
        style={{
          width: 60,
          height: 8,
          background: "var(--dim)",
          marginBottom: 12,
          animation: "shimmer 1.5s infinite",
          backgroundSize: "200% 100%",
          backgroundImage: "linear-gradient(90deg, var(--dim) 25%, var(--raised) 50%, var(--dim) 75%)",
        }}
      />
      <div
        style={{
          width: 80,
          height: 24,
          background: "var(--dim)",
          animation: "shimmer 1.5s infinite",
          backgroundSize: "200% 100%",
          backgroundImage: "linear-gradient(90deg, var(--dim) 25%, var(--raised) 50%, var(--dim) 75%)",
        }}
      />
    </div>
  );
}

export function SkeletonTable() {
  return (
    <div style={{ background: "var(--deep)", border: "1px solid var(--dim)" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--dim)",
            display: "flex",
            gap: 16,
          }}
        >
          {Array.from({ length: 4 }).map((_, j) => (
            <div
              key={j}
              style={{
                flex: 1,
                height: 12,
                background: "var(--dim)",
                animation: "shimmer 1.5s infinite",
                backgroundSize: "200% 100%",
                backgroundImage: "linear-gradient(90deg, var(--dim) 25%, var(--raised) 50%, var(--dim) 75%)",
                animationDelay: `${j * 100}ms`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
