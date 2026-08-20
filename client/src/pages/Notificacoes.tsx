import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Bell, BellRing, CheckCircle2, Filter, Settings } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/_core/hooks/useAuth";

const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";

const EVENT_TYPES = [
  { value: "all", label: "Todos os tipos" },
  { value: "supplier_response", label: "Resposta Fornecedor" },
  { value: "order_generated", label: "Pedido Gerado" },
  { value: "quotation_reopened", label: "Cotação Reaberta" },
  { value: "price_alert", label: "Alerta de Preço" },
  { value: "delivery_adjusted", label: "Ajuste de Entrega" },
  { value: "system", label: "Sistema" },
];

const typeIcons: Record<string, string> = {
  supplier_response: "📩", quotation_ready: "✅", order_generated: "🛒",
  order_cancelled: "❌", quotation_reopened: "🔄", price_alert: "⚠️",
  delivery_adjusted: "✂️", no_response_48h: "⏰", doc_expired: "📄", system: "🔔",
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  critical: { label: "Crítico", color: "bg-red-500 text-white" },
  high: { label: "Alto", color: "bg-orange-500 text-white" },
  medium: { label: "Médio", color: "bg-blue-500 text-white" },
  low: { label: "Baixo", color: "bg-gray-400 text-white" },
};

export default function Notificacoes() {
  const { user } = useAuth();
  const isMaster = user?.email === MASTER_EMAIL;
  const [, navigate] = useLocation();
  const [typeFilter, setTypeFilter] = useState("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [page, setPage] = useState(0);
  const LIMIT = 20;

  const utils = trpc.useUtils();
  const queryInput = useMemo(() => ({
    limit: LIMIT,
    offset: page * LIMIT,
    unreadOnly: showUnreadOnly,
    type: typeFilter === "all" ? undefined : typeFilter,
  }), [page, showUnreadOnly, typeFilter]);

  const { data, isLoading } = trpc.notifications.list.useQuery(queryInput);
  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => { utils.notifications.invalidate(); toast.success("Marcada como lida"); },
  });
  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => { utils.notifications.invalidate(); toast.success("Todas marcadas como lidas"); },
  });

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BellRing className="h-6 w-6" /> Notificações
            </h1>
            <p className="text-muted-foreground mt-1">Alertas e avisos do sistema</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => markAllReadMutation.mutate()}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Marcar todas como lidas
            </Button>
            {isMaster && (
              <Button variant="outline" size="sm" onClick={() => navigate("/preferencias-notificacoes")}>
                <Settings className="h-4 w-4 mr-1" /> Preferências
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant={showUnreadOnly ? "default" : "outline"}
            size="sm"
            onClick={() => { setShowUnreadOnly(!showUnreadOnly); setPage(0); }}
          >
            <Filter className="h-4 w-4 mr-1" /> {showUnreadOnly ? "Não lidas" : "Todas"}
          </Button>
          <span className="text-sm text-muted-foreground">{total} notificação(ões)</span>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-6 h-16" /></Card>)}
          </div>
        ) : items.length === 0 ? (
          <Card><CardContent className="p-12 text-center">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Nenhuma notificação encontrada</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {items.map((n: any) => {
              const pConfig = priorityConfig[n.priority] || priorityConfig.medium;
              return (
                <Card
                  key={n.id}
                  className={`cursor-pointer hover:shadow-sm transition-shadow ${!n.readAt ? 'border-primary/30 bg-primary/5' : ''}`}
                  onClick={() => {
                    if (!n.readAt) markReadMutation.mutate({ id: n.id });
                    if (n.actionUrl) navigate(n.actionUrl);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-xl mt-0.5 shrink-0">{typeIcons[n.type] || "🔔"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={`text-sm ${!n.readAt ? 'font-bold' : 'font-medium'}`}>{n.title}</h3>
                          <Badge className={`text-[10px] ${pConfig.color}`}>{pConfig.label}</Badge>
                          {!n.readAt && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                        </div>
                        {n.message && <p className="text-xs text-muted-foreground mt-1">{n.message}</p>}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(n.createdAt).toLocaleDateString("pt-BR")} {new Date(n.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      {!n.readAt && (
                        <Button variant="ghost" size="sm" className="shrink-0" onClick={(e) => { e.stopPropagation(); markReadMutation.mutate({ id: n.id }); }}>
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
            <span className="text-sm text-muted-foreground">Página {page + 1} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próxima</Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
