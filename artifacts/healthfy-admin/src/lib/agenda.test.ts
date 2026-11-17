import assert from "node:assert/strict";
import { test } from "node:test";
import type { ModuleRecord } from "@workspace/api-client-react";
import {
  dayKey, emptyFilters, eventsOnDay, filterAppointments, getCalendarDays,
  normalizeMeta, overlapsDay, overlapsRange, peopleOf, shiftCursor, visibleRange,
} from "./agenda";

const at = (year: number, month: number, day: number, hour = 0, minute = 0) =>
  new Date(year, month - 1, day, hour, minute);
const record = (patch: Partial<ModuleRecord> = {}): ModuleRecord => ({
  id: "event-1", kind: "appointments", createdAt: "2026-11-01T12:00:00Z",
  title: "Revisão da proposta", description: "Planejamento comercial",
  responsible: "Ana", customerId: "client-1", status: "Confirmado",
  date: at(2026, 11, 17, 10).toISOString(), endDate: at(2026, 11, 17, 11).toISOString(),
  priority: "high", value: 0, tags: ["Proposta", "Cliente"],
  metadata: { channel: "Meet", participants: [{ id: "person-1", name: "Beatriz" }] },
  ...patch,
});

test("month navigation clamps short months and leap years", () => {
  assert.equal(dayKey(shiftCursor(at(2026, 1, 31), "month", 1)), "2026-02-28");
  assert.equal(dayKey(shiftCursor(at(2028, 1, 31), "month", 1)), "2028-02-29");
  assert.equal(dayKey(shiftCursor(at(2026, 3, 31), "month", -1)), "2026-02-28");
  assert.equal(dayKey(shiftCursor(at(2026, 12, 31), "month", 1)), "2027-01-31");
});

test("week and month grids start Monday and use complete local days", () => {
  const month = getCalendarDays(at(2026, 11, 17), "month");
  const week = getCalendarDays(at(2026, 11, 17), "week");
  assert.equal(month.length, 42);
  assert.equal(month[0].getDay(), 1);
  assert.equal(week.length, 7);
  assert.equal(dayKey(week[0]), "2026-11-16");
  assert.equal(getCalendarDays(at(2026, 11, 17), "day").length, 1);
  const range = visibleRange(week);
  assert.equal(dayKey(range.from), "2026-11-16");
  assert.equal(dayKey(range.to), "2026-11-23");
  assert.equal(dayKey(shiftCursor(at(2026, 11, 17), "week", 1)), "2026-11-24");
});

test("overnight appointments appear on every overlapping day", () => {
  const overnight = record({
    date: at(2026, 11, 17, 23).toISOString(),
    endDate: at(2026, 11, 18, 1).toISOString(),
  });
  assert.equal(overlapsDay(overnight, at(2026, 11, 17)), true);
  assert.equal(overlapsDay(overnight, at(2026, 11, 18)), true);
  assert.equal(overlapsDay(overnight, at(2026, 11, 19)), false);
  const midnight = { ...overnight, endDate: at(2026, 11, 18).toISOString() };
  assert.equal(overlapsDay(midnight, at(2026, 11, 18)), false);
  assert.equal(overlapsRange(midnight, at(2026, 11, 17), at(2026, 11, 18)), true);
});

test("invalid dates do not render and point events remain discoverable", () => {
  assert.equal(overlapsDay(record({ date: "invalid" }), at(2026, 11, 17)), false);
  assert.equal(overlapsDay(record({ endDate: "" }), at(2026, 11, 17)), true);
  const early = record({ id: "early", date: at(2026, 11, 17, 8).toISOString() });
  assert.equal(eventsOnDay([record(), early], at(2026, 11, 17))[0].id, "early");
});

test("all filters combine while accepting responsible and participant names", () => {
  const first = record();
  const second = record({
    id: "event-2", responsible: "Carlos", customerId: "client-2", priority: "low",
    title: "Encontro interno", description: "", status: "Agendado", tags: ["Interno"],
    metadata: { channel: "Presencial", participants: [] },
  });
  const data = [first, second];
  const filter = emptyFilters();
  const customerName = (id: string) => id === "client-1" ? "Empresa Ágil" : "Outra empresa";
  assert.equal(filterAppointments(data, filter).length, 2);
  assert.deepEqual(peopleOf(first), ["Ana", "Beatriz"]);
  assert.equal(filterAppointments(data, { ...filter, people: ["Beatriz"] })[0].id, first.id);
  assert.equal(filterAppointments(data, { ...filter, q: "empresa agil" }, customerName)[0].id, first.id);
  const combined = { ...filter, people: ["Ana"], customerId: "client-1", statuses: ["Confirmado"], tags: ["Proposta"], channel: "Meet", priority: "high" };
  assert.deepEqual(filterAppointments(data, combined).map(a => a.id), [first.id]);
  assert.equal(filterAppointments(data, { ...combined, channel: "Presencial" }).length, 0);
  assert.equal(filterAppointments(data, { ...filter, tags: ["Ausente", "Proposta"] }).length, 1);
  assert.equal(filterAppointments(data, { ...filter, statuses: ["Agendado"], priority: "low" })[0].id, second.id);
  assert.equal(filterAppointments(data, { ...filter, customerId: "missing" }).length, 0);
  assert.equal(filterAppointments(data, { ...filter, q: "beatriz" })[0].id, first.id);
});

test("old or malformed metadata is safe and duplicate IDs stay unique", () => {
  assert.deepEqual(normalizeMeta(null).participants, []);
  assert.deepEqual(normalizeMeta({ participants: "invalid" }).participants, []);
  const id = "_".repeat(100);
  const meta = normalizeMeta({ channel: " Meet ", participants: [null, { id, name: "Ana" }, { id, name: "Beatriz" }] });
  assert.equal(meta.channel, "Meet");
  assert.equal(meta.participants.length, 2);
  assert.notEqual(meta.participants[0].id, meta.participants[1].id);
  assert.ok(meta.participants.every(person => person.id.length <= 100));
});
