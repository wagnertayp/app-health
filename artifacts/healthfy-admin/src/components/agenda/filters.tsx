import { Check, ChevronDown, Search, X } from "lucide-react";
import type { Customer } from "@workspace/api-client-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { activeFilterCount, type AgendaFilters } from "@/lib/agenda";
import { priorityLabel } from "@/components/records";
import { cn } from "@/lib/utils";

function Multi({ label, options, value, onChange, testId }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void; testId: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" data-testid={testId} className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors", value.length ? "border-[hsl(var(--chart-1))] bg-accent text-accent-foreground" : "bg-card hover:bg-muted")}>
          {label}
          {value.length > 0 && <span className="num rounded-full bg-[hsl(var(--chart-1))] px-1.5 text-[11px] text-white">{value.length}</span>}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        {options.length === 0 ? <p className="px-2 py-3 text-xs text-muted-foreground">Nenhuma opção nos compromissos.</p> : (
          <div className="max-h-72 overflow-y-auto">
            {options.map((o) => {
              const on = value.includes(o);
              return (
                <button type="button" key={o} role="checkbox" aria-checked={on} onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted" data-testid={`${testId}-option-${o}`}>
                  <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", on && "border-[hsl(var(--chart-1))] bg-[hsl(var(--chart-1))] text-white")}>{on && <Check className="h-3 w-3" />}</span>
                  <span className="truncate">{o}</span>
                </button>
              );
            })}
          </div>
        )}
        {value.length > 0 && <button type="button" onClick={() => onChange([])} className="mt-1 w-full rounded-md border-t px-2 py-1.5 text-left text-xs font-medium text-muted-foreground hover:text-foreground">Limpar seleção</button>}
      </PopoverContent>
    </Popover>
  );
}

const sel = (on: boolean) => cn("h-9 rounded-lg border px-2.5 text-[13px] font-medium outline-none focus:border-ring", on ? "border-[hsl(var(--chart-1))] bg-accent text-accent-foreground" : "bg-card");

export function AgendaFilterBar({ f, set, options, customers, matchCount }: {
  f: AgendaFilters;
  set: (p: Partial<AgendaFilters>) => void;
  options: { people: string[]; tags: string[]; channels: string[]; statuses: string[] };
  customers: Customer[];
  matchCount: number;
}) {
  const n = activeFilterCount(f);
  const custName = customers.find((c) => c.id === f.customerId)?.name;
  const chips: { k: string; label: string; clear: () => void }[] = [
    ...(f.q.trim() ? [{ k: "q", label: `Busca: ${f.q.trim()}`, clear: () => set({ q: "" }) }] : []),
    ...f.people.map((p) => ({ k: `p-${p}`, label: p, clear: () => set({ people: f.people.filter((x) => x !== p) }) })),
    ...(f.customerId ? [{ k: "c", label: `Cliente: ${custName ?? "removido"}`, clear: () => set({ customerId: "" }) }] : []),
    ...f.statuses.map((s) => ({ k: `s-${s}`, label: s, clear: () => set({ statuses: f.statuses.filter((x) => x !== s) }) })),
    ...f.tags.map((t) => ({ k: `t-${t}`, label: `#${t}`, clear: () => set({ tags: f.tags.filter((x) => x !== t) }) })),
    ...(f.channel ? [{ k: "ch", label: `Canal: ${f.channel}`, clear: () => set({ channel: "" }) }] : []),
    ...(f.priority ? [{ k: "pr", label: `Prioridade ${priorityLabel[f.priority]}`, clear: () => set({ priority: "" }) }] : []),
  ];
  return (
    <section className="mb-4 rounded-xl border bg-card p-3" data-testid="agenda-filters">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input aria-label="Buscar compromissos" value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Buscar título, pessoa, cliente, etiqueta, canal ou pauta" className="field h-9 pl-8" data-testid="filter-search" />
        </label>
        <Multi label="Pessoas" options={options.people} value={f.people} onChange={(people) => set({ people })} testId="filter-responsible" />
        <select aria-label="Filtrar por cliente" value={f.customerId} onChange={(e) => set({ customerId: e.target.value })} className={sel(!!f.customerId)} data-testid="filter-customer">
          <option value="">Todos os clientes</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Multi label="Status" options={options.statuses} value={f.statuses} onChange={(statuses) => set({ statuses })} testId="filter-status" />
        <Multi label="Etiquetas" options={options.tags} value={f.tags} onChange={(tags) => set({ tags })} testId="filter-tags" />
        <select aria-label="Filtrar por canal" value={f.channel} onChange={(e) => set({ channel: e.target.value })} className={sel(!!f.channel)} data-testid="filter-channel">
          <option value="">Todos os canais</option>
          {options.channels.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select aria-label="Filtrar por prioridade" value={f.priority} onChange={(e) => set({ priority: e.target.value })} className={sel(!!f.priority)} data-testid="filter-priority">
          <option value="">Qualquer prioridade</option>
          {(["high", "medium", "low"] as const).map((p) => <option key={p} value={p}>{priorityLabel[p]}</option>)}
        </select>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[12px]">
        <span className="num mr-1 font-semibold" data-testid="text-match-count">{matchCount} {matchCount === 1 ? "compromisso" : "compromissos"} no período</span>
        {chips.map((c) => (
          <button key={c.k} type="button" onClick={c.clear} className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--chart-1))]/40 bg-accent px-2 py-0.5 font-medium text-accent-foreground hover:bg-accent/70">
            {c.label}<X className="h-3 w-3" />
          </button>
        ))}
        {n > 0 && <button type="button" onClick={() => set({ q: "", people: [], customerId: "", statuses: [], tags: [], channel: "", priority: "" })} className="ml-auto font-semibold text-destructive hover:underline" data-testid="button-clear-filters">Limpar filtros ({n})</button>}
      </div>
    </section>
  );
}
