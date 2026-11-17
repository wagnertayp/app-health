import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListActivityQueryKey, getListCustomerEntriesQueryKey, useDeleteCustomerEntry, useListCustomerEntries, type CustomerEntry } from "@workspace/api-client-react";
import { CalendarClock, ClipboardList, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Confirm, EmptyState, ErrorState, LoadingRows, Pill } from "@/components/kit";
import { errMsg, fmtDate, fmtDateTime } from "@/lib/format";
import { CATEGORY, PRIORITY, PRIORITY_TONE, STATUS, STATUS_TONE, kindLabel, kindOf, type Kind } from "./files";
import { AttachmentView } from "./attachment-view";
import { EntryEditor } from "./entry-editor";

const sel = "field h-11 min-w-0";

export function CustomerHistory({ customerId }: { customerId: string }) {
  const q = useListCustomerEntries(customerId, { query: { enabled: !!customerId, queryKey: getListCustomerEntriesQueryKey(customerId) } });
  const del = useDeleteCustomerEntry();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [st, setSt] = useState("all");
  const [kind, setKind] = useState("all");
  const [tag, setTag] = useState("all");
  const [editing, setEditing] = useState<CustomerEntry | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [toDel, setToDel] = useState<CustomerEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const all = useMemo(() => [...(q.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [q.data]);
  const tags = useMemo(() => Array.from(new Set(all.flatMap((e) => e.tags))).sort(), [all]);
  const rows = all.filter((e) => (cat === "all" || e.category === cat) && (st === "all" || e.status === st) && (tag === "all" || e.tags.includes(tag))
    && (kind === "all" || (kind === "none" ? e.attachments.length === 0 : e.attachments.some((a) => kindOf(a.contentType) === kind)))
    && (!search || `${e.title} ${e.content} ${e.responsible} ${e.tags.join(" ")} ${e.attachments.map((a) => a.name).join(" ")}`.toLowerCase().includes(search.toLowerCase())));
  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: getListCustomerEntriesQueryKey(customerId) }),
    qc.invalidateQueries({ queryKey: getListActivityQueryKey() }),
  ]);
  const openNew = () => { setEditing(null); setEditorOpen(true); };

  const doDelete = async () => {
    if (!toDel || deleting) return;
    setDeleting(true);
    try { await del.mutateAsync({ customerId, entryId: toDel.id }); toast({ title: "Registro excluído" }); setToDel(null); await refresh(); }
    catch (e) { toast({ title: "Não foi possível excluir", description: errMsg(e), variant: "destructive" }); }
    finally { setDeleting(false); }
  };

  return (
    <section id="customer-history" aria-labelledby="customer-history-title" className="mt-8" data-testid="section-customer-history">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="customer-history-title" className="text-xl font-semibold">Anexos e registros</h3>
        <Button className="h-12 px-5 text-base" onClick={openNew} data-testid="button-new-entry"><Plus className="mr-2 h-5 w-5" />Novo registro</Button>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input className="field h-11 sm:col-span-2 lg:col-span-1" placeholder="Buscar registros..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar registros" data-testid="input-entry-search" />
        <select className={sel} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoria" data-testid="filter-entry-category"><option value="all">Todas as categorias</option>{Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className={sel} value={st} onChange={(e) => setSt(e.target.value)} aria-label="Situação" data-testid="filter-entry-status"><option value="all">Todas as situações</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className={sel} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Tipo de anexo" data-testid="filter-entry-type"><option value="all">Todos os tipos</option>{(Object.keys(kindLabel) as Kind[]).map((k) => <option key={k} value={k}>{kindLabel[k]}</option>)}<option value="none">Sem anexos</option></select>
        <select className={sel} value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Etiqueta" data-testid="filter-entry-tag"><option value="all">Todas as etiquetas</option>{tags.map((t) => <option key={t} value={t}>{t}</option>)}</select>
      </div>
      <div className="mt-4">
        {q.isLoading ? <LoadingRows rows={3} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : all.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Nenhum registro" body="Registre atendimentos de SAC, atualizações, documentos e arquivos deste cliente." action={<Button className="h-11" onClick={openNew} data-testid="button-empty-new-entry">Criar primeiro registro</Button>} />
        ) : rows.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Nenhum resultado" body="Nenhum registro corresponde aos filtros." action={<Button variant="outline" className="h-11" onClick={() => { setSearch(""); setCat("all"); setSt("all"); setKind("all"); setTag("all"); }} data-testid="button-clear-entry-filters">Limpar filtros</Button>} />
        ) : (
          <ol className="space-y-4 border-l-2 pl-5" data-testid="list-entries">
            {rows.map((e) => (
              <li key={e.id} className="relative rounded-2xl border bg-card p-4 shadow-sm" data-testid={`entry-${e.id}`}>
                <span className="absolute -left-[29px] top-6 h-3.5 w-3.5 rounded-full border-2 border-card bg-primary" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-primary px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-primary-foreground" data-testid={`text-entry-category-${e.id}`}>{CATEGORY[e.category]}</span>
                  <Pill tone={STATUS_TONE[e.status]}>{STATUS[e.status]}</Pill>
                  <Pill tone={PRIORITY_TONE[e.priority]}>Prioridade {PRIORITY[e.priority].toLowerCase()}</Pill>
                </div>
                <h4 className="mt-2 text-lg font-semibold leading-snug" data-testid={`text-entry-title-${e.id}`}>{e.title}</h4>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{fmtDateTime(e.createdAt)}{e.createdBy ? ` · ${e.createdBy}` : ""}</span>
                  {e.responsible && <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{e.responsible}</span>}
                  {e.dueDate && <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />Prazo {fmtDate(e.dueDate)}</span>}
                  {e.updatedAt !== e.createdAt && <span>Editado {fmtDateTime(e.updatedAt)}</span>}
                </div>
                {e.content && <p className="font-description mt-3 whitespace-pre-wrap break-words text-sm">{e.content}</p>}
                {e.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{e.tags.map((t) => <button key={t} type="button" onClick={() => setTag(t)} className="inline-flex min-h-11 items-center rounded-full border px-3 text-sm hover:bg-muted">#{t}</button>)}</div>}
                {e.attachments.length > 0 && <div className="mt-4 grid gap-3 md:grid-cols-2">{e.attachments.map((a) => <AttachmentView key={a.id} customerId={customerId} entryId={e.id} a={a} />)}</div>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" className="h-11 px-4" onClick={() => { setEditing(e); setEditorOpen(true); }} data-testid={`button-edit-entry-${e.id}`}><Pencil className="mr-2 h-4 w-4" />Editar</Button>
                  <Button variant="outline" className="h-11 px-4 text-destructive hover:text-destructive" onClick={() => setToDel(e)} data-testid={`button-delete-entry-${e.id}`}><Trash2 className="mr-2 h-4 w-4" />Excluir</Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      <EntryEditor customerId={customerId} open={editorOpen} entry={editing} onClose={() => setEditorOpen(false)} onSaved={(saved) => { toast({ title: editing ? "Registro atualizado" : "Registro criado" }); qc.setQueryData<CustomerEntry[]>(getListCustomerEntriesQueryKey(customerId), (old) => old ? (old.some((x) => x.id === saved.id) ? old.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...old]) : old); void refresh(); }} />
      <Confirm open={!!toDel} onOpenChange={(o) => !o && !deleting && setToDel(null)} title="Excluir registro?"
        body="O registro e o acesso aos seus anexos serão removidos deste cliente. Os arquivos originais permanecem guardados de forma privada."
        confirmLabel={deleting ? "Excluindo..." : "Excluir"} destructive onConfirm={() => void doDelete()} />
    </section>
  );
}
