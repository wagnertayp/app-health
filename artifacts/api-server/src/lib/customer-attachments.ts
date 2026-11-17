import { logoStorage, validLogoPath } from "./customer-logos";
import { find, list, replace, type Entity } from "./healthfy-store";
import { MAX_ATTACHMENT_SIZE, matchesAttachmentType } from "./customer-attachment-types";

export interface AttachmentUpload extends Entity {
  customerId: string;
  userId: string;
  objectPath: string;
  name: string;
  size: number;
  contentType: string;
  generation?: string;
}
export const attachmentUploadsKind = "customerAttachmentUploads";
export const customerEntriesKind = "customerEntries";

export function attachmentInfo(upload: AttachmentUpload) {
  return { id: upload.id, objectPath: upload.objectPath, name: upload.name, size: upload.size, contentType: upload.contentType };
}

export async function inspectAttachment(upload: AttachmentUpload) {
  if (!validLogoPath(upload.objectPath)) throw new Error("Caminho de anexo inválido.");
  const file = await logoStorage.getObjectEntityFile(upload.objectPath);
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size);
  if (!size || size > MAX_ATTACHMENT_SIZE || size !== upload.size || metadata.contentType !== upload.contentType
    || (upload.generation && upload.generation !== String(metadata.generation))) {
    throw new Error("O arquivo enviado difere do selecionado. Envie-o novamente.");
  }
  // Bind reads to the exact inspected generation, even while a PUT URL is still valid.
  const pinned = file.bucket.file(file.name, { generation: metadata.generation });
  const [bytes] = await pinned.download({ start: 0, end: Math.min(size - 1, 8191) });
  if (!matchesAttachmentType(bytes, upload.contentType)) {
    throw new Error("O conteúdo do arquivo não corresponde ao formato informado.");
  }
  return { file: pinned, generation: String(metadata.generation) };
}

export async function resolveAttachments(paths: string[], customerId: string, userId: string, previousPaths: string[]) {
  if (new Set(paths).size !== paths.length) throw new Error("Há anexos repetidos neste registro.");
  if (!paths.length) return [];
  const uploads = await list<AttachmentUpload>(attachmentUploadsKind);
  const attachments = [];
  for (const path of paths) {
    const upload = uploads.find(u => u.objectPath === path && u.customerId === customerId);
    if (!upload || (!previousPaths.includes(path) && upload.userId !== userId)) {
      throw new Error("Anexo não autorizado. Envie os arquivos pela ficha deste cliente.");
    }
    const inspected = await inspectAttachment(upload);
    await logoStorage.trySetObjectEntityAclPolicy(path, { owner: upload.userId, visibility: "private" });
    if (!upload.generation) await replace(attachmentUploadsKind, upload.id, { ...upload, generation: inspected.generation });
    attachments.push(attachmentInfo(upload));
  }
  return attachments;
}

export async function findAttachment(id: string, customerId: string) {
  const upload = await find<AttachmentUpload>(attachmentUploadsKind, id);
  return upload?.customerId === customerId ? upload : undefined;
}
