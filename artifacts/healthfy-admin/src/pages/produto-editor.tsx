import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useCreateProduct, useDeleteProduct, useGetProduct, getGetProductQueryKey, useUpdateProduct, type ProductInput } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Confirm, ErrorState, Field, LoadingRows, PageHeader, Panel } from "@/components/kit";
import { useInvalidateAll } from "@/components/records";
import { DEFAULT_TERMS, brl, errMsg, num, usePageMeta } from "@/lib/format";

const EMPTY: ProductInput = {
  name: "", description: "", type: "hours", price: 2000, hours: 10, active: true, bannerUrl: "",
  checkoutTitle: "", checkoutDescription: "", accentColor: "#1f8a64", paymentTerms: DEFAULT_TERMS,
};

export default function ProdutoEditor() {
  const params = useParams<{ id?: string }>();
  const id = params.id && params.id !== "novo" ? params.id : "";
  const isNew = !id;
  usePageMeta(isNew ? "Novo produto" : "Editar produto", "Cadastro de produtos, serviços e pacotes de horas.");
  const q = useGetProduct(id, { query: { enabled: !!id, queryKey: getGetProductQueryKey(id) } });
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const del = useDeleteProduct();
  const inv = useInvalidateAll();
  const { toast } = useToast();
  const [, nav] = useLocation();
  const [f, setF] = useState<ProductInput>(EMPTY);
  const [err, setErr] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const init = useRef<string | null>(null);

  useEffect(() => {
    if (q.data && init.current !== q.data.id) {
      init.current = q.data.id;
      const { id: _i, createdAt: _c, ...rest } = q.data;
      void _i; void _c;
      setF(rest);
    }
  }, [q.data]);

  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) => setF((s) => ({ ...s, [k]: v }));

  function save(data: ProductInput, msg = "Produto salvo") {
    setErr("");
    if (!data.name.trim()) return setErr("Informe o nome.");
    if (!(data.price > 0)) return setErr("Preço deve ser maior que zero.");
    if (data.type === "hours" && !(data.hours > 0)) return setErr("Pacotes de horas precisam de horas > 0.");
    if (data.bannerUrl && !/^https:\/\//i.test(data.bannerUrl)) return setErr("A URL do banner deve começar com https://");
    if (!/^#[0-9a-fA-F]{6}$/.test(data.accentColor)) return setErr("Cor no formato #RRGGBB.");
    const opts = { onSuccess: (p: { id: string }) => { inv(); toast({ title: msg }); if (isNew) nav(`/produtos/${p.id}`); else setF(data); }, onError: (e: unknown) => setErr(errMsg(e)) };
    if (isNew) create.mutate({ data }, opts);
    else update.mutate({ id, data }, opts);
  }

  if (!isNew && q.isLoading) return <LoadingRows rows={6} />;
  if (!isNew && q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const pending = create.isPending || update.isPending;
  const perHour = f.type === "hours" && f.hours > 0 ? f.price / f.hours : 0;
  const bannerOk = f.bannerUrl.startsWith("https://");

  return (
    <div>
      <PageHeader
        back={{ href: "/produtos", label: "Produtos" }}
        title={isNew ? "Novo produto" : f.name || "Produto"}
        actions={!isNew && (
          <>
            <Button size="sm" variant="outline" onClick={() => save({ ...f, active: !f.active }, f.active ? "Produto arquivado" : "Produto reativado")} data-testid="button-archive">{f.active ? <><Archive className="mr-1.5 h-3.5 w-3.5" />Arquivar</> : <><ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />Reativar</>}</Button>
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => setConfirmDel(true)} data-testid="button-delete"><Trash2 className="h-3.5 w-3.5" /></Button>
          </>
        )}
      />
      <form onSubmit={(e) => { e.preventDefault(); save(f); }} className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Panel title="Produto">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome *" className="sm:col-span-2"><input className="field" value={f.name} onChange={(e) => set("name", e.target.value)} data-testid="input-name" /></Field>
              <Field label="Tipo"><select className="field" value={f.type} onChange={(e) => set("type", e.target.value as ProductInput["type"])} data-testid="select-type"><option value="hours">Pacote de horas</option><option value="service">Serviço</option><option value="digital">Digital</option></select></Field>
              <Field label="Status"><span className="flex h-9 items-center gap-2 text-sm"><Switch checked={f.active} onCheckedChange={(v) => set("active", v)} data-testid="switch-active" />{f.active ? "Ativo" : "Arquivado"}</span></Field>
              <Field label="Preço (R$) *"><input type="number" step="0.01" min="0" className="field" value={f.price} onChange={(e) => set("price", Number(e.target.value))} data-testid="input-price" /></Field>
              <Field label="Horas incluídas" hint={perHour ? `Equivale a ${brl(perHour)}/h` : undefined}><input type="number" step="0.5" min="0" className="field" value={f.hours} onChange={(e) => set("hours", Number(e.target.value))} data-testid="input-hours" /></Field>
              <Field label="Descrição interna" className="sm:col-span-2"><textarea className="field" value={f.description} onChange={(e) => set("description", e.target.value)} data-testid="input-description" /></Field>
              <Field label="Termos de pagamento" className="sm:col-span-2"><textarea className="field" value={f.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} data-testid="input-terms" /></Field>
            </div>
          </Panel>
          <Panel title="Imagem do produto">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="URL do banner (https)" className="sm:col-span-2" hint="Cole o link de uma imagem pública começando com https://"><input className="field" placeholder="https://..." value={f.bannerUrl} onChange={(e) => set("bannerUrl", e.target.value.trim())} data-testid="input-banner" /></Field>
              <Field label="Cor de destaque"><span className="flex gap-2"><input type="color" className="h-9 w-12 cursor-pointer rounded-md border" value={f.accentColor} onChange={(e) => set("accentColor", e.target.value)} data-testid="input-color" /><input className="field num" value={f.accentColor} onChange={(e) => set("accentColor", e.target.value)} /></span></Field>
            </div>
          </Panel>
          {err && <p className="rounded-md bg-[hsl(4_80%_96%)] px-3 py-2 text-xs font-medium text-destructive" data-testid="text-error">{err}</p>}
          <div className="flex gap-2"><Button type="submit" disabled={pending} data-testid="button-save">{pending ? "Salvando..." : isNew ? "Criar produto" : "Salvar alterações"}</Button></div>
        </div>
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Prévia do produto</div>
          <div className="card-surface overflow-hidden">
            <div className="relative h-36" style={{ background: `linear-gradient(135deg, ${f.accentColor}, hsl(222 20% 12%))` }}>
              {bannerOk && <img src={f.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />}
            </div>
            <div className="p-5">
              <h3 className="text-lg font-semibold">{f.name || "Título do produto"}</h3>
              <p className="mt-1 line-clamp-4 text-sm text-muted-foreground">{f.description || "Sem descrição."}</p>
              <div className="num mt-4 text-2xl font-semibold">{brl(f.price)}</div>
              {f.type === "hours" && f.hours > 0 && <div className="text-xs text-muted-foreground">{num(f.hours)} horas</div>}
            </div>
          </div>
        </div>
      </form>
      <Confirm open={confirmDel} onOpenChange={setConfirmDel} title="Excluir produto?" body="Invoices existentes mantêm seus itens e valores registrados." confirmLabel="Excluir" destructive
        onConfirm={() => del.mutate({ id }, { onSuccess: () => { inv(); toast({ title: "Produto excluído" }); nav("/produtos"); }, onError: (e) => toast({ title: "Falha ao excluir", description: errMsg(e), variant: "destructive" }) })} />
    </div>
  );
}
