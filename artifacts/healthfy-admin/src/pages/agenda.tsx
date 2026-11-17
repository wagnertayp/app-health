import { useMemo, useState } from "react";
import { Ban, CalendarRange, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import type { ModuleRecord } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Confirm, EmptyState, ErrorState, LoadingRows, PageHeader, Panel, Pill, Segmented } from "@/components/kit";
import { RecordDialog, toInput, useRecordActions, useRecords, type FieldDef } from "@/components/records";
import { fmtTime, localISO, usePageMeta } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUSES = ["Agendado", "Confirmado", "Realizado", "Cancelado"];
const fields: FieldDef[] = [
  { name: "title", label: "Compromisso", type: "text", required: true, full: true },
  { name: "date", label: "Início", type: "datetime", required: true },
  { name: "endDate", label: "Fim", type: "datetime", required: true },
  { name: "responsible", label: "Responsável (vendedor)", type: "text", required: true },
  { name: "status", label: "Status", type: "select", options: STATUSES.map((s) => ({ value: s, label: s })) },
  { name: "customerId", label: "Cliente", type: "customer" },
  { name: "channel", label: "Canal", type: "text", meta: true, placeholder: "Meet, presencial, WhatsApp..." },
  { name: "reminder", label: "Lembrete", type: "select", meta: true, options: [{ value: "none", label: "Sem lembrete" }, { value: "15", label: "15 min antes" }, { value: "60", label: "1 hora antes" }, { value: "1440", label: "1 dia antes" }], hint: "Registrado no compromisso; envio automático não conectado." },
  { name: "description", label: "Pauta", type: "textarea" },
];
const tone = (s: string) => (s === "Cancelado" ? "red" : s === "Realizado" ? "green" : s === "Confirmado" ? "blue" : "amber") as "red";
const p2 = (n: number) => String(n).padStart(2, "0");
const toLocal = (d: Date) => `${localISO(d)}T${p2(d.getHours())}:${p2(d.getMinutes())}`;

