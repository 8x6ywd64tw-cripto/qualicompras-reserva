import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, TrendingUp, Building2, Users, BarChart3, PieChart, Calendar, ArrowDownRight, ArrowUpRight, Scale, Minus } from "lucide-react";

const formatCurrency = (v: number | string | null) => {
  const num = typeof v === "string" ? parseFloat(v) : v;
  if (!num) return "R$ 0,00";
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const formatPercent = (v: number) => `${v.toFixed(1)}%`;

export default function HistoricoCompras() {
  const [unitFilter, setUnitFilter] = useState("all");
  const [tab, setTab] = useState("comparativo");

  const { data: summary, isLoading } = trpc.historicalPayments.summary.useQuery({
    unitName: unitFilter !== "all" ? unitFilter : undefined,
    category: "alimentos",
  });

  const { data: topSuppliers } = trpc.historicalPayments.topSuppliers.useQuery({
    unitName: unitFilter !== "all" ? unitFilter : undefined,
    category: "alimentos",
    limit: 30,
  });

  const { data: allRecords } = trpc.historicalPayments.list.useQuery({
    unitName: unitFilter !== "all" ? unitFilter : undefined,
    category: "alimentos",
    limit: 200,
  });

  const { data: comparativo } = trpc.historicalPayments.comparativo.useQuery();

  // Compute derived metrics
  const metrics = useMemo(() => {
    if (!summary) return null;
    const totalValue = parseFloat(summary.totals?.total || "0");
    const totalCount = summary.totals?.count || 0;
    const avgTicket = totalCount > 0 ? totalValue / totalCount : 0;
    const uniqueSuppliers = topSuppliers?.length || 0;
    const unitCount = summary.byUnit?.length || 0;

    // Curva ABC calculation
    const curvaA: typeof topSuppliers = [];
    const curvaB: typeof topSuppliers = [];
    const curvaC: typeof topSuppliers = [];
    let accumulated = 0;
    
    if (topSuppliers && totalValue > 0) {
      for (const s of topSuppliers) {
        const sTotal = parseFloat(s.total || "0");
        accumulated += sTotal;
        const pct = (accumulated / totalValue) * 100;
        if (pct <= 80) curvaA.push(s);
        else if (pct <= 95) curvaB.push(s);
        else curvaC.push(s);
      }
    }

    // Concentration index (HHI-like)
    let hhi = 0;
    if (topSuppliers && totalValue > 0) {
      for (const s of topSuppliers) {
        const share = parseFloat(s.total || "0") / totalValue;
        hhi += share * share;
      }
    }
    const concentrationLevel = hhi > 0.25 ? "Alta" : hhi > 0.15 ? "Moderada" : "Baixa";
    const concentrationColor = hhi > 0.25 ? "text-red-600" : hhi > 0.15 ? "text-yellow-600" : "text-green-600";

    return { totalValue, totalCount, avgTicket, uniqueSuppliers, unitCount, curvaA, curvaB, curvaC, hhi, concentrationLevel, concentrationColor };
  }, [summary, topSuppliers]);

  // Daily spending for timeline
  const dailyData = useMemo(() => {
    if (!summary?.byDate) return [];
    return summary.byDate.map(d => ({
      date: d.entryDate,
      total: parseFloat(d.total || "0"),
      count: d.count,
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [summary]);

  // Unit comparison
  const unitData = useMemo(() => {
    if (!summary?.byUnit) return [];
    const totalValue = parseFloat(summary.totals?.total || "0");
    return summary.byUnit.map(u => ({
      name: u.unitName,
      total: parseFloat(u.total || "0"),
      count: u.count,
      pct: totalValue > 0 ? (parseFloat(u.total || "0") / totalValue) * 100 : 0,
    }));
  }, [summary]);

  const units = useMemo(() => {
    if (!summary?.byUnit) return [];
    return summary.byUnit.map(u => u.unitName).filter(u => u !== "Não identificada");
  }, [summary]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-muted rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Histórico de Compras</h1>
          <p className="text-sm text-muted-foreground">Dados retroativos do Fortes AG — Maio/2026 — Apenas insumos alimentícios</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={unitFilter} onValueChange={setUnitFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todas as Unidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Unidades</SelectItem>
              {units.map(u => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-xs">
            <Calendar className="w-3 h-3 mr-1" />
            Mai/2026
          </Badge>
        </div>
      </div>

      {/* KPI Cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <DollarSign className="w-3.5 h-3.5" />
                Total Compras Alimentos
              </div>
              <div className="text-xl font-bold text-foreground">{formatCurrency(metrics.totalValue)}</div>
              <div className="text-xs text-muted-foreground">{metrics.totalCount} pedidos no período</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <TrendingUp className="w-3.5 h-3.5" />
                Ticket Médio
              </div>
              <div className="text-xl font-bold text-foreground">{formatCurrency(metrics.avgTicket)}</div>
              <div className="text-xs text-muted-foreground">por pedido de compra</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Users className="w-3.5 h-3.5" />
                Fornecedores Ativos
              </div>
              <div className="text-xl font-bold text-foreground">{metrics.uniqueSuppliers}</div>
              <div className="text-xs text-muted-foreground">no período</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <PieChart className="w-3.5 h-3.5" />
                Concentração
              </div>
              <div className={`text-xl font-bold ${metrics.concentrationColor}`}>{metrics.concentrationLevel}</div>
              <div className="text-xs text-muted-foreground">HHI: {(metrics.hhi * 10000).toFixed(0)} pts</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="curva-abc">Curva ABC</TabsTrigger>
          <TabsTrigger value="unidades">Por Unidade</TabsTrigger>
          <TabsTrigger value="timeline">Linha do Tempo</TabsTrigger>
          <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
          <TabsTrigger value="comparativo" className="text-emerald-700 font-semibold">Fortes vs QualiCompras</TabsTrigger>
        </TabsList>

        {/* VISÃO GERAL */}
        <TabsContent value="visao-geral" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top 10 Fornecedores */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Top 10 Fornecedores (por valor)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {topSuppliers?.slice(0, 10).map((s, i) => {
                    const total = parseFloat(s.total || "0");
                    const maxVal = parseFloat(topSuppliers[0]?.total || "1");
                    const pct = metrics ? (total / metrics.totalValue) * 100 : 0;
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="text-xs font-medium truncate">{s.supplierName}</span>
                            <span className="text-xs font-mono">{formatCurrency(total)}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${(total / maxVal) * 100}%` }}
                            />
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] px-1">{formatPercent(pct)}</Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Distribuição por Unidade */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Distribuição por Unidade
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {unitData.map((u, i) => {
                    const colors = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500", "bg-rose-500", "bg-cyan-500", "bg-orange-500"];
                    return (
                      <div key={i}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium">{u.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{u.count} pedidos</span>
                            <span className="text-sm font-mono font-medium">{formatCurrency(u.total)}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${colors[i % colors.length]} rounded-full transition-all`}
                            style={{ width: `${u.pct}%` }}
                          />
                        </div>
                        <div className="text-right text-[10px] text-muted-foreground">{formatPercent(u.pct)}</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* CURVA ABC */}
        <TabsContent value="curva-abc" className="space-y-4 mt-4">
          {metrics && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="border-l-4 border-l-red-500">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground mb-1">Curva A (80% do gasto)</div>
                    <div className="text-lg font-bold">{metrics.curvaA.length} fornecedores</div>
                    <div className="text-xs text-red-600 font-medium">Críticos — monitorar de perto</div>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-yellow-500">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground mb-1">Curva B (15% do gasto)</div>
                    <div className="text-lg font-bold">{metrics.curvaB.length} fornecedores</div>
                    <div className="text-xs text-yellow-600 font-medium">Intermediários — oportunidade</div>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground mb-1">Curva C (5% do gasto)</div>
                    <div className="text-lg font-bold">{metrics.curvaC.length} fornecedores</div>
                    <div className="text-xs text-green-600 font-medium">Baixo impacto — simplificar</div>
                  </CardContent>
                </Card>
              </div>

              {/* Curva A Table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-red-700">Fornecedores Curva A — Concentram 80% do gasto</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead className="text-right">Pedidos</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">% do Total</TableHead>
                        <TableHead className="text-right">% Acumulado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        let acc = 0;
                        return metrics.curvaA.map((s, i) => {
                          const total = parseFloat(s?.total || "0");
                          acc += total;
                          const pct = (total / metrics.totalValue) * 100;
                          const accPct = (acc / metrics.totalValue) * 100;
                          return (
                            <TableRow key={i}>
                              <TableCell className="font-mono text-xs">{i + 1}</TableCell>
                              <TableCell className="font-medium text-sm">{s?.supplierName}</TableCell>
                              <TableCell className="text-right text-sm">{s?.count}</TableCell>
                              <TableCell className="text-right font-mono text-sm">{formatCurrency(total)}</TableCell>
                              <TableCell className="text-right text-sm">{formatPercent(pct)}</TableCell>
                              <TableCell className="text-right text-sm font-medium">{formatPercent(accPct)}</TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* POR UNIDADE */}
        <TabsContent value="unidades" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unitData.map((u, i) => (
              <Card key={i} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-sm">{u.name}</h3>
                      <p className="text-xs text-muted-foreground">{u.count} pedidos</p>
                    </div>
                    <Badge variant={u.pct > 25 ? "destructive" : u.pct > 15 ? "default" : "secondary"}>
                      {formatPercent(u.pct)}
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold">{formatCurrency(u.total)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Ticket médio: {formatCurrency(u.count > 0 ? u.total / u.count : 0)}
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-3">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${u.pct}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* TIMELINE */}
        <TabsContent value="timeline" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Gastos Diários — Maio/2026</CardTitle>
            </CardHeader>
            <CardContent>
              {dailyData.length > 0 && (
                <div className="space-y-1">
                  {dailyData.map((d, i) => {
                    const maxDay = Math.max(...dailyData.map(x => x.total));
                    const pct = maxDay > 0 ? (d.total / maxDay) * 100 : 0;
                    return (
                      <div key={i} className="flex items-center gap-2 group hover:bg-muted/50 rounded px-1 py-0.5">
                        <span className="text-xs font-mono text-muted-foreground w-20">{d.date}</span>
                        <div className="flex-1 h-4 bg-muted/30 rounded overflow-hidden">
                          <div
                            className="h-full bg-emerald-500/80 rounded transition-all group-hover:bg-emerald-600"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono w-24 text-right">{formatCurrency(d.total)}</span>
                        <span className="text-[10px] text-muted-foreground w-8 text-right">{d.count}x</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DETALHES */}
        <TabsContent value="detalhes" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Todos os Registros de Compra</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allRecords?.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-mono">{r.entryDate}</TableCell>
                        <TableCell className="text-sm font-medium">{r.supplierName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{r.unitName}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatCurrency(parseFloat(r.value as any))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COMPARATIVO FORTES vs QUALICOMPRAS */}
        <TabsContent value="comparativo" className="space-y-6 mt-4">
          {comparativo ? (
            <>
              {/* Header explicativo */}
              <Card className="border-emerald-200 bg-emerald-50/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Scale className="w-5 h-5 text-emerald-700" />
                    <span className="font-semibold text-emerald-900">Comparação Proporcional por Período</span>
                  </div>
                  <p className="text-sm text-emerald-800">
                    <strong>Fortes (sem QualiCompras):</strong> {comparativo.fortes.period} — {comparativo.fortes.calendarDays} dias — R$ {comparativo.fortes.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})} total
                  </p>
                  <p className="text-sm text-emerald-800">
                    <strong>QualiCompras (cotação centralizada):</strong> {comparativo.qualicompras.firstDate} a {comparativo.qualicompras.lastDate} — {comparativo.qualicompras.calendarDays} dias — R$ {comparativo.qualicompras.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})} total
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">Valores normalizados para gasto/dia para comparação justa entre períodos diferentes. Projeção mensal = gasto/dia × 30.</p>
                </CardContent>
              </Card>

              {/* KPI Cards de Comparação */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground mb-1">Projeção Mensal — Fortes (baseline)</div>
                    <div className="text-xl font-bold text-red-600">{formatCurrency(comparativo.fortes.monthlyProjection)}</div>
                    <div className="text-xs text-muted-foreground">R$ {comparativo.fortes.dailyRate.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}/dia × 30 dias</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground mb-1">Projeção Mensal — QualiCompras</div>
                    <div className="text-xl font-bold text-blue-600">{formatCurrency(comparativo.qualicompras.monthlyProjection)}</div>
                    <div className="text-xs text-muted-foreground">R$ {comparativo.qualicompras.dailyRate.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}/dia × 30 dias</div>
                  </CardContent>
                </Card>
                <Card className={comparativo.economy.isPositive ? "border-green-300 bg-green-50/50" : "border-red-300 bg-red-50/50"}>
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground mb-1">Economia Mensal Estimada</div>
                    <div className={`text-xl font-bold flex items-center gap-1 ${comparativo.economy.isPositive ? 'text-green-700' : 'text-red-700'}`}>
                      {comparativo.economy.isPositive ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                      {formatCurrency(Math.abs(comparativo.economy.absolute))}
                    </div>
                    <div className={`text-xs font-medium ${comparativo.economy.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {comparativo.economy.isPositive ? '↓' : '↑'} {Math.abs(comparativo.economy.percent).toFixed(1)}% {comparativo.economy.isPositive ? 'mais barato' : 'mais caro'} que o período Fortes
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Barra visual de comparação */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Gasto Diário Normalizado</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-red-700">Fortes (Mai/2026)</span>
                      <span className="font-mono">R$ {comparativo.fortes.dailyRate.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}/dia</span>
                    </div>
                    <div className="h-8 bg-red-100 rounded-md overflow-hidden">
                      <div className="h-full bg-red-500 rounded-md" style={{ width: '100%' }} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-blue-700">QualiCompras (Jul/2026)</span>
                      <span className="font-mono">R$ {comparativo.qualicompras.dailyRate.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}/dia</span>
                    </div>
                    <div className="h-8 bg-blue-100 rounded-md overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-md" style={{ width: `${Math.min(100, (comparativo.qualicompras.dailyRate / Math.max(comparativo.fortes.dailyRate, 1)) * 100)}%` }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Resumo numérico */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-red-700">Período Fortes (sem QualiCompras)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableBody>
                        <TableRow><TableCell className="text-muted-foreground">Período</TableCell><TableCell className="text-right font-mono">{comparativo.fortes.period}</TableCell></TableRow>
                        <TableRow><TableCell className="text-muted-foreground">Total gasto</TableCell><TableCell className="text-right font-mono">{formatCurrency(comparativo.fortes.total)}</TableCell></TableRow>
                        <TableRow><TableCell className="text-muted-foreground">Pedidos</TableCell><TableCell className="text-right font-mono">{comparativo.fortes.count}</TableCell></TableRow>
                        <TableRow><TableCell className="text-muted-foreground">Fornecedores</TableCell><TableCell className="text-right font-mono">{comparativo.fortes.supplierCount}</TableCell></TableRow>
                        <TableRow><TableCell className="text-muted-foreground">Gasto/dia</TableCell><TableCell className="text-right font-mono font-bold">{formatCurrency(comparativo.fortes.dailyRate)}</TableCell></TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-blue-700">Período QualiCompras (cotação centralizada)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableBody>
                        <TableRow><TableCell className="text-muted-foreground">Período</TableCell><TableCell className="text-right font-mono">{comparativo.qualicompras.firstDate} a {comparativo.qualicompras.lastDate}</TableCell></TableRow>
                        <TableRow><TableCell className="text-muted-foreground">Total gasto</TableCell><TableCell className="text-right font-mono">{formatCurrency(comparativo.qualicompras.total)}</TableCell></TableRow>
                        <TableRow><TableCell className="text-muted-foreground">Pedidos</TableCell><TableCell className="text-right font-mono">{comparativo.qualicompras.count}</TableCell></TableRow>
                        <TableRow><TableCell className="text-muted-foreground">Fornecedores</TableCell><TableCell className="text-right font-mono">{comparativo.qualicompras.supplierCount}</TableCell></TableRow>
                        <TableRow><TableCell className="text-muted-foreground">Gasto/dia</TableCell><TableCell className="text-right font-mono font-bold">{formatCurrency(comparativo.qualicompras.dailyRate)}</TableCell></TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              {/* Comparação por Fornecedor */}
              {comparativo.supplierComparison.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Mesmo Fornecedor: Antes vs. Depois (gasto/dia normalizado)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fornecedor</TableHead>
                            <TableHead className="text-right">Fortes (R$/dia)</TableHead>
                            <TableHead className="text-right">QualiCompras (R$/dia)</TableHead>
                            <TableHead className="text-right">Variação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {comparativo.supplierComparison.map((s, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{s.name}</TableCell>
                              <TableCell className="text-right font-mono text-red-600">{formatCurrency(s.fortesDailyRate)}</TableCell>
                              <TableCell className="text-right font-mono text-blue-600">{formatCurrency(s.qcDailyRate)}</TableCell>
                              <TableCell className="text-right">
                                <span className={`inline-flex items-center gap-0.5 font-mono text-sm font-medium ${s.variation < 0 ? 'text-green-700' : s.variation > 0 ? 'text-red-700' : 'text-gray-500'}`}>
                                  {s.variation < 0 ? <ArrowDownRight className="w-3.5 h-3.5" /> : s.variation > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                                  {Math.abs(s.variation).toFixed(1)}%
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">Variação negativa (verde) = gastando menos com QualiCompras. Positiva (vermelho) = gastando mais.</p>
                  </CardContent>
                </Card>
              )}

              {/* Nota de evolução */}
              <Card className="border-blue-200 bg-blue-50/30">
                <CardContent className="p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Evolução temporal:</strong> Este comparativo se atualiza automaticamente conforme novos pedidos são aprovados no QualiCompras. 
                    Quanto mais meses de dados acumulados, mais precisa será a análise de economia real. 
                    Atualmente com {comparativo.qualicompras.calendarDays} dias de operação no QualiCompras vs. {comparativo.fortes.calendarDays} dias de baseline do Fortes.
                  </p>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="flex items-center justify-center h-40">
              <div className="animate-pulse text-muted-foreground">Carregando comparativo...</div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
