import { Router, type IRouter } from "express";
import { GetOverviewQueryParams, GetOverviewResponse, CreateRecordResponse, CreateCustomerResponse, GetProductResponse } from "@workspace/api-zod";
import { list, money } from "../lib/healthfy-store";
import type { Invoice } from "./invoices";

const router: IRouter = Router();
type ModuleRecord = typeof CreateRecordResponse._output;
type Customer = typeof CreateCustomerResponse._output;
type Product = typeof GetProductResponse._output;
const done = (status: string) => ["done", "completed", "concluido", "concluído", "concluída", "finalizado", "cancelled", "cancelado"].includes(status.toLowerCase());
const won = (status: string) => ["won", "ganho", "ganha", "fechado", "convertido"].includes(status.toLowerCase());
const settled = (row: ModuleRecord) => row.metadata.paid === true || ["paid", "pago", "recebido"].includes(row.status.toLowerCase());

router.get("/overview", async (req, res): Promise<void> => {
  const parsed = GetOverviewQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Período inválido." }); return; }
  const days = Math.max(1, Math.min(365, Math.trunc(parsed.data.days ?? 30)));
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const startDay = start.toISOString().slice(0, 10);
  const inPeriod = (date: string) => date.slice(0, 10) >= startDay && date.slice(0, 10) <= today;
  const [customers, products, invoices, projects, transactions, appointments, leads, hours] = await Promise.all([
    list<Customer>("customers"), list<Product>("products"), list<Invoice>("invoices"), list<ModuleRecord>("projects"),
    list<ModuleRecord>("transactions"), list<ModuleRecord>("appointments"), list<ModuleRecord>("leads"), list<ModuleRecord>("hours"),
  ]);
  const paidInvoices = invoices.filter(invoice => invoice.status === "paid" && inPeriod(invoice.paidAt || invoice.createdAt));
  const paidTransactions = transactions.filter(row => settled(row) && inPeriod(row.date || row.createdAt));
  const income = paidTransactions.filter(row => row.metadata.type === "income");
  const expenses = paidTransactions.filter(row => row.metadata.type === "expense");
  const sum = (rows: { value: number }[]) => rows.reduce((total, row) => total + row.value, 0);
  const series = Array.from({ length: days }, (_, i) => {
    const date = new Date(start); date.setUTCDate(date.getUTCDate() + i);
    const day = date.toISOString().slice(0, 10);
    return {
      date: day,
      revenue: money(paidInvoices.filter(inv => (inv.paidAt || inv.createdAt).slice(0, 10) === day).reduce((total, row) => total + row.total, 0)
        + sum(income.filter(row => (row.date || row.createdAt).slice(0, 10) === day))),
      expenses: money(sum(expenses.filter(row => (row.date || row.createdAt).slice(0, 10) === day))),
    };
  });
  res.json(GetOverviewResponse.parse({
    customers: customers.length, activeProjects: projects.filter(row => !done(row.status)).length,
    revenue: money(paidInvoices.reduce((total, row) => total + row.total, 0) + sum(income)),
    expenses: money(sum(expenses)),
    receivable: money(invoices.filter(row => row.status === "pending").reduce((total, row) => total + row.total, 0)
      + sum(transactions.filter(row => !settled(row) && row.metadata.type === "income" && !done(row.status)))),
    appointments: appointments.filter(row => inPeriod(row.date) && !done(row.status)).length,
    products: products.length, invoices: invoices.length,
    conversion: leads.length ? money(leads.filter(row => won(row.status)).length / leads.length * 100) : 0,
    hoursSold: invoices.filter(row => row.status === "paid").reduce((total, row) => total + (row.hoursTotal || 0), 0),
    hoursUsed: sum(hours),
    invoiceCounts: {
      draft: invoices.filter(row => row.status === "draft").length,
      pending: invoices.filter(row => row.status === "pending").length,
      paid: invoices.filter(row => row.status === "paid").length,
      cancelled: invoices.filter(row => row.status === "cancelled").length,
      overdue: invoices.filter(row => row.status === "pending" && row.dueDate < today).length,
    },
    periodDays: days, series,
  }));
});
export default router;
