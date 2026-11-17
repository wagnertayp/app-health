import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateRecord,
  useDeleteRecord,
  useListCustomers,
  useListRecords,
  useUpdateRecord,
  getListRecordsQueryKey,
  type ModuleRecord,
  type RecordInput,
  type RecordKind,
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Field } from "@/components/kit";
import { errMsg } from "@/lib/format";
import { cn } from "@/lib/utils";

export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function useRecords(kind: RecordKind) {
  return useListRecords(kind, { query: { queryKey: getListRecordsQueryKey(kind) } });
}

export function useRecordActions(kind: RecordKind) {
  const inv = useInvalidateAll();
  const { toast } = useToast();
  const create = useCreateRecord();
  const update = useUpdateRecord();
  const del = useDeleteRecord();
  return {
    pending: create.isPending || update.isPending || del.isPending,
    save: (input: RecordInput, id?: string, msg = "Registro salvo") =>
      new Promise<ModuleRecord | null>((resolve) => {
        const opts = {
          onSuccess: (r: ModuleRecord) => {
            inv();
            toast({ title: msg });
            resolve(r);
          },
          onError: (e: unknown) => {
            toast({ title: "Falha ao salvar", description: errMsg(e), variant: "destructive" });
            resolve(null);
          },
        };
        if (id) update.mutate({ kind, id, data: input }, opts);
        else create.mutate({ kind, data: input }, opts);
      }),
    remove: (id: string, onDone?: () => void) =>
      del.mutate(
        { kind, id },
        {
          onSuccess: () => {
            inv();
            toast({ title: "Registro excluído" });
            onDone?.();
          },
          onError: (e) => toast({ title: "Falha ao excluir", description: errMsg(e), variant: "destructive" }),
        },
      ),
  };
}

export function toInput(r: ModuleRecord, patch: Partial<RecordInput> = {}): RecordInput {
  return {
    title: r.title,
    status: r.status,
    description: r.description,
    responsible: r.responsible,
    customerId: r.customerId,
    value: r.value,
    date: r.date,
    endDate: r.endDate,
    priority: r.priority,
    tags: r.tags,
    metadata: r.metadata ?? {},
    ...patch,
  };
}

export type FieldDef = {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "datetime" | "select" | "customer" | "tags" | "checkbox" | "priority";
  options?: { value: string; label: string }[];
  meta?: boolean;
  required?: boolean;
  full?: boolean;
  hint?: string;
  placeholder?: string;
};

const BASE = ["title", "status", "description", "responsible", "customerId", "value", "date", "endDate", "priority", "tags"];

type Values = Record<string, unknown>;

function initial(fields: FieldDef[], record?: ModuleRecord | null, defaults: Values = {}): Values {
  const v: Values = {};
  for (const f of fields) {
    let val: unknown;
    if (record) val = f.meta ? record.metadata?.[f.name] : (record as unknown as Values)[f.name];
    if (val === undefined) val = defaults[f.name];
    if (val === undefined) val = f.type === "number" ? 0 : f.type === "checkbox" ? false : f.type === "tags" ? [] : f.type === "priority" ? "medium" : f.type === "select" ? f.options?.[0]?.value ?? "" : "";
    if (f.type === "tags") val = Array.isArray(val) ? (val as string[]).join(", ") : String(val);
    if (f.type === "datetime" && typeof val === "string" && val.length > 16) val = toLocalInput(val);
    v[f.name] = val;
  }
  return v;
}

