export const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024;

/** Inspect file bytes, not just user-controlled MIME metadata. Active formats are deliberately unsupported. */
export function matchesAttachmentType(bytes: Buffer, type: string): boolean {
  const starts = (s: string) => bytes.subarray(0, s.length).toString("ascii") === s;
  const riff = starts("RIFF");
  switch (type) {
    case "application/pdf": return starts("%PDF-");
    case "image/png": return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case "image/jpeg": return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    case "image/webp": return riff && bytes.subarray(8, 12).toString() === "WEBP";
    case "image/gif": return starts("GIF87a") || starts("GIF89a");
    case "audio/mpeg": return starts("ID3") || (bytes[0] === 255 && (bytes[1]! & 0xe0) === 0xe0);
    case "audio/aac": return bytes[0] === 255 && (bytes[1]! & 0xf6) === 0xf0;
    case "audio/mp4":
    case "audio/x-m4a": return bytes.subarray(4, 8).toString() === "ftyp";
    case "audio/wav":
    case "audio/x-wav": return riff && bytes.subarray(8, 12).toString() === "WAVE";
    case "audio/ogg": return starts("OggS");
    case "audio/webm": return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    case "audio/flac": return starts("fLaC");
    case "text/plain":
    case "text/csv":
    case "text/markdown":
      if (bytes.includes(0)) return false;
      try {
        // A prefix can end in a partial UTF-8 sequence. Streaming validates complete sequences only.
        new TextDecoder("utf-8", { fatal: true }).decode(bytes, { stream: true });
        return true;
      } catch { return false; }
    default: return false;
  }
}

export function attachmentRange(header: string | undefined, size: number): { start: number; end: number } | undefined | null {
  if (!header) return undefined;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return null;
  const suffix = !match[1];
  const start = suffix ? Math.max(0, size - Number(match[2])) : Number(match[1]);
  const end = suffix || !match[2] ? size - 1 : Math.min(Number(match[2]), size - 1);
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && start < size && end >= start ? { start, end } : null;
}

export function safeAttachmentName(name: string) {
  return name.replace(/[/\\\u0000-\u001f\u007f]/g, "_").trim();
}
