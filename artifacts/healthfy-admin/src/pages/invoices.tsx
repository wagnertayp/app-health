import { useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { FilePlus2, FileText, Pencil, Trash2 } from "lucide-react";
import { useDeleteInvoice, useListInvoices, type Invoice } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Confirm, EmptyState, ErrorState, LoadingRows, PageHeader, Panel, Pill, SearchBox, Segmented, TableWrap, Td, Th } from "@/components/kit";
import { brl, errMsg, fmtDate, usePageMeta } from "@/lib/format";
import { invoiceKey, invoiceStatusLabel, invoiceStatusTone } from "@/lib/status";
import { useInvalidateAll } from "@/components/records";
import { useToast } from "@/hooks/use-toast";

type F = "all" | "draft" | "pending" | "overdue" | "paid" | "cancelled";

export default function Invoices() {
  usePageMeta("Invoices", "Lista de invoices emitidas pela Healthfy.");
  const search = useSearch();
  const initial = (new URLSearchParams(search).get("status") as F) || "all";
  const [f, setF] = useState<F>(initial);
  const [q, setQ] = useState("");
  const invoices = useListInvoices();
  const del = useDeleteInvoice();
  const invalidate = useInvalidateAll();
  const { toast } = useToast();
  const [toDelete, setToDelete] = useState<Invoice | null>(null);
  const rows = useMemo(
    () =>
      [...(invoices.data ?? [])]
        .filter((i) => f === "all" || invoiceKey(i) === f || (f === "pending" && i.status === "pending"))
        .filter((i) => !q || `${i.number} ${i.customer.name} ${i.customer.email}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [invoices.data, f, q],
  );
  const sum = rows.reduce((s, i) => s + i.total, 0);
  return (
    <div>
      <PageHeader eyebrow="Financeiro" title="Invoices" subtitle="Documentos numerados com snapshot do cliente. Status alterado manualmente." actions={<Button asChild data-testid="button-new-invoice"><Link href="/invoices/nova"><FilePlus2 className="mr-1.5 h-4 w-4" />Nova invoice</Link></Button>} />
      <Panel
        title={<span className="flex flex-wrap items-center gap-3"><Segmented testId="filter-status" value={f} onChange={setF} options={[{ value: "all", label: "Todas" }, { value: "draft", label: "Rascunho" }, { value: "pending", label: "Pendentes" }, { value: "overdue", label: "Vencidas" }, { value: "paid", label: "Pagas" }, { value: "cancelled", label: "Canceladas" }]} /></span>}
        actions={<div className="hidden sm:block"><SearchBox value={q} onChange={setQ} placeholder="Número ou cliente" /></div>}
      >
        <div className="mb-3 sm:hidden"><SearchBox value={q} onChange={setQ} placeholder="Número ou cliente" /></div>
        {invoices.isLoading ? <LoadingRows /> : invoices.isError ? <ErrorState error={invoices.error} onRetry={() => invoices.refetch()} /> : rows.length === 0 ? (
          <EmptyState icon={FileText} title={invoices.data?.length ? "Nenhum resultado" : "Nenhuma invoice ainda"} body={invoices.data?.length ? "Ajuste o filtro ou a busca." : "Crie a primeira invoice a partir de um produto ou de linhas personalizadas."} action={!invoices.data?.length && <Button size="sm" asChild><Link href="/invoices/nova">Nova invoice</Link></Button>} />
        ) : (
          <TableWrap>
            <thead className="border-b bg-muted/40"><tr><Th>Número</Th><Th>Cliente</Th><Th>Emissão</Th><Th>Vencimento</Th><Th>Status</Th><Th className="text-right">Total</Th><Th>Ações</Th></tr></thead>
            <tbody>
              {rows.map((i) => {
                const k = invoiceKey(i);
                return (
                  <tr key={i.id} className="border-b last:border-0 hover:bg-muted/40" data-testid={`row-invoice-${i.id}`}>
                    <Td><Link href={`/invoices/${i.id}`} className="num font-medium hover:underline">{i.number}</Link></Td>
                    <Td><div className="font-medium">{i.customer.name}</div><div className="text-xs text-muted-foreground">{i.customer.email}</div></Td>
                    <Td className="text-muted-foreground">{fmtDate(i.createdAt)}</Td>
                    <Td className="text-muted-foreground">{fmtDate(i.dueDate)}</Td>
                    <Td><Pill tone={invoiceStatusTone[k]}>{invoiceStatusLabel[k]}</Pill></Td>
                    <Td className="num text-right font-medium">{brl(i.total)}</Td>
                    <Td>
                      {i.status === "draft" ? (
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="sm" asChild data-testid={`button-edit-${i.id}`}><Link href={`/invoices/${i.id}/editar`}><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar</Link></Button>
                          <Button variant="outline" size="sm" className="text-destructive" onClick={() => setToDelete(i)} data-testid={`button-delete-${i.id}`}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir</Button>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </Td>
                  </tr>
                );
              })}
              <tr className="bg-muted/30"><Td className="text-xs text-muted-foreground">{rows.length} invoice(s)</Td><Td /><Td /><Td /><Td /><Td className="num text-right font-semibold">{brl(sum)}</Td><Td /></tr>
            </tbody>
          </TableWrap>
        )}
      </Panel>
      <Confirm
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Excluir rascunho?"
        body={<span>O rascunho {toDelete?.number} será removido permanentemente. Invoices emitidas não podem ser excluídas.</span>}
        confirmLabel={del.isPending ? "Excluindo..." : "Excluir rascunho"}
        destructive
        onConfirm={() => {
          if (!toDelete) return;
          del.mutate({ id: toDelete.id }, {
            onSuccess: () => { invalidate(); toast({ title: "Rascunho excluído" }); setToDelete(null); },
            onError: (e) => toast({ title: "Não foi possível excluir", description: errMsg(e), variant: "destructive" }),
          });
        }}
      />
    </div>
  );
}
