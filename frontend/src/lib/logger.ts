type LogLevel = "info" | "warn" | "error";

interface LogPayload {
  level: LogLevel;
  message: string;
  timestamp: string;
  errorName?: string;
  errorStack?: string;
  metadata?: Record<string, unknown>;
  environment: string;
}

const IS_PROD = process.env.NODE_ENV === "production";

class ProductionLogger {
  private logToConsole(level: LogLevel, message: string, ...args: unknown[]) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [AI-SAKHI-${level.toUpperCase()}]`;
    if (level === "error") {
      console.error(prefix, message, ...args);
    } else if (level === "warn") {
      console.warn(prefix, message, ...args);
    } else {
      console.log(prefix, message, ...args);
    }
  }

  private async reportToBackend(payload: LogPayload) {
    if (!IS_PROD) return;
    try {
      // Wired hook for Sentry, LogRocket, or backend REST endpoints
      // fetch("/api/log-crash", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify(payload)
      // }).catch(() => {});
    } catch {
      // Consume silently to avoid telemetric loops
    }
  }

  public info(message: string, metadata?: Record<string, unknown>) {
    this.logToConsole("info", message, metadata || "");
    this.reportToBackend({
      level: "info",
      message,
      timestamp: new Date().toISOString(),
      metadata,
      environment: process.env.NODE_ENV || "development",
    });
  }

  public warn(message: string, metadata?: Record<string, unknown>) {
    this.logToConsole("warn", message, metadata || "");
    this.reportToBackend({
      level: "warn",
      message,
      timestamp: new Date().toISOString(),
      metadata,
      environment: process.env.NODE_ENV || "development",
    });
  }

  public error(message: string, error?: Error | unknown, metadata?: Record<string, unknown>) {
    const err = error instanceof Error ? error : new Error(String(error || "Unknown Error"));
    this.logToConsole("error", message, err.message, err.stack || "");
    this.reportToBackend({
      level: "error",
      message,
      timestamp: new Date().toISOString(),
      errorName: err.name,
      errorStack: err.stack,
      metadata,
      environment: process.env.NODE_ENV || "development",
    });
  }
}

export const logger = new ProductionLogger();
export default logger;
