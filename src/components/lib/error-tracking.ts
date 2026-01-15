/**
 * Error Tracking with Sentry
 * In dev mode, errors are logged to console
 */

import * as Sentry from "@sentry/react";

const isDev = import.meta.env.DEV;
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || "";

export function initErrorTracking() {
  if (isDev) {
    console.log("[Sentry] Dev mode - errors will be logged to console only");
    return;
  }

  if (!SENTRY_DSN) {
    console.warn("[Sentry] DSN not configured - error tracking disabled");
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    // Performance monitoring
    tracesSampleRate: 0.1, // 10% of transactions
    // Session replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0, // 100% when there's an error
  });
}

export function captureException(error: Error, context?: Record<string, any>) {
  if (isDev) {
    console.error("[Sentry] Error captured:", error, context);
    return;
  }

  Sentry.captureException(error, {
    extra: context,
  });
}

export function captureMessage(message: string, level: "info" | "warning" | "error" = "info") {
  if (isDev) {
    console.log(`[Sentry] ${level.toUpperCase()}:`, message);
    return;
  }

  Sentry.captureMessage(message, level);
}

export function setUser(user: { id: string; email?: string; name?: string } | null) {
  if (isDev) {
    console.log("[Sentry] User set:", user);
    return;
  }

  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.name,
    });
  } else {
    Sentry.setUser(null);
  }
}

// Error boundary component for React
export const ErrorBoundary = Sentry.ErrorBoundary;
