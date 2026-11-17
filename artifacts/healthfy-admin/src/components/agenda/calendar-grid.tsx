import { Plus } from "lucide-react";
import type { Customer, ModuleRecord } from "@workspace/api-client-react";
import { dayKey, eventsOnDay, sameDay, type CalendarMode } from "@/lib/agenda";
import { cn } from "@/lib/utils";
import { EventCard, type CardActions } from "./event-card";

const WEEK = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTH_LIMIT = 3;

export function CalendarGrid({ days, mode, cursor, list, customers, actions, onAdd, onShowDay }: {
  days: Date[];
  mode: CalendarMode;
  cursor: Date;
  list: ModuleRecord[];
  customers: Map<string, Customer>;
  actions: CardActions;
  onAdd: (d: Date) => void;
  onShowDay: (d: Date) => void;
}) {
  const today = new Date();
  const cols = mode === "day" ? 1 : 7;
  return (
    <div className="w-full min-w-0 overflow-x-auto rounded-2xl border bg-[hsl(220_20%_92%)] shadow-[0_1px_2px_hsl(222_30%_20%/0.05)]" data-testid="calendar-scroll">
      <div className={cn("grid gap-px", mode === "day" ? "min-w-0" : "min-w-[1120px]")} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {mode === "month" && WEEK.map((w, i) => (
          <div key={w} className={cn("bg-[hsl(40_20%_97%)] px-3 py-2.5 text-[12px] font-bold uppercase tracking-[0.08em]", i >= 5 ? "text-[hsl(12_60%_45%)]" : "text-foreground/60")}>{w}</div>
        ))}
        {days.map((d) => {
          const items = eventsOnDay(list, d);
          const isToday = sameDay(d, today);
          const out = mode === "month" && d.getMonth() !== cursor.getMonth();
          const weekend = d.getDay() === 0 || d.getDay() === 6;
          const visible = mode === "month" ? items.slice(0, MONTH_LIMIT) : items;
          const key = dayKey(d);
          return (
            <section key={key} data-testid={`day-${key}`} className={cn("group/day relative flex flex-col bg-card", mode === "month" ? "min-h-[188px]" : mode === "week" ? "min-h-[560px]" : "min-h-[440px]", out && "bg-[hsl(220_16%_97%)]", weekend && !out && "bg-[hsl(40_30%_98.6%)]", isToday && "bg-[hsl(158_40%_97.5%)]")}>
              {isToday && <span className="absolute inset-x-0 top-0 h-[3px] bg-[hsl(var(--chart-1))]" />}
              <header className={cn("flex items-center justify-between gap-2 border-b border-dashed px-3", mode === "month" ? "py-2" : "py-3")}>
                <button type="button" onClick={() => onShowDay(d)} className="flex items-baseline gap-2 text-left" data-testid={`button-day-${key}`}>
                  {mode !== "month" && <span className={cn("text-[12px] font-bold uppercase tracking-[0.08em]", isToday ? "text-[hsl(var(--chart-1))]" : "text-foreground/55")}>{d.toLocaleDateString("pt-BR", { weekday: mode === "day" ? "long" : "short" }).replace(".", "")}</span>}
                  <span className={cn("num inline-flex items-center justify-center rounded-full font-semibold", mode === "month" ? "h-7 min-w-7 px-1 text-[15px]" : "h-9 min-w-9 px-1.5 text-[22px]", isToday ? "bg-[hsl(var(--chart-1))] text-white" : out ? "text-foreground/35" : "text-foreground")}>{d.getDate()}</span>
                  {mode !== "month" && <span className="text-[12px] font-medium capitalize text-foreground/50">{d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>}
                </button>
                <div className="flex items-center gap-1">
                  {items.length > 0 && <span className="num rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground/70">{items.length}</span>}
                  <button type="button" onClick={() => onAdd(d)} aria-label={`Novo compromisso em ${d.toLocaleDateString("pt-BR")}`} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground/50 hover:bg-accent hover:text-accent-foreground" data-testid={`button-add-${key}`}><Plus className="h-4 w-4" /></button>
                </div>
              </header>
              <div className={cn("flex flex-1 flex-col gap-2 p-2", mode === "day" && "grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3 content-start")}>
                {visible.map((a) => <EventCard key={a.id} a={a} day={d} customer={a.customerId ? customers.get(a.customerId) : undefined} actions={actions} density={mode === "month" ? "compact" : "full"} />)}
                {mode === "month" && items.length > MONTH_LIMIT && (
                  <button type="button" onClick={() => onShowDay(d)} className="rounded-md border border-dashed py-1.5 text-[12px] font-semibold text-foreground/70 hover:bg-muted" data-testid={`button-more-${key}`}>+{items.length - MONTH_LIMIT} mais</button>
                )}
                {items.length === 0 && (
                  <button type="button" onClick={() => onAdd(d)} className={cn("flex flex-1 items-center justify-center rounded-lg text-[12px] font-medium text-foreground/0 transition-colors hover:bg-muted/60 hover:text-foreground/50 focus:text-foreground/50", mode === "day" && "min-h-[300px] text-foreground/40 sm:col-span-2 xl:col-span-3")}>
                    {mode === "day" ? "Dia livre. Clique para agendar." : "Agendar"}
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
