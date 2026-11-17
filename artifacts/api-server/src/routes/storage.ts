import { Readable } from "node:stream";
import { Router, type IRouter, type Response } from "express";
import { RequestUploadUrlBody, RequestUploadUrlResponse } from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/authMiddleware";
import { insert } from "../lib/healthfy-store";
import { getLogoUpload, logoStorage, validLogoPath } from "../lib/customer-logos";
import { ObjectNotFoundError } from "../lib/objectStorage";

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
router.get("/storage/public-objects/*filePath", async (req, res): Promise<void> => {
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
