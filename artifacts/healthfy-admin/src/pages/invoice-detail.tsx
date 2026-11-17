import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { Ban, CheckCircle2, Pencil, Printer, Send, Trash2 } from "lucide-react";
import { useDeleteInvoice, useGetInvoice, getGetInvoiceQueryKey, useUpdateInvoiceStatus, type InvoiceStatusInputStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Confirm, ErrorState, LoadingRows, PageHeader, Pill } from "@/components/kit";
import { useInvalidateAll } from "@/components/records";
import { brl, errMsg, fmtDate, fmtDateTime, num, usePageMeta } from "@/lib/format";
import { invoiceKey, invoiceStatusLabel, invoiceStatusTone } from "@/lib/status";
import logo from "@assets/HEALTH_SEM_FUNDO_1794883543830.png";

const actionCopy: Record<InvoiceStatusInputStatus, { title: string; body: string; label: string }> = {
  pending: { title: "Emitir invoice?", body: "A invoice passa a pendente e entra no contas a receber.", label: "Emitir" },
  paid: { title: "Registrar pagamento manual?", body: "Confirme apenas se você recebeu o valor fora do sistema. Nenhum pagamento é processado aqui; a data de pagamento será registrada pelo servidor.", label: "Marcar como paga" },
  cancelled: { title: "Cancelar invoice?", body: "A invoice deixa de contar como recebível. O documento permanece no histórico.", label: "Cancelar invoice" },
  draft: { title: "Voltar para rascunho?", body: "A invoice sai do contas a receber.", label: "Voltar para rascunho" },
};

