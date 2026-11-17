import type { Tone } from "@/components/kit";
import { isOverdue } from "@/lib/format";

export const invoiceStatusLabel: Record<string, string> = {
  draft: "Rascunho",
  pending: "Pendente",
  paid: "Paga (manual)",
  cancelled: "Cancelada",
  overdue: "Vencida",
};
export const invoiceStatusTone: Record<string, Tone> = {
  draft: "neutral",
  pending: "amber",
  paid: "green",
  cancelled: "red",
  overdue: "red",
};
export function invoiceKey(inv: { status: string; dueDate: string }) {
  return isOverdue(inv) ? "overdue" : inv.status;
}
export const productTypeLabel: Record<string, string> = { hours: "Pacote de horas", service: "Serviço", digital: "Digital" };
export const customerStatusLabel: Record<string, string> = { active: "Ativo", inactive: "Inativo", prospect: "Prospecto" };
export const customerStatusTone: Record<string, Tone> = { active: "green", inactive: "neutral", prospect: "blue" };