export default function Agenda() {
  usePageMeta("Multi-agenda", "Agendas dos vendedores e da equipe Healthfy.");
  const appts = useRecords("appointments");
  const { save, remove } = useRecordActions("appointments");
  const [mode, setMode] = useState<"day" | "week" | "month">("week");
  const [cursor, setCursor] = useState(new Date());
  const [who, setWho] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<ModuleRecord | null>(null);
  const [toDel, setToDel] = useState<ModuleRecord | null>(null);
  const [toCancel, setToCancel] = useState<ModuleRecord | null>(null);
  const people = Array.from(new Set((appts.data ?? []).map((a) => a.responsible).filter(Boolean)));
  const days = useMemo(() => {
    const d = new Date(cursor); d.setHours(0, 0, 0, 0);
    if (mode === "day") return [d];
    if (mode === "week") { const s = new Date(d); s.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return Array.from({ length: 7 }, (_, i) => { const x = new Date(s); x.setDate(s.getDate() + i); return x; }); }
    const first = new Date(d.getFullYear(), d.getMonth(), 1); const s = new Date(first); s.setDate(1 - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => { const x = new Date(s); x.setDate(s.getDate() + i); return x; });
  }, [cursor, mode]);
  const shift = (dir: number) => { const d = new Date(cursor); if (mode === "day") d.setDate(d.getDate() + dir); else if (mode === "week") d.setDate(d.getDate() + 7 * dir); else d.setMonth(d.getMonth() + dir); setCursor(d); };
  const list = (appts.data ?? []).filter((a) => !who || a.responsible === who);
  const on = (d: Date) => list.filter((a) => localISO(new Date(a.date)) === localISO(d)).sort((a, b) => a.date.localeCompare(b.date));
  const label = mode === "month" ? cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : mode === "day" ? cursor.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }) : `${days[0].toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}`;
  const now = new Date(); now.setMinutes(0, 0, 0); now.setHours(now.getHours() + 1);
  const later = new Date(now); later.setHours(now.getHours() + 1);

  const Card = ({ a, compact }: { a: ModuleRecord; compact?: boolean }) => (
    <div className={cn("group rounded-md border-l-2 bg-card px-2 py-1.5 text-xs shadow-sm", a.status === "Cancelado" ? "border-destructive opacity-60 line-through" : "border-[hsl(var(--chart-1))]")} data-testid={`appt-${a.id}`}>
      <div className="flex items-center justify-between gap-1"><span className="num text-muted-foreground">{fmtTime(a.date)}</span>{!compact && <Pill tone={tone(a.status)}>{a.status}</Pill>}</div>
      <div className="truncate font-medium">{a.title}</div>
      {!compact && <div className="truncate text-muted-foreground">{a.responsible}</div>}
      <div className="mt-1 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
        <button onClick={() => { setEdit(a); setOpen(true); }} title="Reagendar / editar" data-testid={`edit-${a.id}`}><Pencil className="h-3 w-3" /></button>
        {a.status !== "Cancelado" && <button onClick={() => setToCancel(a)} title="Cancelar" data-testid={`cancel-${a.id}`}><Ban className="h-3 w-3" /></button>}
        <button onClick={() => setToDel(a)} title="Excluir" data-testid={`delete-${a.id}`}><Trash2 className="h-3 w-3 text-destructive" /></button>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader title="Multi-agenda" subtitle="Agenda individual por vendedor ou visão geral da equipe." actions={<Button onClick={() => { setEdit(null); setOpen(true); }} data-testid="button-new-appointment"><Plus className="mr-1.5 h-4 w-4" />Compromisso</Button>} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => shift(-1)} data-testid="button-prev"><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setCursor(new Date())} data-testid="button-today">Hoje</Button>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => shift(1)} data-testid="button-next"><ChevronRight className="h-4 w-4" /></Button>
          <span className="ml-2 text-sm font-semibold capitalize">{label}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="field h-8 w-48 text-xs" value={who} onChange={(e) => setWho(e.target.value)} data-testid="filter-responsible"><option value="">Equipe inteira</option>{people.map((p) => <option key={p}>{p}</option>)}</select>
          <Segmented testId="toggle-mode" value={mode} onChange={setMode} options={[{ value: "day", label: "Dia" }, { value: "week", label: "Semana" }, { value: "month", label: "Mês" }]} />
        </div>
      </div>
      {appts.isLoading ? <LoadingRows /> : appts.isError ? <ErrorState error={appts.error} onRetry={() => appts.refetch()} /> : !appts.data?.length ? (
        <EmptyState icon={CalendarRange} title="Agenda vazia" body="Crie compromissos e atribua responsáveis para montar a agenda da equipe." action={<Button size="sm" onClick={() => setOpen(true)}>Novo compromisso</Button>} />
      ) : mode === "day" ? (
        <Panel title={`${on(days[0]).length} compromisso(s)`}>{on(days[0]).length ? <div className="space-y-2">{on(days[0]).map((a) => <Card key={a.id} a={a} />)}</div> : <p className="text-sm text-muted-foreground">Dia livre.</p>}</Panel>
      ) : (
        <div className={cn("grid gap-px overflow-hidden rounded-xl border bg-border", mode === "week" ? "grid-cols-1 sm:grid-cols-7" : "grid-cols-7")}>
          {(mode === "month" ? ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] : []).map((d) => <div key={d} className="bg-muted/60 px-2 py-1 text-[11px] font-semibold text-muted-foreground">{d}</div>)}
          {days.map((d) => { const isToday = localISO(d) === localISO(); const out = mode === "month" && d.getMonth() !== cursor.getMonth(); const items = on(d); return (
            <div key={d.toISOString()} className={cn("bg-card p-1.5", mode === "week" ? "min-h-[180px]" : "min-h-[92px]", out && "bg-muted/40 text-muted-foreground")}>
              <div className={cn("mb-1 flex items-center gap-1 text-[11px] font-medium", isToday && "text-[hsl(var(--chart-1))]")}>{mode === "week" && <span className="capitalize">{d.toLocaleDateString("pt-BR", { weekday: "short" })}</span>}<span className={cn("num", isToday && "rounded bg-[hsl(var(--chart-1))] px-1 text-white")}>{d.getDate()}</span></div>
              <div className="space-y-1">{(mode === "month" ? items.slice(0, 2) : items).map((a) => <Card key={a.id} a={a} compact={mode === "month"} />)}{mode === "month" && items.length > 2 && <button className="text-[10px] text-muted-foreground hover:underline" onClick={() => { setCursor(d); setMode("day"); }}>+{items.length - 2} mais</button>}</div>
            </div>); })}
        </div>
      )}
      <RecordDialog kind="appointments" open={open} onOpenChange={setOpen} record={edit} fields={fields} defaults={{ status: "Agendado", date: toLocal(now), endDate: toLocal(later), reminder: "none" }} title={edit ? "Reagendar / editar compromisso" : "Novo compromisso"} description="O fim precisa ser posterior ao início." />
      <Confirm open={!!toCancel} onOpenChange={(o) => !o && setToCancel(null)} title="Cancelar compromisso?" body="O compromisso permanece na agenda marcado como cancelado." confirmLabel="Cancelar compromisso" destructive onConfirm={() => toCancel && save(toInput(toCancel, { status: "Cancelado" }), toCancel.id, "Compromisso cancelado").then(() => setToCancel(null))} />
      <Confirm open={!!toDel} onOpenChange={(o) => !o && setToDel(null)} title="Excluir compromisso?" body="Esta ação não pode ser desfeita." confirmLabel="Excluir" destructive onConfirm={() => toDel && remove(toDel.id, () => setToDel(null))} />
    </div>
  );
}
