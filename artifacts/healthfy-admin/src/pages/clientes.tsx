import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Contact, FilePlus2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  useCreateCustomer, useDeleteCustomer, useListActivity, useListCustomers, useListInvoices, useUpdateCustomer,
  type Customer, type CustomerInput,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { Confirm, EmptyState, ErrorState, Field, LoadingRows, PageHeader, Panel, Pill, SearchBox, Segmented, TableWrap, Td, Th } from "@/components/kit";
import { useInvalidateAll, useRecords } from "@/components/records";
import { brl, errMsg, fmtDate, initials, relative, usePageMeta } from "@/lib/format";
import { customerStatusLabel, customerStatusTone, invoiceKey, invoiceStatusLabel, invoiceStatusTone } from "@/lib/status";

const EMPTY: CustomerInput = { name: "", email: "", phone: "", document: "", address: "", status: "active", responsible: "", notes: "" };

export function CustomerDialog({ open, onOpenChange, customer, initialData, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; customer?: Customer | null; initialData?: Partial<CustomerInput>; onSaved?: (c: Customer) => void }) {
  const [f, setF] = useState<CustomerInput>(EMPTY);
  const [err, setErr] = useState("");
  const create = useCreateCustomer();
  const update = useUpdateCustomer();
  const inv = useInvalidateAll();
  const { toast } = useToast();
  useEffect(() => {
    if (open) {
      setErr("");
      if (customer) { const { id: _i, createdAt: _c, ...rest } = customer; void _i; void _c; setF(rest); }
      else setF({ ...EMPTY, ...initialData });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer?.id]);
  const set = (k: keyof CustomerInput, v: string) => setF((s) => ({ ...s, [k]: v }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return setErr("Informe o nome.");
    const opts = { onSuccess: (c: Customer) => { inv(); toast({ title: customer ? "Cliente atualizado" : "Cliente criado" }); onOpenChange(false); onSaved?.(c); }, onError: (e: unknown) => setErr(errMsg(e)) };
    if (customer) update.mutate({ id: customer.id, data: f }, opts); else create.mutate({ data: f }, opts);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{customer ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" data-testid="form-customer">
          <Field label="Nome / razão social *" className="sm:col-span-2"><input className="field" value={f.name} onChange={(e) => set("name", e.target.value)} data-testid="input-name" /></Field>
          <Field label="E-mail"><input className="field" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} data-testid="input-email" /></Field>
          <Field label="Telefone"><input className="field" value={f.phone} onChange={(e) => set("phone", e.target.value)} data-testid="input-phone" /></Field>
          <Field label="CPF / CNPJ"><input className="field" value={f.document} onChange={(e) => set("document", e.target.value)} data-testid="input-document" /></Field>
          <Field label="Situação"><select className="field" value={f.status} onChange={(e) => set("status", e.target.value)} data-testid="select-status"><option value="active">Ativo</option><option value="prospect">Prospecto</option><option value="inactive">Inativo</option></select></Field>
          <Field label="Endereço" className="sm:col-span-2"><input className="field" value={f.address} onChange={(e) => set("address", e.target.value)} data-testid="input-address" /></Field>
          <Field label="Responsável" className="sm:col-span-2"><input className="field" value={f.responsible} onChange={(e) => set("responsible", e.target.value)} data-testid="input-responsible" /></Field>
          <Field label="Observações internas" className="sm:col-span-2"><textarea className="field" value={f.notes} onChange={(e) => set("notes", e.target.value)} data-testid="input-notes" /></Field>
          {err && <p className="text-xs font-medium text-destructive sm:col-span-2">{err}</p>}
          <DialogFooter className="sm:col-span-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={create.isPending || update.isPending} data-testid="button-save">Salvar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CustomerSheet({ c, onClose, onEdit }: { c: Customer | null; onClose: () => void; onEdit: (c: Customer) => void }) {
  const invoices = useListInvoices();
  const projects = useRecords("projects");
  const activity = useListActivity();
  if (!c) return null;
  const myInv = (invoices.data ?? []).filter((i) => i.customerId === c.id);
  const myProj = (projects.data ?? []).filter((p) => p.customerId === c.id);
  const ids = new Set([c.id, ...myInv.map((i) => i.id), ...myProj.map((p) => p.id)]);
  const myAct = (activity.data ?? []).filter((a) => ids.has(a.entityId)).slice(0, 12);
  return (
    <Sheet open={!!c} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{initials(c.name)}</div>
            <div><SheetTitle>{c.name}</SheetTitle><SheetDescription>Cliente desde {fmtDate(c.createdAt)}</SheetDescription></div>
          </div>
        </SheetHeader>
        <div className="mt-5 flex flex-wrap gap-2">
          <Pill tone={customerStatusTone[c.status]}>{customerStatusLabel[c.status]}</Pill>
          <Button size="sm" variant="outline" onClick={() => onEdit(c)} data-testid="button-edit-customer"><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button>
          <Button size="sm" asChild><Link href={`/invoices/nova?customer=${c.id}`}><FilePlus2 className="mr-1 h-3.5 w-3.5" />Nova invoice</Link></Button>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 rounded-lg border p-4 text-sm">
          {[["E-mail", c.email], ["Telefone", c.phone], ["Documento", c.document], ["Responsável", c.responsible], ["Endereço", c.address]].map(([k, v]) => (
            <div key={k} className={k === "Endereço" ? "col-span-2" : ""}><dt className="text-[11px] text-muted-foreground">{k}</dt><dd className="truncate">{v || "—"}</dd></div>
          ))}
        </dl>
        {c.notes && <p className="mt-3 whitespace-pre-line rounded-lg bg-muted/50 p-3 text-xs">{c.notes}</p>}
        <h4 className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Projetos ({myProj.length})</h4>
        {myProj.length ? myProj.map((p) => <Link key={p.id} href={`/clientes/projetos/${p.id}`} className="flex justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"><span>{p.title}</span><span className="text-xs text-muted-foreground">{p.status}</span></Link>) : <p className="text-xs text-muted-foreground">Nenhum projeto vinculado.</p>}
        <h4 className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invoices ({myInv.length})</h4>
        {myInv.length ? myInv.map((i) => { const k = invoiceKey(i); return <Link key={i.id} href={`/invoices/${i.id}`} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"><span className="num">{i.number}</span><Pill tone={invoiceStatusTone[k]}>{invoiceStatusLabel[k]}</Pill><span className="num">{brl(i.total)}</span></Link>; }) : <p className="text-xs text-muted-foreground">Nenhuma invoice.</p>}
        <h4 className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Histórico</h4>
        {myAct.length ? <ol className="space-y-2 border-l pl-4">{myAct.map((a) => <li key={a.id} className="text-sm"><div className="font-medium">{a.title}</div><div className="text-xs text-muted-foreground">{a.description} · {relative(a.createdAt)}</div></li>)}</ol> : <p className="text-xs text-muted-foreground">Sem eventos registrados.</p>}
      </SheetContent>
    </Sheet>
  );
}

export default function Clientes() {
  usePageMeta("Clientes", "Central de clientes da Healthfy.");
  const customers = useListCustomers();
  const del = useDeleteCustomer();
  const inv = useInvalidateAll();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [st, setSt] = useState<"all" | "active" | "prospect" | "inactive">("all");
  const [edit, setEdit] = useState<Customer | null>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Customer | null>(null);
  const [toDel, setToDel] = useState<Customer | null>(null);
  const rows = useMemo(() => (customers.data ?? []).filter((c) => st === "all" || c.status === st).filter((c) => !q || `${c.name} ${c.email} ${c.document} ${c.responsible}`.toLowerCase().includes(q.toLowerCase())), [customers.data, q, st]);
  return (
    <div>
      <PageHeader title="Clientes" subtitle="Contatos, situação do relacionamento, projetos e cobranças vinculadas." actions={<Button onClick={() => { setEdit(null); setOpen(true); }} data-testid="button-new-customer"><Plus className="mr-1.5 h-4 w-4" />Novo cliente</Button>} />
      <Panel title={<Segmented testId="filter-status" value={st} onChange={setSt} options={[{ value: "all", label: "Todos" }, { value: "active", label: "Ativos" }, { value: "prospect", label: "Prospectos" }, { value: "inactive", label: "Inativos" }]} />} actions={<div className="hidden sm:block"><SearchBox value={q} onChange={setQ} /></div>}>
        <div className="mb-3 sm:hidden"><SearchBox value={q} onChange={setQ} /></div>
        {customers.isLoading ? <LoadingRows /> : customers.isError ? <ErrorState error={customers.error} onRetry={() => customers.refetch()} /> : rows.length === 0 ? (
          <EmptyState icon={Contact} title={customers.data?.length ? "Nenhum resultado" : "Nenhum cliente cadastrado"} body="Clientes ficam disponíveis para invoices, projetos e horas." action={<Button size="sm" onClick={() => { setEdit(null); setOpen(true); }}>Cadastrar cliente</Button>} />
        ) : (
          <TableWrap>
            <thead className="border-b bg-muted/40"><tr><Th>Cliente</Th><Th>Contato</Th><Th>Responsável</Th><Th>Situação</Th><Th className="text-right">Ações</Th></tr></thead>
            <tbody>{rows.map((c) => (
              <tr key={c.id} className="cursor-pointer border-b last:border-0 hover:bg-muted/40" onClick={() => setView(c)} data-testid={`row-customer-${c.id}`}>
                <Td><div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold">{initials(c.name)}</div><div><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.document}</div></div></div></Td>
                <Td><div>{c.email || "—"}</div><div className="text-xs text-muted-foreground">{c.phone}</div></Td>
                <Td>{c.responsible || "—"}</Td>
                <Td><Pill tone={customerStatusTone[c.status]}>{customerStatusLabel[c.status]}</Pill></Td>
                <Td className="text-right" ><span onClick={(e) => e.stopPropagation()} className="inline-flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEdit(c); setOpen(true); }} data-testid={`button-edit-${c.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setToDel(c)} data-testid={`button-delete-${c.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                </span></Td>
              </tr>))}</tbody>
          </TableWrap>
        )}
      </Panel>
      <CustomerDialog open={open} onOpenChange={setOpen} customer={edit} onSaved={(c) => view && setView(c)} />
      <CustomerSheet c={view} onClose={() => setView(null)} onEdit={(c) => { setEdit(c); setOpen(true); }} />
      <Confirm open={!!toDel} onOpenChange={(o) => !o && setToDel(null)} title="Excluir cliente?" body="Invoices emitidas mantêm o snapshot do cliente. Esta ação não pode ser desfeita." confirmLabel="Excluir" destructive
        onConfirm={() => toDel && del.mutate({ id: toDel.id }, { onSuccess: () => { inv(); toast({ title: "Cliente excluído" }); setToDel(null); }, onError: (e) => toast({ title: "Não foi possível excluir", description: errMsg(e), variant: "destructive" }) })} />
    </div>
  );
}
