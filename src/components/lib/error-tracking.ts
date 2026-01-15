/**
 * Error Tracking - Console-based logging
 * Errors are logged to console and can be viewed in Vercel logs
 */

const isDev = import.meta.env.DEV;

export function initErrorTracking() {
  if (isDev) {
    console.log("[ErrorTracking] Dev mode - errors will be logged to console");
    return;
  }

  // Set up global error handler for uncaught errors
  window.onerror = (message, source, lineno, colno, error) => {
    console.error("[ErrorTracking] Uncaught error:", {
      message,
      source,
      lineno,
      colno,
      error,
    });
  };

  // Handle unhandled promise rejections
  window.onunhandledrejection = (event) => {
    console.error("[ErrorTracking] Unhandled promise rejection:", event.reason);
  };

  console.log("[ErrorTracking] Error tracking initialized");
}

export function captureException(error: Error, context?: Record<string, unknown>) {
  console.error("[ErrorTracking] Exception:", error.message, {
    stack: error.stack,
    context,
  });
}

export function captureMessage(message: string, level: "info" | "warning" | "error" = "info") {
  const logFn = level === "error" ? console.error : level === "warning" ? console.warn : console.log;
  logFn(`[ErrorTracking] ${level.toUpperCase()}:`, message);
}

export function setUser(user: { id: string; email?: string; name?: string } | null) {
  if (user) {
    console.log("[ErrorTracking] User context set:", { id: user.id, email: user.email });
  } else {
    console.log("[ErrorTracking] User context cleared");
  }
}

// Simple error boundary fallback - React's built-in error boundaries can use this
export function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-red-600">Something went wrong</h1>
        <p className="mt-2 text-gray-600">{error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded bg-primary px-4 py-2 text-white"
        >
          Reload page
        </button>
      </div>
    </div>
  );
}
