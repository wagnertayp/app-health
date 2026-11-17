import { useState } from "react";
import { Link } from "wouter";
import { Activity as ActivityIcon, AlertCircle, CalendarClock, FolderKanban, Percent, Receipt, Users, Wallet } from "lucide-react";
import { useGetOverview, getGetOverviewQueryKey, useListActivity, useListInvoices } from "@workspace/api-client-react";
import { EmptyState, ErrorState, LoadingRows, PageHeader, Panel, Segmented, Stat } from "@/components/kit";
import { MoneyChart } from "@/components/money-chart";
import { useRecords } from "@/components/records";
import { brl, getPrefs, isOverdue, localISO, num, relative, usePageMeta } from "@/lib/format";

export default function Dashboard() {
  usePageMeta("Dashboard", "Visão geral da operação Healthfy.");
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const params = { days: Number(days) };
  const ov = useGetOverview(params, { query: { queryKey: getGetOverviewQueryKey(params) } });
  const activity = useListActivity();
  const invoices = useListInvoices();
  const leads = useRecords("leads");
  const appts = useRecords("appointments");
  const h = new Date().getHours();
  const greet = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  const owner = getPrefs().ownerName;
  const o = ov.data;

  const sellers = Object.entries(
    (leads.data ?? []).reduce<Record<string, { total: number; won: number; value: number }>>((acc, l) => {
      const k = l.responsible || "Sem responsável";
      acc[k] ??= { total: 0, won: 0, value: 0 };
      acc[k].total++;
      if (/ganho|fechado/i.test(l.status)) { acc[k].won++; acc[k].value += l.value; }
      return acc;
    }, {}),
  ).sort((a, b) => b[1].won - a[1].won);

  const today = localISO();
  const overdue = (invoices.data ?? []).filter(isOverdue);
  const todayAppts = (appts.data ?? []).filter((a) => a.date.slice(0, 10) === today && a.status !== "Cancelado");
  const newLeads = (leads.data ?? []).filter((l) => l.status === "Novo");
  const alerts = [
    overdue.length && { href: "/invoices?status=overdue", text: `${overdue.length} invoice(s) vencida(s) aguardando cobrança` },
    todayAppts.length && { href: "/multi-agenda", text: `${todayAppts.length} compromisso(s) hoje` },
    newLeads.length && { href: "/crm", text: `${newLeads.length} lead(s) novo(s) aguardando contato` },
  ].filter(Boolean) as { href: string; text: string }[];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })} title={`${greet}${owner ? `, ${owner}` : ""}.`} subtitle="Os números abaixo vêm apenas de registros reais do workspace." actions={<Segmented testId="filter-days" value={days} onChange={setDays} options={[{ value: "7", label: "7 dias" }, { value: "30", label: "30 dias" }, { value: "90", label: "90 dias" }]} />} />
      {ov.isError ? <ErrorState error={ov.error} onRetry={() => ov.refetch()} /> : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Clientes" icon={Users} value={o?.customers ?? "—"} testId="stat-customers" />
          <Stat label="Projetos ativos" icon={FolderKanban} value={o?.activeProjects ?? "—"} testId="stat-projects" />
          <Stat label={`Receita (${days}d)`} icon={Receipt} value={o ? brl(o.revenue) : "—"} hint="Pagamentos registrados manualmente" testId="stat-revenue" />
          <Stat label="A receber" icon={Wallet} value={o ? brl(o.receivable) : "—"} testId="stat-receivable" />
          <Stat label="Despesas" icon={Wallet} value={o ? brl(o.expenses) : "—"} testId="stat-expenses" />
          <Stat label="Agendamentos" icon={CalendarClock} value={o?.appointments ?? "—"} testId="stat-appointments" />
          <Stat label="Conversão de leads" icon={Percent} value={o ? `${num(o.conversion)}%` : "—"} testId="stat-conversion" />
          <Stat label="Horas vendidas / usadas" icon={ActivityIcon} value={o ? `${num(o.hoursSold)} / ${num(o.hoursUsed)}` : "—"} testId="stat-hours" />
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <Panel title="Receita e despesas" description={`Últimos ${days} dias`}>{ov.isLoading ? <LoadingRows /> : <MoneyChart series={o?.series ?? []} />}</Panel>
        <Panel title="Avisos">
          {alerts.length ? <ul className="space-y-2">{alerts.map((a) => <li key={a.href}><Link href={a.href} className="flex items-start gap-2 rounded-lg border p-3 text-sm hover:bg-muted/50"><AlertCircle className="mt-0.5 h-4 w-4 text-[hsl(var(--chart-2))]" />{a.text}</Link></li>)}</ul> : <p className="text-sm text-muted-foreground">Tudo em dia. Nenhum aviso pendente.</p>}
        </Panel>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Desempenho por responsável" description="Leads do CRM por responsável">
          {leads.isLoading ? <LoadingRows /> : sellers.length === 0 ? <EmptyState icon={Users} title="Sem leads" body="Cadastre leads no CRM para acompanhar o desempenho comercial." /> : (
            <ul className="divide-y">{sellers.map(([n, s]) => (
              <li key={n} className="flex items-center justify-between py-2.5 text-sm"><span className="font-medium">{n}</span><span className="num text-xs text-muted-foreground">{s.total} leads · {s.won} ganhos · {brl(s.value)}</span></li>
            ))}</ul>
          )}
        </Panel>
        <Panel title="Atividades recentes">
          {activity.isLoading ? <LoadingRows /> : activity.isError ? <ErrorState error={activity.error} onRetry={() => activity.refetch()} /> : !activity.data?.length ? <EmptyState icon={ActivityIcon} title="Nada registrado ainda" body="Ações em clientes, invoices e módulos aparecem aqui." /> : (
            <ol className="space-y-3 border-l pl-4">{activity.data.slice(0, 10).map((a) => (
              <li key={a.id} className="relative text-sm before:absolute before:-left-[21px] before:top-1.5 before:h-2 before:w-2 before:rounded-full before:bg-[hsl(var(--chart-1))]"><div className="font-medium">{a.title}</div><div className="text-xs text-muted-foreground">{a.description} · {relative(a.createdAt)}</div></li>
            ))}</ol>
          )}
        </Panel>
      </div>
    </div>
  );
}
