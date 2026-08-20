import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { TrendingDown, TrendingUp, Minus, AlertTriangle, BarChart3, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PurchaseComparisonProps {
  orderId: number;
}

export function PurchaseComparison({ orderId }: PurchaseComparisonProps) {
  const { data, isLoading } = trpc.orders.comparison.useQuery({ orderId });

  if (isLoading) {
    return (
      <div className="mt-3 p-3 bg-muted/30 rounded-lg animate-pulse">
        <div className="h-4 w-48 bg-muted rounded mb-2" />
        <div className="h-3 w-full bg-muted rounded" />
      </div>
    );
  }

  if (!data || 'error' in data) return null;

  if ('noReference' in data && data.noReference) {
    return (
      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-center gap-2 text-amber-700 text-xs font-medium">
          <Info className="h-3.5 w-3.5" />
          <span>Sem referência histórica para comparação</span>
        </div>
        <p className="text-[10px] text-amber-600 mt-1">
          Esta é a primeira compra de {(data as any).current?.category} para esta unidade, ou não há compras anteriores comparáveis.
        </p>
      </div>
    );
  }

  if (!('comparison' in data) || !data.comparison) return null;

  const c = data.comparison as any;
  const isPositive = c.priceEffect > 0;
  const isNeutral = Math.abs(c.priceEffectPercent) < 0.5;

  return (
    <div className="mt-3 space-y-2">
      {/* Executive Summary Card */}
      <div className={`p-3 rounded-lg border ${isNeutral ? 'bg-slate-50 border-slate-200' : isPositive ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="h-3.5 w-3.5 text-slate-600" />
          <span className="text-xs font-semibold text-slate-700">Comparação Histórica</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                  {c.comparability.index.toFixed(0)}% comparável
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                <p><strong>Índice de Comparabilidade:</strong> {c.comparability.index.toFixed(1)}%</p>
                <p>Sobreposição de produtos: {c.comparability.productOverlap.toFixed(0)}%</p>
                <p>Semelhança de volumes: {c.comparability.volumeSimilarity.toFixed(0)}%</p>
                <p>Cobertura financeira: {c.comparability.financialCoverage.toFixed(0)}%</p>
                <p className="mt-1 text-muted-foreground">{c.comparability.commonProductsCount} produtos em comum, {c.comparability.currentOnlyCount} novos, {c.comparability.referenceOnlyCount} removidos</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {!c.isConclusive && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-300 text-amber-700 bg-amber-50">
              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />Baixa confiança
            </Badge>
          )}
        </div>
        
        {/* Price Effect */}
        <div className="flex items-center gap-3">
          {isNeutral ? (
            <Minus className="h-5 w-5 text-slate-500" />
          ) : isPositive ? (
            <TrendingDown className="h-5 w-5 text-green-600" />
          ) : (
            <TrendingUp className="h-5 w-5 text-red-600" />
          )}
          <div>
            <span className={`text-sm font-bold ${isNeutral ? 'text-slate-700' : isPositive ? 'text-green-700' : 'text-red-700'}`}>
              {isNeutral ? 'Preços estáveis' : isPositive 
                ? `Economia de R$ ${Math.abs(c.priceEffect).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${Math.abs(c.priceEffectPercent).toFixed(1)}%)`
                : `Aumento de R$ ${Math.abs(c.priceEffect).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${Math.abs(c.priceEffectPercent).toFixed(1)}%)`
              }
            </span>
            <p className="text-[10px] text-muted-foreground">
              vs. compra anterior ({c.reference.period || new Date(c.reference.date).toLocaleDateString('pt-BR')})
            </p>
          </div>
        </div>
        
        {/* Summary stats */}
        <div className="flex gap-4 mt-2 text-[10px]">
          <span className="text-green-700">{c.cheaperCount} mais baratos</span>
          <span className="text-red-700">{c.moreExpensiveCount} mais caros</span>
          <span className="text-slate-500">{c.stableCount} estáveis</span>
          {c.noComparisonCount > 0 && <span className="text-amber-600">{c.noComparisonCount} sem ref.</span>}
        </div>
      </div>

      {/* Top Savings & Increases (compact) */}
      {(c.topSavings.length > 0 || c.topIncreases.length > 0) && (
        <div className="grid grid-cols-2 gap-2">
          {c.topSavings.length > 0 && (
            <div className="p-2 bg-green-50/50 border border-green-100 rounded text-[10px]">
              <span className="font-semibold text-green-700 block mb-1">Maiores economias</span>
              {c.topSavings.slice(0, 3).map((p: any, i: number) => (
                <div key={i} className="flex justify-between text-green-800">
                  <span className="truncate mr-1">{p.productName.split(' ').slice(0, 3).join(' ')}</span>
                  <span className="font-mono whitespace-nowrap">-R${Math.abs(p.financialImpact).toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
          {c.topIncreases.length > 0 && (
            <div className="p-2 bg-red-50/50 border border-red-100 rounded text-[10px]">
              <span className="font-semibold text-red-700 block mb-1">Maiores aumentos</span>
              {c.topIncreases.slice(0, 3).map((p: any, i: number) => (
                <div key={i} className="flex justify-between text-red-800">
                  <span className="truncate mr-1">{p.productName.split(' ').slice(0, 3).join(' ')}</span>
                  <span className="font-mono whitespace-nowrap">+R${Math.abs(p.financialImpact).toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
