"use client";

/**
 * @nicheapps-scaffold-v2
 *
 * Wraps the app in Auth.js v5's SessionProvider so any client
 * component can call ``useSession()`` to read the NicheApps SSO
 * session. Auto-mounted in layout.tsx by the scaffold.
 *
 * The ScaffoldErrorBoundary below ensures that any error in
 * SessionProvider (or anything we inject) NEVER takes down the
 * host page. It logs the failure to the console and falls back
 * to rendering ``children`` directly — the user keeps the app
 * functional even if SSO setup fails.
 */
import { Component, type ReactNode } from "react";
import { SessionProvider } from "next-auth/react";

class ScaffoldErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: unknown) {
    console.error("[nicheapps] Scaffold provider error:", error, info);
  }
  render() {
    if (this.state.error) {
      // SessionProvider threw — fall back to rendering the host
      // page WITHOUT our wrapper so the app stays functional. The
      // actual failure is logged to console above so it's still
      // diagnosable.
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ScaffoldErrorBoundary fallback={children}>
      <SessionProvider>{children}</SessionProvider>
    </ScaffoldErrorBoundary>
  );
}
