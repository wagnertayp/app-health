import { useCallback, useEffect, useState } from "react";
import type { AuthUser } from "@workspace/api-client-react";
export type { AuthUser };

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}
function getBasePath() {
  return import.meta.env.BASE_URL.replace(/\/+$/, "") || "/";
}
export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/auth/user", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { user: AuthUser | null };
        if (!cancelled) setUser(data.user ?? null);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void check();
    const interval = window.setInterval(check, 60_000);
    window.addEventListener("focus", check);
    return () => { cancelled = true; window.clearInterval(interval); window.removeEventListener("focus", check); };
  }, []);
  const login = useCallback(() => {
    const current = window.location.pathname;
    const base = getBasePath();
    const returnTo = current.startsWith(base) ? current : base;
    window.location.href = `/api/login?returnTo=${encodeURIComponent(returnTo)}`;
  }, []);
  const logout = useCallback(() => {
    setUser(null);
    window.location.href = `/api/logout?returnTo=${encodeURIComponent(getBasePath())}`;
  }, []);
  return { user, isLoading, isAuthenticated: !!user, login, logout };
}
