import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { FileText, TrendingUp, TrendingDown, ArrowRight, Calendar, User, DollarSign, AlertTriangle } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";

export default function Justificativas() {
  const { user } = useAuth();
  const { data: adjustments, isLoading } = trpc.adjustments.list.useQuery({});
  const { data: stats } = trpc.adjustments.stats.useQuery();

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />
            Justificativas de Compra
          </h1>
          <p className="text-muted-foreground mt-1">
            Registro imutável de todos os ajustes realizados na Compra Otimizada
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Total de Ajustes</p>
                <p className="text-2xl font-bold">{stats.totalExceptions}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Adicionaram Custo</p>
                <p className="text-2xl font-bold text-red-600">{stats.costAdditionCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Impacto Líquido</p>
                <p className={`text-2xl font-bold ${stats.netImpact > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {stats.netImpact > 0 ? '+' : ''}R$ {Math.abs(stats.netImpact).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Economia Gerada</p>
                <p className="text-2xl font-bold text-green-600">R$ {Math.abs(stats.savings).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Adjustments List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : !adjustments || adjustments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum ajuste de compra registrado ainda.</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Ajustes aparecem aqui quando itens são redirecionados para outro fornecedor na Compra Otimizada.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {adjustments.map((adj: any) => {
              const impact = parseFloat(adj.impactValue || '0');
              return (
                <Card key={adj.id} className="border-l-4" style={{ borderLeftColor: impact > 0 ? '#ef4444' : impact < 0 ? '#22c55e' : '#6b7280' }}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                          {adj.productName}
                          <Badge variant="outline" className="text-[10px]">{adj.unit}</Badge>
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          Cotação #{adj.quotationId} • Qtd: {adj.quantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-bold ${impact > 0 ? 'text-red-600' : impact < 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {impact > 0 ? <TrendingUp className="h-3 w-3 inline mr-1" /> : impact < 0 ? <TrendingDown className="h-3 w-3 inline mr-1" /> : null}
                          {impact > 0 ? '+' : ''}R$ {Math.abs(impact).toFixed(2)}
                          <span className="text-[10px] ml-1">({parseFloat(adj.impactPct || '0').toFixed(1)}%)</span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {/* Supplier change */}
                    <div className="flex items-center gap-2 text-xs bg-muted/50 rounded p-2">
                      <div className="flex-1">
                        <p className="text-muted-foreground">Recomendado:</p>
                        <p className="font-medium">{adj.recommendedSupplierName}</p>
                        <p className="text-muted-foreground">R$ {parseFloat(adj.recommendedUnitPrice || '0').toFixed(4)}/un</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-blue-600 shrink-0" />
                      <div className="flex-1">
                        <p className="text-muted-foreground">Selecionado:</p>
                        <p className="font-medium text-blue-700">{adj.selectedSupplierName}</p>
                        <p className="text-blue-700">R$ {parseFloat(adj.selectedUnitPrice || '0').toFixed(4)}/un</p>
                      </div>
                    </div>

                    {/* Justification */}
                    <div className="bg-amber-50 border border-amber-200 rounded p-2">
                      <div className="flex items-center gap-1 mb-1">
                        <AlertTriangle className="h-3 w-3 text-amber-600" />
                        <span className="text-[10px] font-medium text-amber-700">Justificativa:</span>
                      </div>
                      <p className="text-xs text-amber-900">{adj.justificationText}</p>
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />{adj.createdByName || 'Sistema'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />{new Date(adj.createdAt).toLocaleString('pt-BR')}
                      </span>
                      {adj.purchaseGroupId && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />{adj.purchaseGroupId}
                        </span>
                      )}
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
