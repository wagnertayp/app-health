import { CustomerAttachmentUploadInputContentType, type CustomerAttachment, type CustomerEntryInput } from "@workspace/api-client-react";
import type { Tone } from "@/components/kit";

export const MAX_FILES = 10;
export const MAX_SIZE = 50 * 1024 * 1024;
export const ALLOWED = Object.values(CustomerAttachmentUploadInputContentType) as string[];
export type AllowedType = (typeof CustomerAttachmentUploadInputContentType)[keyof typeof CustomerAttachmentUploadInputContentType];

const EXT: Record<string, AllowedType> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
  mp3: "audio/mpeg", m4a: "audio/mp4", mp4: "audio/mp4", aac: "audio/aac", wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg",
  webm: "audio/webm", flac: "audio/flac", txt: "text/plain", csv: "text/csv", md: "text/markdown", markdown: "text/markdown",
};
const ALIAS: Record<string, AllowedType> = {
  "image/jpg": "image/jpeg", "image/pjpeg": "image/jpeg", "audio/mp3": "audio/mpeg", "audio/x-mp3": "audio/mpeg", "audio/mpeg3": "audio/mpeg",
  "audio/m4a": "audio/mp4", "video/mp4": "audio/mp4", "audio/x-aac": "audio/aac", "audio/vnd.wave": "audio/wav", "audio/wave": "audio/wav",
  "audio/x-flac": "audio/flac", "video/webm": "audio/webm", "application/ogg": "audio/ogg", "text/x-markdown": "text/markdown",
  "application/csv": "text/csv", "text/comma-separated-values": "text/csv", "application/x-pdf": "application/pdf",
};

/** Normalizes browser MIME (may be empty/alias) to an allowed type, or null to reject. */
export function normalizeType(file: File): AllowedType | null {
  const t = (file.type || "").toLowerCase().split(";")[0].trim();
  if (ALLOWED.includes(t)) return t as AllowedType;
  if (ALIAS[t]) return ALIAS[t];
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if ((!t || t === "application/octet-stream" || t.startsWith("text/") || t.startsWith("audio/") || t.startsWith("video/")) && EXT[ext]) return EXT[ext];
  return null;
}

export const ACCEPT = [...ALLOWED, ...Object.keys(EXT).map((e) => "." + e)].join(",");

const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
export const fileUrl = (customerId: string, entryId: string, fileId: string) => `${base}api/customers/${customerId}/entries/${entryId}/files/${fileId}`;
export const downloadUrl = (customerId: string, entryId: string, fileId: string) => `${fileUrl(customerId, entryId, fileId)}/download`;

export type Kind = "image" | "audio" | "pdf" | "text";
export const kindOf = (ct: string): Kind => (ct.startsWith("image/") ? "image" : ct.startsWith("audio/") ? "audio" : ct === "application/pdf" ? "pdf" : "text");
export const kindLabel: Record<Kind, string> = { image: "Imagem", audio: "Áudio", pdf: "PDF", text: "Texto" };

export const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

export const CATEGORY: Record<CustomerEntryInput["category"], string> = { sac: "SAC", update: "Atualizações", document: "Documentos", finance: "Financeiro", other: "Outros" };
export const STATUS: Record<CustomerEntryInput["status"], string> = { open: "Aberto", in_progress: "Em andamento", resolved: "Resolvido", archived: "Arquivado" };
export const STATUS_TONE: Record<CustomerEntryInput["status"], Tone> = { open: "blue", in_progress: "amber", resolved: "green", archived: "neutral" };
export const PRIORITY: Record<CustomerEntryInput["priority"], string> = { low: "Baixa", medium: "Média", high: "Alta" };
export const PRIORITY_TONE: Record<CustomerEntryInput["priority"], Tone> = { low: "neutral", medium: "amber", high: "red" };

export type UploadItem = { key: string; file: File; type: AllowedType | null; state: "uploading" | "done" | "error"; error?: string; attachment?: CustomerAttachment };
export type { CustomerAttachment };
