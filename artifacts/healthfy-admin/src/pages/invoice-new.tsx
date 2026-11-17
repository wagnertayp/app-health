import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { useCreateInvoice, useGetInvoice, useListCustomers, useListProducts, useUpdateInvoice, type Invoice, type InvoiceLineInput } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ErrorState, Field, LoadingRows, PageHeader, Panel } from "@/components/kit";
import { CustomerDialog } from "@/pages/clientes";
import { useInvalidateAll } from "@/components/records";
import { addDaysISO, brl, errMsg, getPrefs, usePageMeta } from "@/lib/format";

type Line = { key: number; productId: string; description: string; quantity: string; unitPrice: string };
let k = 1;
const blank = (): Line => ({ key: k++, productId: "", description: "", quantity: "1", unitPrice: "0" });

export default function InvoiceNew({ editMode = false, invoiceId = "" }: { editMode?: boolean; invoiceId?: string }) {
  usePageMeta(editMode ? "Editar invoice" : "Nova invoice", editMode ? "Editar rascunho de invoice." : "Emitir uma nova invoice Healthfy.");
  const prefs = getPrefs();
  const search = new URLSearchParams(useSearch());
  const [, nav] = useLocation();
  const { toast } = useToast();
  const inv = useInvalidateAll();
  const customers = useListCustomers();
  const products = useListProducts();
  const create = useCreateInvoice();
  const update = useUpdateInvoice();
  const existing = useGetInvoice(invoiceId, { query: { enabled: editMode && !!invoiceId } });
  const [customerId, setCustomerId] = useState(search.get("customer") ?? "");
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [dueDate, setDueDate] = useState(addDaysISO(prefs.dueDays));
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState(prefs.defaultNotes);
  const [terms, setTerms] = useState(prefs.defaultTerms);
  const [err, setErr] = useState("");
  const [newCust, setNewCust] = useState(false);
  const seeded = useRef(false);
  const editSeeded = useRef(false);

  useEffect(() => {
    if (!editMode || !existing.data || editSeeded.current) return;
    editSeeded.current = true;
    const invoice = existing.data;
    setCustomerId(invoice.customerId);
    setLines(invoice.items.map((item) => ({
      key: k++,
      productId: item.productId ?? "",
      description: item.description,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
    })));
    setDueDate(invoice.dueDate);
    setDiscount(String(invoice.discount));
    setNotes(invoice.notes);
    setTerms(invoice.paymentTerms);
  }, [editMode, existing.data]);

  useEffect(() => {
    if (editMode) return;
    const pid = search.get("product");
    if (seeded.current || !pid || !products.data) return;
    const p = products.data.find((x) => x.id === pid);
    seeded.current = true;
    if (p) {
      setLines([{ key: k++, productId: p.id, description: p.name, quantity: "1", unitPrice: String(p.price) }]);
      if (p.paymentTerms) setTerms(p.paymentTerms);
    }
  }, [products.data, search, editMode]);

  const upd = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const pick = (key: number, pid: string) => {
    const p = products.data?.find((x) => x.id === pid);
    upd(key, p ? { productId: p.id, description: p.name, unitPrice: String(p.price) } : { productId: "" });
  };
  const subtotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const disc = Number(discount) || 0;
  const total = Math.max(0, subtotal - disc);

  function submit(status: "draft" | "pending") {
    setErr("");
    if (!customerId) return setErr("Selecione um cliente.");
    const items: InvoiceLineInput[] = [];
    for (const l of lines) {
      if (!l.description.trim()) return setErr("Toda linha precisa de descrição.");
      if (!(Number(l.quantity) > 0)) return setErr("Quantidade deve ser maior que zero.");
      if (Number(l.unitPrice) < 0) return setErr("Preço unitário inválido.");
      items.push({ ...(l.productId ? { productId: l.productId } : {}), description: l.description.trim(), quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) });
    }
    if (disc < 0 || disc > subtotal) return setErr("O desconto não pode exceder o subtotal.");
    const data = { customerId, items, dueDate, discount: disc, notes, paymentTerms: terms };
    const onSuccess = (i: Invoice) => {
      inv();
      toast({ title: editMode ? `Invoice ${i.number} atualizada` : `Invoice ${i.number} criada` });
      nav(`/invoices/${i.id}`);
    };
    const onError = (e: unknown) => setErr(errMsg(e));
    if (editMode) update.mutate({ id: invoiceId, data }, { onSuccess, onError });
    else create.mutate({ data: { ...data, status } }, { onSuccess, onError });
  }

  if (editMode && existing.isLoading) return <LoadingRows rows={6} />;
  if (editMode && (existing.isError || !existing.data)) return <ErrorState error={existing.error} onRetry={() => existing.refetch()} />;
  if (editMode && existing.data && existing.data.status !== "draft") {
    return <ErrorState error={new Error("Somente rascunhos podem ser editados. Invoices emitidas preservam o histórico.")} onRetry={() => nav(`/invoices/${invoiceId}`)} />;
  }
  const saving = create.isPending || update.isPending;

  return (
    <div>
      <PageHeader back={{ href: editMode ? `/invoices/${invoiceId}` : "/invoices", label: editMode ? "Invoice" : "Invoices" }} title={editMode ? `Editar ${existing.data?.number ?? "invoice"}` : "Nova invoice"} subtitle={editMode ? "Altere os dados do rascunho. O número e a data de criação serão preservados." : "Escolha um produto para preencher a linha ou digite uma linha personalizada."} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Panel title="Cliente">
            <div className="flex flex-col gap-2 sm:flex-row">
              <select className="field" value={customerId} onChange={(e) => setCustomerId(e.target.value)} data-testid="select-customer">
                <option value="">{customers.isLoading ? "Carregando..." : "Selecione um cliente"}</option>
                {(customers.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}{c.email ? ` · ${c.email}` : ""}</option>)}
              </select>
              <Button type="button" variant="outline" onClick={() => setNewCust(true)} data-testid="button-new-customer"><UserPlus className="mr-1.5 h-4 w-4" />Novo cliente</Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Os dados do cliente são salvos como snapshot no documento.</p>
          </Panel>
          <Panel title="Itens" actions={<Button size="sm" variant="outline" onClick={() => setLines((l) => [...l, blank()])} data-testid="button-add-line"><Plus className="mr-1 h-3.5 w-3.5" />Linha</Button>}>
            <div className="space-y-3">
              {lines.map((l, idx) => (
                <div key={l.key} className="grid grid-cols-12 gap-2 rounded-lg border p-3" data-testid={`line-${idx}`}>
                  <select className="field col-span-12 sm:col-span-4" value={l.productId} onChange={(e) => pick(l.key, e.target.value)} data-testid={`select-product-${idx}`}>
                    <option value="">Linha personalizada</option>
                    {(products.data ?? []).filter((p) => p.active || p.id === l.productId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input className="field col-span-12 sm:col-span-8" placeholder="Descrição" value={l.description} onChange={(e) => upd(l.key, { description: e.target.value })} data-testid={`input-description-${idx}`} />
                  <label className="col-span-4 sm:col-span-3"><span className="text-[11px] text-muted-foreground">Qtd.</span><input type="number" min="0" step="any" className="field" value={l.quantity} onChange={(e) => upd(l.key, { quantity: e.target.value })} data-testid={`input-quantity-${idx}`} /></label>
                  <label className="col-span-8 sm:col-span-4"><span className="text-[11px] text-muted-foreground">Preço unitário (R$)</span><input type="number" min="0" step="0.01" className="field" value={l.unitPrice} onChange={(e) => upd(l.key, { unitPrice: e.target.value })} data-testid={`input-price-${idx}`} /></label>
                  <div className="col-span-9 flex items-end sm:col-span-4"><div className="num pb-2 text-sm font-semibold">{brl((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0))}</div></div>
                  <div className="col-span-3 flex items-end justify-end sm:col-span-1">
                    <Button size="icon" variant="ghost" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} data-testid={`button-remove-line-${idx}`}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Condições">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Vencimento"><input type="date" className="field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} data-testid="input-due-date" /></Field>
              <Field label="Desconto (R$)"><input type="number" min="0" step="0.01" className="field" value={discount} onChange={(e) => setDiscount(e.target.value)} data-testid="input-discount" /></Field>
              <Field label="Termos de pagamento" className="sm:col-span-2" hint="Padrão de contrato: R$ 1.000 de entrada e R$ 1.000 na conclusão. Ajuste livremente."><textarea className="field" rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} data-testid="input-terms" /></Field>
              <Field label="Observações" className="sm:col-span-2"><textarea className="field" value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="input-notes" /></Field>
            </div>
          </Panel>
        </div>
        <div className="lg:sticky lg:top-20 lg:self-start">
          <Panel title="Resumo">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="num">{brl(subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Desconto</dt><dd className="num">- {brl(disc)}</dd></div>
              <div className="flex justify-between border-t pt-3 text-base font-semibold"><dt>Total</dt><dd className="num" data-testid="text-total">{brl(total)}</dd></div>
            </dl>
            {err && <p className="mt-3 rounded-md bg-[hsl(4_80%_96%)] px-3 py-2 text-xs font-medium text-destructive" data-testid="text-error">{err}</p>}
            <div className="mt-4 grid gap-2">
              {editMode ? (
                <Button disabled={saving} onClick={() => submit("draft")} data-testid="button-save-invoice">{saving ? "Salvando..." : "Salvar alterações"}</Button>
              ) : (
                <>
                  <Button disabled={saving} onClick={() => submit("pending")} data-testid="button-issue">{saving ? "Emitindo..." : "Emitir como pendente"}</Button>
                  <Button variant="outline" disabled={saving} onClick={() => submit("draft")} data-testid="button-draft">Salvar rascunho</Button>
                </>
              )}
              <Button variant="ghost" asChild><Link href="/invoices">Cancelar</Link></Button>
            </div>
          </Panel>
        </div>
      </div>
      <CustomerDialog open={newCust} onOpenChange={setNewCust} onSaved={(c) => setCustomerId(c.id)} />
    </div>
  );
}
