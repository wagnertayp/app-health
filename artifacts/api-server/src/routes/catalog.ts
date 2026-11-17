import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  CreateProductBody, GetProductResponse, ListProductsResponse,
  CreateCustomerBody, GetInvoiceResponse, ListCustomersResponse, CreateCustomerResponse,
} from "@workspace/api-zod";
import { activity, find, insert, list, remove, replace, type Entity } from "../lib/healthfy-store";

const router: IRouter = Router();
type Product = typeof GetProductResponse._output;
type Customer = typeof CreateCustomerResponse._output;
type Invoice = typeof GetInvoiceResponse._output;

function bannerValid(url: string) {
  if (url === "") return true;
  try { return new URL(url).protocol === "https:"; } catch { return false; }
}

router.get("/products", async (_req, res): Promise<void> => {
  res.json(ListProductsResponse.parse(await list("products")));
});
router.get("/products/:id", async (req, res): Promise<void> => {
  const product = await find<Product>("products", req.params.id);
  if (!product) { res.status(404).json({ error: "Produto não encontrado." }); return; }
  res.json(GetProductResponse.parse(product));
});
async function saveProduct(req: Request, res: Response, editing: boolean): Promise<void> {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Confira os dados do produto.", details: parsed.error.flatten() }); return; }
  const input = parsed.data;
  if (!input.name.trim() || !bannerValid(input.bannerUrl) || (input.type === "hours" && input.hours <= 0)) {
    res.status(400).json({ error: "Nome obrigatório, banner HTTPS e quantidade de horas positiva para pacotes." }); return;
  }
  const old = editing ? await find<Product>("products", req.params.id) : undefined;
  if (editing && !old) { res.status(404).json({ error: "Produto não encontrado." }); return; }
  const entity = await db.transaction(async tx => {
    const product = old
      ? { ...input, id: old.id, createdAt: old.createdAt }
      : (await insert("products", input, tx)).entity;
    if (old) await replace("products", old.id, product, tx);
    await activity(old ? "Produto atualizado" : "Produto criado", input.name, "products", product.id, tx);
    return product;
  });
  res.status(editing ? 200 : 201).json(GetProductResponse.parse(entity));
}
router.post("/products", (req, res) => saveProduct(req, res, false));
router.put("/products/:id", (req, res) => saveProduct(req, res, true));
router.delete("/products/:id", async (req, res): Promise<void> => {
  const old = await find<Product>("products", req.params.id);
  if (!old) { res.status(404).json({ error: "Produto não encontrado." }); return; }
  const invoices = await list<Invoice>("invoices");
  if (invoices.some(inv => inv.items.some(item => item.productId === old.id))) {
    res.status(409).json({ error: "Produto vinculado a invoices. Desative-o para preservar o histórico." }); return;
  }
  await db.transaction(async tx => {
    await remove("products", old.id, tx);
    await activity("Produto excluído", old.name, "products", old.id, tx);
  });
  res.sendStatus(204);
});

router.get("/customers", async (_req, res): Promise<void> => {
  res.json(ListCustomersResponse.parse(await list("customers")));
});
async function saveCustomer(req: Request, res: Response, editing: boolean): Promise<void> {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.name.trim()) { res.status(400).json({ error: "Confira os dados do cliente." }); return; }
  const old = editing ? await find<Customer>("customers", req.params.id) : undefined;
  if (editing && !old) { res.status(404).json({ error: "Cliente não encontrado." }); return; }
  const entity = await db.transaction(async tx => {
    const customer = old ? { ...parsed.data, id: old.id, createdAt: old.createdAt }
      : (await insert("customers", parsed.data, tx)).entity;
    if (old) await replace("customers", old.id, customer, tx);
    await activity(old ? "Cliente atualizado" : "Cliente cadastrado", parsed.data.name, "customers", customer.id, tx);
    return customer;
  });
  res.status(editing ? 200 : 201).json(CreateCustomerResponse.parse(entity));
}
router.post("/customers", (req, res) => saveCustomer(req, res, false));
router.put("/customers/:id", (req, res) => saveCustomer(req, res, true));
router.delete("/customers/:id", async (req, res): Promise<void> => {
  const customer = await find<Customer>("customers", req.params.id);
  if (!customer) { res.status(404).json({ error: "Cliente não encontrado." }); return; }
  const related = await Promise.all(["invoices", "projects", "hours", "appointments"].map(kind => list<Entity>(kind)));
  if (related.flat().some(row => row.customerId === customer.id)) {
    res.status(409).json({ error: "Cliente possui registros vinculados. Altere o status para inativo." }); return;
  }
  await db.transaction(async tx => {
    await remove("customers", customer.id, tx);
    await activity("Cliente excluído", customer.name, "customers", customer.id, tx);
  });
  res.sendStatus(204);
});
export default router;
