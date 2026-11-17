import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { link, mkdir, stat, unlink } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Request } from "express";

const OBJECT_PREFIX = "/objects/uploads/";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isLocalObjectStorage = () => process.env.OBJECT_STORAGE_DRIVER === "local";

function resolveObjectPath(objectPath: string): string {
  if (!objectPath.startsWith(OBJECT_PREFIX)) throw new Error("Caminho de arquivo inválido.");
  const id = objectPath.slice(OBJECT_PREFIX.length);
  if (!UUID_PATTERN.test(id)) throw new Error("Caminho de arquivo inválido.");
  const root = resolve(process.env.HEALTHFY_UPLOAD_DIR || "/var/lib/healthfy/uploads");
  const target = resolve(root, id);
  if (!target.startsWith(`${root}${sep}`)) throw new Error("Caminho de arquivo inválido.");
  return target;
}

export async function writeLocalObject(
  req: Request,
  objectPath: string,
  expectedSize: number,
  expectedContentType: string,
  maxSize: number,
): Promise<void> {
  if (!Number.isInteger(expectedSize) || expectedSize < 1 || expectedSize > maxSize) {
    throw new Error("Tamanho de arquivo inválido.");
  }
  const requestType = req.headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
  if (requestType !== expectedContentType.toLowerCase()) throw new Error("O tipo de arquivo enviado não corresponde ao selecionado.");
  const contentLength = req.headers["content-length"];
  if (contentLength && Number(contentLength) !== expectedSize) throw new Error("O tamanho enviado não corresponde ao selecionado.");

  const target = resolveObjectPath(objectPath);
  await mkdir(dirname(target), { recursive: true, mode: 0o750 });
  const temporary = `${target}.${randomUUID()}.tmp`;
  let received = 0;
  const limit = new Transform({
    transform(chunk: Buffer | string, _encoding, callback) {
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      received += data.length;
      if (received > expectedSize || received > maxSize) {
        callback(new Error("O arquivo ultrapassa o tamanho informado."));
        return;
      }
      callback(null, data);
    },
  });

  try {
    await pipeline(req, limit, createWriteStream(temporary, { flags: "wx", mode: 0o640 }));
    if (received !== expectedSize) throw new Error("O arquivo enviado está incompleto.");
    await link(temporary, target);
    await unlink(temporary);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

export async function getLocalObjectMetadata(objectPath: string) {
  const info = await stat(resolveObjectPath(objectPath));
  if (!info.isFile()) throw new Error("Arquivo inválido.");
  return { size: info.size, generation: `${info.ino}-${info.mtimeMs}-${info.size}` };
}

export function createLocalObjectReadStream(
  objectPath: string,
  range?: { start: number; end: number },
) {
  return createReadStream(resolveObjectPath(objectPath), range);
}

export async function readLocalObjectBytes(objectPath: string, start: number, end: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of createLocalObjectReadStream(objectPath, { start, end })) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
