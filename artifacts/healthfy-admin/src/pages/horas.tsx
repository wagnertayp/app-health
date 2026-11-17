import { useMemo, useState } from "react";
import { Pencil, Plus, Timer, Trash2 } from "lucide-react";
import type { ModuleRecord } from "@workspace/api-client-react";
import { useGetOverview, getGetOverviewQueryKey, useListCustomers, useListInvoices } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Confirm, EmptyState, ErrorState, LoadingRows, PageHeader, Panel, Stat, TableWrap, Td, Th } from "@/components/kit";
import { RecordDialog, useRecordActions, useRecords, type FieldDef } from "@/components/records";
import { fmtDate, localISO, num, usePageMeta } from "@/lib/format";

const fields: FieldDef[] = [
  { name: "title", label: "Atividade", type: "text", required: true, full: true },
  { name: "customerId", label: "Cliente (conta)", type: "customer" },
  { name: "value", label: "Horas consumidas", type: "number", required: true },
  { name: "date", label: "Data", type: "date" },
  { name: "responsible", label: "Executado por", type: "text" },
  { name: "description", label: "Detalhes", type: "textarea" },
];

export default function Horas() {
  usePageMeta("Horas", "Controle de consumo de pacotes de horas.");
  const params = { days: 365 };
  const ov = useGetOverview(params, { query: { queryKey: getGetOverviewQueryKey(params) } });
  const hours = useRecords("hours");
  const invoices = useListInvoices();
  const customers = useListCustomers();
  const { remove } = useRecordActions("hours");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<ModuleRecord | null>(null);
  const [toDel, setToDel] = useState<ModuleRecord | null>(null);
  const balances = useMemo(() => {
    const m: Record<string, { sold: number; used: number }> = {};
    for (const i of invoices.data ?? []) {
      if (i.status !== "paid") continue;
      m[i.customerId] ??= { sold: 0, used: 0 };
      m[i.customerId].sold += i.hoursTotal ?? 0;
    }
    for (const h of hours.data ?? []) { const k = h.customerId || "_"; m[k] ??= { sold: 0, used: 0 }; m[k].used += h.value; }
    return Object.entries(m);
  }, [invoices.data, hours.data]);
  const cname = (id: string) => (id === "_" ? "Sem cliente" : customers.data?.find((c) => c.id === id)?.name ?? "Cliente removido");
  const o = ov.data;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Financeiro" title="Horas" subtitle="Horas vendidas vêm de invoices pagas com pacotes de horas. Consumos são registrados aqui." actions={<Button onClick={() => { setEdit(null); setOpen(true); }} data-testid="button-new-hours"><Plus className="mr-1.5 h-4 w-4" />Registrar consumo</Button>} />
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Horas vendidas" value={o ? `${num(o.hoursSold)}h` : "—"} /><Stat label="Consumidas" value={o ? `${num(o.hoursUsed)}h` : "—"} /><Stat label="Saldo" value={o ? `${num(o.hoursSold - o.hoursUsed)}h` : "—"} />
      </div>
      <Panel title="Saldo por cliente">
        {balances.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum pacote pago ou consumo registrado ainda.</p> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{balances.map(([cid, b]) => { const pct = b.sold ? Math.min(100, (b.used / b.sold) * 100) : 100; return (
            <div key={cid} className="rounded-lg border p-3" data-testid={`balance-${cid}`}>
              <div className="text-sm font-medium">{cname(cid)}</div>
              <div className="num mt-1 text-xs text-muted-foreground">{num(b.used)}h de {num(b.sold)}h · saldo {num(b.sold - b.used)}h</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full ${b.used > b.sold ? "bg-destructive" : "bg-[hsl(var(--chart-1))]"}`} style={{ width: `${pct}%` }} /></div>
            </div>); })}</div>
        )}
      </Panel>
      <Panel title="Registros de consumo">
        {hours.isLoading ? <LoadingRows /> : hours.isError ? <ErrorState error={hours.error} onRetry={() => hours.refetch()} /> : !hours.data?.length ? (
          <EmptyState icon={Timer} title="Nenhum consumo registrado" body="Registre as horas trabalhadas por cliente para acompanhar o saldo dos pacotes." action={<Button size="sm" onClick={() => setOpen(true)}>Registrar consumo</Button>} />
        ) : (
          <TableWrap>
            <thead className="border-b bg-muted/40"><tr><Th>Atividade</Th><Th>Cliente</Th><Th>Data</Th><Th>Por</Th><Th className="text-right">Horas</Th><Th className="text-right">Ações</Th></tr></thead>
            <tbody>{[...hours.data].sort((a, b) => b.date.localeCompare(a.date)).map((h) => (
              <tr key={h.id} className="border-b last:border-0 hover:bg-muted/40" data-testid={`row-hours-${h.id}`}>
                <Td className="font-medium">{h.title}</Td><Td>{cname(h.customerId || "_")}</Td><Td className="text-muted-foreground">{fmtDate(h.date)}</Td><Td>{h.responsible || "—"}</Td>
                <Td className="num text-right font-medium">{num(h.value, 2)}h</Td>
                <Td className="text-right"><span className="inline-flex gap-1"><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEdit(h); setOpen(true); }} data-testid={`button-edit-${h.id}`}><Pencil className="h-3.5 w-3.5" /></Button><Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setToDel(h)} data-testid={`button-delete-${h.id}`}><Trash2 className="h-3.5 w-3.5" /></Button></span></Td>
              </tr>))}</tbody>
          </TableWrap>
        )}
      </Panel>
      <RecordDialog kind="hours" open={open} onOpenChange={setOpen} record={edit} fields={fields} defaults={{ date: localISO(), value: 1 }} fixed={{ status: "registrado" }} title={edit ? "Editar consumo" : "Registrar consumo"} />
      <Confirm open={!!toDel} onOpenChange={(o) => !o && setToDel(null)} title="Excluir registro?" body="O saldo do cliente será recalculado." confirmLabel="Excluir" destructive onConfirm={() => toDel && remove(toDel.id, () => setToDel(null))} />
    </div>
  );
}
