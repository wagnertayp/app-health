import { useMemo, useState } from "react";
import { Pencil, Plus, Timer, Trash2 } from "lucide-react";
import type { Customer, CustomerInput, ModuleRecord } from "@workspace/api-client-react";
import { useGetOverview, getGetOverviewQueryKey, useListCustomers, useListInvoices, useUpdateCustomer } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Confirm, EmptyState, ErrorState, Field, LoadingRows, PageHeader, Panel, Stat, TableWrap, Td, Th } from "@/components/kit";
import { RecordDialog, useInvalidateAll, useRecordActions, useRecords, type FieldDef } from "@/components/records";
import { HoursLogDialog } from "@/components/hours/hours-log-dialog";
import { useToast } from "@/hooks/use-toast";
import { errMsg, fmtDate, localISO, num, usePageMeta } from "@/lib/format";

type CustomerBalance = { sold: number; used: number; packageUsed: number; packageLimit?: number; packageStart?: string };

function emptyBalance(): CustomerBalance {
  return { sold: 0, used: 0, packageUsed: 0 };
}

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
  const updateCustomer = useUpdateCustomer();
  const invalidate = useInvalidateAll();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<ModuleRecord | null>(null);
  const [toDel, setToDel] = useState<ModuleRecord | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  const [limitCustomerId, setLimitCustomerId] = useState("");
  const [limitValue, setLimitValue] = useState("");
  const [limitError, setLimitError] = useState("");
  const paidPackages = useMemo(() => {
    const packages: Record<string, { date: string; hours: number }> = {};
    for (const invoice of invoices.data ?? []) {
      if (invoice.status !== "paid" || !(invoice.hoursTotal && invoice.hoursTotal > 0)) continue;
      const date = (invoice.paidAt || invoice.createdAt).slice(0, 10);
      const current = packages[invoice.customerId];
      if (!current || date > current.date) packages[invoice.customerId] = { date, hours: invoice.hoursTotal };
      else if (date === current.date) current.hours += invoice.hoursTotal;
    }
    return packages;
  }, [invoices.data]);
  const balances = useMemo(() => {
    const m: Record<string, CustomerBalance> = {};
    const customerById = new Map((customers.data ?? []).map((customer) => [customer.id, customer]));
    for (const customer of customers.data ?? []) {
      if (customer.hoursLimit !== undefined) m[customer.id] = emptyBalance();
    }
    for (const i of invoices.data ?? []) {
      if (i.status !== "paid") continue;
      m[i.customerId] ??= emptyBalance();
      m[i.customerId].sold += i.hoursTotal ?? 0;
    }
    for (const h of hours.data ?? []) {
      const k = h.customerId || "_";
      m[k] ??= emptyBalance();
      m[k].used += h.value;
    }
    for (const [customerId, balance] of Object.entries(m)) {
      const activePackage = paidPackages[customerId];
      const customer = customerById.get(customerId);
      balance.packageStart = activePackage?.date;
      balance.packageLimit = customer?.hoursLimit ?? activePackage?.hours;
      balance.packageUsed = activePackage
        ? (hours.data ?? []).filter((entry) => (entry.customerId || "_") === customerId && entry.date >= activePackage.date).reduce((sum, entry) => sum + entry.value, 0)
        : 0;
    }
    return Object.entries(m);
  }, [invoices.data, hours.data, customers.data, paidPackages]);
  const balanceByCustomer = useMemo(() => Object.fromEntries(balances), [balances]);
  const cname = (id: string) => (id === "_" ? "Sem cliente" : customers.data?.find((c) => c.id === id)?.name ?? "Cliente removido");
  const openLimit = (customer?: Customer) => {
    setLimitCustomerId(customer?.id ?? "");
    setLimitValue(customer?.hoursLimit === undefined ? "" : String(customer.hoursLimit));
    setLimitError("");
    setLimitOpen(true);
  };
  const saveLimit = (event: React.FormEvent) => {
    event.preventDefault();
    setLimitError("");
    const customer = customers.data?.find((item) => item.id === limitCustomerId);
    if (!customer) return setLimitError("Selecione um cliente.");
    const hoursLimit = limitValue.trim() === "" ? undefined : Number(limitValue);
    if (hoursLimit !== undefined && (!Number.isFinite(hoursLimit) || hoursLimit < 0)) return setLimitError("Informe um limite igual ou maior que zero.");
    const data: CustomerInput = {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      document: customer.document,
      address: customer.address,
      status: customer.status,
      responsible: customer.responsible,
      notes: customer.notes,
      logoPath: customer.logoPath,
      hoursLimit,
    };
    updateCustomer.mutate({ id: customer.id, data }, {
      onSuccess: () => {
        invalidate();
        toast({ title: "Limite de horas atualizado" });
        setLimitOpen(false);
      },
      onError: (error) => setLimitError(errMsg(error)),
    });
  };
  const o = ov.data;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Financeiro" title="Horas" subtitle="Horas vendidas vêm de invoices pagas com pacotes de horas. Consumos são registrados aqui." actions={<><Button variant="outline" onClick={() => openLimit()} disabled={!customers.data?.length} data-testid="button-set-hours-limit">Definir limite</Button><Button onClick={() => { setEdit(null); setOpen(true); }} data-testid="button-new-hours"><Plus className="mr-1.5 h-4 w-4" />Registrar consumo</Button></>} />
      <HoursLogDialog open={open && !edit} onOpenChange={setOpen} customers={customers.data ?? []} balances={balanceByCustomer} />
      <Dialog open={limitOpen} onOpenChange={(value) => { setLimitOpen(value); if (!value) setLimitError(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Limite de horas do pacote</DialogTitle></DialogHeader>
          <form onSubmit={saveLimit} className="space-y-4">
            <Field label="Cliente *">
              <select className="field min-h-11" value={limitCustomerId} onChange={(event) => {
                const customer = customers.data?.find((item) => item.id === event.target.value);
                setLimitCustomerId(event.target.value);
                setLimitValue(customer?.hoursLimit === undefined ? "" : String(customer.hoursLimit));
                setLimitError("");
              }} data-testid="select-hours-limit-customer">
                <option value="">Selecione um cliente</option>
                {(customers.data ?? []).map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
              </select>
            </Field>
            <Field label="Horas por pacote pago" hint="O consumo reinicia quando uma nova invoice de pacote é paga. Vazio usa as horas da invoice.">
              <input className="field min-h-11" type="number" min="0" step="0.5" value={limitValue} onChange={(event) => setLimitValue(event.target.value)} placeholder="Usar horas da invoice" data-testid="input-hours-limit-value" />
            </Field>
            {limitError && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" data-testid="text-hours-limit-error">{limitError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLimitOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={updateCustomer.isPending} data-testid="button-save-hours-limit">{updateCustomer.isPending ? "Salvando..." : "Salvar limite"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Horas vendidas" value={o ? `${num(o.hoursSold)}h` : "—"} /><Stat label="Consumidas" value={o ? `${num(o.hoursUsed)}h` : "—"} /><Stat label="Saldo" value={o ? `${num(o.hoursSold - o.hoursUsed)}h` : "—"} />
      </div>
      <Panel title="Saldo por cliente">
        {balances.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum pacote pago ou consumo registrado ainda.</p> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{balances.map(([cid, b]) => {
            const customer = customers.data?.find((item) => item.id === cid);
            const pct = !b.packageStart || b.packageLimit === undefined ? 0 : b.packageLimit > 0 ? Math.min(100, (b.packageUsed / b.packageLimit) * 100) : b.packageUsed > 0 ? 100 : 0;
            return (
            <div key={cid} className="rounded-lg border p-3" data-testid={`balance-${cid}`}>
              <div className="text-sm font-medium">{cname(cid)}</div>
              <div className="num mt-1 text-xs text-muted-foreground">{num(b.used)}h consumidas no total · saldo acumulado {num(b.sold - b.used)}h</div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="font-description text-xs text-muted-foreground">{b.packageStart && b.packageLimit !== undefined ? `${num(b.packageUsed)}h de ${num(b.packageLimit)}h no pacote atual` : b.packageLimit !== undefined ? `Limite de ${num(b.packageLimit)}h pronto para o próximo pacote` : "Sem pacote pago ou limite"}</span>
                {customer && <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => openLimit(customer)} data-testid={`button-edit-hours-limit-${cid}`}>{customer.hoursLimit === undefined ? "Definir limite" : "Editar limite"}</Button>}
              </div>
              {b.packageStart && b.packageLimit !== undefined && <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`Limite de horas de ${cname(cid)}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}><div className={`h-full transition-[width] ${b.packageUsed > b.packageLimit ? "bg-destructive" : "bg-[hsl(var(--chart-1))]"}`} style={{ width: `${pct}%` }} /></div>}
            </div>); })}</div>
        )}
      </Panel>
      <Panel title="Registros de consumo">
        {hours.isLoading ? <LoadingRows /> : hours.isError ? <ErrorState error={hours.error} onRetry={() => hours.refetch()} /> : !hours.data?.length ? (
          <EmptyState icon={Timer} title="Nenhum consumo registrado" body="Registre as horas trabalhadas por cliente para acompanhar o saldo dos pacotes." action={<Button size="sm" onClick={() => { setEdit(null); setOpen(true); }}>Registrar consumo</Button>} />
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
      <RecordDialog kind="hours" open={open && !!edit} onOpenChange={(value) => { setOpen(value); if (!value) setEdit(null); }} record={edit} fields={fields} defaults={{ date: localISO(), value: 1 }} fixed={{ status: "registrado" }} title="Editar consumo" />
      <Confirm open={!!toDel} onOpenChange={(o) => !o && setToDel(null)} title="Excluir registro?" body="O saldo do cliente será recalculado." confirmLabel="Excluir" destructive onConfirm={() => toDel && remove(toDel.id, () => setToDel(null))} />
    </div>
  );
}
