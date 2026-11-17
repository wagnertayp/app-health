import { type ReactNode } from "react";
import { Link } from "wouter";
import { AlertTriangle, ArrowLeft, RotateCw, Search, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { errMsg } from "@/lib/format";

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="no-print mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between fade-up">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors" data-testid="link-back">
            <ArrowLeft className="h-3.5 w-3.5" /> {back.label}
          </Link>
        )}
        {eyebrow && <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--chart-1))]">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold text-foreground sm:text-[26px]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("card-surface fade-up overflow-hidden", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{title}</h2>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  testId,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  testId?: string;
}) {
  return (
    <div className="card-surface fade-up px-4 py-3.5 transition-transform hover:-translate-y-0.5" data-testid={testId}>
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        {Icon && <Icon className="h-3.5 w-3.5" />}
      </div>
      <div className="num mt-1.5 text-xl font-semibold text-foreground">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

const tones = {
  neutral: "bg-muted text-muted-foreground border-border",
  green: "bg-[hsl(158_45%_93%)] text-[hsl(160_60%_24%)] border-[hsl(158_40%_82%)]",
  amber: "bg-[hsl(42_90%_93%)] text-[hsl(30_70%_30%)] border-[hsl(40_70%_80%)]",
  red: "bg-[hsl(4_80%_95%)] text-[hsl(2_60%_40%)] border-[hsl(4_60%_86%)]",
  blue: "bg-[hsl(218_70%_95%)] text-[hsl(222_50%_36%)] border-[hsl(218_50%_86%)]",
  ink: "bg-primary text-primary-foreground border-primary",
};
export type Tone = keyof typeof tones;

export function Pill({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium", tones[tone], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="dot-grid flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center fade-up">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border bg-card shadow-sm">
        <Icon className="h-5 w-5 text-foreground/70" />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" data-testid="status-loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-11 animate-pulse rounded-lg bg-muted" style={{ animationDelay: `${i * 90}ms` }} />
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-[hsl(4_60%_86%)] bg-[hsl(4_80%_97%)] px-6 py-8 text-center" data-testid="status-error">
      <AlertTriangle className="h-5 w-5 text-destructive" />
      <p className="text-sm font-medium">Não foi possível carregar os dados.</p>
      <p className="text-xs text-muted-foreground">{errMsg(error)}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} data-testid="button-retry">
          <RotateCw className="mr-1.5 h-3.5 w-3.5" /> Tentar novamente
        </Button>
      )}
    </div>
  );
}

export function Confirm({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel = "Confirmar",
  destructive,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-confirm">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            data-testid="button-confirm"
            className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-medium text-foreground/80">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  testId,
}: {
  value: T;
  options: { value: NoInfer<T>; label: string; icon?: LucideIcon }[];
  onChange: (v: NoInfer<T>) => void;
  testId?: string;
}) {
  return (
    <div className="inline-flex rounded-lg border bg-muted/60 p-0.5" data-testid={testId}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          data-testid={`${testId ?? "seg"}-${o.value}`}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
            value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.icon && <o.icon className="h-3.5 w-3.5" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = "Buscar..." }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="field pl-8" data-testid="input-search" />
    </div>
  );
}

export function Notice({ tone = "amber", icon: Icon, title, children }: { tone?: Tone; icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", tones[tone])}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <div className="font-semibold">{title}</div>
        {children && <div className="mt-0.5 text-xs opacity-90">{children}</div>}
      </div>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", className)}>{children}</th>;
}
export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle text-sm", className)}>{children}</td>;
}
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 -my-4 overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">{children}</table>
    </div>
  );
}
