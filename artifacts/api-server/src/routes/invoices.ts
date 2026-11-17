import { Router, type IRouter } from "express";
import { db, healthfyEntities } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateInvoiceBody, GetInvoiceResponse, ListInvoicesResponse, UpdateInvoiceBody, UpdateInvoiceStatusBody,
  GetProductResponse, CreateCustomerResponse,
} from "@workspace/api-zod";
import { activity, find, insert, list, money, remove, replace, validDate } from "../lib/healthfy-store";

const router: IRouter = Router();
export type Invoice = typeof GetInvoiceResponse._output;
type Product = typeof GetProductResponse._output;
type Customer = typeof CreateCustomerResponse._output;

router.get("/invoices", async (_req, res): Promise<void> => {
  res.json(ListInvoicesResponse.parse(await list("invoices")));
});
router.get("/invoices/:id", async (req, res): Promise<void> => {
  const invoice = await find<Invoice>("invoices", req.params.id);
  if (!invoice) { res.status(404).json({ error: "Invoice não encontrada." }); return; }
  res.json(GetInvoiceResponse.parse(invoice));
});
router.post("/invoices", async (req, res): Promise<void> => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Confira os dados da invoice.", details: parsed.error.flatten() }); return; }
  const input = parsed.data;
  if (!validDate(input.dueDate) || input.items.some(item => item.quantity <= 0 || !item.description.trim())) {
    res.status(400).json({ error: "Informe data válida, descrições e quantidades positivas." }); return;
  }
  const customer = await find<Customer>("customers", input.customerId);
  if (!customer) { res.status(400).json({ error: "Selecione um cliente cadastrado." }); return; }
  const items = input.items.map(item => ({ ...item, unitPrice: money(item.unitPrice) }));
  const subtotal = money(items.reduce((sum, item) => sum + money(item.quantity * item.unitPrice), 0));
  const discount = money(input.discount);
  if (discount > subtotal) { res.status(400).json({ error: "Desconto não pode superar o subtotal." }); return; }
  let hoursTotal = 0;
  for (const item of items) {
    if (!item.productId) continue;
    const product = await find<Product>("products", item.productId);
    if (!product) { res.status(400).json({ error: "Um produto selecionado não existe mais." }); return; }
    if (product.type === "hours") hoursTotal += product.hours * item.quantity;
  }
  const invoice = await db.transaction(async tx => {
    const { entity, sequence } = await insert("invoices", {
      ...input, items, customer, subtotal, discount, total: money(subtotal - discount),
      paidAt: null, hoursTotal,
    }, tx);
    const result = { ...entity, number: `HF-${new Date().getFullYear()}-${String(sequence).padStart(5, "0")}` };
    await replace("invoices", result.id, result, tx);
    await activity("Invoice criada", `${result.number} · ${customer.name}`, "invoices", result.id, tx);
    return result;
  });
  res.status(201).json(GetInvoiceResponse.parse(invoice));
});
router.put("/invoices/:id", async (req, res): Promise<void> => {
  const parsed = UpdateInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Confira os dados da invoice.", details: parsed.error.flatten() }); return; }
  const input = parsed.data;
  if (!validDate(input.dueDate) || input.items.some(item => item.quantity <= 0 || !item.description.trim())) {
    res.status(400).json({ error: "Informe data válida, descrições e quantidades positivas." }); return;
  }
  const customer = await find<Customer>("customers", input.customerId);
  if (!customer) { res.status(400).json({ error: "Selecione um cliente cadastrado." }); return; }
  const items = input.items.map(item => ({ ...item, description: item.description.trim(), unitPrice: money(item.unitPrice) }));
  const subtotal = money(items.reduce((sum, item) => sum + money(item.quantity * item.unitPrice), 0));
  const discount = money(input.discount);
  if (discount > subtotal) { res.status(400).json({ error: "Desconto não pode superar o subtotal." }); return; }
  let hoursTotal = 0;
  for (const item of items) {
    if (!item.productId) continue;
    const product = await find<Product>("products", item.productId);
    if (!product) { res.status(400).json({ error: "Um produto selecionado não existe mais." }); return; }
    if (product.type === "hours") hoursTotal += product.hours * item.quantity;
  }
  const result = await db.transaction(async tx => {
    await tx.select().from(healthfyEntities).where(eq(healthfyEntities.id, req.params.id)).for("update");
    const current = await find<Invoice>("invoices", req.params.id, tx);
    if (!current) return { kind: "missing" as const };
    if (current.status !== "draft") return { kind: "locked" as const };
    const updated = {
      ...current, ...input, items, customer, subtotal, discount,
      total: money(subtotal - discount), hoursTotal,
    };
    await replace("invoices", current.id, updated, tx);
    await activity("Rascunho atualizado", `${current.number} · ${customer.name}`, "invoices", current.id, tx);
    return { kind: "updated" as const, invoice: updated };
  });
  if (result.kind === "missing") { res.status(404).json({ error: "Invoice não encontrada." }); return; }
  if (result.kind === "locked") { res.status(409).json({ error: "Somente rascunhos podem ser editados. Invoices emitidas, pagas ou canceladas preservam o histórico." }); return; }
  res.json(GetInvoiceResponse.parse(result.invoice));
});
router.patch("/invoices/:id", async (req, res): Promise<void> => {
  const parsed = UpdateInvoiceStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Status inválido." }); return; }
  const invoice = await find<Invoice>("invoices", req.params.id);
  if (!invoice) { res.status(404).json({ error: "Invoice não encontrada." }); return; }
  const allowed: Record<string, string[]> = {
    draft: ["draft", "pending", "cancelled"], pending: ["pending", "paid", "cancelled"],
    paid: ["paid"], cancelled: ["cancelled"],
  };
  if (!allowed[invoice.status]?.includes(parsed.data.status)) {
    res.status(409).json({ error: "Esta alteração apagaria o histórico de emissão. Invoices emitidas não podem voltar a rascunho." }); return;
  }
  const result = await db.transaction(async tx => {
    // Lock the row so concurrent manual status changes cannot lose paidAt.
    await tx.select().from(healthfyEntities).where(eq(healthfyEntities.id, invoice.id)).for("update");
    const current = (await find<Invoice>("invoices", invoice.id, tx))!;
    if (!allowed[current.status]?.includes(parsed.data.status)) return undefined;
    const updated = { ...current, status: parsed.data.status,
      paidAt: parsed.data.status === "paid" ? (current.paidAt || new Date().toISOString()) : null };
    await replace("invoices", invoice.id, updated, tx);
    await activity("Status da invoice alterado manualmente", `${current.number}: ${parsed.data.status}`, "invoices", invoice.id, tx);
    return updated;
  });
  if (!result) { res.status(409).json({ error: "O status foi alterado por outra operação. Atualize a página." }); return; }
  res.json(GetInvoiceResponse.parse(result));
});
router.delete("/invoices/:id", async (req, res): Promise<void> => {
  const result = await db.transaction(async tx => {
    await tx.select().from(healthfyEntities).where(eq(healthfyEntities.id, req.params.id)).for("update");
    const invoice = await find<Invoice>("invoices", req.params.id, tx);
    if (!invoice) return { kind: "missing" as const };
    if (invoice.status !== "draft") return { kind: "locked" as const };
    await remove("invoices", invoice.id, tx);
    await activity("Rascunho excluído", invoice.number, "invoices", invoice.id, tx);
    return { kind: "deleted" as const };
  });
  if (result.kind === "missing") { res.status(404).json({ error: "Invoice não encontrada." }); return; }
  if (result.kind === "locked") { res.status(409).json({ error: "Somente rascunhos podem ser excluídos. Invoices emitidas, pagas ou canceladas devem ser canceladas para preservar o histórico." }); return; }
  res.sendStatus(204);
});
export default router;
