import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Field, Notice, PageHeader, Panel } from "@/components/kit";
import { DEFAULT_TERMS, getPrefs, setPrefs, usePageMeta } from "@/lib/format";

export default function Configuracoes() {
  usePageMeta("Configurações", "Preferências locais do workspace Healthfy.");
  const [p, setP] = useState(getPrefs);
  const { toast } = useToast();
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Configurações" subtitle="Preferências salvas apenas neste navegador." />
      <Notice icon={ShieldAlert} title="Workspace em pré-visualização">Não há autenticação configurada. Este painel não deve ser exposto publicamente até que o acesso seja protegido.</Notice>
      <Panel title="Preferências">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setPrefs(p); toast({ title: "Preferências salvas" }); }}>
          <Field label="Seu nome (saudação do dashboard)"><input className="field" value={p.ownerName} onChange={(e) => setP({ ...p, ownerName: e.target.value })} data-testid="input-owner" /></Field>
          <Field label="Prazo padrão de vencimento (dias)"><input type="number" min={0} className="field" value={p.dueDays} onChange={(e) => setP({ ...p, dueDays: Number(e.target.value) || 0 })} data-testid="input-due-days" /></Field>
          <Field label="Termos de pagamento padrão"><textarea className="field" rows={3} value={p.defaultTerms} onChange={(e) => setP({ ...p, defaultTerms: e.target.value })} data-testid="input-terms" /></Field>
          <Field label="Observações padrão da invoice"><textarea className="field" value={p.defaultNotes} onChange={(e) => setP({ ...p, defaultNotes: e.target.value })} data-testid="input-notes" /></Field>
          <div className="flex gap-2"><Button type="submit" data-testid="button-save">Salvar</Button><Button type="button" variant="outline" onClick={() => setP({ ...p, defaultTerms: DEFAULT_TERMS })} data-testid="button-reset-terms">Restaurar termos do contrato</Button></div>
        </form>
      </Panel>
    </div>
  );
}
