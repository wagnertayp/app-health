import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Info, Pencil, Plus, Radar, Trash2 } from "lucide-react";
import type { ModuleRecord } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Confirm, EmptyState, ErrorState, LoadingRows, Notice, PageHeader, Panel, Pill, Segmented, Stat, TableWrap, Td, Th } from "@/components/kit";
import { RecordDialog, useRecordActions, useRecords, type FieldDef } from "@/components/records";
import { addDaysISO, brl, fmtDate, localISO, num, usePageMeta } from "@/lib/format";

const EVENTS = [{ value: "visit", label: "Visitas" }, { value: "lead", label: "Leads" }, { value: "conversion", label: "Conversões" }];
const evLabel = (v: string) => EVENTS.find((e) => e.value === v)?.label ?? v;
const fields: FieldDef[] = [
  { name: "title", label: "Campanha", type: "text", required: true, full: true },
  { name: "channel", label: "Canal / origem", type: "text", meta: true, required: true, placeholder: "Google Ads, Instagram, indicação..." },
  { name: "eventType", label: "Evento", type: "select", meta: true, options: EVENTS },
  { name: "value", label: "Quantidade", type: "number", required: true },
  { name: "investment", label: "Investimento (R$)", type: "number", meta: true },
  { name: "date", label: "Data", type: "date" },
  { name: "status", label: "Status", type: "select", options: [{ value: "Ativa", label: "Ativa" }, { value: "Pausada", label: "Pausada" }, { value: "Encerrada", label: "Encerrada" }] },
  { name: "description", label: "Notas", type: "textarea" },
];

export default function Trackeamento() {
  usePageMeta("Trackeamento", "Campanhas, origens e conversões registradas.");
  const tr = useRecords("tracking");
  const { remove } = useRecordActions("tracking");
  const [period, setPeriod] = useState<"30" | "90" | "all">("30");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<ModuleRecord | null>(null);
  const [toDel, setToDel] = useState<ModuleRecord | null>(null);
  const list = (tr.data ?? []).filter((t) => period === "all" || (t.date && t.date >= addDaysISO(-Number(period))));
  const sum = (ev: string) => list.filter((t) => t.metadata?.eventType === ev).reduce((a, b) => a + b.value, 0);
  const invest = list.reduce((a, b) => a + (Number(b.metadata?.investment) || 0), 0);
  const visits = sum("visit"), leads = sum("lead"), conv = sum("conversion");
  const byChannel = useMemo(() => {
    const m: Record<string, { channel: string; visit: number; lead: number; conversion: number }> = {};
    for (const t of list) { const c = String(t.metadata?.channel ?? "—"); m[c] ??= { channel: c, visit: 0, lead: 0, conversion: 0 }; const e = String(t.metadata?.eventType) as "visit"; if (e in m[c]) m[c][e] += t.value; }
    return Object.values(m);
  }, [list]);
  return (
    <div className="space-y-6">
      <PageHeader title="Trackeamento" subtitle="Eventos de campanhas registrados manualmente e agregados por canal." actions={<><Segmented testId="filter-period" value={period} onChange={setPeriod} options={[{ value: "30", label: "30d" }, { value: "90", label: "90d" }, { value: "all", label: "Tudo" }]} /><Button onClick={() => { setEdit(null); setOpen(true); }} data-testid="button-new-event"><Plus className="mr-1.5 h-4 w-4" />Registrar evento</Button></>} />
      <Notice tone="blue" icon={Info} title="Sem integração ao vivo">Os números abaixo somam apenas eventos registrados aqui. Nenhum pixel ou plataforma de anúncios está conectado.</Notice>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Visitas" value={num(visits, 0)} /><Stat label="Leads" value={num(leads, 0)} /><Stat label="Conversões" value={num(conv, 0)} />
        <Stat label="Taxa lead → conversão" value={leads ? `${num((conv / leads) * 100)}%` : "—"} /><Stat label="Custo por conversão" value={conv && invest ? brl(invest / conv) : "—"} hint={`Investido ${brl(invest)}`} />
      </div>
      <Panel title="Desempenho por canal">
        {byChannel.length === 0 ? <p className="text-sm text-muted-foreground">Sem eventos no período.</p> : (
          <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={byChannel}><CartesianGrid stroke="hsl(var(--border))" vertical={false} /><XAxis dataKey="channel" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} /><Tooltip formatter={(v: number, n: string) => [num(v, 0), evLabel(n)]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="visit" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} /><Bar dataKey="lead" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} /><Bar dataKey="conversion" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        )}
      </Panel>
      <Panel title="Eventos registrados">
        {tr.isLoading ? <LoadingRows /> : tr.isError ? <ErrorState error={tr.error} onRetry={() => tr.refetch()} /> : list.length === 0 ? (
          <EmptyState icon={Radar} title="Nenhum evento" body="Registre visitas, leads e conversões por campanha para ver relatórios por canal." action={<Button size="sm" onClick={() => setOpen(true)}>Registrar evento</Button>} />
        ) : (
          <TableWrap>
            <thead className="border-b bg-muted/40"><tr><Th>Campanha</Th><Th>Canal</Th><Th>Evento</Th><Th>Data</Th><Th>Status</Th><Th className="text-right">Qtd.</Th><Th className="text-right">Ações</Th></tr></thead>
            <tbody>{[...list].sort((a, b) => b.date.localeCompare(a.date)).map((t) => (
              <tr key={t.id} className="border-b last:border-0 hover:bg-muted/40" data-testid={`row-tracking-${t.id}`}>
                <Td className="font-medium">{t.title}</Td><Td>{String(t.metadata?.channel ?? "—")}</Td><Td>{evLabel(String(t.metadata?.eventType ?? ""))}</Td><Td className="text-muted-foreground">{fmtDate(t.date)}</Td>
                <Td><Pill tone={t.status === "Ativa" ? "green" : "neutral"}>{t.status || "—"}</Pill></Td><Td className="num text-right">{num(t.value, 0)}</Td>
                <Td className="text-right"><span className="inline-flex gap-1"><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEdit(t); setOpen(true); }} data-testid={`button-edit-${t.id}`}><Pencil className="h-3.5 w-3.5" /></Button><Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setToDel(t)} data-testid={`button-delete-${t.id}`}><Trash2 className="h-3.5 w-3.5" /></Button></span></Td>
              </tr>))}</tbody>
          </TableWrap>
        )}
      </Panel>
      <RecordDialog kind="tracking" open={open} onOpenChange={setOpen} record={edit} fields={fields} defaults={{ eventType: "lead", date: localISO(), status: "Ativa", investment: 0 }} title={edit ? "Editar evento" : "Registrar evento"} />
      <Confirm open={!!toDel} onOpenChange={(o) => !o && setToDel(null)} title="Excluir evento?" body="Os agregados serão recalculados." confirmLabel="Excluir" destructive onConfirm={() => toDel && remove(toDel.id, () => setToDel(null))} />
    </div>
  );
}
