import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LineChart as LineIcon } from "lucide-react";
import type { RevenuePoint } from "@workspace/api-client-react";
import { EmptyState } from "@/components/kit";
import { brl } from "@/lib/format";

export function MoneyChart({ series }: { series: RevenuePoint[] }) {
  const has = series.some((s) => s.revenue > 0 || s.expenses > 0);
  if (!has) return <EmptyState icon={LineIcon} title="Sem movimentação no período" body="O gráfico aparece quando houver receitas pagas ou despesas registradas. Nenhuma curva é simulada." />;
  const data = series.map((s) => ({ ...s, label: new Date(s.date + (s.date.length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) }));
  return (
    <div className="h-64" data-testid="chart-series">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.25} /><stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} /></linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => brl(Number(v)).replace(",00", "")} />
          <Tooltip formatter={(v: number, n: string) => [brl(v), n === "revenue" ? "Receita" : "Despesas"]} contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
          <Area type="monotone" dataKey="revenue" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#rev)" />
          <Area type="monotone" dataKey="expenses" stroke="hsl(var(--chart-2))" strokeWidth={1.5} fill="transparent" strokeDasharray="4 3" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
