import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import type { Customer, RecordInput } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/kit";
import { useRecordActions } from "@/components/records";
import { localISO, num } from "@/lib/format";

const STORAGE_KEY = "healthfy.hours.timer.v1";
type TimerDraft = {
  title: string;
  customerId: string;
  responsible: string;
  description: string;
  date: string;
  hours: string;
  elapsedMs: number;
  startedAt: number | null;
};
type Balance = { sold: number; used: number };
type DraftField = "title" | "customerId" | "responsible" | "description" | "date" | "hours";

function emptyDraft(): TimerDraft {
  return { title: "", customerId: "", responsible: "", description: "", date: localISO(), hours: "", elapsedMs: 0, startedAt: null };
}

function readDraft(): TimerDraft {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return emptyDraft();
    const parsed = JSON.parse(saved) as Partial<TimerDraft>;
    return {
      ...emptyDraft(),
      ...parsed,
      title: typeof parsed.title === "string" ? parsed.title : "",
      customerId: typeof parsed.customerId === "string" ? parsed.customerId : "",
      responsible: typeof parsed.responsible === "string" ? parsed.responsible : "",
      description: typeof parsed.description === "string" ? parsed.description : "",
      date: typeof parsed.date === "string" ? parsed.date : localISO(),
      hours: typeof parsed.hours === "string" ? parsed.hours : "",
      elapsedMs: Number.isFinite(parsed.elapsedMs) && Number(parsed.elapsedMs) >= 0 ? Number(parsed.elapsedMs) : 0,
      startedAt: Number.isFinite(parsed.startedAt) ? Number(parsed.startedAt) : null,
    };
  } catch {
    return emptyDraft();
  }
}

function elapsed(draft: TimerDraft, now: number) {
  return draft.elapsedMs + (draft.startedAt ? Math.max(0, now - draft.startedAt) : 0);
}

