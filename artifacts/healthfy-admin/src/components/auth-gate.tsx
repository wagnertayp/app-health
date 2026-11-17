import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { LogIn, LogOut, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@assets/HEALTH_SEM_FUNDO_1794883543830.png";

type Session = { name: string; email: string; initials: string; signOut: () => void };
const SessionCtx = createContext<Session | null>(null);
export const useSession = () => useContext(SessionCtx);

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-sidebar px-5">
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(hsl(40_20%_97%)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="pointer-events-none absolute -bottom-40 left-1/2 h-80 w-[44rem] -translate-x-1/2 rounded-full bg-[hsl(158_52%_46%/0.18)] blur-3xl" />
      <div className="fade-up relative w-full max-w-sm rounded-2xl border border-sidebar-border bg-[hsl(222_16%_13%)] p-8 text-sidebar-accent-foreground shadow-2xl">
        <img src={logo} alt="Healthfy" className="h-14 w-14 rounded-xl ring-1 ring-white/10" />
        {children}
      </div>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();
  const qc = useQueryClient();
  const lastId = useRef<string | null | undefined>(undefined);
  const uid = isAuthenticated ? (user?.id ?? null) : null;

  useEffect(() => {
    if (isLoading) return;
    if (lastId.current !== undefined && lastId.current !== uid) qc.clear();
    lastId.current = uid;
  }, [uid, isLoading, qc]);

  const signOut = () => { qc.clear(); logout(); };

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-sidebar" data-testid="status-auth-loading">
        <div className="h-12 w-12 animate-pulse rounded-xl bg-sidebar-accent" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <Frame>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight" data-testid="text-login-title">Healthfy Admin</h1>
        <Button onClick={login} className="mt-8 h-11 w-full bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90" data-testid="button-login">
          <LogIn className="mr-2 h-4 w-4" />Entrar
        </Button>
      </Frame>
    );
  }

  const u = user as typeof user & { isAdmin?: boolean };
  if (!u.isAdmin) {
    return (
      <Frame>
        <div className="mt-8 flex items-center gap-2 text-[hsl(12_72%_66%)]"><ShieldX className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-[0.16em]">Acesso negado</span></div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight" data-testid="text-access-denied">Esta conta não tem acesso ao painel.</h1>
        <Button onClick={signOut} variant="outline" className="mt-8 h-11 w-full border-sidebar-border bg-transparent text-sidebar-accent-foreground hover:bg-sidebar-accent" data-testid="button-logout-denied">
          <LogOut className="mr-2 h-4 w-4" />Sair
        </Button>
      </Frame>
    );
  }

  const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Administrador";
  const ini = name.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return <SessionCtx.Provider value={{ name, email: u.email ?? "", initials: ini, signOut }}>{children}</SessionCtx.Provider>;
}
