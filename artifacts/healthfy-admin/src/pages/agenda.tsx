import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { getListCustomersQueryKey, useListCustomers, type Customer, type ModuleRecord } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Confirm, ErrorState, PageHeader, Segmented } from "@/components/kit";
import { Skeleton } from "@/components/ui/skeleton";
import { toInput, useRecordActions, useRecords } from "@/components/records";
import { AgendaFilterBar } from "@/components/agenda/filters";
import { CalendarGrid } from "@/components/agenda/calendar-grid";
import { EventCard, type CardActions } from "@/components/agenda/event-card";
import { AppointmentEditor } from "@/components/agenda/appointment-editor";
import { dayKey, deriveOptions, emptyFilters, eventsOnDay, filterAppointments, getCalendarDays, overlapsRange, shiftCursor, startOfDay, visibleRange, type AgendaFilters, type CalendarMode } from "@/lib/agenda";
import { usePageMeta } from "@/lib/format";

export default function Agenda() {
  usePageMeta("Multi-agenda", "Agendas dos vendedores e da equipe Healthfy.");
  const appts = useRecords("appointments");
  const customersQ = useListCustomers({ query: { queryKey: getListCustomersQueryKey() } });
  const { save, remove, pending } = useRecordActions("appointments");
  const [mode, setMode] = useState<CalendarMode>("week");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [filters, setFilters] = useState<AgendaFilters>(emptyFilters);
  const [editorOpen, setEditorOpen] = useState(false);
  const [edit, setEdit] = useState<ModuleRecord | null>(null);
  const [addDay, setAddDay] = useState<Date | undefined>();
  const [toDel, setToDel] = useState<ModuleRecord | null>(null);
  const [toCancel, setToCancel] = useState<ModuleRecord | null>(null);
  const [cancelErr, setCancelErr] = useState("");
  const [detailDay, setDetailDay] = useState<Date | null>(null);

  const customers = useMemo(() => customersQ.data ?? [], [customersQ.data]);
  const custMap = useMemo(() => new Map<string, Customer>(customers.map((c) => [c.id, c])), [customers]);
  const all = useMemo(() => appts.data ?? [], [appts.data]);
  const options = useMemo(() => deriveOptions(all), [all]);
  const filtered = useMemo(() => filterAppointments(all, filters, (id) => custMap.get(id)?.name), [all, filters, custMap]);
  const days = useMemo(() => getCalendarDays(cursor, mode), [cursor, mode]);
  const range = visibleRange(days);
  const matchCount = filtered.filter((a) => overlapsRange(a, range.from, range.to)).length;

  const label = mode === "month"
    ? cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : mode === "day"
      ? cursor.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : `${days[0].toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}`;

  const openNew = (d?: Date) => { setEdit(null); setAddDay(d); setEditorOpen(true); };
  const actions: CardActions = {
    onEdit: (a) => { setEdit(a); setAddDay(undefined); setEditorOpen(true); },
    onCancel: (a) => { setCancelErr(""); setToCancel(a); },
    onDelete: (a) => setToDel(a),
  };
  const detailItems = detailDay ? eventsOnDay(filtered, detailDay) : [];

  return (
    <div className="min-w-0">
      <PageHeader title="Multi-agenda" actions={<Button onClick={() => openNew()} data-testid="button-new-appointment"><Plus className="mr-1.5 h-4 w-4" />Compromisso</Button>} />

      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => setCursor((c) => shiftCursor(c, mode, -1))} aria-label="Período anterior" data-testid="button-prev"><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" className="h-9" onClick={() => setCursor(startOfDay(new Date()))} data-testid="button-today">Hoje</Button>
          <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => setCursor((c) => shiftCursor(c, mode, 1))} aria-label="Próximo período" data-testid="button-next"><ChevronRight className="h-4 w-4" /></Button>
          <input type="date" className="field h-9 w-[150px]" value={dayKey(cursor)} onChange={(e) => { const [y, m, d] = e.target.value.split("-").map(Number); if (y && m && d) setCursor(new Date(y, m - 1, d)); }} aria-label="Ir para data" data-testid="input-goto-date" />
          <h2 className="ml-1 text-lg font-semibold capitalize" data-testid="text-period">{label}</h2>
        </div>
        <Segmented testId="toggle-mode" value={mode} onChange={setMode} options={[{ value: "day", label: "Dia" }, { value: "week", label: "Semana" }, { value: "month", label: "Mês" }]} />
      </div>

      <AgendaFilterBar f={filters} set={(p) => setFilters((s) => ({ ...s, ...p }))} options={options} customers={customers} matchCount={matchCount} />

      {appts.isLoading ? (
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border bg-border" data-testid="calendar-loading">
          {Array.from({ length: 14 }, (_, i) => <div key={i} className="space-y-2 bg-card p-3"><Skeleton className="h-6 w-10" /><Skeleton className="h-16 w-full" /></div>)}
        </div>
      ) : appts.isError ? (
        <ErrorState error={appts.error} onRetry={() => appts.refetch()} />
      ) : (
        <CalendarGrid days={days} mode={mode} cursor={cursor} list={filtered} customers={custMap} actions={actions} onAdd={openNew} onShowDay={setDetailDay} />
      )}

      <Dialog open={!!detailDay} onOpenChange={(o) => !o && setDetailDay(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle className="capitalize">{detailDay?.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })} · {detailItems.length}</DialogTitle></DialogHeader>
          <div className="space-y-2" data-testid="list-day-detail">
            {detailItems.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nenhum compromisso com os filtros atuais.</p> : detailItems.map((a) => (
              <EventCard key={a.id} a={a} day={detailDay ?? undefined} customer={a.customerId ? custMap.get(a.customerId) : undefined} actions={{ onEdit: (x) => { setDetailDay(null); actions.onEdit(x); }, onCancel: actions.onCancel, onDelete: actions.onDelete }} />
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { const d = detailDay; setDetailDay(null); if (d) { setCursor(d); setMode("day"); } }} data-testid="button-open-day">Abrir dia</Button>
            <Button onClick={() => { const d = detailDay ?? undefined; setDetailDay(null); openNew(d); }} data-testid="button-add-detail"><Plus className="mr-1.5 h-4 w-4" />Agendar neste dia</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AppointmentEditor open={editorOpen} onOpenChange={setEditorOpen} record={edit} day={addDay} customers={customers} knownTags={options.tags} />

      <Dialog open={!!toCancel} onOpenChange={(o) => { if (!o && !pending) setToCancel(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Cancelar compromisso?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">O compromisso permanece na agenda marcado como cancelado.</p>
          {cancelErr && <p role="alert" className="text-xs font-medium text-destructive">{cancelErr}</p>}
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setToCancel(null)} data-testid="button-cancel-confirm">Voltar</Button>
            <Button variant="destructive" disabled={pending} data-testid="button-confirm" onClick={async () => {
              if (!toCancel) return;
              setCancelErr("");
              const r = await save(toInput(toCancel, { status: "Cancelado" }), toCancel.id, "Compromisso cancelado");
              if (r) setToCancel(null); else setCancelErr("Não foi possível cancelar. Tente novamente.");
            }}>{pending ? "Cancelando..." : "Cancelar compromisso"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Confirm open={!!toDel} onOpenChange={(o) => !o && setToDel(null)} title="Excluir compromisso?" body="Esta ação não pode ser desfeita." confirmLabel="Excluir" destructive onConfirm={() => toDel && remove(toDel.id, () => setToDel(null))} />
    </div>
  );
}
