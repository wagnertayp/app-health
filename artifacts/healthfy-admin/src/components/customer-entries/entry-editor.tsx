import { useEffect, useState } from "react";
import { useCreateCustomerEntry, useUpdateCustomerEntry, type CustomerEntry, type CustomerEntryInput } from "@workspace/api-client-react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Confirm, Field } from "@/components/kit";
import { errMsg } from "@/lib/format";
import { CATEGORY, PRIORITY, STATUS, fmtSize, kindLabel, kindOf } from "./files";
import { UploadPanel, useUploads } from "./upload-list";

const blank = (category: CustomerEntryInput["category"] = "sac"): CustomerEntryInput => ({ title: "", content: "", category, status: "open", priority: "medium", responsible: "", tags: [], dueDate: "", attachmentPaths: [] });

export function EntryEditor({ customerId, open, entry, onClose, onSaved }: { customerId: string; open: boolean; entry: CustomerEntry | null; onClose: () => void; onSaved: (e: CustomerEntry) => void }) {
  const create = useCreateCustomerEntry();
  const update = useUpdateCustomerEntry();
  const u = useUploads(customerId);
  const [f, setF] = useState<CustomerEntryInput>(blank());
  const [kept, setKept] = useState<CustomerEntry["attachments"]>([]);
  const [tagText, setTagText] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [askLeave, setAskLeave] = useState(false);

  useEffect(() => {
    if (!open) return;
    u.reset(); setErr(""); setDirty(false); setSaving(false);
    if (entry) {
      const { title, content, category, status, priority, responsible, tags, dueDate, attachmentPaths } = entry;
      setF({ title, content, category, status, priority, responsible, tags, dueDate, attachmentPaths });
      setKept(entry.attachments); setTagText(tags.join(", "));
    } else { setF(blank()); setKept([]); setTagText(""); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry?.id]);

  const set = <K extends keyof CustomerEntryInput>(k: K, v: CustomerEntryInput[K]) => { setDirty(true); setF((s) => ({ ...s, [k]: v })); };
  const locked = saving || u.busy;
  const tryClose = () => { if (locked) return; if (dirty || u.items.length) setAskLeave(true); else onClose(); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) return;
    const tags = Array.from(new Set(tagText.split(",").map((t) => t.trim()).filter(Boolean)));
    if (!f.title.trim()) return setErr("Informe o título.");
    if (f.title.length > 200) return setErr("Título acima de 200 caracteres.");
    if (f.content.length > 20000) return setErr("Descrição acima de 20000 caracteres.");
    if (tags.length > 20 || tags.some((t) => t.length > 50)) return setErr("Até 20 etiquetas de no máximo 50 caracteres.");
    if (f.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(f.dueDate)) return setErr("Data de prazo inválida.");
    if (u.failed) return setErr("Há arquivos com falha. Repita o envio ou remova-os antes de salvar.");
    const paths = [...kept.map((a) => a.objectPath), ...u.done.map((a) => a.objectPath)];
    if (paths.length > 10) return setErr("Máximo de 10 anexos por registro.");
    const data: CustomerEntryInput = { ...f, title: f.title.trim(), tags, attachmentPaths: paths };
    setErr(""); setSaving(true);
    try {
      const saved = entry ? await update.mutateAsync({ customerId, entryId: entry.id, data }) : await create.mutateAsync({ customerId, data });
      setSaving(false); onSaved(saved); onClose();
    } catch (x) { setErr(`Não foi possível salvar. ${errMsg(x)}`); setSaving(false); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && tryClose()}>
        <DialogContent className="customer-entry-editor max-h-[94dvh] overflow-y-auto sm:max-w-2xl" onEscapeKeyDown={(e) => { if (locked) e.preventDefault(); }} onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle className="text-xl">{entry ? "Editar registro" : "Novo registro"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" data-testid="form-entry">
            <Field label="Categoria" className="sm:col-span-2">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup">
                {(Object.keys(CATEGORY) as CustomerEntryInput["category"][]).map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={f.category === c} onClick={() => set("category", c)} className={`h-12 rounded-lg border text-sm font-semibold ${f.category === c ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`} data-testid={`button-category-${c}`}>{CATEGORY[c]}</button>
                ))}
              </div>
            </Field>
            <Field label="Título *" className="sm:col-span-2"><input className="field h-12 text-base" maxLength={200} value={f.title} onChange={(e) => set("title", e.target.value)} data-testid="input-entry-title" /></Field>
            <Field label="Descrição" className="sm:col-span-2" hint={`${f.content.length}/20000`}><textarea className="field font-description min-h-32 text-base" maxLength={20000} value={f.content} onChange={(e) => set("content", e.target.value)} data-testid="input-entry-content" /></Field>
            <Field label="Situação"><select className="field h-12" value={f.status} onChange={(e) => set("status", e.target.value as CustomerEntryInput["status"])} data-testid="select-entry-status">{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Prioridade"><select className="field h-12" value={f.priority} onChange={(e) => set("priority", e.target.value as CustomerEntryInput["priority"])} data-testid="select-entry-priority">{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Responsável"><input className="field h-12" maxLength={200} value={f.responsible} onChange={(e) => set("responsible", e.target.value)} data-testid="input-entry-responsible" /></Field>
            <Field label="Prazo"><input type="date" className="field h-12" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} data-testid="input-entry-due" /></Field>
            <Field label="Etiquetas (separadas por vírgula)" className="sm:col-span-2"><input className="field h-12" value={tagText} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} onChange={(e) => { setDirty(true); setTagText(e.target.value); }} data-testid="input-entry-tags" /></Field>
            <div className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-foreground/80">Anexos</span>
              {kept.length > 0 && (
                <ul className="mb-3 space-y-2">
                  {kept.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2" data-testid={`kept-attachment-${a.id}`}>
                      <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{a.name}</div><div className="font-description text-xs text-muted-foreground">{kindLabel[kindOf(a.contentType)]} · {fmtSize(a.size)}</div></div>
                      <button type="button" disabled={locked} onClick={() => { setDirty(true); setKept((s) => s.filter((x) => x.id !== a.id)); }} aria-label={`Remover ${a.name}`} className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-destructive/10 hover:text-destructive" data-testid={`button-remove-kept-${a.id}`}><X className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
              )}
              <UploadPanel u={u} existing={kept.length} disabled={saving} />
            </div>
            {err && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive sm:col-span-2" data-testid="text-entry-error">{err}</p>}
            <DialogFooter className="gap-2 sm:col-span-2">
              <Button type="button" variant="outline" className="h-12 px-6 text-base" disabled={locked} onClick={tryClose} data-testid="button-cancel-entry">Cancelar</Button>
              <Button type="submit" className="h-12 px-6 text-base" disabled={locked || u.failed} data-testid="button-save-entry">{u.busy ? "Enviando arquivos..." : saving ? "Salvando..." : "Salvar registro"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Confirm open={askLeave} onOpenChange={setAskLeave} title="Descartar alterações?" body="As alterações e os anexos adicionados neste registro não serão salvos." confirmLabel="Descartar" destructive onConfirm={() => { setAskLeave(false); onClose(); }} />
    </>
  );
}
