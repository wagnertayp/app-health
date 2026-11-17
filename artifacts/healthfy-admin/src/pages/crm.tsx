import { useMemo, useState } from "react";
import { Columns3, List, MessageSquarePlus, Pencil, Plus, Trash2, UserCheck, Users2, X } from "lucide-react";
import type { ModuleRecord } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Confirm, EmptyState, ErrorState, LoadingRows, PageHeader, Panel, Pill, SearchBox, Segmented, TableWrap, Td, Th } from "@/components/kit";
import { RecordDialog, priorityLabel, priorityTone, toInput, useRecordActions, useRecords, type FieldDef } from "@/components/records";
import { CustomerDialog } from "@/pages/clientes";
import { brl, fmtDateTime, usePageMeta } from "@/lib/format";

const DEFAULT_STAGES = ["Novo", "Contato", "Proposta", "Negociação", "Ganho", "Perdido"];
const loadStages = (): string[] => { try { return JSON.parse(localStorage.getItem("healthfy.stages") || "null") ?? DEFAULT_STAGES; } catch { return DEFAULT_STAGES; } };
type Interaction = { at: string; text: string; kind: string };

export default function Crm() {
  usePageMeta("CRM", "Pipeline comercial e leads da Healthfy.");
  const leads = useRecords("leads");
  const { save, remove } = useRecordActions("leads");
  const [stages, setStagesState] = useState<string[]>(loadStages);
  const setStages = (s: string[]) => { setStagesState(s); localStorage.setItem("healthfy.stages", JSON.stringify(s)); };
  const all = useMemo(() => Array.from(new Set([...stages, ...(leads.data ?? []).map((l) => l.status).filter(Boolean)])), [stages, leads.data]);
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [q, setQ] = useState("");
  const [resp, setResp] = useState("");
  const [src, setSrc] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<ModuleRecord | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [toDel, setToDel] = useState<ModuleRecord | null>(null);
  const [newStage, setNewStage] = useState("");
  const [convert, setConvert] = useState<ModuleRecord | null>(null);
  const [note, setNote] = useState("");

  const fields: FieldDef[] = [
    { name: "title", label: "Nome do lead", type: "text", required: true, full: true },
    { name: "email", label: "E-mail", type: "text", meta: true },
    { name: "phone", label: "Telefone", type: "text", meta: true },
    { name: "status", label: "Etapa", type: "select", options: all.map((s) => ({ value: s, label: s })) },
    { name: "source", label: "Origem", type: "text", meta: true, placeholder: "Indicação, Instagram, Site..." },
    { name: "responsible", label: "Responsável", type: "text" },
    { name: "value", label: "Valor potencial (R$)", type: "number" },
    { name: "priority", label: "Prioridade", type: "priority" },
    { name: "tags", label: "Tags", type: "tags" },
    { name: "description", label: "Observações internas", type: "textarea" },
  ];

  const list = (leads.data ?? []).filter((l) => (!q || `${l.title} ${l.description} ${l.tags.join(" ")} ${String(l.metadata?.email ?? "")}`.toLowerCase().includes(q.toLowerCase())) && (!resp || l.responsible === resp) && (!src || String(l.metadata?.source ?? "") === src));
  const resps = Array.from(new Set((leads.data ?? []).map((l) => l.responsible).filter(Boolean)));
  const srcs = Array.from(new Set((leads.data ?? []).map((l) => String(l.metadata?.source ?? "")).filter(Boolean)));
  const detail = (leads.data ?? []).find((l) => l.id === detailId) ?? null;
  const interactions = (detail?.metadata?.interactions as Interaction[] | undefined) ?? [];

  const move = (l: ModuleRecord, status: string) => {
    const log = [...((l.metadata?.interactions as Interaction[]) ?? []), { at: new Date().toISOString(), text: `Movido de ${l.status} para ${status}`, kind: "move" }];
    save(toInput(l, { status, metadata: { ...l.metadata, interactions: log } }), l.id, `Movido para ${status}`);
  };
  const addNote = () => {
    if (!detail || !note.trim()) return;
    save(toInput(detail, { metadata: { ...detail.metadata, interactions: [...interactions, { at: new Date().toISOString(), text: note.trim(), kind: "note" }] } }), detail.id, "Interação registrada").then((r) => r && setNote(""));
  };

  return (
    <div>
      <PageHeader title="CRM" subtitle="Leads, etapas personalizadas e histórico de interações." actions={<><Segmented testId="toggle-view" value={view} onChange={setView} options={[{ value: "kanban", label: "Kanban", icon: Columns3 }, { value: "table", label: "Tabela", icon: List }]} /><Button onClick={() => { setEdit(null); setOpen(true); }} data-testid="button-new-lead"><Plus className="mr-1.5 h-4 w-4" />Novo lead</Button></>} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchBox value={q} onChange={setQ} placeholder="Nome, e-mail, tag..." />
        <select className="field sm:w-48" value={resp} onChange={(e) => setResp(e.target.value)} data-testid="filter-responsible"><option value="">Todos responsáveis</option>{resps.map((r) => <option key={r}>{r}</option>)}</select>
        <select className="field sm:w-48" value={src} onChange={(e) => setSrc(e.target.value)} data-testid="filter-source"><option value="">Todas origens</option>{srcs.map((r) => <option key={r}>{r}</option>)}</select>
      </div>
      {leads.isLoading ? <LoadingRows /> : leads.isError ? <ErrorState error={leads.error} onRetry={() => leads.refetch()} /> : view === "kanban" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-2">
          <div className="flex gap-3">
            {all.map((s) => {
              const col = list.filter((l) => l.status === s);
              return (
                <div key={s} className="w-[272px] shrink-0 rounded-xl border bg-muted/40 p-2" data-testid={`column-${s}`}>
                  <div className="flex items-center justify-between px-1.5 py-1">
                    <span className="text-xs font-semibold">{s} <span className="text-muted-foreground">{col.length}</span></span>
                    {!DEFAULT_STAGES.includes(s) && stages.includes(s) && col.length === 0 && <button className="text-muted-foreground hover:text-destructive" onClick={() => setStages(stages.filter((x) => x !== s))} data-testid={`button-remove-stage-${s}`}><X className="h-3.5 w-3.5" /></button>}
                  </div>
                  <div className="num px-1.5 pb-2 text-[11px] text-muted-foreground">{brl(col.reduce((a, b) => a + b.value, 0))}</div>
                  <div className="space-y-2">
                    {col.map((l) => (
                      <div key={l.id} className="card-surface cursor-pointer p-3 transition-shadow hover:shadow-md" onClick={() => setDetailId(l.id)} data-testid={`card-lead-${l.id}`}>
                        <div className="flex items-start justify-between gap-2"><span className="text-sm font-medium">{l.title}</span><Pill tone={priorityTone[l.priority]}>{priorityLabel[l.priority]}</Pill></div>
                        <div className="mt-1 text-xs text-muted-foreground">{String(l.metadata?.source ?? "") || "Sem origem"} · {l.responsible || "—"}</div>
                        {l.value > 0 && <div className="num mt-1.5 text-xs font-medium">{brl(l.value)}</div>}
                        <select className="field mt-2 h-7 text-xs" value={l.status} onClick={(e) => e.stopPropagation()} onChange={(e) => move(l, e.target.value)} data-testid={`select-stage-${l.id}`}>{all.map((x) => <option key={x}>{x}</option>)}</select>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="w-[240px] shrink-0 rounded-xl border border-dashed p-3">
              <div className="mb-2 text-xs font-semibold">Nova etapa</div>
              <input className="field" value={newStage} onChange={(e) => setNewStage(e.target.value)} placeholder="Ex.: Reunião técnica" data-testid="input-new-stage" />
              <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => { const s = newStage.trim(); if (s && !all.includes(s)) setStages([...stages, s]); setNewStage(""); }} data-testid="button-add-stage">Adicionar etapa</Button>
            </div>
          </div>
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={Users2} title="Nenhum lead" body="Cadastre oportunidades para acompanhar seus contatos comerciais." action={<Button size="sm" onClick={() => setOpen(true)}>Novo lead</Button>} />
      ) : (
        <Panel bodyClassName="p-4">
          <TableWrap>
            <thead className="border-b bg-muted/40"><tr><Th>Lead</Th><Th>Etapa</Th><Th>Origem</Th><Th>Responsável</Th><Th>Tags</Th><Th className="text-right">Valor</Th></tr></thead>
            <tbody>{list.map((l) => (
              <tr key={l.id} className="cursor-pointer border-b last:border-0 hover:bg-muted/40" onClick={() => setDetailId(l.id)} data-testid={`row-lead-${l.id}`}>
                <Td><div className="font-medium">{l.title}</div><div className="text-xs text-muted-foreground">{String(l.metadata?.email ?? "")}</div></Td>
                <Td><Pill tone={l.status === "Ganho" ? "green" : l.status === "Perdido" ? "red" : "blue"}>{l.status}</Pill></Td>
                <Td>{String(l.metadata?.source ?? "") || "—"}</Td><Td>{l.responsible || "—"}</Td>
                <Td><div className="flex flex-wrap gap-1">{l.tags.map((t) => <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{t}</span>)}</div></Td>
                <Td className="num text-right">{brl(l.value)}</Td>
              </tr>))}</tbody>
          </TableWrap>
        </Panel>
      )}

      <RecordDialog kind="leads" open={open} onOpenChange={setOpen} record={edit} fields={fields} defaults={{ status: all[0] }} title={edit ? "Editar lead" : "Novo lead"} />
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetailId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {detail && (<>
            <SheetHeader><SheetTitle>{detail.title}</SheetTitle><SheetDescription>{detail.status} · {String(detail.metadata?.source ?? "") || "sem origem"}</SheetDescription></SheetHeader>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => { setEdit(detail); setOpen(true); }} data-testid="button-edit-lead"><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button>
              <Button size="sm" variant="outline" onClick={() => setConvert(detail)} data-testid="button-convert"><UserCheck className="mr-1 h-3.5 w-3.5" />Converter em cliente</Button>
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => setToDel(detail)} data-testid="button-delete-lead"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg border p-4 text-sm">
              <div><dt className="text-[11px] text-muted-foreground">E-mail</dt><dd className="truncate">{String(detail.metadata?.email ?? "") || "—"}</dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Telefone</dt><dd>{String(detail.metadata?.phone ?? "") || "—"}</dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Responsável</dt><dd>{detail.responsible || "—"}</dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Valor potencial</dt><dd className="num">{brl(detail.value)}</dd></div>
            </dl>
            {detail.description && <p className="mt-3 whitespace-pre-line rounded-lg bg-muted/50 p-3 text-xs">{detail.description}</p>}
            <h4 className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Histórico de interações</h4>
            <div className="flex gap-2"><input className="field" placeholder="Registrar ligação, reunião, mensagem..." value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} data-testid="input-interaction" /><Button size="icon" onClick={addNote} data-testid="button-add-interaction"><MessageSquarePlus className="h-4 w-4" /></Button></div>
            <ol className="mt-4 space-y-3 border-l pl-4">
              {[...interactions].reverse().map((it, i) => <li key={i} className="text-sm"><div className={it.kind === "move" ? "text-muted-foreground" : ""}>{it.text}</div><div className="text-[11px] text-muted-foreground">{fmtDateTime(it.at)}</div></li>)}
              <li className="text-[11px] text-muted-foreground">Lead criado em {fmtDateTime(detail.createdAt)}</li>
            </ol>
          </>)}
        </SheetContent>
      </Sheet>
      <CustomerDialog open={!!convert} onOpenChange={(o) => !o && setConvert(null)} initialData={convert ? { name: convert.title, email: String(convert.metadata?.email ?? ""), phone: String(convert.metadata?.phone ?? ""), document: String(convert.metadata?.document ?? ""), responsible: convert.responsible, notes: convert.description, status: "active" } : undefined}
        onSaved={() => { if (convert) move(convert, "Ganho"); setConvert(null); }} />
      <Confirm open={!!toDel} onOpenChange={(o) => !o && setToDel(null)} title="Excluir lead?" body="O histórico de interações também será removido." confirmLabel="Excluir" destructive onConfirm={() => toDel && remove(toDel.id, () => { setDetailId(null); setToDel(null); })} />
    </div>
  );
}
