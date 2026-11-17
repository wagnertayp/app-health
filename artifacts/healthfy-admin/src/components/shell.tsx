import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users2,
  Contact,
  FolderKanban,
  Landmark,
  CalendarRange,
  Bot,
  Radar,
  Settings2,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  LogOut,
  FileText,
  Package,
  Timer,
  ReceiptText,
  LineChart,
  type LucideIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useSession } from "@/components/auth-gate";
import logo from "@assets/HEALTH_SEM_FUNDO_1794883543830.png";

type Item = { label: string; href: string; icon: LucideIcon; match?: (p: string) => boolean; children?: Item[] };

const NAV: Item[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "CRM", href: "/crm", icon: Users2 },
  {
    label: "Clientes",
    href: "/clientes",
    icon: Contact,
    match: (p) => p === "/clientes",
    children: [{ label: "Projetos", href: "/clientes/projetos", icon: FolderKanban, match: (p) => p.startsWith("/clientes/projetos") }],
  },
  {
    label: "Financeiro",
    href: "/",
    icon: Landmark,
    match: (p) => p === "/",
    children: [
      { label: "Central de faturas", href: "/", icon: ReceiptText, match: (p) => p === "/" },
      { label: "Visão geral", href: "/financeiro", icon: LineChart },
      { label: "Invoices", href: "/invoices", icon: FileText, match: (p) => p.startsWith("/invoices") },
      { label: "Produtos e checkout", href: "/produtos", icon: Package, match: (p) => p.startsWith("/produtos") },
      { label: "Horas", href: "/horas", icon: Timer },
    ],
  },
  { label: "Multi-agenda", href: "/multi-agenda", icon: CalendarRange },
  { label: "Agentes Health", href: "/agentes", icon: Bot },
  { label: "Trackeamento", href: "/trackeamento", icon: Radar },
];

const isActive = (it: Item, p: string) => (it.match ? it.match(p) : p === it.href);
const groupActive = (it: Item, p: string) => isActive(it, p) || !!it.children?.some((c) => isActive(c, p));

