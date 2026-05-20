"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error intercepted by UI boundary:", error, errorInfo);
    try {
      // Lazy load custom logger to avoid boot race conditions
      const { logger } = require("@/lib/logger");
      logger.error("UI Boundary Crash", error, { componentStack: errorInfo.componentStack });
    } catch {
      // Fallback
    }
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/dashboard";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f9fafb",
          fontFamily: "Inter, sans-serif",
          padding: "24px",
          color: "#111827",
        }}>
          <div style={{
            maxWidth: "480px",
            width: "100%",
            background: "white",
            padding: "36px",
            borderRadius: "16px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
            border: "1px solid #f3f4f6",
            textAlign: "center",
          }}>
            <div style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "#fee2e2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px auto",
            }}>
              <AlertTriangle size={28} style={{ color: "#ef4444" }} />
            </div>
            
            <h1 style={{
              fontSize: "22px",
              fontWeight: 700,
              marginBottom: "8px",
              letterSpacing: "-0.5px",
            }}>
              Oops! Something went wrong
            </h1>
            
            <p style={{
              fontSize: "14px",
              color: "#6b7280",
              lineHeight: 1.5,
              marginBottom: "24px",
            }}>
              AI Sakhi encountered a temporary error rendering this page. You can try refreshing or returning to the home dashboard.
            </p>

            {this.state.error?.message && (
              <div style={{
                textAlign: "left",
                background: "#f9fafb",
                padding: "12px 16px",
                borderRadius: "8px",
                fontSize: "12px",
                fontFamily: "monospace",
                color: "#ef4444",
                maxHeight: "120px",
                overflowY: "auto",
                marginBottom: "24px",
                border: "1px solid #e5e7eb",
              }}>
                <strong>Details:</strong> {this.state.error.message}
              </div>
            )}

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={this.handleReload}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "10px 16px",
                  borderRadius: "8px",
                  background: "#059669",
                  color: "white",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
              >
                <RefreshCw size={15} />
                Refresh Page
              </button>

              <button
                onClick={this.handleGoHome}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "10px 16px",
                  borderRadius: "8px",
                  background: "white",
                  color: "#374151",
                  border: "1px solid #d1d5db",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
              >
                <Home size={15} />
                Home Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
