import { useState } from "react";
import { Bot, Info, Pencil, Plus, Trash2 } from "lucide-react";
import type { ModuleRecord } from "@workspace/api-client-react";
import { useListActivity } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Confirm, EmptyState, ErrorState, LoadingRows, Notice, PageHeader, Panel, Pill, Stat } from "@/components/kit";
import { RecordDialog, toInput, useRecordActions, useRecords, type FieldDef } from "@/components/records";
import { relative, usePageMeta } from "@/lib/format";

const fields: FieldDef[] = [
  { name: "title", label: "Nome do agente", type: "text", required: true, full: true },
  { name: "role", label: "Função", type: "text", meta: true, placeholder: "Atendimento, qualificação, agendamento..." },
  { name: "channel", label: "Canal", type: "text", meta: true, placeholder: "WhatsApp, site, e-mail..." },
  { name: "status", label: "Situação", type: "select", options: [{ value: "active", label: "Ativo" }, { value: "inactive", label: "Inativo" }] },
  { name: "responsible", label: "Responsável", type: "text" },
  { name: "customerId", label: "Cliente atendido", type: "customer" },
  { name: "tags", label: "Tags", type: "tags" },
  { name: "instructions", label: "Instruções / configuração", type: "textarea", meta: true },
  { name: "description", label: "Observações", type: "textarea" },
];

export default function Agentes() {
  usePageMeta("Agentes Health", "Configuração dos agentes inteligentes Healthfy.");
  const agents = useRecords("agents");
  const activity = useListActivity();
  const { save, remove } = useRecordActions("agents");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<ModuleRecord | null>(null);
  const [toDel, setToDel] = useState<ModuleRecord | null>(null);
  const list = agents.data ?? [];
  const ids = new Set(list.map((a) => a.id));
  const events = (activity.data ?? []).filter((a) => ids.has(a.entityId)).slice(0, 12);
  return (
    <div className="space-y-6">
      <PageHeader title="Agentes Health" subtitle="Cadastro e configuração dos agentes que a Healthfy opera para clientes." actions={<Button onClick={() => { setEdit(null); setOpen(true); }} data-testid="button-new-agent"><Plus className="mr-1.5 h-4 w-4" />Novo agente</Button>} />
      <Notice tone="blue" icon={Info} title="Somente registros de configuração">Nenhum modelo de IA está conectado a este painel. Ativar um agente aqui altera seu status cadastral, não inicia execuções.</Notice>
      <div className="grid grid-cols-3 gap-3"><Stat label="Agentes" value={list.length} /><Stat label="Ativos" value={list.filter((a) => a.status === "active").length} /><Stat label="Inativos" value={list.filter((a) => a.status !== "active").length} /></div>
      {agents.isLoading ? <LoadingRows /> : agents.isError ? <ErrorState error={agents.error} onRetry={() => agents.refetch()} /> : list.length === 0 ? (
        <EmptyState icon={Bot} title="Nenhum agente configurado" body="Documente cada agente: função, canal, instruções e responsável." action={<Button size="sm" onClick={() => setOpen(true)}>Configurar agente</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{list.map((a) => { const on = a.status === "active"; return (
          <article key={a.id} className="card-surface fade-up p-4" data-testid={`card-agent-${a.id}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5"><div className={`flex h-9 w-9 items-center justify-center rounded-lg ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}><Bot className="h-4 w-4" /></div><div><div className="font-semibold">{a.title}</div><div className="text-xs text-muted-foreground">{String(a.metadata?.role ?? "") || "Sem função"}</div></div></div>
              <Switch checked={on} onCheckedChange={(v) => save(toInput(a, { status: v ? "active" : "inactive" }), a.id, v ? "Agente ativado" : "Agente desativado")} data-testid={`switch-${a.id}`} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5"><Pill tone={on ? "green" : "neutral"}>{on ? "Ativo" : "Inativo"}</Pill>{a.metadata?.channel ? <Pill tone="blue">{String(a.metadata.channel)}</Pill> : null}{a.tags.map((t) => <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{t}</span>)}</div>
            {a.metadata?.instructions ? <p className="mt-3 line-clamp-3 rounded-md bg-muted/50 p-2 font-mono text-[11px] text-muted-foreground">{String(a.metadata.instructions)}</p> : null}
            <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground"><span>{a.responsible || "Sem responsável"}</span><span className="flex gap-1"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEdit(a); setOpen(true); }} data-testid={`button-edit-${a.id}`}><Pencil className="h-3.5 w-3.5" /></Button><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setToDel(a)} data-testid={`button-delete-${a.id}`}><Trash2 className="h-3.5 w-3.5" /></Button></span></div>
          </article>); })}</div>
      )}
      <Panel title="Registro de eventos" description="Alterações de configuração">{events.length ? <ol className="space-y-2 border-l pl-4">{events.map((e) => <li key={e.id} className="text-sm"><span className="font-medium">{e.title}</span> <span className="text-xs text-muted-foreground">· {e.description} · {relative(e.createdAt)}</span></li>)}</ol> : <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>}</Panel>
      <RecordDialog kind="agents" open={open} onOpenChange={setOpen} record={edit} fields={fields} defaults={{ status: "inactive" }} title={edit ? "Editar agente" : "Novo agente"} />
      <Confirm open={!!toDel} onOpenChange={(o) => !o && setToDel(null)} title="Excluir agente?" body="A configuração será removida." confirmLabel="Excluir" destructive onConfirm={() => toDel && remove(toDel.id, () => setToDel(null))} />
    </div>
  );
}
