import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useRequestUploadUrl, type UploadUrlRequestContentType } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { errMsg, initials } from "@/lib/format";

export const logoSrc = (path?: string | null) => (path ? `/api/storage${path}` : undefined);

export function CustomerLogo({ name, path, className, textClass }: { name: string; path?: string; className?: string; textClass?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [path]);
  const src = logoSrc(path);
  return (
    <div className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[hsl(40_25%_98%)] ring-1 ring-border", className)}>
      {src && !broken ? <img src={src} alt={`Logo ${name}`} className="h-full w-full object-contain p-[12%]" onError={() => setBroken(true)} /> : <span className={cn("font-semibold tracking-tight text-foreground", textClass)}>{initials(name)}</span>}
    </div>
  );
}

const TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX = 5 * 1024 * 1024;

/** Uploads to protected storage; only reports objectPath after PUT succeeded. */
export function LogoUpload({ name, value, onChange, onBusy, noun = "logo", testIdSuffix = "" }: { name: string; value?: string; onChange: (p: string) => void; onBusy: (b: boolean) => void; noun?: "logo" | "foto"; testIdSuffix?: string }) {
  const uid = useId();
  const inputId = noun === "logo" && !testIdSuffix ? "customer-logo-input" : `upload-${uid}`;
  const art = noun === "logo" ? "o" : "a";
  const req = useRequestUploadUrl();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const busyRef = useRef(onBusy);
  busyRef.current = onBusy;
  useEffect(() => busyRef.current(busy), [busy]);

  const pick = async (file?: File) => {
    if (!file || inFlight.current) return;
    setErr("");
    if (!TYPES.includes(file.type)) return setErr("Use PNG, JPEG ou WebP.");
    if (file.size > MAX) return setErr("Arquivo acima de 5 MB.");
    if (file.size === 0) return setErr("O arquivo está vazio.");
    inFlight.current = true;
    const url = URL.createObjectURL(file);
    setPreview(url);
    setBusy(true);
    try {
      const { uploadURL, objectPath } = await req.mutateAsync({ data: { name: file.name.slice(0, 250), size: file.size, contentType: file.type as UploadUrlRequestContentType } });
      const res = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!res.ok) throw new Error(`Falha no envio (${res.status}).`);
      onChange(objectPath);
    } catch (e) {
      setErr(`Não foi possível enviar ${art} ${noun}. ${errMsg(e)}`);
      setPreview(null);
    } finally {
      inFlight.current = false;
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const shown = preview ?? logoSrc(value);
  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void pick(e.dataTransfer.files?.[0]); }}
        className={cn("flex items-center gap-4 rounded-xl border border-dashed p-3 transition-colors", drag ? "border-ring bg-accent" : "border-input bg-muted/30")}
      >
        <div className={cn("relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[hsl(40_25%_98%)] ring-1 ring-border", noun === "foto" && "h-16 w-16 rounded-full")}>
          {shown ? <img src={shown} alt={`Pré-visualização d${art} ${noun}`} className={cn("h-full w-full", noun === "foto" ? "object-cover" : "object-contain p-2")} data-testid={`img-${noun}-preview${testIdSuffix}`} /> : <span className="text-xl font-semibold">{initials(name || "?")}</span>}
          {busy && <div className="absolute inset-0 flex items-center justify-center bg-card/70"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} className="sr-only" id={inputId} onChange={(e) => void pick(e.target.files?.[0])} data-testid={`input-${noun}${testIdSuffix}`} />
          <label htmlFor={inputId} aria-disabled={busy} className={cn("inline-flex h-10 w-fit cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium hover:bg-muted", busy && "pointer-events-none opacity-60")}>
            <ImagePlus className="h-4 w-4" />{shown ? `Trocar ${noun}` : `Enviar ${noun}`}
          </label>
          {shown && !busy && (
            <button type="button" onClick={() => { setPreview(null); setErr(""); onChange(""); }} className="inline-flex h-9 w-fit items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-destructive hover:bg-destructive/10" data-testid={`button-remove-${noun}${testIdSuffix}`}>
              <X className="h-3.5 w-3.5" />Remover {noun}
            </button>
          )}
          <span className="font-description text-[11px] text-muted-foreground">PNG, JPEG ou WebP até 5 MB</span>
        </div>
      </div>
      {err && <p role="alert" className="mt-1.5 text-xs font-medium text-destructive" data-testid={`text-${noun}-error${testIdSuffix}`}>{err}</p>}
    </div>
  );
}
