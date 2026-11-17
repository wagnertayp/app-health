import type { ModuleRecord } from "@workspace/api-client-react";

export type CalendarMode = "day" | "week" | "month";
export type Participant = { id: string; name: string; photoPath?: string };
export type AppointmentMeta = {
  channel: string;
  reminder: string;
  responsiblePhotoPath?: string;
  participants: Participant[];
};
export type AgendaFilters = {
  q: string;
  people: string[];
  customerId: string;
  statuses: string[];
  tags: string[];
  channel: string;
  priority: string;
};

export const STATUSES = ["Agendado", "Confirmado", "Realizado", "Cancelado"] as const;
export const MAX_PARTICIPANTS = 20;
export const REMINDERS = [
  { value: "none", label: "Sem lembrete" },
  { value: "15", label: "15 min antes" },
  { value: "60", label: "1 hora antes" },
  { value: "1440", label: "1 dia antes" },
];
export const emptyFilters = (): AgendaFilters => ({ q: "", people: [], customerId: "", statuses: [], tags: [], channel: "", priority: "" });

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

/** Runtime-guarded read of appointment metadata; tolerant of legacy/wrong-typed values. */
export function normalizeMeta(meta: unknown): AppointmentMeta {
  const m = isObj(meta) ? meta : {};
  const seen = new Set<string>();
  const participants: Participant[] = [];
  if (Array.isArray(m.participants)) {
    m.participants.forEach((p, i) => {
      if (!isObj(p)) return;
      const name = str(p.name).trim().slice(0, 200);
      if (!name) return;
      const base = str(p.id).trim().slice(0, 100) || `p${i}`;
      let id = base;
      for (let n = 2; seen.has(id); n++) { const suf = `_${n}`; id = base.slice(0, 100 - suf.length) + suf; }
      seen.add(id);
      const photo = str(p.photoPath).trim();
      participants.push(photo ? { id, name, photoPath: photo } : { id, name });
    });
  }
  const rp = str(m.responsiblePhotoPath).trim();
  return { channel: str(m.channel).trim(), reminder: str(m.reminder) || "none", ...(rp ? { responsiblePhotoPath: rp } : {}), participants: participants.slice(0, MAX_PARTICIPANTS) };
}

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const sameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b);
export const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

/** Moves the cursor by one period; months clamp the day (Jan 31 + 1 month = Feb 28/29). */
export function shiftCursor(cursor: Date, mode: CalendarMode, dir: number): Date {
  if (mode === "day") return addDays(cursor, dir);
  if (mode === "week") return addDays(cursor, 7 * dir);
  const total = cursor.getFullYear() * 12 + cursor.getMonth() + dir;
  const y = Math.floor(total / 12), m = total - y * 12;
  return new Date(y, m, Math.min(cursor.getDate(), daysInMonth(y, m)));
}

