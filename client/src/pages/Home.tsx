import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { DollarSign, TrendingUp, TrendingDown, ShoppingCart, Users, Package, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart as RechartsPie, Pie, Area, AreaChart
} from "recharts";

const COLORS = ["#25346D", "#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#be185d"];

function PurchaseEvolutionSection() {
  const [category, setCategory] = useState("Cereais");
  const { data: evolutionData, isLoading } = trpc.orders.evolution.useQuery({ category });

  const chartData = useMemo(() => {
    if (!evolutionData?.evolution?.length) return [];
    return evolutionData.evolution.map((p: any) => ({
      period: p.period || new Date(p.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      priceIndex: p.priceIndex ?? 100,
    }));
  }, [evolutionData]);

  const categories = ["Cereais", "Limpeza", "Descartáveis", "Proteína", "Hortifruti", "Laticínios", "Pão", "Gás"];

  const trend = useMemo(() => {
    if (chartData.length < 2) return null;
    const first = chartData[0]?.priceIndex || 100;
    const last = chartData[chartData.length - 1]?.priceIndex || 100;
    return { direction: last <= first ? "down" : "up", change: Math.abs((last - first) / first * 100).toFixed(1) };
  }, [chartData]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Evolução de Preços por Categoria
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Índice base 100 = primeira compra. Mostra variação pura de preço ao longo do tempo.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {trend && (
              <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold ${
                trend.direction === "down" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
              }`}>
                {trend.direction === "down" ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                {trend.change}%
              </div>
            )}
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[180px] h-9 text-sm font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[260px] flex items-center justify-center text-muted-foreground">Carregando...</div>
        ) : chartData.length < 2 ? (
          <div className="h-[260px] flex flex-col items-center justify-center text-muted-foreground">
            <Activity className="h-12 w-12 mb-3 opacity-20" />
            <p className="font-medium">Dados insuficientes para <strong>{category}</strong></p>
            <p className="text-xs mt-1 opacity-70">Necessárias pelo menos 2 compras para gerar evolução.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="priceGradientHome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} domain={["dataMin - 5", "dataMax + 5"]} />
              <Tooltip content={({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
                    <p className="font-semibold text-gray-700 mb-1">{label}</p>
                    <p className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-600" />
                      <span className="text-gray-600">Índice:</span>
                      <span className="font-bold">{Number(payload[0].value).toFixed(1)}</span>
                    </p>
                  </div>
                );
              }} />
              <Area type="monotone" dataKey="priceIndex" name="Índice" stroke="#2563eb" fill="url(#priceGradientHome)" strokeWidth={2.5} dot={{ r: 4, fill: "#2563eb", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const { data: kpis, isLoading } = trpc.dashboard.kpis.useQuery();

  const monthlyData = useMemo(() => {
    if (!kpis?.purchasesByMonth) return [];
    return (kpis.purchasesByMonth as any[]).map((m: any) => ({
      month: m.month ? m.month.substring(5) + "/" + m.month.substring(2, 4) : "",
      total: parseFloat(m.total_value || "0"),
      orders: m.order_count || 0,
    })).reverse();
  }, [kpis]);

  const categoryData = useMemo(() => {
    if (!kpis?.categoryDistribution) return [];
    return (kpis.categoryDistribution as any[])
      .filter((c: any) => c.category)
      .map((c: any) => ({
        name: c.category,
        value: c.itemCount,
      }));
  }, [kpis]);

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (num >= 1000000) return `R$ ${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `R$ ${(num / 1000).toFixed(1)}K`;
    return `R$ ${num.toFixed(0)}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Central de Compras</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão geral da operação de compras e cotações</p>
        </div>

        {/* KPI Cards - Row 1: Main metrics */}
        <h2 className="text-lg font-semibold tracking-tight text-foreground/80">Indicadores de desempenho e volume de compras</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Saving Gerado - Total */}
          <Card className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Saving Total Real</p>
                  <p className="text-xl font-bold text-emerald-600">
                    {isLoading ? "—" : formatCurrency(kpis?.totalSaving || "0")}
                  </p>
                  {kpis?.savingPercentage && parseFloat(kpis.savingPercentage) > 0 && (
                    <div className="flex items-center gap-1">
                      <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                      <span className="text-xs text-emerald-600 font-medium">{kpis.savingPercentage}% economia</span>
                    </div>
                  )}
                </div>
                <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
              </div>
            </CardContent>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
          </Card>

          {/* Total Comprado */}
          <Card className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Comprado</p>
                  <p className="text-xl font-bold">
                    {isLoading ? "—" : formatCurrency(kpis?.totalPurchased || "0")}
                  </p>
                  <p className="text-xs text-muted-foreground">{kpis?.totalOrders || 0} pedidos</p>
                </div>
                <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardContent>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-blue-600" />
          </Card>

          {/* Cotações Abertas */}
          <Card className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cotações Abertas</p>
                  <p className="text-xl font-bold">{isLoading ? "—" : kpis?.openQuotations || 0}</p>
                  <p className="text-xs text-muted-foreground">{kpis?.pendingOrders || 0} pedidos pendentes</p>
                </div>
                <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Package className="h-4 w-4 text-amber-600" />
                </div>
              </div>
            </CardContent>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-amber-600" />
          </Card>

          {/* Fornecedores Ativos */}
          <Card className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fornecedores</p>
                  <p className="text-xl font-bold">{isLoading ? "—" : kpis?.activeSuppliers || 0}</p>
                  <p className="text-xs text-muted-foreground">ativos na base</p>
                </div>
                <div className="h-9 w-9 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Users className="h-4 w-4 text-purple-600" />
                </div>
              </div>
            </CardContent>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-400 to-purple-600" />
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bar Chart: Compras por Mês */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Volume de Compras por Mês</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}K`} />
                    <Tooltip formatter={(value: any) => [`R$ ${parseFloat(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Total"]} />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {monthlyData.map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={index === monthlyData.length - 1 ? "#2563eb" : "#93c5fd"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                  Dados de compras serão exibidos conforme pedidos forem gerados
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pie Chart: Distribuição por Categoria */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Itens por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              {categoryData.length > 0 ? (
                <div>
                  <ResponsiveContainer width="100%" height={150}>
                    <RechartsPie>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={2} dataKey="value">
                        {categoryData.map((_: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any, name: any) => [value, name]} />
                    </RechartsPie>
                  </ResponsiveContainer>
                  <div className="mt-2 space-y-1">
                    {categoryData.slice(0, 5).map((c: any, i: number) => (
                      <div key={c.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-muted-foreground truncate max-w-[120px]">{c.name}</span>
                        </div>
                        <span className="font-medium">{c.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                  Sem dados de categoria
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row: Top Suppliers + Recent Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Suppliers */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Top Fornecedores por Volume</CardTitle>
            </CardHeader>
            <CardContent>
              {(kpis?.topSuppliers as any[])?.length ? (
                <div className="space-y-3">
                  {(kpis!.topSuppliers as any[]).map((s: any, i: number) => (
                    <div key={s.supplierId} className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.orderCount} pedidos</p>
                      </div>
                      <p className="text-sm font-semibold">{formatCurrency(s.totalValue)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum pedido gerado ainda</p>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Evolução de Preços por Categoria */}
        <PurchaseEvolutionSection />
      </div>
    </DashboardLayout>
  );
}
