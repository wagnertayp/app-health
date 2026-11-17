import { Link } from "wouter";
import { Package, Pencil, Plus } from "lucide-react";
import { useListProducts } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingRows, PageHeader, Pill } from "@/components/kit";
import { brl, num, usePageMeta } from "@/lib/format";
import { productTypeLabel } from "@/lib/status";

export default function Produtos() {
  usePageMeta("Produtos", "Catálogo de pacotes de horas e serviços da Healthfy.");
  const products = useListProducts();
  return (
    <div>
      <PageHeader title="Produtos" actions={<Button asChild data-testid="button-new-product"><Link href="/produtos/novo"><Plus className="mr-1.5 h-4 w-4" />Novo produto</Link></Button>} />
      {products.isLoading ? <LoadingRows /> : products.isError ? <ErrorState error={products.error} onRetry={() => products.refetch()} /> : !products.data?.length ? (
        <EmptyState icon={Package} title="Catálogo vazio" body="Crie um pacote de horas para vender e faturar." action={<Button size="sm" asChild><Link href="/produtos/novo">Criar produto</Link></Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.data.map((p) => (
            <article key={p.id} className="card-surface fade-up group overflow-hidden transition-transform hover:-translate-y-0.5" data-testid={`card-product-${p.id}`}>
              <div className="relative h-32 overflow-hidden border-b" style={{ background: `linear-gradient(135deg, ${p.accentColor}, hsl(222 20% 14%))` }}>
                {p.bannerUrl && <img src={p.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />}
                <div className="absolute left-3 top-3"><Pill tone={p.active ? "green" : "neutral"} className="bg-white/90">{p.active ? "Ativo" : "Arquivado"}</Pill></div>
              </div>
              <div className="p-4">
                <div className="text-[11px] font-medium text-muted-foreground">{productTypeLabel[p.type]}</div>
                <h3 className="mt-0.5 font-semibold">{p.name}</h3>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="num text-xl font-semibold">{brl(p.price)}</span>
                  {p.type === "hours" && p.hours > 0 && <span className="num text-xs text-muted-foreground">{num(p.hours)}h · {brl(p.price / p.hours)}/h</span>}
                </div>
                <div className="mt-4 flex gap-1.5">
                  <Button size="sm" variant="outline" className="flex-1" asChild data-testid={`button-edit-${p.id}`}><Link href={`/produtos/${p.id}`}><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Link></Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
