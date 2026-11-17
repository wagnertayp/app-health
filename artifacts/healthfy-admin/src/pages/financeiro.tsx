import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import type { ModuleRecord } from "@workspace/api-client-react";
import { useGetOverview, getGetOverviewQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Confirm, EmptyState, ErrorState, LoadingRows, PageHeader, Panel, Pill, Segmented, Stat, TableWrap, Td, Th } from "@/components/kit";
import { MoneyChart } from "@/components/money-chart";
import { RecordDialog, toInput, useRecordActions, useRecords, type FieldDef } from "@/components/records";
import { brl, fmtDate, localISO, usePageMeta } from "@/lib/format";

const fields: FieldDef[] = [
  { name: "title", label: "Descrição", type: "text", required: true, full: true },
  { name: "type", label: "Tipo", type: "select", meta: true, options: [{ value: "income", label: "Receita" }, { value: "expense", label: "Despesa" }] },
  { name: "value", label: "Valor (R$)", type: "number", required: true },
  { name: "date", label: "Data / vencimento", type: "date" },
  { name: "category", label: "Categoria", type: "text", meta: true, placeholder: "Software, impostos, serviço..." },
  { name: "customerId", label: "Cliente", type: "customer" },
  { name: "paid", label: "Liquidação", type: "checkbox", meta: true, placeholder: "Já pago / recebido" },
  { name: "description", label: "Observações", type: "textarea" },
];
const settled = (t: ModuleRecord) => t.metadata?.paid === true || /^(paid|pago|recebido)$/i.test(t.status);

export default function Financeiro() {
  usePageMeta("Financeiro", "Fluxo de caixa, receitas e despesas da Healthfy.");
  const [days, setDays] = useState<"30" | "90" | "365">("30");
  const params = { days: Number(days) };
  const ov = useGetOverview(params, { query: { queryKey: getGetOverviewQueryKey(params) } });
  const tx = useRecords("transactions");
  const { save, remove } = useRecordActions("transactions");
  const [tab, setTab] = useState<"all" | "receivable" | "payable" | "settled">("all");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<ModuleRecord | null>(null);
  const [toDel, setToDel] = useState<ModuleRecord | null>(null);
  const list = [...(tx.data ?? [])].sort((a, b) => b.date.localeCompare(a.date)).filter((t) => tab === "all" || (tab === "settled" ? settled(t) : !settled(t) && (tab === "receivable" ? t.metadata?.type === "income" : t.metadata?.type === "expense")));
  const o = ov.data;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Financeiro" title="Visão geral" subtitle="Invoices pagas manualmente e lançamentos avulsos de receitas e despesas." actions={<><Segmented testId="filter-days" value={days} onChange={setDays} options={[{ value: "30", label: "30d" }, { value: "90", label: "90d" }, { value: "365", label: "12m" }]} /><Button onClick={() => { setEdit(null); setOpen(true); }} data-testid="button-new-transaction"><Plus className="mr-1.5 h-4 w-4" />Lançamento</Button></>} />
      {ov.isError ? <ErrorState error={ov.error} onRetry={() => ov.refetch()} /> : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Receita" icon={ArrowUpRight} value={o ? brl(o.revenue) : "—"} testId="stat-revenue" />
          <Stat label="Despesas" icon={ArrowDownLeft} value={o ? brl(o.expenses) : "—"} testId="stat-expenses" />
          <Stat label="Resultado" icon={Wallet} value={o ? brl(o.revenue - o.expenses) : "—"} testId="stat-result" />
          <Stat label="A receber" icon={Wallet} value={o ? brl(o.receivable) : "—"} testId="stat-receivable" />
        </div>
      )}
      <Panel title="Fluxo de caixa">{ov.isLoading ? <LoadingRows /> : <MoneyChart series={o?.series ?? []} />}</Panel>
      <Panel title={<Segmented testId="filter-tab" value={tab} onChange={setTab} options={[{ value: "all", label: "Todos" }, { value: "receivable", label: "A receber" }, { value: "payable", label: "A pagar" }, { value: "settled", label: "Liquidados" }]} />}>
        {tx.isLoading ? <LoadingRows /> : tx.isError ? <ErrorState error={tx.error} onRetry={() => tx.refetch()} /> : list.length === 0 ? (
          <EmptyState icon={Wallet} title="Sem lançamentos" body="Registre despesas e receitas avulsas. Invoices pagas já entram na receita automaticamente." action={<Button size="sm" onClick={() => setOpen(true)}>Novo lançamento</Button>} />
        ) : (
          <TableWrap>
            <thead className="border-b bg-muted/40"><tr><Th>Descrição</Th><Th>Tipo</Th><Th>Data</Th><Th>Situação</Th><Th className="text-right">Valor</Th><Th className="text-right">Ações</Th></tr></thead>
            <tbody>{list.map((t) => { const inc = t.metadata?.type === "income"; const s = settled(t); return (
              <tr key={t.id} className="border-b last:border-0 hover:bg-muted/40" data-testid={`row-transaction-${t.id}`}>
                <Td><div className="font-medium">{t.title}</div><div className="text-xs text-muted-foreground">{String(t.metadata?.category ?? "")}</div></Td>
                <Td><Pill tone={inc ? "green" : "red"}>{inc ? "Receita" : "Despesa"}</Pill></Td>
                <Td className="text-muted-foreground">{fmtDate(t.date)}</Td>
                <Td>{s ? <Pill tone="neutral">Liquidado</Pill> : <Pill tone={t.date && t.date < localISO() ? "red" : "amber"}>{inc ? "A receber" : "A pagar"}</Pill>}</Td>
                <Td className={`num text-right font-medium ${inc ? "" : "text-[hsl(var(--chart-2))]"}`}>{inc ? "" : "- "}{brl(t.value)}</Td>
                <Td className="text-right"><span className="inline-flex gap-1">
                  {!s && <Button size="icon" variant="ghost" className="h-8 w-8" title="Marcar liquidado" onClick={() => save(toInput(t, { status: "pago", metadata: { ...t.metadata, paid: true } }), t.id, "Lançamento liquidado")} data-testid={`button-settle-${t.id}`}><CheckCircle2 className="h-3.5 w-3.5" /></Button>}
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEdit(t); setOpen(true); }} data-testid={`button-edit-${t.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setToDel(t)} data-testid={`button-delete-${t.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                </span></Td>
              </tr>); })}</tbody>
          </TableWrap>
        )}
      </Panel>
      <RecordDialog kind="transactions" open={open} onOpenChange={setOpen} record={edit} fields={fields} defaults={{ type: "expense", date: localISO(), paid: false }} title={edit ? "Editar lançamento" : "Novo lançamento"} />
      <Confirm open={!!toDel} onOpenChange={(o) => !o && setToDel(null)} title="Excluir lançamento?" body="Esta ação não pode ser desfeita." confirmLabel="Excluir" destructive onConfirm={() => toDel && remove(toDel.id, () => setToDel(null))} />
    </div>
  );
}