/** Monday-first: 1 day, 7 days or 42-cell month grid. */
export function getCalendarDays(cursor: Date, mode: CalendarMode): Date[] {
  const d = startOfDay(cursor);
  if (mode === "day") return [d];
  if (mode === "week") {
    const s = addDays(d, -((d.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => addDays(s, i));
  }
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const s = addDays(first, -((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => addDays(s, i));
}

export function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Interval of an appointment; missing/invalid end is treated as a point in time. */
export function apptInterval(a: Pick<ModuleRecord, "date" | "endDate">): { start: Date; end: Date } | null {
  const start = parseDate(a.date);
  if (!start) return null;
  const e = parseDate(a.endDate);
  return { start, end: e && e > start ? e : start };
}

/** Half-open overlap: [start,end) vs [from,to). Point events match if inside. */
export function overlapsRange(a: Pick<ModuleRecord, "date" | "endDate">, from: Date, to: Date): boolean {
  const iv = apptInterval(a);
  if (!iv) return false;
  if (iv.end.getTime() === iv.start.getTime()) return iv.start >= from && iv.start < to;
  return iv.start < to && iv.end > from;
}

export const overlapsDay = (a: Pick<ModuleRecord, "date" | "endDate">, day: Date) => overlapsRange(a, startOfDay(day), addDays(day, 1));

export function eventsOnDay<T extends Pick<ModuleRecord, "date" | "endDate">>(list: T[], day: Date): T[] {
  return list.filter((a) => overlapsDay(a, day)).sort((x, y) => (parseDate(x.date)?.getTime() ?? 0) - (parseDate(y.date)?.getTime() ?? 0));
}

export function visibleRange(days: Date[]) {
  return { from: startOfDay(days[0]), to: addDays(days[days.length - 1], 1) };
}

export const peopleOf = (a: ModuleRecord) => {
  const out = [a.responsible?.trim()].filter(Boolean) as string[];
  for (const p of normalizeMeta(a.metadata).participants) if (!out.includes(p.name)) out.push(p.name);
  return out;
};

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** AND across dimensions; OR inside multi-selects (people, statuses, tags). */
export function filterAppointments(list: ModuleRecord[], f: AgendaFilters, customerName: (id: string) => string | undefined = () => undefined): ModuleRecord[] {
  const q = fold(f.q.trim());
  return list.filter((a) => {
    const meta = normalizeMeta(a.metadata);
    const tags = Array.isArray(a.tags) ? a.tags : [];
    if (f.people.length && !peopleOf(a).some((p) => f.people.includes(p))) return false;
    if (f.customerId && a.customerId !== f.customerId) return false;
    if (f.statuses.length && !f.statuses.includes(a.status)) return false;
    if (f.tags.length && !tags.some((t) => f.tags.includes(t))) return false;
    if (f.channel && meta.channel !== f.channel) return false;
    if (f.priority && a.priority !== f.priority) return false;
    if (q) {
      const hay = fold([a.title, a.responsible, ...meta.participants.map((p) => p.name), a.customerId ? customerName(a.customerId) ?? "" : "", ...tags, meta.channel, a.description].join(" "));
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function activeFilterCount(f: AgendaFilters) {
  return (f.q.trim() ? 1 : 0) + f.people.length + (f.customerId ? 1 : 0) + f.statuses.length + f.tags.length + (f.channel ? 1 : 0) + (f.priority ? 1 : 0);
}

export function deriveOptions(list: ModuleRecord[]) {
  const people = new Set<string>(), tags = new Set<string>(), channels = new Set<string>(), statuses = new Set<string>(STATUSES);
  for (const a of list) {
    peopleOf(a).forEach((p) => people.add(p));
    (Array.isArray(a.tags) ? a.tags : []).forEach((t) => t && tags.add(t));
    const c = normalizeMeta(a.metadata).channel;
    if (c) channels.add(c);
    if (a.status) statuses.add(a.status);
  }
  const s = (x: Set<string>) => [...x].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return { people: s(people), tags: s(tags), channels: s(channels), statuses: [...statuses] };
}

const p2 = (n: number) => String(n).padStart(2, "0");
export const toLocalInput = (d: Date) => `${dayKey(d)}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
export const toLocalInputFromString = (s: string) => {
  const d = parseDate(s);
  return d ? toLocalInput(d) : s.slice(0, 16);
};

/** Default slot for a new event: on given day at next full hour (or 9:00 if not today). */
export function defaultSlot(day?: Date) {
  const now = new Date();
  let start: Date;
  if (!day || sameDay(day, now)) { start = new Date(now); start.setMinutes(0, 0, 0); start.setHours(start.getHours() + 1); }
  else start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0);
  return { start, end: new Date(start.getTime() + 60 * 60 * 1000) };
}

const TAG_HUES = [158, 12, 222, 38, 262, 192, 330, 88];
export function tagHue(tag: string) {
  let h = 0;
  for (const c of tag) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TAG_HUES[h % TAG_HUES.length];
}

export const fmtHM = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
/** Time label relative to a given day (shows continuation for multi-day events). */
export function timeLabel(a: Pick<ModuleRecord, "date" | "endDate">, day?: Date) {
  const iv = apptInterval(a);
  if (!iv) return "Sem horário";
  const { start, end } = iv;
  if (sameDay(start, end) || end.getTime() === start.getTime()) return end > start ? `${fmtHM(start)} – ${fmtHM(end)}` : fmtHM(start);
  const sd = start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const ed = end.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  if (day && !sameDay(day, start) && !sameDay(day, end)) return `Dia inteiro (${sd} – ${ed})`;
  return `${sd} ${fmtHM(start)} – ${ed} ${fmtHM(end)}`;
}
