import { ObjectStorageService } from "./objectStorage";
import { list } from "./healthfy-store";
import { getLocalObjectMetadata, isLocalObjectStorage, readLocalObjectBytes } from "./local-storage";

export const logoStorage = new ObjectStorageService();
export const validLogoPath = (path: string) => /^\/objects\/uploads\/[0-9a-f-]{36}$/i.test(path);
const types = ["image/png", "image/jpeg", "image/webp"];
export interface LogoUpload {
  objectPath: string;
  userId: string;
  size: number;
  contentType: string;
}
export async function getLogoUpload(path: string) {
  return (await list<LogoUpload>("logoUploads")).find(row => row.objectPath === path);
}
export async function validateOwnedLogo(path: string, userId: string) {
  if (!validLogoPath(path)) throw new Error("Caminho de logo inválido.");
  const upload = await getLogoUpload(path);
  if (!upload || upload.userId !== userId) throw new Error("Envie a logo pelo cadastro deste painel.");
  if (isLocalObjectStorage()) {
    const metadata = await getLocalObjectMetadata(path);
    const size = metadata.size;
    if (!size || size > 5 * 1024 * 1024 || size !== upload.size || !types.includes(upload.contentType)) {
      throw new Error("A logo deve ser PNG, JPG ou WebP, com até 5 MB.");
    }
    const bytes = await readLocalObjectBytes(path, 0, 15);
    const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp = bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
    if (!((png && upload.contentType === "image/png") || (jpeg && upload.contentType === "image/jpeg") || (webp && upload.contentType === "image/webp"))) {
      throw new Error("O arquivo não corresponde a uma imagem PNG, JPG ou WebP válida.");
    }
    return;
  }
  const file = await logoStorage.getObjectEntityFile(path);
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size);
  if (!size || size > 5 * 1024 * 1024 || size !== upload.size || !types.includes(metadata.contentType || "") || metadata.contentType !== upload.contentType) {
    throw new Error("A logo deve ser PNG, JPG ou WebP, com até 5 MB.");
  }
  const [bytes] = await file.download({ start: 0, end: 15 });
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
  if (!((png && upload.contentType === "image/png") || (jpeg && upload.contentType === "image/jpeg") || (webp && upload.contentType === "image/webp"))) {
    throw new Error("O arquivo não corresponde a uma imagem PNG, JPG ou WebP válida.");
  }
  await logoStorage.trySetObjectEntityAclPolicy(path, { owner: userId, visibility: "private" });
}
