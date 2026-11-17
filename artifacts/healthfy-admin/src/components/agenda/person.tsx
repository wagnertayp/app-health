import { useEffect, useState } from "react";
import { logoSrc } from "@/components/customer-logo";
import { initials } from "@/lib/format";
import { tagHue } from "@/lib/agenda";
import { cn } from "@/lib/utils";

export function PersonAvatar({ name, photoPath, size = 26, ring, className }: { name: string; photoPath?: string; size?: number; ring?: boolean; className?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [photoPath]);
  const src = logoSrc(photoPath);
  const hue = tagHue(name);
  return (
    <span
      title={name}
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold", ring && "ring-2 ring-card", className)}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.38), background: `hsl(${hue} 45% 90%)`, color: `hsl(${hue} 50% 26%)` }}
    >
      {src && !broken ? <img src={src} alt={name} className="h-full w-full object-cover" onError={() => setBroken(true)} /> : initials(name)}
    </span>
  );
}

export function TagChip({ tag, small }: { tag: string; small?: boolean }) {
  const h = tagHue(tag);
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1 rounded-md border font-medium", small ? "px-1.5 py-px text-[10.5px]" : "px-2 py-0.5 text-xs")} style={{ background: `hsl(${h} 60% 95%)`, borderColor: `hsl(${h} 40% 82%)`, color: `hsl(${h} 50% 28%)` }}>
      <span className="h-1.5 w-1.5 shrink-0 rotate-45" style={{ background: `hsl(${h} 50% 45%)` }} />
      <span className="truncate">{tag}</span>
    </span>
  );
}

export const STATUS_STYLE: Record<string, { bar: string; chip: string }> = {
  Agendado: { bar: "hsl(38 88% 52%)", chip: "bg-[hsl(42_90%_93%)] text-[hsl(30_70%_30%)] border-[hsl(40_70%_80%)]" },
  Confirmado: { bar: "hsl(222 55% 48%)", chip: "bg-[hsl(218_70%_95%)] text-[hsl(222_50%_36%)] border-[hsl(218_50%_86%)]" },
  Realizado: { bar: "hsl(158 52% 36%)", chip: "bg-[hsl(158_45%_93%)] text-[hsl(160_60%_24%)] border-[hsl(158_40%_82%)]" },
  Cancelado: { bar: "hsl(2 64% 48%)", chip: "bg-[hsl(4_80%_95%)] text-[hsl(2_60%_40%)] border-[hsl(4_60%_86%)]" },
};
const FALLBACK = { bar: "hsl(220 9% 60%)", chip: "bg-muted text-foreground border-border" };
export const statusStyle = (s: string) => STATUS_STYLE[s] ?? FALLBACK;

export function StatusChip({ status, small }: { status: string; small?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border font-semibold", small ? "px-1.5 py-px text-[10.5px]" : "px-2 py-0.5 text-xs", statusStyle(status).chip)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status || "Sem status"}
    </span>
  );
}
