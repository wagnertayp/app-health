import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { CheckSquare, Pencil, Plus, Square, Trash2, X } from "lucide-react";
import { useListActivity, useListCustomers } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Confirm, EmptyState, ErrorState, LoadingRows, PageHeader, Panel, Pill } from "@/components/kit";
import { RecordDialog, priorityLabel, priorityTone, toInput, useRecordActions, useRecords } from "@/components/records";
import { PROJECT_STATUSES, isLate, progressOf, projectFields, statusTone } from "@/pages/projetos";
import { brl, fmtDate, relative, usePageMeta } from "@/lib/format";

type Task = { id: string; title: string; done: boolean };

export default function ProjetoDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const projects = useRecords("projects");
  const customers = useListCustomers();
  const activity = useListActivity();
  const { save, remove } = useRecordActions("projects");
  const [, nav] = useLocation();
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const [task, setTask] = useState("");
  const p = projects.data?.find((x) => x.id === id);
  usePageMeta(p?.title ?? "Projeto", "Detalhes do projeto.");
  if (projects.isLoading) return <LoadingRows rows={6} />;
  if (projects.isError) return <ErrorState error={projects.error} onRetry={() => projects.refetch()} />;
  if (!p) return <EmptyState icon={X} title="Projeto não encontrado" body="Ele pode ter sido excluído." action={<Button size="sm" asChild><Link href="/clientes/projetos">Voltar</Link></Button>} />;
  const tasks = (p.metadata?.tasks as Task[] | undefined) ?? [];
  const setTasks = (t: Task[], msg: string) => save(toInput(p, { metadata: { ...p.metadata, tasks: t, progress: t.length ? Math.round((t.filter((x) => x.done).length / t.length) * 100) : 0 } }), p.id, msg);
  const customer = customers.data?.find((c) => c.id === p.customerId);
  const hist = (activity.data ?? []).filter((a) => a.entityId === p.id);
  const pr = progressOf(p);
  return (
    <div>
      <PageHeader back={{ href: "/clientes/projetos", label: "Projetos" }} title={p.title} subtitle={customer ? `Cliente: ${customer.name}` : "Sem cliente vinculado"}
        actions={<><select className="field h-8 w-40 text-xs" value={p.status} onChange={(e) => save(toInput(p, { status: e.target.value }), p.id, `Status: ${e.target.value}`)} data-testid="select-status">{PROJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select><Button size="sm" variant="outline" onClick={() => setEdit(true)} data-testid="button-edit"><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button><Button size="sm" variant="outline" className="text-destructive" onClick={() => setDel(true)} data-testid="button-delete"><Trash2 className="h-3.5 w-3.5" /></Button></>} />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Panel title="Tarefas" description={`${tasks.filter((t) => t.done).length} de ${tasks.length} concluídas`}>
            <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!task.trim()) return; setTasks([...tasks, { id: crypto.randomUUID(), title: task.trim(), done: false }], "Tarefa criada"); setTask(""); }}>
              <input className="field" placeholder="Nova tarefa" value={task} onChange={(e) => setTask(e.target.value)} data-testid="input-task" />
              <Button type="submit" size="icon" data-testid="button-add-task"><Plus className="h-4 w-4" /></Button>
            </form>
            {tasks.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma tarefa. Quebre a entrega em passos acompanháveis.</p> : (
              <ul className="divide-y">{tasks.map((t) => (
                <li key={t.id} className="group flex items-center gap-2 py-2" data-testid={`task-${t.id}`}>
                  <button onClick={() => setTasks(tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)), t.done ? "Tarefa reaberta" : "Tarefa concluída")} data-testid={`toggle-task-${t.id}`}>{t.done ? <CheckSquare className="h-4 w-4 text-[hsl(var(--chart-1))]" /> : <Square className="h-4 w-4 text-muted-foreground" />}</button>
                  <span className={`flex-1 text-sm ${t.done ? "text-muted-foreground line-through" : ""}`}>{t.title}</span>
                  <button className="opacity-0 transition-opacity group-hover:opacity-100" onClick={() => setTasks(tasks.filter((x) => x.id !== t.id), "Tarefa removida")} data-testid={`delete-task-${t.id}`}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                </li>))}</ul>
            )}
          </Panel>
          {p.description && <Panel title="Descrição"><p className="whitespace-pre-line text-sm">{p.description}</p></Panel>}
        </div>
        <div className="space-y-6">
          <Panel title="Resumo">
            <div className="mb-4"><div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">Progresso</span><span className="num font-medium">{pr}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-[hsl(var(--chart-1))] transition-all" style={{ width: `${pr}%` }} /></div></div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-[11px] text-muted-foreground">Status</dt><dd><Pill tone={statusTone(p.status)}>{p.status}</Pill></dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Prioridade</dt><dd><Pill tone={priorityTone[p.priority]}>{priorityLabel[p.priority]}</Pill></dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Início</dt><dd>{fmtDate(p.date)}</dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Conclusão</dt><dd className={isLate(p) ? "text-destructive" : ""}>{fmtDate(p.endDate)}</dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Responsável</dt><dd>{p.responsible || "—"}</dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Valor</dt><dd className="num">{brl(p.value)}</dd></div>
            </dl>
          </Panel>
          <Panel title="Histórico de alterações">
            {hist.length ? <ol className="space-y-3 border-l pl-4">{hist.map((a) => <li key={a.id} className="text-sm"><div className="font-medium">{a.title}</div><div className="text-xs text-muted-foreground">{a.description} · {relative(a.createdAt)}</div></li>)}</ol> : <p className="text-sm text-muted-foreground">Sem alterações registradas.</p>}
          </Panel>
        </div>
      </div>
      <RecordDialog kind="projects" open={edit} onOpenChange={setEdit} record={p} fields={projectFields} title="Editar projeto" />
      <Confirm open={del} onOpenChange={setDel} title="Excluir projeto?" body="Tarefas e dados do projeto serão removidos." confirmLabel="Excluir" destructive onConfirm={() => remove(p.id, () => nav("/clientes/projetos"))} />
    </div>
  );
}
