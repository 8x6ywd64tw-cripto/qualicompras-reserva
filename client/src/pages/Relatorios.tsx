import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { FileText, Download, Send, Calendar, TrendingDown, TrendingUp, DollarSign, Package, Building2, Users, Clock, MessageCircle } from "lucide-react";

export default function Relatorios() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() === 0 ? 12 : now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [whatsappMsg, setWhatsappMsg] = useState<string | null>(null);

  const previewQuery = trpc.monthlyReport.preview.useQuery(
    { month: selectedMonth, year: selectedYear },
    { enabled: true }
  );

  const generateMutation = trpc.monthlyReport.generate.useMutation({
    onSuccess: (result) => {
      if (result.success && 'pdfUrl' in result) {
        setGeneratedPdfUrl(result.pdfUrl as string);
        setWhatsappMsg(result.whatsappMessage as string);
        toast.success("Relatório gerado com sucesso!");
      } else {
        toast.info(('message' in result ? result.message : 'Nenhum dado') as string);
      }
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const setupScheduleMutation = trpc.monthlyReport.setupSchedule.useMutation({
    onSuccess: (result) => {
      toast.success(`Agendamento criado! Próxima execução: ${result.nextExecution || 'em breve'}`);
    },
    onError: (err) => toast.error(`Erro ao agendar: ${err.message}`),
  });

  const data = previewQuery.data;

  const months = useMemo(() => [
    { value: 1, label: "Janeiro" },
    { value: 2, label: "Fevereiro" },
    { value: 3, label: "Março" },
    { value: 4, label: "Abril" },
    { value: 5, label: "Maio" },
    { value: 6, label: "Junho" },
    { value: 7, label: "Julho" },
    { value: 8, label: "Agosto" },
    { value: 9, label: "Setembro" },
    { value: 10, label: "Outubro" },
    { value: 11, label: "Novembro" },
    { value: 12, label: "Dezembro" },
  ], []);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear - 1, currentYear, currentYear + 1];
  }, []);

  const handleGenerate = () => {
    generateMutation.mutate({ month: selectedMonth, year: selectedYear });
  };

  const handleSchedule = () => {
    // Schedule for day 1 at 6h UTC (3h BRT)
    setupScheduleMutation.mutate({ dayOfMonth: 1, hour: 6 });
  };

  const handleWhatsApp = () => {
    if (!whatsappMsg) {
      toast.info("Gere o relatório primeiro para enviar via WhatsApp.");
      return;
    }
    const encoded = encodeURIComponent(whatsappMsg);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  const handleDownloadPdf = () => {
    if (generatedPdfUrl) {
      window.open(generatedPdfUrl, "_blank");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatório Mensal</h1>
            <p className="text-muted-foreground text-sm">
              Consolidado de compras com evolução de preços, economia e ranking de fornecedores
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-[90px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        {data && data.summary.totalOrders > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    Total Comprado
                  </div>
                  <p className="text-lg font-bold">
                    R$ {data.summary.totalPurchased.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-xs mb-1">
                    <TrendingDown className="h-3.5 w-3.5" />
                    Economia
                  </div>
                  <p className="text-lg font-bold text-green-700 dark:text-green-400">
                    R$ {data.savings.totalSavings.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-500">
                    {data.savings.savingsPercent.toFixed(1)}% vs pior cenário
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Package className="h-3.5 w-3.5" />
                    Pedidos
                  </div>
                  <p className="text-lg font-bold">{data.summary.totalOrders}</p>
                  <p className="text-xs text-muted-foreground">{data.summary.totalItems} itens</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Users className="h-3.5 w-3.5" />
                    Fornecedores
                  </div>
                  <p className="text-lg font-bold">{data.summary.totalSuppliers}</p>
                  <p className="text-xs text-muted-foreground">{data.summary.totalUnits} unidades</p>
                </CardContent>
              </Card>
            </div>

            {/* Category Breakdown */}
            {data.categoryBreakdown.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Distribuição por Categoria</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.categoryBreakdown.map((cat) => (
                      <div key={cat.category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{cat.category}</Badge>
                          <span className="text-xs text-muted-foreground">{cat.orderCount} pedidos</span>
                        </div>
                        <div className="text-right">
                          <span className="font-medium text-sm">
                            R$ {cat.totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({cat.percentOfTotal.toFixed(0)}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Supplier Ranking */}
            {data.supplierRanking.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Ranking de Fornecedores</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 font-medium">#</th>
                          <th className="pb-2 font-medium">Fornecedor</th>
                          <th className="pb-2 font-medium text-right">Valor</th>
                          <th className="pb-2 font-medium text-right">Pedidos</th>
                          <th className="pb-2 font-medium text-right">Avaliação</th>
                          <th className="pb-2 font-medium text-right">% Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.supplierRanking.slice(0, 10).map((sup, idx) => (
                          <tr key={sup.supplierName} className="border-b last:border-0">
                            <td className="py-2 font-bold text-muted-foreground">{idx + 1}</td>
                            <td className="py-2">{sup.supplierName}</td>
                            <td className="py-2 text-right font-medium">
                              R$ {sup.totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 text-right">{sup.orderCount}</td>
                            <td className="py-2 text-right">
                              {sup.avgRating ? `${sup.avgRating.toFixed(1)}/5` : "—"}
                            </td>
                            <td className="py-2 text-right">{sup.percentOfTotal.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Price Movements */}
            {data.priceMovements.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Movimentações de Preço (vs. mês anterior)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.priceMovements.filter(p => p.direction === "down").length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-green-600 mb-1 flex items-center gap-1">
                          <TrendingDown className="h-3 w-3" /> Quedas (Economia)
                        </p>
                        {data.priceMovements.filter(p => p.direction === "down").slice(0, 5).map((item) => (
                          <div key={item.productName} className="flex items-center justify-between py-1 text-sm">
                            <span>{item.productName}</span>
                            <span className="text-green-600 font-medium">{item.variationPercent.toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {data.priceMovements.filter(p => p.direction === "up").length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-red-600 mb-1 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" /> Aumentos (Atenção)
                        </p>
                        {data.priceMovements.filter(p => p.direction === "up").slice(0, 5).map((item) => (
                          <div key={item.productName} className="flex items-center justify-between py-1 text-sm">
                            <span>{item.productName}</span>
                            <span className="text-red-600 font-medium">+{item.variationPercent.toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Unit Breakdown */}
            {data.unitBreakdown.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> Distribuição por Unidade
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.unitBreakdown.map((unit) => (
                      <div key={unit.unitName} className="flex items-center justify-between">
                        <div>
                          <span className="text-sm">{unit.unitName}</span>
                          <span className="text-xs text-muted-foreground ml-1">({unit.state})</span>
                        </div>
                        <div className="text-right">
                          <span className="font-medium text-sm">
                            R$ {unit.totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {unit.percentOfTotal.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : previewQuery.isLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-muted-foreground">Carregando dados do período...</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum pedido encontrado no período selecionado.</p>
              <p className="text-xs text-muted-foreground mt-1">Selecione outro mês/ano para visualizar.</p>
            </CardContent>
          </Card>
        )}

        <Separator />

        {/* Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending || !data || data.summary.totalOrders === 0}
              >
                <FileText className="h-4 w-4 mr-2" />
                {generateMutation.isPending ? "Gerando..." : "Gerar PDF"}
              </Button>

              {generatedPdfUrl && (
                <>
                  <Button variant="outline" onClick={handleDownloadPdf}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar PDF
                  </Button>
                  <Button variant="outline" onClick={handleWhatsApp} className="text-green-600 border-green-200 hover:bg-green-50">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Enviar WhatsApp
                  </Button>
                </>
              )}

              <Button
                variant="secondary"
                onClick={handleSchedule}
                disabled={setupScheduleMutation.isPending}
              >
                <Clock className="h-4 w-4 mr-2" />
                {setupScheduleMutation.isPending ? "Agendando..." : "Agendar Mensal (dia 1)"}
              </Button>
            </div>

            {generatedPdfUrl && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">PDF gerado:</p>
                <a href={generatedPdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline break-all">
                  {generatedPdfUrl}
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
