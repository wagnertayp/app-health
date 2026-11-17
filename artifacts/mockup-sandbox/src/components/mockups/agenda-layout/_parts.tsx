import { ChevronDown, ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";

const days = [
  { day: "Seg", date: "16", items: [{ time: "09:30", title: "Alinhamento de campanha", person: "Marina Costa", customer: "AC Academy", color: "blue", tag: "Marketing" }, { time: "14:00", title: "Revisão de automação", person: "Rafael Lima", customer: "Spa&Bronze Belém", color: "green", tag: "Automação" }] },
  { day: "Ter", date: "17", items: [{ time: "10:00", title: "Apresentação do novo fluxo", person: "Marina Costa", customer: "AC Academy", color: "green", tag: "Reunião" }, { time: "15:30", title: "Acompanhamento semanal", person: "João Pedro", customer: "Belém Saúde", color: "amber", tag: "Retorno" }] },
  { day: "Qua", date: "18", items: [{ time: "11:00", title: "Planejamento de conteúdo", person: "João Pedro", customer: "Spa&Bronze Belém", color: "blue", tag: "Conteúdo" }] },
  { day: "Qui", date: "19", items: [{ time: "09:00", title: "Entrega do relatório mensal", person: "Rafael Lima", customer: "Belém Saúde", color: "green", tag: "Entrega" }] },
  { day: "Sex", date: "20", items: [{ time: "13:30", title: "Reunião de resultados", person: "Marina Costa", customer: "AC Academy", color: "amber", tag: "Reunião" }] },
  { day: "Sáb", date: "21", items: [] },
  { day: "Dom", date: "22", items: [] },
];

const controls = ["Pessoas", "Todos os clientes", "Status", "Etiquetas", "Canal", "Prioridade"];

export function Filters({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`rounded-xl border bg-card ${compact ? "p-3" : "p-3"}`}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input className="field h-9 pl-8" placeholder="Buscar compromissos" />
      </div>
      {compact ? (
        <div className="mt-3 space-y-3">
          <FilterGroup title="Equipe e cliente" options={controls.slice(0, 2)} />
          <FilterGroup title="Compromisso" options={controls.slice(2, 4)} />
          <FilterGroup title="Classificação" options={controls.slice(4)} />
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {controls.map((label) => <FilterButton key={label} label={label} />)}
        </div>
      )}
      <div className={`mt-3 flex ${compact ? "flex-col items-start" : "flex-wrap"} items-center gap-2 border-t pt-3 text-xs`}>
        <span className="font-semibold">12 compromissos no período</span>
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border bg-accent px-2 py-1 text-accent-foreground">Marina Costa <X className="h-3 w-3" /></span>
          <span className="inline-flex items-center gap-1 rounded-full border bg-accent px-2 py-1 text-accent-foreground">Confirmado <X className="h-3 w-3" /></span>
        </div>
        <button className="font-semibold text-destructive">Limpar filtros</button>
      </div>
    </section>
  );
}

function FilterGroup({ title, options }: { title: string; options: string[] }) {
  return (
    <div className="space-y-2 border-b pb-3 last:border-0 last:pb-0">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      {options.map((label) => <FilterButton key={label} label={label} full />)}
    </div>
  );
}

function FilterButton({ label, full }: { label: string; full?: boolean }) {
  return <button className={`inline-flex h-9 items-center justify-between gap-1.5 rounded-lg border bg-card px-3 text-left text-[13px] font-medium ${full ? "w-full" : ""}`}>{label}<ChevronDown className="h-3.5 w-3.5 opacity-60" /></button>;
}

export function CalendarPreview({ wide = false }: { wide?: boolean }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border bg-[hsl(220_20%_92%)] shadow-sm">
      <div className="overflow-x-auto">
        <div className={`grid ${wide ? "min-w-[1050px]" : "min-w-[1400px]"} grid-cols-7 gap-px bg-border`}>
          {days.map((d, index) => (
            <section key={d.date} className={`flex min-h-[560px] flex-col bg-card ${index > 4 ? "bg-[hsl(40_30%_98.6%)]" : ""} ${d.date === "17" ? "bg-[hsl(158_40%_97.5%)]" : ""}`}>
              <header className="flex items-center justify-between gap-2 border-b border-dashed px-3 py-3">
                <div className="flex items-baseline gap-2">
                  <span className={`text-[12px] font-bold uppercase tracking-wider ${d.date === "17" ? "text-[hsl(var(--chart-1))]" : "text-foreground/55"}`}>{d.day}</span>
                  <span className={`num inline-flex h-9 min-w-9 items-center justify-center rounded-full px-1.5 text-[22px] font-semibold ${d.date === "17" ? "bg-[hsl(var(--chart-1))] text-white" : ""}`}>{d.date}</span>
                </div>
                <div className="flex items-center gap-1">
                  {d.items.length > 0 && <span className="num rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">{d.items.length}</span>}
                  <button className="inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground/50 hover:bg-accent"><Plus className="h-4 w-4" /></button>
                </div>
              </header>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {d.items.map((item) => <Event key={item.title} {...item} />)}
                {!d.items.length && <div className="flex flex-1 items-center justify-center text-xs text-foreground/35">Agendar</div>}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function Event({ time, title, person, customer, color, tag }: { time: string; title: string; person: string; customer: string; color: string; tag: string }) {
  const tones: Record<string, string> = {
    blue: "bg-[hsl(218_70%_95%)] text-[hsl(222_50%_36%)] border-[hsl(218_50%_86%)]",
    green: "bg-[hsl(158_45%_93%)] text-[hsl(160_60%_24%)] border-[hsl(158_40%_82%)]",
    amber: "bg-[hsl(42_90%_93%)] text-[hsl(30_70%_30%)] border-[hsl(40_70%_80%)]",
  };
  return (
    <article className="relative overflow-hidden rounded-lg border bg-card px-3 py-2 text-left shadow-[0_1px_2px_hsl(222_30%_20%/0.06)]">
      <span className={`absolute inset-y-0 left-0 w-1 ${color === "green" ? "bg-[hsl(var(--chart-1))]" : color === "amber" ? "bg-[hsl(var(--chart-4))]" : "bg-[hsl(var(--chart-3))]"}`} />
      <div className="flex items-center justify-between gap-1">
        <span className="num text-xs font-semibold text-foreground/75">{time}</span>
        <span className={`rounded-full border px-1.5 py-px text-[10px] font-semibold ${tones[color]}`}>Confirmado</span>
      </div>
      <div className="mt-1 text-sm font-semibold leading-snug">{title}</div>
      <div className="mt-1.5 truncate text-xs font-medium text-foreground/80">{customer}</div>
      <div className="mt-2 flex items-center gap-1.5 text-xs"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">{person.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><span className="truncate font-semibold">{person}</span></div>
      <div className="mt-2"><span className="rounded-md border bg-muted px-1.5 py-px text-[10px] font-medium">{tag}</span></div>
    </article>
  );
}

export function CalendarToolbar() {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card"><ChevronLeft className="h-4 w-4" /></button>
        <button className="h-9 rounded-lg border bg-card px-3 text-sm">Hoje</button>
        <button className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card"><ChevronRight className="h-4 w-4" /></button>
        <span className="text-lg font-semibold">16 – 22 nov. 2026</span>
      </div>
      <div className="inline-flex rounded-lg border bg-card p-1 text-xs font-medium">
        <span className="rounded-md px-3 py-1.5">Dia</span><span className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground">Semana</span><span className="rounded-md px-3 py-1.5">Mês</span>
      </div>
    </div>
  );
}
