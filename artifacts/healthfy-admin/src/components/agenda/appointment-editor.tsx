import { useEffect, useRef, useState } from "react";
import { Plus, UserPlus, X } from "lucide-react";
import type { Customer, ModuleRecord, RecordInput, RecordInputPriority } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/kit";
import { LogoUpload } from "@/components/customer-logo";
import { toInput, useRecordActions } from "@/components/records";
import { MAX_PARTICIPANTS, REMINDERS, STATUSES, defaultSlot, normalizeMeta, parseDate, toLocalInput, toLocalInputFromString, type Participant } from "@/lib/agenda";
import { TagChip } from "./person";

type Form = {
  title: string; date: string; endDate: string; responsible: string; responsiblePhotoPath: string;
  status: string; customerId: string; channel: string; reminder: string; description: string;
  priority: RecordInputPriority; tags: string[]; participants: Participant[];
};

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

function initForm(record: ModuleRecord | null, day?: Date): Form {
  if (record) {
    const m = normalizeMeta(record.metadata);
    return {
      title: record.title, date: toLocalInputFromString(record.date), endDate: toLocalInputFromString(record.endDate), responsible: record.responsible,
      responsiblePhotoPath: m.responsiblePhotoPath ?? "", status: record.status || "Agendado", customerId: record.customerId ?? "", channel: m.channel,
      reminder: m.reminder, description: record.description ?? "", priority: (record.priority as RecordInputPriority) || "medium",
      tags: Array.isArray(record.tags) ? record.tags : [], participants: m.participants,
    };
  }
  const { start, end } = defaultSlot(day);
  return { title: "", date: toLocalInput(start), endDate: toLocalInput(end), responsible: "", responsiblePhotoPath: "", status: "Agendado", customerId: "", channel: "", reminder: "none", description: "", priority: "medium", tags: [], participants: [] };
}

