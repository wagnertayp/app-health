import { Ban, Pencil, Trash2 } from "lucide-react";
import type { Customer, ModuleRecord } from "@workspace/api-client-react";
import { CustomerLogo } from "@/components/customer-logo";
import { normalizeMeta, timeLabel } from "@/lib/agenda";
import { priorityLabel } from "@/components/records";
import { cn } from "@/lib/utils";
import { PersonAvatar, StatusChip, TagChip, statusStyle } from "./person";

export type CardActions = { onEdit: (a: ModuleRecord) => void; onCancel: (a: ModuleRecord) => void; onDelete: (a: ModuleRecord) => void };

export function EventCard({ a, day, customer, actions, density = "full" }: { a: ModuleRecord; day?: Date; customer?: Customer; actions: CardActions; density?: "full" | "compact" }) {
  const meta = normalizeMeta(a.metadata);
  const cancelled = a.status === "Cancelado";
  const compact = density === "compact";
  const people = [
    ...(a.responsible ? [{ id: "__resp", name: a.responsible, photoPath: meta.responsiblePhotoPath, lead: true }] : []),
    ...meta.participants.map((p) => ({ ...p, lead: false })),
  ];
  const shown = people;
  const tags = Array.isArray(a.tags) ? a.tags : [];
  return (
    <article
      data-testid={`appt-${a.id}`}
      className={cn("group relative overflow-hidden rounded-lg border bg-card pl-3 pr-2 py-2 text-left shadow-[0_1px_2px_hsl(222_30%_20%/0.06)] transition-shadow hover:shadow-[0_4px_14px_-6px_hsl(222_30%_20%/0.25)]", cancelled && "opacity-70")}
    >
      <span className="absolute inset-y-0 left-0 w-[4px]" style={{ background: statusStyle(a.status).bar }} />
      <div className="flex items-start justify-between gap-2">
        <span className="num text-[12px] font-semibold text-foreground/75" data-testid={`text-time-${a.id}`}>{timeLabel(a, day)}</span>
        <StatusChip status={a.status} small />
      </div>
      <button type="button" onClick={() => actions.onEdit(a)} className={cn("mt-0.5 block w-full text-left text-[14px] font-semibold leading-snug hover:underline", compact ? "line-clamp-2" : "", cancelled && "line-through")} data-testid={`text-title-${a.id}`}>
        {a.title}
      </button>
      {customer && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-foreground/80">
          <CustomerLogo name={customer.name} path={customer.logoPath} className="h-5 w-5 rounded-md" textClass="text-[8px]" />
          <span className="truncate">{customer.name}</span>
        </div>
      )}
      {shown.length > 0 && (
        <ul className={cn("mt-2", compact ? "flex flex-wrap gap-x-2 gap-y-1" : "space-y-1")}>
          {shown.map((p) => (
            <li key={p.id} className="flex min-w-0 items-center gap-1.5 text-[12px]">
              <PersonAvatar name={p.name} photoPath={p.photoPath} size={compact ? 20 : 24} className={p.lead ? "ring-2 ring-[hsl(var(--chart-1))]/50" : undefined} />
              <span className={cn("min-w-0 break-words", p.lead && "font-semibold")}>{p.name}</span>
            </li>
          ))}
        </ul>
      )}
      {(tags.length > 0 || (!compact && (meta.channel || a.priority === "high"))) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {a.priority === "high" && <span className="rounded-md border border-[hsl(4_60%_86%)] bg-[hsl(4_80%_95%)] px-1.5 py-px text-[10.5px] font-semibold text-[hsl(2_60%_40%)]">Prioridade {priorityLabel.high}</span>}
          {!compact && meta.channel && <span className="rounded-md border bg-muted px-1.5 py-px text-[10.5px] font-medium">{meta.channel}</span>}
          {tags.map((t) => <TagChip key={t} tag={t} small />)}
        </div>
      )}
      <div className="mt-2 flex gap-1 border-t border-dashed pt-1.5">
        <button type="button" onClick={() => actions.onEdit(a)} className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-foreground/70 hover:bg-muted hover:text-foreground" data-testid={`edit-${a.id}`}><Pencil className="h-3 w-3" />Editar</button>
        {!cancelled && <button type="button" onClick={() => actions.onCancel(a)} className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-foreground/70 hover:bg-muted hover:text-foreground" data-testid={`cancel-${a.id}`}><Ban className="h-3 w-3" />Cancelar</button>}
        <button type="button" onClick={() => actions.onDelete(a)} aria-label="Excluir" className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-destructive hover:bg-destructive/10" data-testid={`delete-${a.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </article>
  );
}
