import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Bell, CheckCircle2, AlertTriangle, FileWarning, Clock, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export default function Alertas() {
  const utils = trpc.useUtils();
  const { data: alertsList, isLoading } = trpc.alerts.list.useQuery({ resolved: false });
  const resolveMutation = trpc.alerts.resolve.useMutation({
    onSuccess: () => { toast.success("Alerta resolvido!"); utils.alerts.list.invalidate(); },
  });

  const typeConfig: Record<string, { label: string; icon: any; color: string }> = {
    price_anomaly: { label: "Preço Anômalo", icon: TrendingUp, color: "text-orange-500" },
    doc_expired: { label: "Documentação Vencida", icon: FileWarning, color: "text-red-500" },
    no_response: { label: "Sem Resposta 48h", icon: Clock, color: "text-yellow-600" },
    curve_a_rupture: { label: "Ruptura Curva A", icon: AlertTriangle, color: "text-red-600" },
  };

  const severityConfig: Record<string, { label: string; variant: any }> = {
    critical: { label: "Crítico", variant: "destructive" },
    high: { label: "Alto", variant: "destructive" },
    medium: { label: "Médio", variant: "default" },
    low: { label: "Baixo", variant: "secondary" },
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alertas</h1>
          <p className="text-muted-foreground mt-1">Monitoramento automático de preços, documentos e prazos</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-6 h-16" /></Card>)}
          </div>
        ) : !alertsList || alertsList.length === 0 ? (
          <Card><CardContent className="p-12 text-center"><Bell className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" /><p className="text-muted-foreground">Nenhum alerta pendente</p><p className="text-xs text-muted-foreground mt-1">O sistema monitora preços anômalos, documentos vencidos e rupturas de Curva A</p></CardContent></Card>
        ) : (
          <div className="space-y-3">
            {alertsList.map((alert: any) => {
              const tConfig = typeConfig[alert.type] || typeConfig.price_anomaly;
              const sConfig = severityConfig[alert.severity] || severityConfig.medium;
              const TypeIcon = tConfig.icon;
              return (
                <Card key={alert.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <TypeIcon className={`h-5 w-5 ${tConfig.color}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-sm truncate">{alert.title}</h3>
                            <Badge variant={sConfig.variant} className="text-xs shrink-0">{sConfig.label}</Badge>
                          </div>
                          {alert.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{alert.description}</p>}
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {tConfig.label} • {new Date(alert.createdAt).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => resolveMutation.mutate({ id: alert.id })}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Resolver
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