export function AppointmentEditor({ open, onOpenChange, record, day, customers, knownTags }: {
  open: boolean; onOpenChange: (o: boolean) => void; record: ModuleRecord | null; day?: Date; customers: Customer[]; knownTags: string[];
}) {
  const { save, pending } = useRecordActions("appointments");
  const [f, setF] = useState<Form>(() => initForm(record, day));
  const [error, setError] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const busy = Object.values(uploading).some(Boolean);
  const dayRef = useRef(day);
  dayRef.current = day;

  useEffect(() => {
    if (open) { setF(initForm(record, dayRef.current)); setError(""); setTagDraft(""); setUploading({}); }
  }, [open, record?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (p: Partial<Form>) => setF((s) => ({ ...s, ...p }));
  const busyFor = (key: string) => (b: boolean) => setUploading((u) => (u[key] === b ? u : { ...u, [key]: b }));
  const setPart = (id: string, p: Partial<Participant>) => setF((current) => ({
    ...current, participants: current.participants.map((x) => (x.id === id ? { ...x, ...p } : x)),
  }));
  const addTag = (raw: string) => {
    const parts = raw.split(",").map((t) => t.trim().slice(0, 60)).filter(Boolean);
    if (parts.length) setF((s) => ({ ...s, tags: Array.from(new Set([...s.tags, ...parts])) }));
    setTagDraft("");
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return setError("Aguarde o envio das fotos terminar.");
    if (!f.title.trim()) return setError("Informe o título do compromisso.");
    if (!f.responsible.trim()) return setError("Informe o responsável.");
    const s = parseDate(f.date), en = parseDate(f.endDate);
    if (!s || !en) return setError("Informe início e fim válidos.");
    if (en <= s) return setError("O fim precisa ser posterior ao início.");
    const parts = f.participants.map((p) => ({ ...p, name: p.name.trim() }));
    if (parts.some((p) => !p.name)) return setError("Preencha o nome de todos os participantes ou remova a linha vazia.");
    if (parts.some((p) => p.name.length > 200)) return setError("Nome de participante com mais de 200 caracteres.");
    const pendingTag = tagDraft.split(",").map((t) => t.trim()).filter(Boolean);
    const tags = Array.from(new Set([...f.tags, ...pendingTag]));
    const baseMeta = { ...(record?.metadata ?? {}) } as Record<string, unknown>;
    baseMeta.channel = f.channel.trim();
    baseMeta.reminder = f.reminder;
    if (f.responsiblePhotoPath) baseMeta.responsiblePhotoPath = f.responsiblePhotoPath; else delete baseMeta.responsiblePhotoPath;
    baseMeta.participants = parts.map((p) => (p.photoPath ? { id: p.id.slice(0, 100), name: p.name, photoPath: p.photoPath } : { id: p.id.slice(0, 100), name: p.name }));
    const fields: Partial<RecordInput> = {
      title: f.title.trim(), date: f.date, endDate: f.endDate, responsible: f.responsible.trim(), status: f.status, customerId: f.customerId,
      description: f.description, priority: f.priority, tags, metadata: baseMeta,
    };
    const input: RecordInput = record ? toInput(record, fields) : { ...(fields as RecordInput), value: 0 };
    setError("");
    const r = await save(input, record?.id, record ? "Compromisso atualizado" : "Compromisso criado");
    if (r) onOpenChange(false);
    else setError("Não foi possível salvar. Revise os dados e tente novamente.");
  }

  const suggestions = knownTags.filter((t) => !f.tags.includes(t)).slice(0, 8);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && busy) return; onOpenChange(o); }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{record ? "Editar compromisso" : "Novo compromisso"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="form-appointments">
          <Field label="Compromisso *" className="sm:col-span-2"><input className="field" value={f.title} maxLength={200} onChange={(e) => set({ title: e.target.value })} data-testid="input-title" /></Field>
          <Field label="Início *"><input type="datetime-local" className="field" value={f.date} onChange={(e) => set({ date: e.target.value })} data-testid="input-date" /></Field>
          <Field label="Fim *"><input type="datetime-local" className="field" value={f.endDate} onChange={(e) => set({ endDate: e.target.value })} data-testid="input-endDate" /></Field>
          <Field label="Status"><select className="field" value={f.status} onChange={(e) => set({ status: e.target.value })} data-testid="select-status">{Array.from(new Set([...STATUSES, f.status])).map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>
          <Field label="Prioridade"><select className="field" value={f.priority} onChange={(e) => set({ priority: e.target.value as RecordInputPriority })} data-testid="select-priority"><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select></Field>
          <Field label="Cliente"><select className="field" value={f.customerId} onChange={(e) => set({ customerId: e.target.value })} data-testid="select-customerId"><option value="">Sem cliente vinculado</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Canal"><input className="field" value={f.channel} placeholder="Meet, presencial, WhatsApp..." onChange={(e) => set({ channel: e.target.value })} data-testid="input-channel" /></Field>
          <Field label="Lembrete" hint="Registrado no compromisso; envio automático não conectado." className="sm:col-span-2"><select className="field" value={f.reminder} onChange={(e) => set({ reminder: e.target.value })} data-testid="select-reminder">{REMINDERS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}{!REMINDERS.some((r) => r.value === f.reminder) && <option value={f.reminder}>{f.reminder}</option>}</select></Field>

          <div className="rounded-xl border bg-muted/30 p-3 sm:col-span-2">
            <Field label="Responsável *"><input className="field" value={f.responsible} maxLength={200} onChange={(e) => set({ responsible: e.target.value })} data-testid="input-responsible" /></Field>
            <div className="mt-2"><LogoUpload noun="foto" testIdSuffix="-responsible" name={f.responsible || "?"} value={f.responsiblePhotoPath} onChange={(p) => set({ responsiblePhotoPath: p })} onBusy={busyFor("__resp")} /></div>
          </div>

          <div className="sm:col-span-2">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-foreground/80">Participantes ({f.participants.length}/{MAX_PARTICIPANTS})</span>
              <Button type="button" size="sm" variant="outline" disabled={f.participants.length >= MAX_PARTICIPANTS} onClick={() => set({ participants: [...f.participants, { id: newId(), name: "" }] })} data-testid="button-add-participant"><UserPlus className="mr-1.5 h-4 w-4" />Adicionar pessoa</Button>
            </div>
            <div className="space-y-2">
              {f.participants.map((p, i) => (
                <div key={p.id} className="rounded-xl border p-3" data-testid={`row-participant-${i}`}>
                  <div className="flex items-center gap-2">
                    <input className="field" placeholder="Nome do participante" maxLength={200} value={p.name} onChange={(e) => setPart(p.id, { name: e.target.value })} data-testid={`input-participant-name-${i}`} />
                    <button type="button" disabled={!!uploading[p.id]} onClick={() => { set({ participants: f.participants.filter((x) => x.id !== p.id) }); setUploading((u) => { const n = { ...u }; delete n[p.id]; return n; }); }} aria-label="Remover participante" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-40" data-testid={`button-remove-participant-${i}`}><X className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-2"><LogoUpload noun="foto" testIdSuffix={`-participant-${i}`} name={p.name || "?"} value={p.photoPath} onChange={(path) => setPart(p.id, { photoPath: path || undefined })} onBusy={busyFor(p.id)} /></div>
                </div>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-foreground/80">Etiquetas</span>
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-card p-1.5">
              {f.tags.map((t) => (
                <button key={t} type="button" onClick={() => set({ tags: f.tags.filter((x) => x !== t) })} className="inline-flex items-center gap-0.5" aria-label={`Remover etiqueta ${t}`} data-testid={`button-remove-tag-${t}`}><TagChip tag={t} /><X className="h-3 w-3 text-muted-foreground" /></button>
              ))}
              <input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagDraft); } }} onBlur={() => tagDraft && addTag(tagDraft)} placeholder="Digite e pressione Enter" className="h-7 min-w-[160px] flex-1 bg-transparent px-1 text-sm outline-none" data-testid="input-tags" />
            </div>
            {suggestions.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {suggestions.map((t) => <button key={t} type="button" onClick={() => addTag(t)} className="inline-flex items-center gap-0.5 rounded-md border border-dashed px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"><Plus className="h-3 w-3" />{t}</button>)}
              </div>
            )}
          </div>

          <Field label="Pauta" className="sm:col-span-2"><textarea className="field" value={f.description} maxLength={5000} onChange={(e) => set({ description: e.target.value })} data-testid="input-description" /></Field>
          {error && <p role="alert" className="text-xs font-medium text-destructive sm:col-span-2" data-testid="text-form-error">{error}</p>}
          <DialogFooter className="mt-1 sm:col-span-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)} data-testid="button-cancel">Fechar</Button>
            <Button type="submit" disabled={pending || busy} data-testid="button-save">{busy ? "Enviando foto..." : pending ? "Salvando..." : record ? "Salvar alterações" : "Criar compromisso"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
