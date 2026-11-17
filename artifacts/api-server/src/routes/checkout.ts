import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { GetCheckoutResponse, GetProductResponse, SubmitCheckoutBody, SubmitCheckoutResponse } from "@workspace/api-zod";
import { activity, find, insert, money } from "../lib/healthfy-store";

const router: IRouter = Router();
type Product = typeof GetProductResponse._output;
const message = "Pagamentos online não conectados. Sua solicitação será registrada para contato; nenhum valor será cobrado.";
const requests = new Map<string, { count: number; until: number }>();
router.get("/checkout/:id", async (req, res): Promise<void> => {
  const product = await find<Product>("products", req.params.id);
  if (!product?.active) { res.status(404).json({ error: "Este produto está indisponível." }); return; }
  res.json(GetCheckoutResponse.parse({ product, paymentConnected: false, sellerName: "HEALTHFY IA", message }));
});
router.post("/checkout/:id", async (req, res): Promise<void> => {
  const key = req.ip || "unknown";
  const now = Date.now();
  const limit = requests.get(key);
  if (limit && limit.until > now && limit.count >= 10) {
    res.status(429).json({ error: "Muitas solicitações. Tente novamente em alguns minutos." }); return;
  }
  if (limit && limit.until > now) limit.count++;
  else requests.set(key, { count: 1, until: now + 10 * 60 * 1000 });
  if (requests.size > 10000) for (const [ip, row] of requests) if (row.until < now) requests.delete(ip);
  const parsed = SubmitCheckoutBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.acceptedTerms) { res.status(400).json({ error: "Preencha nome, e-mail e aceite os termos." }); return; }
  const product = await find<Product>("products", req.params.id);
  if (!product?.active) { res.status(404).json({ error: "Este produto está indisponível." }); return; }
  const total = money(product.price * parsed.data.quantity);
  const result = await db.transaction(async tx => {
    const { entity } = await insert("purchaseRequests", {
      ...parsed.data, productId: product.id, product, status: "awaiting_contact", total,
    }, tx);
    await insert("leads", {
      title: `${parsed.data.name} · ${product.name}`, status: "Novo", description: `Solicitação de compra de ${parsed.data.quantity} unidade(s). Nenhum pagamento processado.`,
      responsible: "", customerId: "", value: total, date: new Date().toISOString().slice(0, 10), endDate: "",
      priority: "medium", tags: ["Checkout"], kind: "leads",
      metadata: { source: "Checkout", email: parsed.data.email, document: parsed.data.document, productId: product.id, purchaseRequestId: entity.id },
    }, tx);
    await activity("Solicitação de compra recebida", product.name, "purchaseRequests", entity.id, tx);
    return { id: entity.id, total, status: "awaiting_contact", message };
  });
  res.status(201).json(SubmitCheckoutResponse.parse(result));
});
export default router;
