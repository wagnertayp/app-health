import { useState } from "react";
import { useParams } from "wouter";
import { CheckCircle2, Clock, Info } from "lucide-react";
import { useGetCheckout, getGetCheckoutQueryKey, useSubmitCheckout, type PurchaseRequest } from "@workspace/api-client-react";
import { ErrorState, LoadingRows } from "@/components/kit";
import { brl, errMsg, num, usePageMeta } from "@/lib/format";
import logo from "@assets/HEALTH_SEM_FUNDO_1794883543830.png";

export default function Checkout() {
  const { id = "" } = useParams<{ id: string }>();
  const q = useGetCheckout(id, { query: { enabled: !!id, queryKey: getGetCheckoutQueryKey(id) } });
  usePageMeta(q.data?.product.checkoutTitle || q.data?.product.name || "Checkout", "Solicitação de compra Healthfy IA.");
  const submit = useSubmitCheckout();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [doc, setDoc] = useState("");
  const [qty, setQty] = useState(1);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<PurchaseRequest | null>(null);

  if (q.isLoading) return <div className="mx-auto max-w-3xl p-8"><LoadingRows rows={5} /></div>;
  if (q.isError || !q.data) return <div className="mx-auto max-w-md p-8"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;
  const { product: p, paymentConnected, sellerName, message } = q.data;
  const accent = p.accentColor;

  function send(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (name.trim().length < 2) return setErr("Informe seu nome.");
    if (!ok) return setErr("Aceite os termos para continuar.");
    submit.mutate({ id, data: { name: name.trim(), email: email.trim(), document: doc.trim(), quantity: qty, acceptedTerms: true } }, { onSuccess: setResult, onError: (e) => setErr(errMsg(e)) });
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b bg-card"><div className="mx-auto flex h-14 max-w-5xl items-center gap-2.5 px-4"><img src={logo} alt="" className="h-7 w-7 rounded-md" /><span className="text-sm font-semibold">{sellerName || "Healthfy IA"}</span></div></header>
      <div className="relative h-48 sm:h-64" style={{ background: `linear-gradient(135deg, ${accent}, hsl(222 20% 12%))` }}>
        {p.bannerUrl && <img src={p.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      </div>
      <main className="mx-auto -mt-16 grid max-w-5xl gap-6 px-4 pb-16 lg:grid-cols-[1.3fr_1fr]">
        <section className="card-surface fade-up relative p-6 sm:p-8">
          <h1 className="text-2xl font-semibold sm:text-3xl" data-testid="text-title">{p.checkoutTitle || p.name}</h1>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{p.checkoutDescription || p.description}</p>
          <div className="mt-6 flex items-baseline gap-3 border-t pt-6">
            <span className="num text-3xl font-semibold" data-testid="text-price">{brl(p.price)}</span>
            {p.type === "hours" && p.hours > 0 && <span className="text-sm text-muted-foreground">{num(p.hours)} horas incluídas</span>}
          </div>
          {p.paymentTerms && <div className="mt-6"><div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Termos</div><p className="whitespace-pre-line text-xs leading-relaxed">{p.paymentTerms}</p></div>}
        </section>
        <section className="card-surface fade-up relative p-6">
          {result ? (
            <div className="text-center" data-testid="status-awaiting">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: `${accent}22`, color: accent }}><Clock className="h-6 w-6" /></div>
              <h2 className="text-lg font-semibold">Solicitação recebida</h2>
              <p className="mt-1 text-sm text-muted-foreground">{result.message}</p>
              <div className="mt-4 rounded-lg border bg-muted/40 p-3 text-sm"><div className="text-xs text-muted-foreground">Valor da solicitação</div><div className="num text-xl font-semibold">{brl(result.total)}</div></div>
              <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5" />Aguardando contato · nenhum pagamento foi realizado</p>
            </div>
          ) : (
            <form onSubmit={send} className="space-y-3">
              <h2 className="font-semibold">Solicitar compra</h2>
              {!paymentConnected && <div className="flex gap-2 rounded-lg border bg-muted/50 p-3 text-xs text-muted-foreground"><Info className="h-4 w-4 shrink-0" />{message || "Pagamento online não disponível. Entraremos em contato para combinar o pagamento."}</div>}
              <input className="field" placeholder="Nome completo" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-name" />
              <input className="field" type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-email" />
              <input className="field" placeholder="CPF ou CNPJ (opcional)" value={doc} onChange={(e) => setDoc(e.target.value)} data-testid="input-document" />
              <label className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Quantidade</span><input type="number" min={1} max={100} className="field w-20" value={qty} onChange={(e) => setQty(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} data-testid="input-quantity" /></label>
              <div className="flex justify-between border-t pt-3 text-sm font-semibold"><span>Total</span><span className="num">{brl(p.price * qty)}</span></div>
              <label className="flex items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" className="mt-0.5" checked={ok} onChange={(e) => setOk(e.target.checked)} data-testid="check-terms" />Li e aceito os termos de pagamento.</label>
              {err && <p className="text-xs font-medium text-destructive">{err}</p>}
              <button type="submit" disabled={submit.isPending} className="w-full rounded-lg py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60" style={{ background: accent }} data-testid="button-submit">{submit.isPending ? "Enviando..." : "Enviar solicitação"}</button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