function clock(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function hoursValue(ms: number) {
  return Number((ms / 3_600_000).toFixed(4));
}

export function HoursLogDialog({
  open,
  onOpenChange,
  customers,
  balances,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
  balances: Record<string, Balance>;
}) {
  const [draft, setDraft] = useState<TimerDraft>(readDraft);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");
  const { save, pending } = useRecordActions("hours");
  const durationMs = elapsed(draft, now);
  const countedHours = draft.startedAt ? hoursValue(durationMs) : Number(draft.hours) || 0;
  const selectedBalance = balances[draft.customerId] ?? { sold: 0, used: 0 };
  const projectedUsed = selectedBalance.used + countedHours;
  const progress = selectedBalance.sold > 0 ? Math.min(100, (projectedUsed / selectedBalance.sold) * 100) : 0;
  const percentLabel = useMemo(() => `${Math.round(progress)}%`, [progress]);
  const hasTimer = durationMs > 0 || !!draft.startedAt;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // The running timer continues for this session if browser storage is unavailable.
    }
  }, [draft]);

  const set = (key: DraftField, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  function toggleTimer() {
    setError("");
    if (draft.startedAt) {
      const finalMs = elapsed(draft, Date.now());
      setNow(Date.now());
      setDraft((current) => ({ ...current, elapsedMs: finalMs, startedAt: null, hours: String(hoursValue(finalMs)) }));
      return;
    }
    if (!draft.customerId) {
      setError("Selecione o cliente antes de iniciar o timer.");
      return;
    }
    setDraft((current) => ({ ...current, startedAt: Date.now() }));
    setNow(Date.now());
  }

  function resetTimer() {
    setDraft((current) => ({ ...current, elapsedMs: 0, startedAt: null, hours: "" }));
    setNow(Date.now());
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const value = draft.startedAt ? hoursValue(elapsed(draft, Date.now())) : Number(draft.hours) || 0;
    if (!draft.customerId) return setError("Selecione o cliente.");
    if (!draft.title.trim()) return setError("Informe a atividade realizada.");
    if (!(value > 0)) return setError("Inicie o timer ou informe as horas consumidas.");
    const record: RecordInput = {
      title: draft.title.trim(),
      status: "registrado",
      description: draft.description.trim(),
      responsible: draft.responsible.trim(),
      customerId: draft.customerId,
      value,
      date: draft.date || localISO(),
      endDate: "",
      priority: "medium",
      tags: [],
      metadata: {},
    };
    const saved = await save(record, undefined, "Consumo de horas registrado");
    if (saved) {
      const clean = emptyDraft();
      setDraft(clean);
      setNow(Date.now());
      setError("");
      onOpenChange(false);
    }
  }

  return (
    <>
      {!open && hasTimer && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3" data-testid="hours-timer-resume">
          <div className="flex items-center gap-3">
            <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${draft.startedAt ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}><Timer className="h-5 w-5" /></span>
            <div>
              <div className="text-sm font-semibold">{draft.title || "Registro de horas em andamento"}</div>
              <div className="font-description text-xs text-muted-foreground">{clock(durationMs)} · {customers.find((c) => c.id === draft.customerId)?.name ?? "Selecione o cliente"}</div>
            </div>
          </div>
          <Button onClick={() => onOpenChange(true)} data-testid="button-resume-hours-timer">Abrir registro</Button>
        </div>
      )}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Registrar consumo de horas</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit}>
            <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-3">
                <Field label="Cliente *">
                  <select className="field min-h-12" value={draft.customerId} onChange={(event) => set("customerId", event.target.value)} data-testid="select-hours-customer">
                    <option value="">Selecione um cliente</option>
                    {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                  </select>
                </Field>
                <Field label="Atividade *">
                  <input className="field min-h-12" value={draft.title} onChange={(event) => set("title", event.target.value)} placeholder="Ex.: Configuração de automação" data-testid="input-hours-title" />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Horas consumidas">
                    <input className="field min-h-12" type="number" min="0" step="any" value={draft.startedAt ? countedHours : draft.hours} onChange={(event) => set("hours", event.target.value)} readOnly={!!draft.startedAt} data-testid="input-hours-value" />
                  </Field>
                  <Field label="Data">
                    <input className="field min-h-12" type="date" value={draft.date} onChange={(event) => set("date", event.target.value)} data-testid="input-hours-date" />
                  </Field>
                </div>
                <Field label="Executado por">
                  <input className="field min-h-12" value={draft.responsible} onChange={(event) => set("responsible", event.target.value)} placeholder="Nome do responsável" data-testid="input-hours-responsible" />
                </Field>
                <Field label="Detalhes">
                  <textarea className="field min-h-24" value={draft.description} onChange={(event) => set("description", event.target.value)} placeholder="Anotações sobre o trabalho realizado" data-testid="input-hours-description" />
                </Field>
              </div>

              <div className="space-y-4">
                <section className="rounded-xl border bg-card p-4" aria-label="Timer de horas">
                  <div className="flex items-center gap-2 text-sm font-semibold"><Timer className="h-4 w-4 text-primary" />Timer</div>
                  <div className="num my-4 text-center text-4xl font-semibold tabular-nums" data-testid="text-hours-timer">{clock(durationMs)}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" className="min-h-12" onClick={toggleTimer} disabled={pending} data-testid="button-toggle-hours-timer">
                      {draft.startedAt ? <><Pause className="mr-2 h-4 w-4" />Pausar</> : <><Play className="mr-2 h-4 w-4" />{durationMs ? "Continuar" : "Iniciar"}</>}
                    </Button>
                    <Button type="button" variant="outline" className="min-h-12" onClick={resetTimer} disabled={!hasTimer || pending} data-testid="button-reset-hours-timer"><RotateCcw className="mr-2 h-4 w-4" />Zerar</Button>
                  </div>
                  <p className="font-description mt-3 text-center text-xs text-muted-foreground">{draft.startedAt ? "Contabilizando tempo" : "O tempo fica salvo neste navegador até o registro ser concluído."}</p>
                </section>

                <section className="rounded-xl border bg-card p-4" aria-label="Progresso do pacote do cliente">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">Progresso do pacote</div>
                    {draft.customerId && selectedBalance.sold > 0 && <span className="num text-xs font-medium text-muted-foreground">{percentLabel}</span>}
                  </div>
                  {!draft.customerId ? (
                    <p className="font-description mt-3 text-sm text-muted-foreground">Selecione um cliente para ver o saldo do pacote.</p>
                  ) : selectedBalance.sold > 0 ? (
                    <>
                      <div className="font-description mt-2 text-xs text-muted-foreground">{num(projectedUsed)}h de {num(selectedBalance.sold)}h utilizadas</div>
                      <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`Pacote usado ${percentLabel}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
                        <div className={`h-full rounded-full transition-[width] ${projectedUsed > selectedBalance.sold ? "bg-destructive" : "bg-primary"}`} style={{ width: `${progress}%` }} />
                      </div>
                      <div className="font-description mt-2 flex justify-between text-xs text-muted-foreground">
                        <span>Já consumidas {num(selectedBalance.used)}h</span>
                        <span>Saldo após salvar {num(selectedBalance.sold - projectedUsed)}h</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="font-description mt-3 text-sm text-muted-foreground">Este cliente ainda não tem pacote pago registrado.</p>
                      <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Sem pacote pago" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}><div className="h-full w-0" /></div>
                    </>
                  )}
                </section>
              </div>
            </div>
            {error && <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" role="alert" data-testid="text-hours-error">{error}</p>}
            <DialogFooter className="mt-4 gap-2 sm:gap-2">
              <Button type="button" variant="outline" className="min-h-12" onClick={() => onOpenChange(false)}>Manter para depois</Button>
              <Button type="submit" className="min-h-12" disabled={pending} data-testid="button-save-hours">{pending ? "Salvando..." : "Salvar consumo"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
