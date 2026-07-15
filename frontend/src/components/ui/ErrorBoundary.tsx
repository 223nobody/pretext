import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Pretext Reader render error:", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="notice error-notice" style={{ flexDirection: "column", gap: 12, padding: 20 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <AlertTriangle size={18} />
            <span>Something went wrong while rendering the reader.</span>
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              color: "var(--text)",
              background: "var(--panel-strong)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            <RotateCcw size={14} />
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
