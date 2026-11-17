import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  CreateCustomerEntryBody, CreateCustomerEntryParams, CreateCustomerEntryResponse,
  UpdateCustomerEntryParams, DeleteCustomerEntryParams, ListCustomerEntriesParams, ListCustomerEntriesResponse,
  RequestCustomerAttachmentUploadBody, RequestCustomerAttachmentUploadParams, RequestCustomerAttachmentUploadResponse,
  GetCustomerEntryFileParams,
} from "@workspace/api-zod";
import { activity, find, insert, list, remove, replace, validDate } from "../lib/healthfy-store";
import { logoStorage } from "../lib/customer-logos";
import { attachmentInfo, attachmentUploadsKind, customerEntriesKind, findAttachment, inspectAttachment, resolveAttachments, type AttachmentUpload } from "../lib/customer-attachments";
import { attachmentRange, safeAttachmentName } from "../lib/customer-attachment-types";
import { ObjectNotFoundError } from "../lib/objectStorage";

const router: IRouter = Router();
type CustomerEntry = typeof CreateCustomerEntryResponse._output;
const rates = new Map<string, { count: number; until: number }>();

router.get("/customers/:customerId/entries", async (req, res): Promise<void> => {
  const p = ListCustomerEntriesParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: "Cliente inválido." }); return; }
  if (!await find("customers", p.data.customerId)) { res.sendStatus(404); return; }
  const entries = (await list<CustomerEntry>(customerEntriesKind))
    .filter(e => e.customerId === p.data.customerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(ListCustomerEntriesResponse.parse(entries));
});

async function save(req: Request, res: Response, editing: boolean): Promise<void> {
  const p = (editing ? UpdateCustomerEntryParams : CreateCustomerEntryParams).safeParse(req.params);
  const b = CreateCustomerEntryBody.safeParse(req.body);
  if (!p.success || !b.success || !b.data.title.trim() || (b.data.dueDate && !validDate(b.data.dueDate))) {
    res.status(400).json({ error: "Confira o título, o prazo e os dados do registro." }); return;
  }
  const { customerId } = p.data;
  if (!await find("customers", customerId)) { res.sendStatus(404); return; }
  const old = editing ? await find<CustomerEntry>(customerEntriesKind, req.params.entryId) : undefined;
  if (editing && (!old || old.customerId !== customerId)) { res.sendStatus(404); return; }
  let attachments: CustomerEntry["attachments"];
  try {
    attachments = await resolveAttachments(b.data.attachmentPaths, customerId, req.user!.id, old?.attachmentPaths ?? []);
  } catch (error) {
    req.log.warn({ err: error }, "Customer attachment validation failed");
    res.status(400).json({ error: error instanceof Error ? error.message : "Não foi possível validar os anexos." }); return;
  }
  const data = {
    ...b.data, title: b.data.title.trim(), tags: [...new Set(b.data.tags.map(t => t.trim()).filter(Boolean))],
    customerId, attachments, updatedAt: new Date().toISOString(),
    createdBy: old?.createdBy ?? ([req.user!.firstName, req.user!.lastName].filter(Boolean).join(" ") || "Administrador"),
  };
  const entry = await db.transaction(async tx => {
    const result = old ? { ...data, id: old.id, createdAt: old.createdAt }
      : (await insert(customerEntriesKind, data, tx)).entity;
    if (old) await replace(customerEntriesKind, old.id, result, tx);
    await activity(`Registro do cliente ${old ? "atualizado" : "criado"}`, data.title, "customers", customerId, tx);
    return result;
  });
  res.status(editing ? 200 : 201).json(CreateCustomerEntryResponse.parse(entry));
}
router.post("/customers/:customerId/entries", (req, res) => save(req, res, false));
router.put("/customers/:customerId/entries/:entryId", (req, res) => save(req, res, true));
router.delete("/customers/:customerId/entries/:entryId", async (req, res): Promise<void> => {
  const p = DeleteCustomerEntryParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: "Registro inválido." }); return; }
  const old = await find<CustomerEntry>(customerEntriesKind, p.data.entryId);
  if (!old || old.customerId !== p.data.customerId || !await find("customers", p.data.customerId)) { res.sendStatus(404); return; }
  await db.transaction(async tx => {
    await remove(customerEntriesKind, old.id, tx);
    await activity("Registro do cliente excluído", old.title, "customers", p.data.customerId, tx);
  });
  res.sendStatus(204);
});