function NavLink({ it, collapsed, nested, onNav }: { it: Item; collapsed: boolean; nested?: boolean; onNav?: () => void }) {
  const [p] = useLocation();
  const active = isActive(it, p);
  const link = (
    <Link
      href={it.href}
      onClick={onNav}
      data-testid={`nav-${it.href.replace(/\//g, "-") || "home"}-${it.label.toLowerCase().replace(/\s/g, "-")}`}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-colors",
        collapsed ? "h-9 w-9 justify-center" : nested ? "h-8 pl-9 pr-2" : "h-9 px-2.5",
        active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      {active && !collapsed && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-sidebar-primary" />}
      {(!nested || collapsed) && <it.icon className={cn("h-4 w-4 shrink-0", active && "text-sidebar-primary")} />}
      {!collapsed && <span className="truncate">{it.label}</span>}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{it.label}</TooltipContent>
    </Tooltip>
  );
}

function Group({ it, collapsed, onNav }: { it: Item; collapsed: boolean; onNav?: () => void }) {
  const [p] = useLocation();
  const [open, setOpen] = useState(groupActive(it, p));
  useEffect(() => {
    if (groupActive(it, p)) setOpen(true);
  }, [p, it]);
  if (!it.children) return <NavLink it={it} collapsed={collapsed} onNav={onNav} />;
  if (collapsed)
    return (
      <>
        <NavLink it={it} collapsed onNav={onNav} />
        {it.children.filter((c) => c.href !== it.href).map((c) => (
          <NavLink key={c.href} it={c} collapsed onNav={onNav} />
        ))}
      </>
    );
  return (
    <div>
      <div className="flex items-center">
        <div className="flex-1">
          <NavLink it={it} collapsed={false} onNav={onNav} />
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label={`Expandir ${it.label}`}
          data-testid={`toggle-group-${it.label.toLowerCase()}`}
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} />
        </button>
      </div>
      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className="relative mt-0.5 space-y-0.5 before:absolute before:left-[18px] before:top-1 before:bottom-1 before:w-px before:bg-sidebar-border">
            {it.children.filter((c) => !(c.href === it.href && c.label === it.label)).map((c) => (
              <NavLink key={c.label} it={c} collapsed={false} nested onNav={onNav} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarBody({ collapsed, onNav, onToggle }: { collapsed: boolean; onNav?: () => void; onToggle?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-14 items-center gap-2.5 border-b border-sidebar-border", collapsed ? "justify-center px-2" : "px-4")}>
        <img src={logo} alt="Healthfy" className="h-8 w-8 rounded-lg ring-1 ring-white/10" />
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-sidebar-accent-foreground">Healthfy Admin</div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/60">Sistemas e automação</div>
          </div>
        )}
      </div>
      <nav className={cn("flex-1 space-y-0.5 overflow-y-auto py-3", collapsed ? "flex flex-col items-center px-2" : "px-2.5")}>
        {!collapsed && <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">Menu principal</div>}
        {NAV.map((it) => (
          <Group key={it.label} it={it} collapsed={collapsed} onNav={onNav} />
        ))}
      </nav>
      <div className={cn("space-y-1 border-t border-sidebar-border py-2.5", collapsed ? "flex flex-col items-center px-2" : "px-2.5")}>
        <NavLink it={{ label: "Configurações", href: "/configuracoes", icon: Settings2 }} collapsed={collapsed} onNav={onNav} />
        {onToggle && (
          <button
            onClick={onToggle}
            className={cn("flex items-center gap-2.5 rounded-lg text-[13px] text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", collapsed ? "h-9 w-9 justify-center" : "h-9 w-full px-2.5")}
            data-testid="button-collapse-sidebar"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && "Recolher menu"}
          </button>
        )}
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("healthfy.sidebar") === "1");
  const [mobile, setMobile] = useState(false);
  const [p] = useLocation();
  const session = useSession();
  useEffect(() => setMobile(false), [p]);
  const toggle = () =>
    setCollapsed((c) => {
      localStorage.setItem("healthfy.sidebar", c ? "0" : "1");
      return !c;
    });
  return (
    <div className="flex min-h-[100dvh] bg-background">
      <aside className={cn("no-print sticky top-0 hidden h-[100dvh] shrink-0 bg-sidebar transition-[width] duration-300 ease-out md:block", collapsed ? "w-[60px]" : "w-[244px]")}>
        <SidebarBody collapsed={collapsed} onToggle={toggle} />
      </aside>
      <div className={cn("no-print fixed inset-0 z-50 md:hidden", mobile ? "pointer-events-auto" : "pointer-events-none")}>
        <div className={cn("absolute inset-0 bg-black/40 transition-opacity", mobile ? "opacity-100" : "opacity-0")} onClick={() => setMobile(false)} />
        <aside className={cn("absolute left-0 top-0 h-full w-[264px] bg-sidebar transition-transform duration-300", mobile ? "translate-x-0" : "-translate-x-full")}>
          <button onClick={() => setMobile(false)} className="absolute right-2 top-3 rounded-md p-1.5 text-sidebar-foreground hover:bg-sidebar-accent" data-testid="button-close-menu">
            <X className="h-4 w-4" />
          </button>
          <SidebarBody collapsed={false} onNav={() => setMobile(false)} />
        </aside>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card/85 px-4 backdrop-blur md:px-6">
          <button className="rounded-md p-1.5 hover:bg-muted md:hidden" onClick={() => setMobile(true)} data-testid="button-open-menu">
            <Menu className="h-5 w-5" />
          </button>
          <img src={logo} alt="" className="h-7 w-7 rounded-md md:hidden" />
          <div className="flex-1" />
          {session && (
            <div className="flex items-center gap-2" data-testid="status-session">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{session.initials}</div>
              <span className="hidden max-w-[180px] truncate text-[13px] font-medium sm:inline" data-testid="text-user-name">{session.name}</span>
              <button onClick={session.signOut} className="ml-1 flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium hover:bg-muted" data-testid="button-logout">
                <LogOut className="h-3.5 w-3.5" /><span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          )}
        </header>
        <main key={p} className="fade-up mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
