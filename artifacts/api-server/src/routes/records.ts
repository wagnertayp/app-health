import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  ListRecordsParams, CreateRecordBody, ListRecordsResponse, CreateRecordResponse,
  ListActivityResponse,
} from "@workspace/api-zod";
import { activity, find, insert, list, remove, replace } from "../lib/healthfy-store";
import { appointmentPhotoPaths } from "../lib/appointment-people";
import { validateOwnedLogo } from "../lib/customer-logos";

const router: IRouter = Router();
type ModuleRecord = typeof CreateRecordResponse._output;
const kinds: Record<string, string> = {
  leads: "Oportunidade", projects: "Projeto", transactions: "Transação",
  appointments: "Agendamento", agents: "Agente", tracking: "Evento", hours: "Registro de horas",
};

router.get("/records/:kind", async (req, res): Promise<void> => {
  const params = ListRecordsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Módulo inválido." }); return; }
  res.json(ListRecordsResponse.parse(await list(params.data.kind)));
});

async function save(req: Request, res: Response, editing: boolean): Promise<void> {
  const params = ListRecordsParams.safeParse(req.params);
  const body = CreateRecordBody.safeParse(req.body);
  if (!params.success || !body.success || !body.data.title.trim()) {
    res.status(400).json({ error: "Confira os dados do registro." }); return;
  }
  const { kind } = params.data;
  const input = body.data;
  if (input.customerId && !(await find("customers", input.customerId))) {
    res.status(400).json({ error: "Cliente vinculado não encontrado." }); return;
  }
  if (kind === "hours" && input.value <= 0) {
    res.status(400).json({ error: "Informe uma quantidade positiva de horas." }); return;
  }
  if (kind === "appointments" && (!input.date || !input.endDate || !Number.isFinite(Date.parse(input.date))
    || !Number.isFinite(Date.parse(input.endDate)) || Date.parse(input.endDate) <= Date.parse(input.date))) {
    res.status(400).json({ error: "Informe início e término válidos; o término deve ser posterior ao início." }); return;
  }
  if (kind === "projects" && input.date && input.endDate && input.endDate < input.date) {
    res.status(400).json({ error: "A conclusão não pode ser anterior ao início." }); return;
  }
  if (kind === "transactions" && !["income", "expense"].includes(String(input.metadata.type))) {
    res.status(400).json({ error: "Selecione receita ou despesa." }); return;
  }
  const old = editing ? await find<ModuleRecord>(kind, req.params.id) : undefined;
  if (editing && !old) { res.status(404).json({ error: "Registro não encontrado." }); return; }
  if (kind === "appointments") {
    if (!input.responsible.trim()) { res.status(400).json({ error: "Informe o responsável pelo compromisso." }); return; }
    try {
      const photoPaths = appointmentPhotoPaths(input.metadata);
      let previous: string[] = [];
      try { previous = appointmentPhotoPaths(old?.metadata ?? {}); } catch { /* Invalid legacy metadata is never trusted as an approved image. */ }
      for (const path of photoPaths) {
        if (!previous.includes(path)) await validateOwnedLogo(path, req.user!.id);
      }
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Confira as fotos e os participantes." }); return;
    }
  }
  const entity = await db.transaction(async tx => {
    const result = old ? { ...input, id: old.id, kind, createdAt: old.createdAt }
      : (await insert(kind, { ...input, kind }, tx)).entity;
    if (old) await replace(kind, old.id, result, tx);
    await activity(`${kinds[kind]} ${old ? "atualizado" : "criado"}`, input.title, kind, result.id, tx);
    return result;
  });
  res.status(editing ? 200 : 201).json(CreateRecordResponse.parse(entity));
}
router.post("/records/:kind", (req, res) => save(req, res, false));
router.put("/records/:kind/:id", (req, res) => save(req, res, true));
router.delete("/records/:kind/:id", async (req, res): Promise<void> => {
  const params = ListRecordsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Módulo inválido." }); return; }
  const old = await find<ModuleRecord>(params.data.kind, req.params.id);
  if (!old) { res.status(404).json({ error: "Registro não encontrado." }); return; }
  await db.transaction(async tx => {
    await remove(params.data.kind, old.id, tx);
    await activity(`${kinds[params.data.kind]} excluído`, old.title, params.data.kind, old.id, tx);
  });
  res.sendStatus(204);
});
router.get("/activity", async (_req, res): Promise<void> => {
  res.json(ListActivityResponse.parse((await list("activity")).slice(0, 40)));
});
export default router;