export default function InvoiceDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const q = useGetInvoice(id, { query: { enabled: !!id, queryKey: getGetInvoiceQueryKey(id) } });
  usePageMeta(q.data ? `Invoice ${q.data.number}` : "Invoice", "Documento de invoice Healthfy para impressão em PDF.");
  const upd = useUpdateInvoiceStatus();
  const del = useDeleteInvoice();
  const inv = useInvalidateAll();
  const { toast } = useToast();
  const [, nav] = useLocation();
  const [pending, setPending] = useState<InvoiceStatusInputStatus | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  if (q.isLoading) return <LoadingRows rows={6} />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const i = q.data;
  const k = invoiceKey(i);

  const change = (status: InvoiceStatusInputStatus) =>
    upd.mutate(
      { id, data: { status } },
      { onSuccess: () => { inv(); toast({ title: `Status: ${invoiceStatusLabel[status]}` }); }, onError: (e) => toast({ title: "Falha", description: errMsg(e), variant: "destructive" }) },
    );

  return (
    <div>
      <PageHeader
        back={{ href: "/invoices", label: "Invoices" }}
        title={<span className="flex items-center gap-3"><span className="num">{i.number}</span><Pill tone={invoiceStatusTone[k]}>{invoiceStatusLabel[k]}</Pill></span>}
        subtitle={i.paidAt ? `Pagamento registrado manualmente em ${fmtDateTime(i.paidAt)}` : "Pagamento não conectado — status alterado manualmente."}
        actions={
          <>
            {i.status === "draft" && <Button variant="outline" size="sm" onClick={() => setPending("pending")} data-testid="button-issue"><Send className="mr-1.5 h-3.5 w-3.5" />Emitir</Button>}
            {i.status === "draft" && <Button variant="outline" size="sm" asChild data-testid="button-edit-invoice"><Link href={`/invoices/${id}/editar`}><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar</Link></Button>}
            {i.status === "pending" && <Button variant="outline" size="sm" onClick={() => setPending("paid")} data-testid="button-mark-paid"><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Registrar pagamento</Button>}
            {(i.status === "pending" || i.status === "draft") && <Button variant="outline" size="sm" onClick={() => setPending("cancelled")} data-testid="button-cancel-invoice"><Ban className="mr-1.5 h-3.5 w-3.5" />Cancelar</Button>}
            {i.status === "draft" && <Button variant="outline" size="sm" className="text-destructive" onClick={() => setConfirmDel(true)} data-testid="button-delete"><Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir</Button>}
            <Button size="sm" onClick={() => window.print()} data-testid="button-print"><Printer className="mr-1.5 h-3.5 w-3.5" />Imprimir / PDF</Button>
          </>
        }
      />

      <article className="print-area card-surface mx-auto max-w-[820px] p-8 sm:p-12" data-testid="invoice-document">
        <header className="flex flex-col justify-between gap-6 border-b pb-8 sm:flex-row">
          <div className="flex items-start gap-3">
            <img src={logo} alt="Healthfy" className="h-12 w-12 rounded-lg" />
            <div>
              <div className="text-lg font-semibold">Healthfy IA</div>
              <div className="text-xs text-muted-foreground">Sistemas e automação</div>
            </div>
          </div>
          <div className="sm:text-right">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Invoice</div>
            <div className="num text-2xl font-semibold">{i.number}</div>
            <div className="mt-2 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-xs sm:justify-end">
              <span className="text-muted-foreground">Emissão</span><span>{fmtDate(i.createdAt)}</span>
              <span className="text-muted-foreground">Vencimento</span><span className="font-medium">{fmtDate(i.dueDate)}</span>
              <span className="text-muted-foreground">Status</span><span>{invoiceStatusLabel[k]}</span>
            </div>
          </div>
        </header>

        <section className="grid gap-6 py-8 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Emitente</div>
            <div className="text-sm font-medium">Healthfy IA</div>
            <div className="text-xs text-muted-foreground">CNPJ 58.484.325/0001-77</div>
            <div className="text-xs text-muted-foreground">Rua da Mooca, 1350 · São Paulo/SP</div>
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cobrar de</div>
            <div className="text-sm font-medium" data-testid="text-customer">{i.customer.name}</div>
            <div className="space-y-0.5 text-xs text-muted-foreground">
              {i.customer.document && <div>Documento: {i.customer.document}</div>}
              {i.customer.email && <div>{i.customer.email}</div>}
              {i.customer.phone && <div>{i.customer.phone}</div>}
              {i.customer.address && <div>{i.customer.address}</div>}
            </div>
          </div>
        </section>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-y bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-left font-semibold">Descrição</th>
              <th className="px-3 py-2 text-right font-semibold">Qtd.</th>
              <th className="px-3 py-2 text-right font-semibold">Unitário</th>
              <th className="px-3 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {i.items.map((it, idx) => (
              <tr key={idx} className="border-b">
                <td className="px-3 py-3">{it.description}</td>
                <td className="num px-3 py-3 text-right">{num(it.quantity, 2)}</td>
                <td className="num px-3 py-3 text-right">{brl(it.unitPrice)}</td>
                <td className="num px-3 py-3 text-right font-medium">{brl(it.quantity * it.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex justify-end">
          <dl className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="num">{brl(i.subtotal)}</dd></div>
            {i.discount > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Desconto</dt><dd className="num">- {brl(i.discount)}</dd></div>}
            <div className="flex justify-between border-t pt-2 text-lg font-semibold"><dt>Total</dt><dd className="num" data-testid="text-total">{brl(i.total)}</dd></div>
          </dl>
        </div>

        {(i.paymentTerms || i.notes) && (
          <section className="mt-10 grid gap-6 border-t pt-6 sm:grid-cols-2">
            {i.paymentTerms && <div><div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Termos de pagamento</div><p className="whitespace-pre-line text-xs leading-relaxed">{i.paymentTerms}</p></div>}
            {i.notes && <div><div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Observações</div><p className="whitespace-pre-line text-xs leading-relaxed">{i.notes}</p></div>}
          </section>
        )}

        <footer className="mt-10 border-t pt-4 text-[10px] leading-relaxed text-muted-foreground">
          Documento comercial sem valor fiscal. Não substitui nota fiscal de serviço (NFS-e). Valores em reais (BRL).
        </footer>
      </article>

      {pending && (
        <Confirm
          open={!!pending}
          onOpenChange={(o) => !o && setPending(null)}
          title={actionCopy[pending].title}
          body={actionCopy[pending].body}
          confirmLabel={actionCopy[pending].label}
          destructive={pending === "cancelled"}
          onConfirm={() => { change(pending); setPending(null); }}
        />
      )}
      <Confirm
        open={confirmDel}
        onOpenChange={setConfirmDel}
        title="Excluir rascunho?"
        body="O rascunho será removido permanentemente. Invoices emitidas, pagas ou canceladas devem ser canceladas para preservar o histórico."
        confirmLabel="Excluir"
        destructive
        onConfirm={() => del.mutate({ id }, { onSuccess: () => { inv(); toast({ title: "Rascunho excluído" }); nav("/invoices"); }, onError: (e) => toast({ title: "Falha", description: errMsg(e), variant: "destructive" }) })}
      />
    </div>
  );
}
