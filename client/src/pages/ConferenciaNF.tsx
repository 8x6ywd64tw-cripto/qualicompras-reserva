import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Upload, CheckCircle, AlertTriangle, XCircle, Eye, Search, FileText, Zap, Camera, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

type MatchStatus = "match" | "partial" | "missing" | "extra";

export default function ConferenciaNF() {
  const { user } = useAuth();
  const isMaster = user?.email === "afonsoqueirogagn@gmail.com";
  const isBuyerSenior = user?.role === "buyer_senior";
  const canAccess = isMaster || isBuyerSenior;

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [validationId, setValidationId] = useState<number | null>(null);

  const pendingQuery = trpc.nfValidation.listPendingValidations.useQuery(undefined, { enabled: canAccess });
  const analyzeMutation = trpc.nfValidation.analyzeOrderNF.useMutation();
  const confirmMutation = trpc.nfValidation.confirmNFValidation.useMutation();
  const emergencyMutation = trpc.nfValidation.generateEmergencyFromNF.useMutation();

  const orders = useMemo(() => {
    const data = pendingQuery.data || [];
    let filtered = data.filter((o: any) => o.status === "approved" || o.status === "purchased" || o.status === "delivered");
    if (filterStatus !== "all") {
      filtered = filtered.filter((o: any) => (o.validationStatus || "pending") === filterStatus);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((o: any) =>
        (o.supplierName || "").toLowerCase().includes(q) ||
        (o.unitName || "").toLowerCase().includes(q) ||
        (o.sector || "").toLowerCase().includes(q) ||
        String(o.id).includes(q)
      );
    }
    return filtered;
  }, [pendingQuery.data, filterStatus, searchQuery]);

  const handleUploadNF = async (orderId: number, file: File) => {
    setUploading(true);
    try {
      // Upload to S3 via storage proxy
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload-invoice", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Erro no upload");
      const { url } = await uploadRes.json();

      // Analyze with AI
      setAnalyzing(true);
      setSelectedOrderId(orderId);
      const result = await analyzeMutation.mutateAsync({ orderId, imageUrl: url });
      setAnalysisResult(result.analysis);
      setValidationId(result.validationId);
      toast.success("NF analisada com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao analisar NF");
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const handleConfirm = async () => {
    if (!validationId || !selectedOrderId) return;
    try {
      await confirmMutation.mutateAsync({ validationId, orderId: selectedOrderId });
      toast.success("NF validada! CSV liberado para exportação.");
      setAnalysisResult(null);
      setSelectedOrderId(null);
      pendingQuery.refetch();
    } catch (err: any) {
      toast.error(err.message || "Erro ao confirmar");
    }
  };

  const handleGenerateEmergency = async () => {
    if (!validationId || !selectedOrderId || !analysisResult?.matching) return;
    const deficitItems = analysisResult.matching
      .filter((m: any) => m.status === "partial" || m.status === "missing")
      .map((m: any) => ({
        productName: m.itemPedido,
        requestedQty: m.qtdPedido || 0,
        receivedQty: m.qtdNF || 0,
        deficit: (m.qtdPedido || 0) - (m.qtdNF || 0),
        unit: "UN",
      }));
    try {
      await emergencyMutation.mutateAsync({ validationId, orderId: selectedOrderId, deficitItems });
      toast.success("Pedido emergencial gerado! Aguardando aprovação do Master.");
      setAnalysisResult(null);
      setSelectedOrderId(null);
      pendingQuery.refetch();
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar emergencial");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "validated": return <Badge className="bg-green-100 text-green-800">Validado</Badge>;
      case "partial": return <Badge className="bg-amber-100 text-amber-800">Parcial</Badge>;
      case "rejected": return <Badge className="bg-red-100 text-red-800">Rejeitado</Badge>;
      case "emergency_generated": return <Badge className="bg-orange-100 text-orange-800">Emergencial</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-800">Pendente</Badge>;
    }
  };

  const getMatchIcon = (status: MatchStatus) => {
    switch (status) {
      case "match": return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "partial": return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case "missing": return <XCircle className="h-4 w-4 text-red-600" />;
      case "extra": return <Eye className="h-4 w-4 text-blue-600" />;
    }
  };

  if (!canAccess) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Acesso restrito ao Master e Diretor de Compras.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">Conferência de NF com IA Visual</h1>
          <p className="text-muted-foreground">Upload da nota fiscal → IA analisa e compara com o pedido → Aprove ou gere emergencial</p>
        </div>

        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">5 Camadas de Proteção</p>
            <p className="mt-1">1. Leitura por IA avançada (GPT-4o Vision) • 2. Base de conhecimento por fornecedor • 3. Validação cruzada por valores • 4. Conferência visual lado a lado • 5. Histórico de acertos</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por fornecedor, unidade, setor..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="validated">Validados</SelectItem>
              <SelectItem value="partial">Parciais</SelectItem>
              <SelectItem value="emergency_generated">Emergenciais</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Orders list */}
        <div className="space-y-3">
          {orders.length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum pedido encontrado para conferência</p>
            </CardContent></Card>
          )}
          {orders.map((order: any) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{order.supplierName || "Fornecedor"}</span>
                      {getStatusBadge(order.validationStatus || "pending")}
                      <Badge variant="outline" className="text-xs">{order.sector || "—"}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {order.unitName} • Pedido #{order.id} • R$ {parseFloat(order.totalAmount || 0).toFixed(2)}
                    </p>
                    {order.consumptionPeriod && (
                      <p className="text-xs text-muted-foreground">{order.consumptionPeriod}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {(order.validationStatus === "pending" || !order.validationStatus) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <label className="cursor-pointer">
                              <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) handleUploadNF(order.id, file);
                              }} />
                              <Button variant="default" size="sm" className="gap-1.5 pointer-events-none" disabled={uploading || analyzing}>
                                {(uploading || analyzing) && selectedOrderId === order.id ? (
                                  <><Loader2 className="h-4 w-4 animate-spin" /> Analisando...</>
                                ) : (
                                  <><Camera className="h-4 w-4" /> Upload NF</>
                                )}
                              </Button>
                            </label>
                          </TooltipTrigger>
                          <TooltipContent>Envie a foto da nota fiscal para conferência automática</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {order.validationStatus === "validated" && (
                      <Badge className="bg-green-600 text-white gap-1"><CheckCircle className="h-3 w-3" /> CSV Liberado</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Analysis Dialog - Side by side comparison */}
        <Dialog open={!!analysisResult} onOpenChange={() => { setAnalysisResult(null); setSelectedOrderId(null); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                Conferência de NF — Pedido #{selectedOrderId}
              </DialogTitle>
            </DialogHeader>

            {analysisResult && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-700">{analysisResult.resumo?.matched || 0}</p>
                    <p className="text-xs text-green-600">Conferidos</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-amber-700">{analysisResult.resumo?.partial || 0}</p>
                    <p className="text-xs text-amber-600">Parciais</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-700">{analysisResult.resumo?.missing || 0}</p>
                    <p className="text-xs text-red-600">Faltantes</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-700">{analysisResult.resumo?.extra || 0}</p>
                    <p className="text-xs text-blue-600">Extras</p>
                  </div>
                </div>

                {/* Confidence */}
                <div className={`rounded-lg p-3 text-center text-sm font-medium ${
                  analysisResult.confiancaGeral === "alta" ? "bg-green-100 text-green-800" :
                  analysisResult.confiancaGeral === "media" ? "bg-amber-100 text-amber-800" :
                  "bg-red-100 text-red-800"
                }`}>
                  Confiança da análise: {analysisResult.confiancaGeral?.toUpperCase() || "N/A"}
                  {analysisResult.fornecedor && ` • Fornecedor na NF: ${analysisResult.fornecedor}`}
                  {analysisResult.dataNF && ` • Data: ${analysisResult.dataNF}`}
                </div>

                {/* Value comparison */}
                {analysisResult.resumo && (
                  <div className="flex justify-between items-center bg-gray-50 rounded-lg p-3 text-sm">
                    <span>Valor do Pedido: <strong>R$ {(analysisResult.resumo.valorPedido || 0).toFixed(2)}</strong></span>
                    <span>Valor da NF: <strong>R$ {(analysisResult.resumo.valorNF || 0).toFixed(2)}</strong></span>
                    <span className={analysisResult.resumo.diferencaValor > 0 ? "text-red-600" : "text-green-600"}>
                      Diferença: <strong>R$ {(analysisResult.resumo.diferencaValor || 0).toFixed(2)}</strong>
                    </span>
                  </div>
                )}

                {/* Item by item comparison */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 grid grid-cols-12 gap-2 text-xs font-semibold text-gray-600">
                    <div className="col-span-1">Status</div>
                    <div className="col-span-4">Item no Pedido</div>
                    <div className="col-span-4">Item na NF</div>
                    <div className="col-span-1">Qtd Ped.</div>
                    <div className="col-span-1">Qtd NF</div>
                    <div className="col-span-1">Conf.</div>
                  </div>
                  {(analysisResult.matching || []).map((match: any, idx: number) => (
                    <div key={idx} className={`px-4 py-2.5 grid grid-cols-12 gap-2 text-sm border-t items-center ${
                      match.status === "match" ? "bg-green-50/50" :
                      match.status === "partial" ? "bg-amber-50/50" :
                      match.status === "missing" ? "bg-red-50/50" :
                      "bg-blue-50/50"
                    }`}>
                      <div className="col-span-1">{getMatchIcon(match.status)}</div>
                      <div className="col-span-4 font-medium truncate">{match.itemPedido || "—"}</div>
                      <div className="col-span-4 truncate">{match.itemNF || <span className="text-red-500 italic">Não encontrado</span>}</div>
                      <div className="col-span-1 text-center">{match.qtdPedido ?? "—"}</div>
                      <div className="col-span-1 text-center">{match.qtdNF ?? "—"}</div>
                      <div className="col-span-1 text-center text-xs">{match.confidence ? `${(match.confidence * 100).toFixed(0)}%` : "—"}</div>
                    </div>
                  ))}
                </div>

                {/* Observations */}
                {(analysisResult.matching || []).some((m: any) => m.observacao) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-amber-800 mb-1">Observações da IA:</p>
                    {(analysisResult.matching || []).filter((m: any) => m.observacao).map((m: any, i: number) => (
                      <p key={i} className="text-xs text-amber-700">• {m.itemPedido}: {m.observacao}</p>
                    ))}
                  </div>
                )}

                {/* Audit warning */}
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <span>🔒</span> Todas as ações são registradas na auditoria corporativa.
                </p>
              </div>
            )}

            <DialogFooter className="flex-col sm:flex-row gap-2">
              {analysisResult?.resumo?.missing === 0 && analysisResult?.resumo?.partial === 0 ? (
                <Button onClick={handleConfirm} disabled={confirmMutation.isPending} className="bg-green-600 hover:bg-green-700 gap-1.5">
                  <CheckCircle className="h-4 w-4" />
                  {confirmMutation.isPending ? "Validando..." : "Aprovar NF — Liberar CSV"}
                </Button>
              ) : (
                <>
                  <Button onClick={handleConfirm} variant="outline" disabled={confirmMutation.isPending} className="gap-1.5">
                    <CheckCircle className="h-4 w-4" />
                    Aprovar mesmo assim
                  </Button>
                  <Button onClick={handleGenerateEmergency} disabled={emergencyMutation.isPending} className="bg-orange-600 hover:bg-orange-700 gap-1.5">
                    <Zap className="h-4 w-4" />
                    {emergencyMutation.isPending ? "Gerando..." : "Gerar Pedido Emergencial"}
                  </Button>
                </>
              )}
              <Button variant="ghost" onClick={() => { setAnalysisResult(null); setSelectedOrderId(null); }}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
