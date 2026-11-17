import { useEffect } from "react";

export const brl = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);

export const num = (n: number | null | undefined, d = 1) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: d }).format(Number(n) || 0);

function parse(s: string) {
  return s.length === 10 ? new Date(s + "T12:00:00") : new Date(s);
}

export function fmtDate(s?: string | null) {
  if (!s) return "—";
  const d = parse(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(s?: string | null) {
  if (!s) return "—";
  const d = parse(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function fmtTime(s?: string | null) {
  if (!s) return "";
  const d = parse(s);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function localISO(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localISO(d);
}

export function relative(s: string) {
  const diff = Date.now() - new Date(s).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `há ${d} d`;
  return fmtDate(s);
}

export function errMsg(e: unknown) {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Erro inesperado. Tente novamente.";
}

export function isOverdue(inv: { status: string; dueDate: string }) {
  return inv.status === "pending" && inv.dueDate < localISO();
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}

export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    document.title = `${title} · Healthfy Admin`;
    let m = document.querySelector('meta[name="description"]');
    if (!m) {
      m = document.createElement("meta");
      m.setAttribute("name", "description");
      document.head.appendChild(m);
    }
    m.setAttribute("content", description);
  }, [title, description]);
}

const PREF_KEY = "healthfy.prefs";
export type Prefs = { ownerName: string; dueDays: number; defaultTerms: string; defaultNotes: string };
export const DEFAULT_TERMS =
  "Pagamento em duas parcelas: R$ 1.000,00 de entrada na assinatura e R$ 1.000,00 na conclusão da entrega. Valores ajustáveis conforme acordo entre as partes.";
export function getPrefs(): Prefs {
  const base: Prefs = { ownerName: "", dueDays: 7, defaultTerms: DEFAULT_TERMS, defaultNotes: "" };
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(PREF_KEY) || "{}") };
  } catch {
    return base;
  }
}
export function setPrefs(p: Prefs) {
  localStorage.setItem(PREF_KEY, JSON.stringify(p));
}