router.post("/customers/:customerId/attachment-uploads", async (req, res): Promise<void> => {
  const p = RequestCustomerAttachmentUploadParams.safeParse(req.params);
  const b = RequestCustomerAttachmentUploadBody.safeParse(req.body);
  if (!p.success || !b.success || !safeAttachmentName(b.data.name)) {
    res.status(400).json({ error: "Selecione PDF, imagem, áudio ou texto de até 50 MB." }); return;
  }
  if (!await find("customers", p.data.customerId)) { res.sendStatus(404); return; }
  const userId = req.user!.id;
  const now = Date.now();
  for (const [key, value] of rates) if (value.until <= now) rates.delete(key);
  const rate = rates.get(userId) ?? { count: 0, until: now + 600_000 };
  rates.set(userId, rate);
  if (++rate.count > 50) { res.status(429).json({ error: "Limite de envios atingido. Tente novamente em alguns minutos." }); return; }
  const uploadURL = await logoStorage.getObjectEntityUploadURL();
  const objectPath = logoStorage.normalizeObjectEntityPath(uploadURL);
  const { entity } = await insert(attachmentUploadsKind, { ...b.data, name: safeAttachmentName(b.data.name), objectPath, userId, customerId: p.data.customerId });
  res.json(RequestCustomerAttachmentUploadResponse.parse({ uploadURL, attachment: attachmentInfo(entity as AttachmentUpload) }));
});

router.get([
  "/customers/:customerId/entries/:entryId/files/:fileId",
  "/customers/:customerId/entries/:entryId/files/:fileId/download",
], async (req, res): Promise<void> => {
  const p = GetCustomerEntryFileParams.safeParse(req.params);
  if (!p.success) { res.sendStatus(400); return; }
  const { customerId, entryId, fileId } = p.data;
  const entry = await find<CustomerEntry>(customerEntriesKind, entryId);
  if (!entry || entry.customerId !== customerId || !entry.attachments.some(f => f.id === fileId) || !await find("customers", customerId)) {
    res.sendStatus(404); return;
  }
  const upload = await findAttachment(fileId, customerId);
  if (!upload || !entry.attachmentPaths.includes(upload.objectPath)) { res.sendStatus(404); return; }
  try {
    const { file } = await inspectAttachment(upload);
    const range = attachmentRange(req.headers.range, upload.size);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", upload.contentType.startsWith("text/") ? "text/plain; charset=utf-8" : upload.contentType);
    const filename = encodeURIComponent(upload.name).replace(/['()]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
    res.setHeader("Content-Disposition", `${req.path.endsWith("/download") ? "attachment" : "inline"}; filename*=UTF-8''${filename}`);
    if (range === null) { res.setHeader("Content-Range", `bytes */${upload.size}`); res.status(416).end(); return; }
    if (range) {
      res.status(206);
      res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${upload.size}`);
      res.setHeader("Content-Length", range.end - range.start + 1);
    } else res.setHeader("Content-Length", upload.size);
    if (req.method === "HEAD") { res.end(); return; }
    const source = file.createReadStream(range || undefined);
    source.on("error", (error) => { req.log.error({ err: error }, "Customer file stream failed"); res.destroy(); });
    res.on("close", () => source.destroy());
    source.pipe(res);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) { res.sendStatus(404); return; }
    req.log.warn({ err: error }, "Customer file unavailable");
    res.status(400).json({ error: "Arquivo indisponível ou inválido. Envie-o novamente." });
  }
});
export default router;
