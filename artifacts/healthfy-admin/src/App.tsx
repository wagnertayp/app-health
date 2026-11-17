import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Shell } from '@/components/shell';
import { AuthGate } from '@/components/auth-gate';
import FinanceHome from '@/pages/finance-home';
import Dashboard from '@/pages/dashboard';
import Crm from '@/pages/crm';
import Clientes from '@/pages/clientes';
import Projetos from '@/pages/projetos';
import ProjetoDetail from '@/pages/projeto-detail';
import Financeiro from '@/pages/financeiro';
import Invoices from '@/pages/invoices';
import InvoiceNew from '@/pages/invoice-new';
import InvoiceDetail from '@/pages/invoice-detail';
import Produtos from '@/pages/produtos';
import ProdutoEditor from '@/pages/produto-editor';
import Horas from '@/pages/horas';
import Agenda from '@/pages/agenda';
import Agentes from '@/pages/agentes';
import Trackeamento from '@/pages/trackeamento';
import Configuracoes from '@/pages/configuracoes';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 } } });

function Router() {
  const [loc] = useLocation();
  if (loc === '/checkout' || loc.startsWith('/checkout/')) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Página indisponível</h1>
          <p className="font-description mt-3 text-sm text-muted-foreground">Este endereço não está mais disponível.</p>
        </div>
      </main>
    );
  }
  return (
    <AuthGate>
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={FinanceHome} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/crm" component={Crm} />
          <Route path="/clientes" component={Clientes} />
          <Route path="/clientes/projetos" component={Projetos} />
          <Route path="/clientes/projetos/:id" component={ProjetoDetail} />
          <Route path="/financeiro" component={Financeiro} />
          <Route path="/invoices" component={Invoices} />
          <Route path="/invoices/nova">{() => <InvoiceNew />}</Route>
          <Route path="/invoices/:id/editar">{(params) => <InvoiceNew editMode invoiceId={params.id} />}</Route>
          <Route path="/invoices/:id" component={InvoiceDetail} />
          <Route path="/produtos" component={Produtos} />
          <Route path="/produtos/novo" component={ProdutoEditor} />
          <Route path="/produtos/:id" component={ProdutoEditor} />
          <Route path="/horas" component={Horas} />
          <Route path="/multi-agenda" component={Agenda} />
          <Route path="/agentes" component={Agentes} />
          <Route path="/trackeamento" component={Trackeamento} />
          <Route path="/configuracoes" component={Configuracoes} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
    </AuthGate>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
