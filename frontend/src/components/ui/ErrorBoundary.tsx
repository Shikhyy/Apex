"use client";

import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            style={{
              padding: 40,
              background: "var(--deep)",
              border: "1px solid var(--red)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              lineHeight: 1.8,
            }}
          >
            <div style={{ color: "var(--red)", marginBottom: 12 }}>
              &gt; Component crashed
            </div>
            <div style={{ color: "var(--muted)" }}>
              {this.state.error?.message || "Unknown error"}
            </div>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                marginTop: 16,
                padding: "8px 16px",
                border: "1px solid var(--amber)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--amber)",
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
