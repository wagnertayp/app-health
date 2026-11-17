import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Columns3, FolderKanban, List, Plus } from "lucide-react";
import type { ModuleRecord } from "@workspace/api-client-react";
import { useListCustomers } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingRows, PageHeader, Panel, Pill, SearchBox, Segmented, Stat, TableWrap, Td, Th } from "@/components/kit";
import { RecordDialog, priorityLabel, priorityTone, toInput, useRecordActions, useRecords, type FieldDef } from "@/components/records";
import { fmtDate, localISO, usePageMeta } from "@/lib/format";

export const PROJECT_STATUSES = ["Planejamento", "Em andamento", "Pendente", "Concluído", "Cancelado"];
export const projectFields: FieldDef[] = [
  { name: "title", label: "Nome do projeto", type: "text", required: true, full: true },
  { name: "customerId", label: "Cliente", type: "customer" },
  { name: "status", label: "Status", type: "select", options: PROJECT_STATUSES.map((s) => ({ value: s, label: s })) },
  { name: "responsible", label: "Responsável", type: "text" },
  { name: "priority", label: "Prioridade", type: "priority" },
  { name: "date", label: "Início", type: "date" },
  { name: "endDate", label: "Conclusão prevista", type: "date" },
  { name: "value", label: "Valor do projeto (R$)", type: "number" },
  { name: "tags", label: "Tags", type: "tags" },
  { name: "description", label: "Descrição e observações", type: "textarea" },
];
export const isLate = (p: ModuleRecord) => !!p.endDate && p.endDate.slice(0, 10) < localISO() && !["Concluído", "Cancelado"].includes(p.status);
export function progressOf(p: ModuleRecord) {
  const t = (p.metadata?.tasks as { done: boolean }[] | undefined) ?? [];
  if (t.length) return Math.round((t.filter((x) => x.done).length / t.length) * 100);
  return p.status === "Concluído" ? 100 : Number(p.metadata?.progress ?? 0);
}
export const statusTone = (s: string) => (s === "Concluído" ? "green" : s === "Em andamento" ? "blue" : s === "Pendente" ? "amber" : s === "Cancelado" ? "red" : "neutral") as "green";

export default function Projetos() {
  usePageMeta("Projetos", "Projetos de clientes Healthfy.");
  const projects = useRecords("projects");
  const customers = useListCustomers();
  const { save } = useRecordActions("projects");
  const [view, setView] = useState<"table" | "kanban">("table");
  const [q, setQ] = useState("");
  const [f, setF] = useState("");
  const [open, setOpen] = useState(false);
  const cname = (id: string) => customers.data?.find((c) => c.id === id)?.name ?? "—";
  const all = projects.data ?? [];
  const list = useMemo(() => all.filter((p) => (!q || `${p.title} ${p.responsible}`.toLowerCase().includes(q.toLowerCase())) && (!f || (f === "late" ? isLate(p) : p.status === f))), [all, q, f]);
  return (
    <div>
      <PageHeader eyebrow="Clientes" title="Projetos" subtitle="Entregas por cliente com tarefas, prazos e histórico." actions={<><Segmented testId="toggle-view" value={view} onChange={setView} options={[{ value: "table", label: "Tabela", icon: List }, { value: "kanban", label: "Kanban", icon: Columns3 }]} /><Button onClick={() => setOpen(true)} data-testid="button-new-project"><Plus className="mr-1.5 h-4 w-4" />Novo projeto</Button></>} />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Total" value={all.length} /><Stat label="Ativos" value={all.filter((p) => p.status === "Em andamento").length} /><Stat label="Concluídos" value={all.filter((p) => p.status === "Concluído").length} /><Stat label="Pendentes" value={all.filter((p) => p.status === "Pendente" || p.status === "Planejamento").length} /><Stat label="Atrasados" value={all.filter(isLate).length} />
      </div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchBox value={q} onChange={setQ} />
        <select className="field sm:w-48" value={f} onChange={(e) => setF(e.target.value)} data-testid="filter-status"><option value="">Todos status</option>{PROJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}<option value="late">Atrasados</option></select>
      </div>
      {projects.isLoading ? <LoadingRows /> : projects.isError ? <ErrorState error={projects.error} onRetry={() => projects.refetch()} /> : list.length === 0 && view === "table" ? (
        <EmptyState icon={FolderKanban} title="Nenhum projeto" body="Crie um projeto e vincule-o a um cliente cadastrado." action={<Button size="sm" onClick={() => setOpen(true)}>Novo projeto</Button>} />
      ) : view === "table" ? (
        <Panel>
          <TableWrap>
            <thead className="border-b bg-muted/40"><tr><Th>Projeto</Th><Th>Cliente</Th><Th>Status</Th><Th>Prioridade</Th><Th>Prazo</Th><Th>Progresso</Th></tr></thead>
            <tbody>{list.map((p) => { const pr = progressOf(p); return (
              <tr key={p.id} className="border-b last:border-0 hover:bg-muted/40" data-testid={`row-project-${p.id}`}>
                <Td><Link href={`/clientes/projetos/${p.id}`} className="font-medium hover:underline">{p.title}</Link><div className="text-xs text-muted-foreground">{p.responsible}</div></Td>
                <Td>{cname(p.customerId)}</Td>
                <Td><Pill tone={statusTone(p.status)}>{p.status}</Pill>{isLate(p) && <Pill tone="red" className="ml-1">Atrasado</Pill>}</Td>
                <Td><Pill tone={priorityTone[p.priority]}>{priorityLabel[p.priority]}</Pill></Td>
                <Td className="text-muted-foreground">{fmtDate(p.endDate)}</Td>
                <Td><div className="flex items-center gap-2"><div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><div className="h-full bg-[hsl(var(--chart-1))]" style={{ width: `${pr}%` }} /></div><span className="num text-xs">{pr}%</span></div></Td>
              </tr>); })}</tbody>
          </TableWrap>
        </Panel>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4"><div className="flex gap-3">
          {PROJECT_STATUSES.map((s) => (
            <div key={s} className="w-[260px] shrink-0 rounded-xl border bg-muted/40 p-2">
              <div className="px-1.5 py-1 text-xs font-semibold">{s} <span className="text-muted-foreground">{list.filter((p) => p.status === s).length}</span></div>
              <div className="space-y-2">{list.filter((p) => p.status === s).map((p) => (
                <div key={p.id} className="card-surface p-3" data-testid={`card-project-${p.id}`}>
                  <Link href={`/clientes/projetos/${p.id}`} className="text-sm font-medium hover:underline">{p.title}</Link>
                  <div className="mt-0.5 text-xs text-muted-foreground">{cname(p.customerId)} · {fmtDate(p.endDate)}</div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-[hsl(var(--chart-1))]" style={{ width: `${progressOf(p)}%` }} /></div>
                  <select className="field mt-2 h-7 text-xs" value={p.status} onChange={(e) => save(toInput(p, { status: e.target.value }), p.id, `Status: ${e.target.value}`)} data-testid={`select-status-${p.id}`}>{PROJECT_STATUSES.map((x) => <option key={x}>{x}</option>)}</select>
                </div>))}</div>
            </div>))}
        </div></div>
      )}
      <RecordDialog kind="projects" open={open} onOpenChange={setOpen} fields={projectFields} defaults={{ status: "Planejamento", date: localISO() }} title="Novo projeto" />
    </div>
  );
}
