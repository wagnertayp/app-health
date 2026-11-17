import { Readable } from "node:stream";
import { Router, type IRouter, type Response } from "express";
import { RequestUploadUrlBody, RequestUploadUrlResponse } from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/authMiddleware";
import { insert, list } from "../lib/healthfy-store";
import { getLogoUpload, logoStorage, validLogoPath } from "../lib/customer-logos";
import { ObjectNotFoundError } from "../lib/objectStorage";
import { attachmentUploadsKind, type AttachmentUpload } from "../lib/customer-attachments";
import { MAX_ATTACHMENT_SIZE } from "../lib/customer-attachment-types";
import { createLocalObjectReadStream, getLocalObjectMetadata, isLocalObjectStorage, writeLocalObject } from "../lib/local-storage";

const router: IRouter = Router();
const rates = new Map<string, { count: number; until: number }>();
async function stream(response: globalThis.Response, res: Response, protectedObject = false) {
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (protectedObject) res.setHeader("Cache-Control", "private, no-store");
  if (response.body) Readable.fromWeb(response.body as ReadableStream<Uint8Array>).on("error", () => res.destroy()).pipe(res);
  else res.end();
}
router.post("/storage/uploads/request-url", requireAdmin, async (req, res): Promise<void> => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Selecione uma imagem PNG, JPG ou WebP de até 5 MB." }); return; }
  const id = req.user!.id;
  const now = Date.now();
  let rate = rates.get(id);
  if (!rate || rate.until < now) { rate = { count: 0, until: now + 10 * 60 * 1000 }; rates.set(id, rate); }
  if (++rate.count > 50) { res.status(429).json({ error: "Muitos envios. Tente novamente em alguns minutos." }); return; }
  const uploadURL = await logoStorage.getObjectEntityUploadURL();
  const objectPath = logoStorage.normalizeObjectEntityPath(uploadURL);
  await insert("logoUploads", { ...parsed.data, userId: id, objectPath });
  res.json(RequestUploadUrlResponse.parse({ uploadURL, objectPath, metadata: parsed.data }));
});
router.put("/storage/uploads/:uploadId", requireAdmin, async (req, res): Promise<void> => {
  if (!isLocalObjectStorage()) { res.sendStatus(404); return; }
  const objectPath = `/objects/uploads/${req.params.uploadId}`;
  if (!validLogoPath(objectPath)) { res.sendStatus(400); return; }
  const logoUpload = await getLogoUpload(objectPath);
  const attachmentUpload = logoUpload ? undefined
    : (await list<AttachmentUpload>(attachmentUploadsKind)).find(upload => upload.objectPath === objectPath);
  const upload = logoUpload || attachmentUpload;
  if (!upload) { res.sendStatus(404); return; }
  if (upload.userId !== req.user!.id) { res.sendStatus(403); return; }
  const maxSize = logoUpload ? 5 * 1024 * 1024 : MAX_ATTACHMENT_SIZE;
  try {
    await writeLocalObject(req, objectPath, upload.size, upload.contentType, maxSize);
    res.sendStatus(204);
  } catch (error) {
    req.log.warn({ err: error }, "Local file upload rejected");
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    res.status(code === "EEXIST" ? 409 : 400).json({ error: "O arquivo não foi salvo. Selecione-o novamente." });
  }
});
router.get("/storage/public-objects/*filePath", async (req, res): Promise<void> => {
  if (isLocalObjectStorage()) { res.sendStatus(404); return; }
  const raw = req.params.filePath;
  const path = Array.isArray(raw) ? raw.join("/") : raw;
  if (!path || path.includes("..") || path.includes("\\")) { res.sendStatus(400); return; }
  const file = await logoStorage.searchPublicObject(path);
  if (!file) { res.sendStatus(404); return; }
  await stream(await logoStorage.downloadObject(file), res);
});
router.get("/storage/objects/*path", requireAdmin, async (req, res): Promise<void> => {
  const raw = req.params.path;
  const path = `/objects/${Array.isArray(raw) ? raw.join("/") : raw}`;
  if (!validLogoPath(path) || !await getLogoUpload(path)) { res.sendStatus(404); return; }
  if (isLocalObjectStorage()) {
    const upload = await getLogoUpload(path);
    if (!upload) { res.sendStatus(404); return; }
    try {
      const metadata = await getLocalObjectMetadata(path);
      if (!["image/png", "image/jpeg", "image/webp"].includes(upload.contentType) || !metadata.size || metadata.size > 5 * 1024 * 1024 || metadata.size !== upload.size) {
        res.status(400).json({ error: "Imagem inválida." }); return;
      }
      res.setHeader("Content-Type", upload.contentType);
      res.setHeader("Content-Length", metadata.size);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "private, no-store");
      createLocalObjectReadStream(path).on("error", () => res.destroy()).pipe(res);
      return;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") { res.sendStatus(404); return; }
      throw error;
    }
  }
  try {
    const file = await logoStorage.getObjectEntityFile(path);
    const [meta] = await file.getMetadata();
    if (!["image/png", "image/jpeg", "image/webp"].includes(meta.contentType || "") || Number(meta.size) > 5242880) {
      res.status(400).json({ error: "Imagem inválida." }); return;
    }
    await stream(await logoStorage.downloadObject(file, 0), res, true);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) { res.sendStatus(404); return; }
    throw error;
  }
});
export default router;