function toLocalInput(s: string) {
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.slice(0, 16);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function RecordDialog({
  kind,
  open,
  onOpenChange,
  record,
  fields,
  defaults,
  title,
  description,
  fixed,
  onSaved,
}: {
  kind: RecordKind;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  record?: ModuleRecord | null;
  fields: FieldDef[];
  defaults?: Values;
  title: string;
  description?: string;
  fixed?: Partial<RecordInput>;
  onSaved?: (r: ModuleRecord) => void;
}) {
  const [values, setValues] = useState<Values>({});
  const [error, setError] = useState("");
  const { save, pending } = useRecordActions(kind);
  const needsCustomers = fields.some((f) => f.type === "customer");
  const customers = useListCustomers({ query: { enabled: needsCustomers && open, queryKey: ["/api/customers"] } });

  useEffect(() => {
    if (open) {
      setValues(initial(fields, record, defaults));
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record?.id]);

  const set = (k: string, v: unknown) => setValues((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    for (const f of fields) {
      if (f.required && !String(values[f.name] ?? "").trim()) {
        setError(`Preencha o campo "${f.label}".`);
        return;
      }
    }
    const base: RecordInput = record
      ? toInput(record)
      : { title: "", status: "", description: "", responsible: "", customerId: "", value: 0, date: "", endDate: "", priority: "medium", tags: [], metadata: {} };
    const out: Values = { ...base, metadata: { ...(base.metadata ?? {}) } };
    for (const f of fields) {
      let v = values[f.name];
      if (f.type === "number") v = Number(v) || 0;
      if (f.type === "tags") v = String(v).split(",").map((t) => t.trim()).filter(Boolean);
      if (f.meta || !BASE.includes(f.name)) (out.metadata as Values)[f.name] = v;
      else out[f.name] = v;
    }
    Object.assign(out, fixed ?? {});
    const input = out as unknown as RecordInput;
    if (!input.title.trim()) {
      setError("Informe um título.");
      return;
    }
    const r = await save(input, record?.id, record ? "Alterações salvas" : "Registro criado");
    if (r) {
      onOpenChange(false);
      onSaved?.(r);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid={`form-${kind}`}>
          {fields.map((f) => (
            <Field key={f.name} label={f.label + (f.required ? " *" : "")} hint={f.hint} className={cn((f.full || f.type === "textarea") && "sm:col-span-2")}>
              {f.type === "textarea" ? (
                <textarea className="field" value={String(values[f.name] ?? "")} placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value)} data-testid={`input-${f.name}`} />
              ) : f.type === "select" || f.type === "priority" ? (
                <select className="field" value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} data-testid={`select-${f.name}`}>
                  {(f.type === "priority"
                    ? [
                        { value: "low", label: "Baixa" },
                        { value: "medium", label: "Média" },
                        { value: "high", label: "Alta" },
                      ]
                    : f.options ?? []
                  ).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "customer" ? (
                <select className="field" value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} data-testid={`select-${f.name}`}>
                  <option value="">Sem cliente vinculado</option>
                  {(customers.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : f.type === "checkbox" ? (
                <span className="flex h-9 items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--chart-1))]" checked={Boolean(values[f.name])} onChange={(e) => set(f.name, e.target.checked)} data-testid={`check-${f.name}`} />
                  {f.placeholder ?? "Sim"}
                </span>
              ) : (
                <input
                  className="field"
                  type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "datetime" ? "datetime-local" : "text"}
                  step={f.type === "number" ? "any" : undefined}
                  min={f.type === "number" ? 0 : undefined}
                  placeholder={f.placeholder ?? (f.type === "tags" ? "separe por vírgulas" : undefined)}
                  value={String(values[f.name] ?? "")}
                  onChange={(e) => set(f.name, e.target.value)}
                  data-testid={`input-${f.name}`}
                />
              )}
            </Field>
          ))}
          {error && <p className="text-xs font-medium text-destructive sm:col-span-2">{error}</p>}
          <DialogFooter className="sm:col-span-2 mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
              Cancelar
            </Button>
            <Button type="submit" disabled={pending} data-testid="button-save">
              {pending ? "Salvando..." : record ? "Salvar alterações" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export const priorityLabel: Record<string, string> = { low: "Baixa", medium: "Média", high: "Alta" };
export const priorityTone = { low: "neutral", medium: "blue", high: "red" } as const;
