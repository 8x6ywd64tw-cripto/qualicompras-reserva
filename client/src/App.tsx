import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Fornecedores from "./pages/Fornecedores";
import Unidades from "./pages/Unidades";
import Cotacoes from "./pages/Cotacoes";
import CotacaoDetalhe from "./pages/CotacaoDetalhe";
import CotacaoPublica from "./pages/CotacaoPublica";
import Pedidos from "./pages/Pedidos";
import Alertas from "./pages/Alertas";
import Auditoria from "./pages/Auditoria";
import HistoricoPrecos from "./pages/HistoricoPrecos";
import Login from "./pages/Login";
import Requisicoes from "./pages/Requisicoes";
import Configuracoes from "./pages/Configuracoes";
import CorrecaoPreco from "./pages/CorrecaoPreco";
import ComparativoUnidades from "./pages/ComparativoUnidades";
import Justificativas from "./pages/Justificativas";
import Marcas from "./pages/Marcas";
import HistoricoCotacoes from "./pages/HistoricoCotacoes";
import HistoricoPedidos from "./pages/HistoricoPedidos";
import Cancelados from "./pages/Cancelados";
import InteligenciaCompras from "./pages/InteligenciaCompras";
import SolicitacoesFortes from "./pages/SolicitacoesFortes";
import Notificacoes from "./pages/Notificacoes";
import PreferenciasNotificacoes from "./pages/PreferenciasNotificacoes";
import ConferenciaNF from "./pages/ConferenciaNF";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={Home} />
      <Route path="/cotacoes" component={Cotacoes} />
      <Route path="/cotacoes/:id" component={CotacaoDetalhe} />
      <Route path="/cotacao/:token" component={CotacaoPublica} />
      <Route path="/correcao/:token/:supplierId/:itemId" component={CorrecaoPreco} />
      <Route path="/pedidos" component={Pedidos} />
      <Route path="/fornecedores" component={Fornecedores} />
      <Route path="/unidades" component={Unidades} />
      <Route path="/historico-precos" component={HistoricoPrecos} />
      <Route path="/requisicoes" component={Requisicoes} />
      <Route path="/alertas" component={Alertas} />
      <Route path="/auditoria" component={Auditoria} />
      <Route path="/configuracoes" component={Configuracoes} />
      <Route path="/comparativo-unidades" component={ComparativoUnidades} />
      <Route path="/justificativas" component={Justificativas} />
      <Route path="/marcas" component={Marcas} />
      <Route path="/historico-cotacoes" component={HistoricoCotacoes} />
      <Route path="/historico-pedidos" component={HistoricoPedidos} />
      <Route path="/cancelados" component={Cancelados} />
      <Route path="/solicitacoes-fortes" component={SolicitacoesFortes} />
      <Route path="/inteligencia-compras" component={InteligenciaCompras} />
      <Route path="/notificacoes" component={Notificacoes} />
      <Route path="/preferencias-notificacoes" component={PreferenciasNotificacoes} />
      <Route path="/conferencia-nf" component={ConferenciaNF} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
