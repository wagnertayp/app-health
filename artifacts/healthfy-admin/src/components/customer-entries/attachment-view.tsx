import { useState } from "react";
import { Download, ExternalLink, FileText, Image as ImageIcon, Music, FileType2 } from "lucide-react";
import { downloadUrl, fileUrl, fmtSize, kindLabel, kindOf, type CustomerAttachment } from "./files";

const ICON = { image: ImageIcon, audio: Music, pdf: FileType2, text: FileText };
const btn = "inline-flex h-11 items-center gap-2 rounded-lg border bg-card px-4 text-sm font-medium hover:bg-muted";

function TextPreview({ url }: { url: string }) {
  const [state, setState] = useState<{ s: "idle" | "loading" | "ok" | "err"; text?: string; err?: string }>({ s: "idle" });
  const load = async () => {
    setState({ s: "loading" });
    try {
      const r = await fetch(url, { credentials: "include", headers: { Range: "bytes=0-100000" } });
      if (!r.ok) throw new Error(`Erro ${r.status}`);
      const t = await r.text();
      setState({ s: "ok", text: t.length > 100000 ? t.slice(0, 100000) + "\n[...]" : t });
    } catch (e) { setState({ s: "err", err: e instanceof Error ? e.message : "Falha" }); }
  };
  if (state.s === "ok") return <pre className="font-description mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-3 text-xs" data-testid="text-attachment-preview">{state.text}</pre>;
  return (
    <div className="mt-3 flex items-center gap-3">
      <button type="button" className={btn} onClick={load} disabled={state.s === "loading"} data-testid="button-preview-text">{state.s === "loading" ? "Carregando..." : state.s === "err" ? "Tentar novamente" : "Ver texto"}</button>
      {state.s === "err" && <span role="alert" className="text-xs text-destructive">{state.err}</span>}
    </div>
  );
}

export function AttachmentView({ customerId, entryId, a }: { customerId: string; entryId: string; a: CustomerAttachment }) {
  const k = kindOf(a.contentType);
  const Icon = ICON[k];
  const url = fileUrl(customerId, entryId, a.id);
  return (
    <div className="rounded-xl border bg-card p-3" data-testid={`attachment-${a.id}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold" title={a.name}>{a.name}</div>
          <div className="font-description text-xs text-muted-foreground">{kindLabel[k]} · {fmtSize(a.size)}</div>
        </div>
      </div>
      {k === "image" && <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={a.name} loading="lazy" className="mt-3 max-h-72 w-full rounded-lg bg-muted/40 object-contain" data-testid={`img-attachment-${a.id}`} /></a>}
      {k === "audio" && <audio controls preload="metadata" src={url} className="mt-3 w-full" data-testid={`audio-attachment-${a.id}`} />}
      {k === "text" && <TextPreview url={url} />}
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={url} target="_blank" rel="noopener noreferrer" className={btn} data-testid={`link-open-${a.id}`}><ExternalLink className="h-4 w-4" />{k === "pdf" ? "Abrir PDF" : "Abrir"}</a>
        <a href={downloadUrl(customerId, entryId, a.id)} download={a.name} className={btn} data-testid={`link-download-${a.id}`}><Download className="h-4 w-4" />Baixar</a>
      </div>
    </div>
  );
}
