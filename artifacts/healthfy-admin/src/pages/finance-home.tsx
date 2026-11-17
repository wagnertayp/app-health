import { Link } from "wouter";
import { ArrowUpRight, FilePlus2, FileText, Package, PlugZap, Receipt, Timer, Wallet, AlertCircle } from "lucide-react";
import { useGetOverview, getGetOverviewQueryKey, useListInvoices, useListProducts } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingRows, Notice, Panel, Pill, Stat, TableWrap, Td, Th } from "@/components/kit";
import { brl, fmtDate, num, usePageMeta } from "@/lib/format";
import { invoiceKey, invoiceStatusLabel, invoiceStatusTone, productTypeLabel } from "@/lib/status";

export default function FinanceHome() {
  usePageMeta("Central de faturas", "Venda de horas e emissão de invoices da Healthfy IA.");
  const overview = useGetOverview({ days: 30 }, { query: { queryKey: getGetOverviewQueryKey({ days: 30 }) } });
  const invoices = useListInvoices();
  const products = useListProducts();
  const o = overview.data;
  const ref = (products.data ?? []).find((p) => p.active && p.type === "hours") ?? (products.data ?? []).find((p) => p.active);
  const recent = [...(invoices.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const counts = o?.invoiceCounts;

  return (
    <div className="space-y-6">
      <section className="fade-up flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground sm:text-[26px]">
            Central de faturas
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild data-testid="button-new-product">
            <Link href="/produtos/novo"><Package className="mr-1.5 h-4 w-4" />Novo produto</Link>
          </Button>
          <Button asChild data-testid="button-new-invoice">
            <Link href="/invoices/nova"><FilePlus2 className="mr-1.5 h-4 w-4" />Nova invoice</Link>
          </Button>
        </div>
      </section>

      <Notice tone="blue" icon={PlugZap} title="Pagamentos não conectados">
        Nenhum gateway está integrado. A confirmação de pagamento das invoices é feita manualmente por você.
      </Notice>

      {overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat testId="stat-receivable" label="A receber" icon={Wallet} value={o ? brl(o.receivable) : "—"} hint={counts ? `${counts.pending} pendente(s)` : " "} />
          <Stat testId="stat-revenue" label="Recebido (30 dias)" icon={Receipt} value={o ? brl(o.revenue) : "—"} hint="Marcado como pago manualmente" />
          <Stat testId="stat-overdue" label="Vencidas" icon={AlertCircle} value={counts ? counts.overdue : "—"} hint={counts ? `${counts.draft} rascunho(s)` : " "} />
          <Stat testId="stat-hours" label="Horas vendidas / usadas" icon={Timer} value={o ? `${num(o.hoursSold)}h / ${num(o.hoursUsed)}h` : "—"} hint="Saldo de pacotes" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.6fr]">
        <Panel title="Produto de referência" bodyClassName="p-0">
          {products.isLoading ? (
            <div className="p-4"><LoadingRows rows={3} /></div>
          ) : products.isError ? (
            <div className="p-4"><ErrorState error={products.error} onRetry={() => products.refetch()} /></div>
          ) : !ref ? (
            <div className="p-4"><EmptyState icon={Package} title="Nenhum produto ativo" body="Cadastre um pacote de horas ou serviço para começar a faturar." action={<Button asChild size="sm"><Link href="/produtos/novo">Criar produto</Link></Button>} /></div>
          ) : (
            <div data-testid={`card-reference-${ref.id}`}>
              <div className="relative h-36 overflow-hidden border-b" style={{ background: `linear-gradient(135deg, ${ref.accentColor}, hsl(222 20% 12%))` }}>
                {ref.bannerUrl && <img src={ref.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />}
                <div className="absolute bottom-3 left-4 rounded-md bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">{productTypeLabel[ref.type]}</div>
              </div>
              <div className="p-5">
                <h3 className="text-lg font-semibold">{ref.name}</h3>
                <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{ref.description || "Sem descrição."}</p>
                <div className="mt-4 flex items-end justify-between border-t pt-4">
                  <div>
                    <div className="num text-3xl font-semibold">{brl(ref.price)}</div>
                    {ref.type === "hours" && ref.hours > 0 && <div className="text-xs text-muted-foreground">{num(ref.hours)} horas · {brl(ref.price / ref.hours)}/h</div>}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2">
                  <Button size="sm" asChild data-testid="button-invoice-reference"><Link href={`/invoices/nova?product=${ref.id}`}>Faturar</Link></Button>
                </div>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Invoices recentes" actions={<Link href="/invoices" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground" data-testid="link-all-invoices">Ver todas <ArrowUpRight className="h-3.5 w-3.5" /></Link>}>
          {invoices.isLoading ? (
            <LoadingRows />
          ) : invoices.isError ? (
            <ErrorState error={invoices.error} onRetry={() => invoices.refetch()} />
          ) : recent.length === 0 ? (
            <EmptyState icon={FileText} title="Nenhuma invoice emitida" body="Selecione um cliente, adicione o pacote de horas e gere um documento pronto para imprimir em PDF." action={<Button size="sm" asChild><Link href="/invoices/nova">Emitir primeira invoice</Link></Button>} />
          ) : (
            <TableWrap>
              <thead className="border-b bg-muted/40"><tr><Th>Número</Th><Th>Cliente</Th><Th>Vencimento</Th><Th>Status</Th><Th className="text-right">Total</Th></tr></thead>
              <tbody>
                {recent.map((i) => {
                  const k = invoiceKey(i);
                  return (
                    <tr key={i.id} className="border-b last:border-0 transition-colors hover:bg-muted/40" data-testid={`row-invoice-${i.id}`}>
                      <Td><Link href={`/invoices/${i.id}`} className="num font-medium hover:underline">{i.number}</Link></Td>
                      <Td className="max-w-[180px] truncate">{i.customer.name}</Td>
                      <Td className="text-muted-foreground">{fmtDate(i.dueDate)}</Td>
                      <Td><Pill tone={invoiceStatusTone[k]}>{invoiceStatusLabel[k]}</Pill></Td>
                      <Td className="num text-right font-medium">{brl(i.total)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
          )}
        </Panel>
      </div>

      {counts && (
        <Panel title="Pipeline de cobrança" description="Contagem atual por status">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(["draft", "pending", "overdue", "paid", "cancelled"] as const).map((k) => (
              <Link key={k} href={`/invoices?status=${k}`} className="rounded-lg border p-3 transition-colors hover:bg-muted/50" data-testid={`link-status-${k}`}>
                <Pill tone={invoiceStatusTone[k]}>{invoiceStatusLabel[k]}</Pill>
                <div className="num mt-2 text-2xl font-semibold">{counts[k]}</div>
              </Link>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
