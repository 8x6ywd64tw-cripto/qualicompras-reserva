import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Shield, User, FileText, ShoppingCart, Building2, Users, Lock, AlertTriangle, CheckCircle, Eye, Clock, Fingerprint, Bot, Zap, MessageCircle, ExternalLink, Globe } from "lucide-react";
import { useLocation } from "wouter";

const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";

export default function Auditoria() {
  const { user } = useAuth();
  const isMaster = user?.email === MASTER_EMAIL;
  const [severityFilter, setSeverityFilter] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState("audit");

  const { data: logs, isLoading } = trpc.audit.list.useQuery({ limit: 100, severity: severityFilter }, { enabled: isMaster });
  const { data: events, isLoading: eventsLoading, refetch: refetchEvents } = trpc.audit.securityEvents.useQuery({ limit: 50 }, { enabled: isMaster });
  const { data: whatsappData } = trpc.audit.whatsappAlerts.useQuery(undefined, { enabled: isMaster, refetchInterval: 10000 });
  const { data: loginData } = trpc.audit.loginSessions.useQuery(undefined, { enabled: isMaster });
  const resolveMutation = trpc.audit.resolveEvent.useMutation({ onSuccess: () => { refetchEvents(); } });

  const actionLabels: Record<string, string> = {
    create_unit: "Criou unidade", update_unit: "Atualizou unidade", delete_unit: "Excluiu unidade",
    create_supplier: "Cadastrou fornecedor", update_supplier: "Atualizou fornecedor", delete_supplier: "Excluiu fornecedor",
    create_quotation: "Criou cotação", open_quotation: "Abriu cotação", close_quotation: "Fechou cotação", delete_quotation: "Excluiu cotação",
    create_order: "Criou pedido", approve_order: "Aprovou pedido", cancel_order: "Cancelou pedido", mark_delivered: "Confirmou entrega", delete_order: "Excluiu pedido",
    update_settings: "Alterou configurações", update_role: "Alterou permissão de usuário",
    update_fortes_code: "Alterou código Fortes", adjust_delivery: "Ajustou entrega (com NF)",
    reopen_quotation: "Reabriu cotação", reopen_quotation_manual: "Reabriu cotação",
    order_quotation: "Gerou pedidos (compra otimizada)", integrity_divergence: "Divergência de integridade",
    edit_quotation_item: "Editou item da cotação", swap_brand: "Trocou marca no pedido",
    edit_order_item: "Editou item do pedido", delete_order_item: "Excluiu item do pedido", add_order_item: "Adicionou item ao pedido",
    request_emergency_purchase: "Solicitou compra emergencial", approve_emergency_purchase: "Aprovou compra emergencial", reject_emergency_purchase: "Rejeitou compra emergencial",
  };
  const entityIcons: Record<string, any> = {
    unit: Building2, units: Building2, supplier: Users, suppliers: Users,
    quotation: FileText, quotations: FileText, purchase_order: ShoppingCart, orders: ShoppingCart, system_settings: Zap,
  };
  const severityColors: Record<string, string> = {
    info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };
  const eventTypeLabels: Record<string, string> = {
    excessive_actions: "Excesso de Ações", bulk_scraping: "Scraping em Massa", price_manipulation: "Manipulação de Preço",
    session_hijacking: "Hijacking de Sessão", bot_detected: "Bot Detectado", honeypot_triggered: "Honeypot Ativado",
    prompt_injection: "Injeção de Prompt (IA)", unauthorized_access: "Acesso Não Autorizado",
  };
  const eventTypeIcons: Record<string, any> = {
    excessive_actions: Zap, bulk_scraping: Bot, price_manipulation: AlertTriangle,
    session_hijacking: Fingerprint, bot_detected: Bot, honeypot_triggered: Shield, prompt_injection: Bot,
  };

  const [, setLocation] = useLocation();
  
  useEffect(() => {
    if (user && !isMaster) {
      setLocation("/");
    }
  }, [user, isMaster, setLocation]);
  
  if (!isMaster) {
    return null;
  }

  const unresolvedEvents = events?.filter((e: any) => !e.resolved) || [];
  const criticalLogs = logs?.filter((l: any) => l.severity === "critical") || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-6 w-6 text-red-500" /> Central de Segurança
            </h1>
            <p className="text-muted-foreground mt-1">Monitoramento em tempo real de todas as ações e ameaças</p>
          </div>
          {unresolvedEvents.length > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1">
              <AlertTriangle className="h-3.5 w-3.5 mr-1" />
              {unresolvedEvents.length} alerta{unresolvedEvents.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center"><Eye className="h-5 w-5 text-blue-600" /></div><div><p className="text-2xl font-bold">{logs?.length || 0}</p><p className="text-xs text-muted-foreground">Ações registradas</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-red-600" /></div><div><p className="text-2xl font-bold">{unresolvedEvents.length}</p><p className="text-xs text-muted-foreground">Alertas ativos</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center"><Fingerprint className="h-5 w-5 text-yellow-600" /></div><div><p className="text-2xl font-bold">{criticalLogs.length}</p><p className="text-xs text-muted-foreground">Ações críticas</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center"><CheckCircle className="h-5 w-5 text-green-600" /></div><div><p className="text-2xl font-bold">{events?.filter((e: any) => e.resolved).length || 0}</p><p className="text-xs text-muted-foreground">Resolvidos</p></div></div></CardContent></Card>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="audit">Trilha de Auditoria</TabsTrigger>
            <TabsTrigger value="security" className="relative">
              Alertas de Segurança
              {unresolvedEvents.length > 0 && <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">{unresolvedEvents.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="relative">
              <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
              {(whatsappData?.alerts?.length || 0) > 0 && <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-500 text-[10px] text-white flex items-center justify-center">{whatsappData?.alerts?.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="logins" className="relative">
              <Globe className="h-3.5 w-3.5 mr-1" /> Sessões/IPs
              {loginData?.sessions?.some((s: any) => s.suspicious) && <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">!</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="audit" className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant={!severityFilter ? "default" : "outline"} onClick={() => setSeverityFilter(undefined)}>Todos</Button>
              <Button size="sm" variant={severityFilter === "info" ? "default" : "outline"} onClick={() => setSeverityFilter("info")}>Info</Button>
              <Button size="sm" variant={severityFilter === "warning" ? "default" : "outline"} onClick={() => setSeverityFilter("warning")}>Aviso</Button>
              <Button size="sm" variant={severityFilter === "critical" ? "default" : "outline"} onClick={() => setSeverityFilter("critical")}>Crítico</Button>
            </div>
            {isLoading ? (
              <div className="space-y-2">{[1,2,3,4,5].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-16" /></Card>)}</div>
            ) : !logs || logs.length === 0 ? (
              <Card><CardContent className="p-12 text-center"><Shield className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" /><p className="text-muted-foreground">Nenhuma ação registrada</p></CardContent></Card>
            ) : (
              <div className="space-y-2">
                {logs.map((log: any) => {
                  const EntityIcon = entityIcons[log.resource || log.entityType] || Shield;
                  return (
                    <Card key={log.id} className={log.severity === "critical" ? "border-red-300 dark:border-red-800" : log.severity === "warning" ? "border-yellow-300 dark:border-yellow-800" : ""}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0"><EntityIcon className="h-4 w-4 text-muted-foreground" /></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{actionLabels[log.action] || log.action}</span>
                              <Badge variant="outline" className="text-[10px]">{log.resource || log.entityType || "—"}</Badge>
                              {log.severity && log.severity !== "info" && <Badge className={`text-[10px] ${severityColors[log.severity] || ""}`}>{log.severity === "warning" ? "⚠️ Aviso" : "🚨 Crítico"}</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              <User className="h-3 w-3 inline mr-1" />{log.userName || "Sistema"}{log.userRole && <span className="ml-1 opacity-60">({log.userRole})</span>}
                              {" \u2022 "}<Clock className="h-3 w-3 inline mr-1" />{new Date(log.createdAt).toLocaleString("pt-BR")}
                              {log.ipAddress && <span className="ml-2 opacity-50">IP: {log.ipAddress}</span>}
                            </p>
                            {log.details && (() => {
                              try {
                                const d = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
                                const justification = d?.justification;
                                const sev = d?.severity;
                                return (
                                  <div className="mt-1 text-xs space-y-0.5">
                                    {justification && <p className="text-muted-foreground italic">Justificativa: "{justification}"</p>}
                                    {d?.productName && <p className="text-muted-foreground">Produto: {d.productName}</p>}
                                    {d?.companyName && <p className="text-muted-foreground">Fornecedor: {d.companyName}</p>}
                                    {d?.adjustPct && <p className="text-muted-foreground">Ajuste: {d.adjustPct}% do pedido (R$ {d.adjustValue})</p>}
                                    {d?.reopenCount && <p className="text-muted-foreground">Reabertura #{d.reopenCount}{d.reason ? ` — ${d.reason}` : ''}</p>}
                                    {d?.divergenceCount && <p className="text-red-600 font-medium">{d.divergenceCount} item(ns) com quantidade divergente</p>}
                                  </div>
                                );
                              } catch { return null; }
                            })()}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            {eventsLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-20" /></Card>)}</div>
            ) : !events || events.length === 0 ? (
              <Card><CardContent className="p-12 text-center"><CheckCircle className="h-12 w-12 mx-auto text-green-400 mb-3" /><p className="text-lg font-medium">Sistema Seguro</p><p className="text-muted-foreground">Nenhum evento de segurança registrado</p></CardContent></Card>
            ) : (
              <div className="space-y-3">
                {events.map((event: any) => {
                  const EventIcon = eventTypeIcons[event.eventType] || AlertTriangle;
                  return (
                    <Card key={event.id} className={event.resolved ? "opacity-60" : "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/10"}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${event.resolved ? "bg-muted" : "bg-red-100 dark:bg-red-900/30"}`}>
                            <EventIcon className={`h-5 w-5 ${event.resolved ? "text-muted-foreground" : "text-red-600"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold">{eventTypeLabels[event.eventType] || event.eventType}</span>
                              {event.resolved ? <Badge variant="outline" className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"><CheckCircle className="h-3 w-3 mr-1" />Resolvido</Badge> : <Badge variant="destructive" className="text-[10px]">Ativo</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              {event.userName && <span><User className="h-3 w-3 inline mr-1" />{event.userName}</span>}
                              <span><Clock className="h-3 w-3 inline mr-1" />{new Date(event.createdAt).toLocaleString("pt-BR")}</span>
                              {event.ipAddress && <span>IP: {event.ipAddress}</span>}
                            </div>
                            {!event.resolved && <Button size="sm" variant="outline" className="mt-2" onClick={() => resolveMutation.mutate({ id: event.id })} disabled={resolveMutation.isPending}><CheckCircle className="h-3.5 w-3.5 mr-1" />Marcar como Resolvido</Button>}
                            {event.resolved && event.resolvedBy && <p className="text-xs text-green-600 mt-1">Resolvido por {event.resolvedBy} em {event.resolvedAt ? new Date(event.resolvedAt).toLocaleString("pt-BR") : "—"}</p>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="whatsapp" className="space-y-4">
            <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/10">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <MessageCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Alertas WhatsApp Ativo</p>
                    <p className="text-sm text-muted-foreground">Alertas de segurança são enviados para (83) 99314-9365</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            {!whatsappData?.alerts || whatsappData.alerts.length === 0 ? (
              <Card><CardContent className="p-12 text-center"><CheckCircle className="h-12 w-12 mx-auto text-green-400 mb-3" /><p className="text-lg font-medium">Nenhum alerta recente</p><p className="text-muted-foreground">Quando algo suspeito acontecer, o alerta aparece aqui e você pode enviar direto pro WhatsApp</p></CardContent></Card>
            ) : (
              <div className="space-y-3">
                {whatsappData.alerts.map((alert: any, idx: number) => (
                  <Card key={idx} className="border-orange-200 dark:border-orange-800">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{alert.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{alert.message}</p>
                          <p className="text-xs text-muted-foreground mt-2"><Clock className="h-3 w-3 inline mr-1" />{new Date(alert.timestamp).toLocaleString("pt-BR")}</p>
                        </div>
                        <a href={alert.whatsappUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Enviar WhatsApp
                          </Button>
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="logins" className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2"><Globe className="h-4 w-4" /> Histórico de Login por IP</h3>
                {!loginData?.sessions || loginData.sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma sessão registrada ainda</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 font-medium">Usuário</th>
                          <th className="pb-2 font-medium">IP</th>
                          <th className="pb-2 font-medium">Data/Hora</th>
                          <th className="pb-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loginData.sessions.map((s: any) => (
                          <tr key={s.id} className={`border-b last:border-0 ${s.suspicious ? "bg-red-50 dark:bg-red-950/20" : ""}`}>
                            <td className="py-2">
                              <p className="font-medium">{s.userName || "Desconhecido"}</p>
                              <p className="text-xs text-muted-foreground">{s.userEmail}</p>
                            </td>
                            <td className="py-2 font-mono text-xs">{s.ipAddress}</td>
                            <td className="py-2 text-xs">{new Date(s.loginAt).toLocaleString("pt-BR")}</td>
                            <td className="py-2">
                              {s.suspicious ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                                  <AlertTriangle className="h-3 w-3" /> Suspeito
                                </span>
                              ) : (
                                <span className="text-xs text-green-600 dark:text-green-400">Normal</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
            {loginData?.sessions?.some((s: any) => s.suspicious) && (
              <Card className="border-red-200 dark:border-red-800">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-red-600 dark:text-red-400 flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4" /> Sessões Suspeitas Detectadas
                  </h4>
                  <p className="text-sm text-muted-foreground">Foram detectados logins do mesmo usuário de IPs diferentes em menos de 1 hora. Isso pode indicar compartilhamento de credenciais.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
