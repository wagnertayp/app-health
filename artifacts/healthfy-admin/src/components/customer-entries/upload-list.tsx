import { useRef, useState } from "react";
import { useRequestCustomerAttachmentUpload } from "@workspace/api-client-react";
import { CheckCircle2, Loader2, Paperclip, RotateCw, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { errMsg } from "@/lib/format";
import { ACCEPT, MAX_FILES, MAX_SIZE, fmtSize, normalizeType, type CustomerAttachment, type UploadItem } from "./files";

/** Manages file uploads; keeps failed items for retry/remove. */
export function useUploads(customerId: string) {
  const req = useRequestCustomerAttachmentUpload();
  const reqRef = useRef(req.mutateAsync);
  reqRef.current = req.mutateAsync;
  const [items, setItems] = useState<UploadItem[]>([]);
  const patch = (key: string, p: Partial<UploadItem>) => setItems((s) => s.map((i) => (i.key === key ? { ...i, ...p } : i)));
  const run = async (it: UploadItem) => {
    if (!it.type) return;
    patch(it.key, { state: "uploading", error: undefined });
    try {
      const { uploadURL, attachment } = await reqRef.current({ customerId, data: { name: it.file.name.slice(0, 200), size: it.file.size, contentType: it.type } });
      const r = await fetch(uploadURL, { method: "PUT", body: it.file, headers: { "Content-Type": it.type } });
      if (!r.ok) throw new Error(`Falha no envio (${r.status}).`);
      patch(it.key, { state: "done", attachment });
    } catch (e) { patch(it.key, { state: "error", error: errMsg(e) }); }
  };
  const add = (files: File[], existing: number) => {
    const room = MAX_FILES - existing - items.length;
    const next: UploadItem[] = files.slice(0, Math.max(0, room)).map((file) => {
      const type = normalizeType(file);
      const error = !type ? "Formato não permitido." : file.size === 0 ? "Arquivo vazio." : file.size > MAX_SIZE ? "Acima de 50 MB." : undefined;
      return { key: `${Date.now()}-${Math.random()}`, file, type: error ? null : type, state: error ? "error" : "uploading", error };
    });
    setItems((s) => [...s, ...next]);
    next.forEach((n) => n.type && void run(n));
    return files.length > next.length;
  };
  return {
    items, add, reset: () => setItems([]),
    retry: (key: string) => { const it = items.find((i) => i.key === key); if (it) void run(it); },
    remove: (key: string) => setItems((s) => s.filter((i) => i.key !== key)),
    busy: items.some((i) => i.state === "uploading"),
    failed: items.some((i) => i.state === "error"),
    done: items.filter((i) => i.state === "done" && i.attachment).map((i) => i.attachment as CustomerAttachment),
  };
}

export function UploadPanel({ u, existing, disabled }: { u: ReturnType<typeof useUploads>; existing: number; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [note, setNote] = useState("");
  const full = existing + u.items.length >= MAX_FILES;
  const pick = (fl: FileList | null) => { if (!fl) return; setNote(u.add(Array.from(fl), existing) ? `Limite de ${MAX_FILES} anexos por registro.` : ""); if (input.current) input.current.value = ""; };
  return (
    <div>
      <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); if (!disabled && !full) pick(e.dataTransfer.files); }}
        className={cn("flex flex-col items-start gap-2 rounded-xl border border-dashed p-4 sm:flex-row sm:items-center", drag ? "border-ring bg-accent" : "bg-muted/30")}>
        <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" id="entry-file-input" disabled={disabled || full} onChange={(e) => pick(e.target.files)} data-testid="input-entry-files" />
        <label htmlFor="entry-file-input" aria-disabled={disabled || full} className={cn("inline-flex h-12 cursor-pointer items-center gap-2 rounded-lg border bg-card px-5 text-base font-medium hover:bg-muted", (disabled || full) && "pointer-events-none opacity-50")} data-testid="button-add-files">
          <Paperclip className="h-5 w-5" />Adicionar arquivos
        </label>
        <span className="font-description text-xs text-muted-foreground">PDF, imagens, áudio, TXT, CSV ou Markdown. Até {MAX_FILES} arquivos de 50 MB.</span>
      </div>
      {note && <p className="mt-2 text-xs text-destructive" role="alert">{note}</p>}
      {u.items.length > 0 && (
        <ul className="mt-3 space-y-2" aria-live="polite">
          {u.items.map((i) => (
            <li key={i.key} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2" data-testid={`upload-item-${i.state}`}>
              {i.state === "uploading" ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" /> : i.state === "done" ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[hsl(160_60%_30%)]" /> : <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{i.file.name}</div>
                <div className={cn("font-description text-xs", i.state === "error" ? "text-destructive" : "text-muted-foreground")}>{i.state === "uploading" ? "Enviando..." : i.state === "done" ? `Enviado · ${fmtSize(i.file.size)}` : i.error}</div>
              </div>
              {i.state === "error" && i.type && <button type="button" onClick={() => u.retry(i.key)} className="inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm hover:bg-muted" data-testid="button-retry-upload"><RotateCw className="h-4 w-4" />Repetir</button>}
              {i.state !== "uploading" && <button type="button" onClick={() => u.remove(i.key)} aria-label={`Remover ${i.file.name}`} className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-destructive/10 hover:text-destructive" data-testid="button-remove-upload"><X className="h-4 w-4" /></button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
