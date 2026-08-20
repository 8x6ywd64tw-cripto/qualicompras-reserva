import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { TrendingDown, TrendingUp, DollarSign, BarChart3, PieChart, Activity, Target, Zap, Building2, ShoppingCart, Package, Handshake, Scale, LineChart } from "lucide-react";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Legend
} from "recharts";

const COLORS = ["#1e40af", "#0891b2", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#be185d", "#4f46e5", "#059669", "#ea580c"];

function formatCurrency(value: number): string {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}K`;
  return `R$ ${value.toFixed(0)}`;
}

function CustomTooltip({ active, payload, label, prefix = "R$" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-bold">{prefix} {Number(entry.value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </p>
      ))}
    </div>
  );
}

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
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} domain={["dataMin - 5", "dataMax + 5"]} />
              <Tooltip content={<CustomTooltip prefix="Índice:" />} />
              <Area type="monotone" dataKey="priceIndex" name="Índice" stroke="#2563eb" fill="url(#priceGradient)" strokeWidth={2.5} dot={{ r: 4, fill: "#2563eb", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export default function Analytics() {
  const { data, isLoading } = trpc.analytics.data.useQuery();
  const { data: suppliersList } = trpc.suppliers.list.useQuery();

  // Supplier ranking - clean data, sorted by value
  const supplierRanking = useMemo(() => {
    if (!data?.supplierRanking?.length || !suppliersList?.length) return [];
    return data.supplierRanking
      .map(sr => {
        const supplier = suppliersList.find((s: any) => s.id === sr.supplierId);
        const name = supplier?.tradeName || supplier?.companyName || "";
        return { name: name.length > 20 ? name.substring(0, 18) + "…" : name, fullName: name, pedidos: sr.orderCount, valor: parseFloat(sr.totalValue || "0") };
      })
      .filter(s => s.name && s.valor > 0)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);
  }, [data?.supplierRanking, suppliersList]);

  // Category distribution - clean data
  const categoryData = useMemo(() => {
    if (!data?.spendByCategory?.length) return [];
    return data.spendByCategory
      .filter((c: any) => c.category && c.category !== "null" && c.category !== "undefined")
      .map((c: any, i: number) => ({
        name: c.category.length > 18 ? c.category.substring(0, 16) + "…" : c.category,
        fullName: c.category,
        value: c.itemCount,
        fill: COLORS[i % COLORS.length],
      }));
  }, [data?.spendByCategory]);

  // Gasto por Unidade - FILTER OUT "Sem unidade" and empty names
  const cmvByUnit = useMemo(() => {
    if (!(data as any)?.savingsByUnit?.length) return [];
    return (data as any).savingsByUnit
      .filter((u: any) => u.unitName && u.unitName !== "Sem unidade" && u.unitName.trim() !== "")
      .map((u: any) => ({
        name: u.unitName.length > 14 ? u.unitName.substring(0, 12) + "…" : u.unitName,
        fullName: u.unitName,
        valor: parseFloat(u.totalValue || "0"),
        itens: u.itemCount,
      }))
      .sort((a: any, b: any) => b.valor - a.valor)
      .slice(0, 8);
  }, [(data as any)?.savingsByUnit]);

  // Top Products with price evolution
  const topProducts = useMemo(() => {
    if (!data?.priceHistory?.length) return [];
    const byProduct: Record<string, { prices: number[]; lastPrice: number; lastDate: Date; brand: string; supplier: string }> = {};
    for (const entry of data.priceHistory) {
      const key = `${entry.productName}|${(entry as any).brand || ''}`;
      const price = parseFloat(entry.unitPrice);
      if (price <= 0 || price > 200) continue;
      if (!byProduct[key]) byProduct[key] = { prices: [], lastPrice: 0, lastDate: new Date(0), brand: (entry as any).brand || '', supplier: entry.supplierName || '' };
      byProduct[key].prices.push(price);
      const entryDate = new Date(entry.recordedAt);
      if (entryDate > byProduct[key].lastDate) {
        byProduct[key].lastPrice = price;
        byProduct[key].lastDate = entryDate;
        byProduct[key].supplier = entry.supplierName || '';
      }
    }
    return Object.entries(byProduct)
      .filter(([_, v]) => v.prices.length >= 2)
      .map(([key, v]) => {
        const [name] = key.split('|');
        const avg = v.prices.reduce((a, b) => a + b, 0) / v.prices.length;
        return {
          name: name.length > 28 ? name.substring(0, 26) + "…" : name,
          fullName: name,
          brand: v.brand,
          entries: v.prices.length,
          avgPrice: avg,
          lastPrice: v.lastPrice,
          minPrice: Math.min(...v.prices),
          maxPrice: Math.max(...v.prices),
          variation: ((v.lastPrice - avg) / avg * 100),
          supplier: v.supplier,
        };
      })
      .sort((a, b) => b.entries - a.entries)
      .slice(0, 15);
  }, [data?.priceHistory]);

  // Parse saving values
  const totalSaving = parseFloat((data as any)?.totalSaving || "0");
  const savingNegociacao = parseFloat((data as any)?.savingNegociacao || "0");
  const savingCompetitiva = parseFloat((data as any)?.savingCompetitiva || "0");
  const savingMedia = parseFloat((data as any)?.savingMedia || "0");
  const totalSpend = parseFloat(data?.totalSpend || "0");
  const savingPct = (totalSpend + totalSaving) > 0 ? ((totalSaving / (totalSpend + totalSaving)) * 100).toFixed(1) : "0";

  // Saving breakdown for donut chart
  const savingBreakdown = useMemo(() => {
    const items = [];
    if (savingNegociacao > 0) items.push({ name: "Negociação", value: savingNegociacao, fill: "#16a34a" });
    if (savingCompetitiva > 0) items.push({ name: "Cotação Competitiva", value: savingCompetitiva, fill: "#2563eb" });
    if (savingMedia > 0) items.push({ name: "vs Média Histórica", value: savingMedia, fill: "#7c3aed" });
    return items;
  }, [savingNegociacao, savingCompetitiva, savingMedia]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Carregando analytics...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analytics de Compras</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Inteligência de preços com 3 dimensões de economia real
            </p>
          </div>
          <Badge variant="outline" className="text-xs gap-1 px-3 py-1">
            <Zap className="h-3 w-3 text-amber-500" />
            Dados em tempo real
          </Badge>
        </div>

        {/* === SAVING REAL - 3 DIMENSIONS === */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Saving por Negociação */}
          <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Handshake className="h-4 w-4 text-emerald-600" />
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Saving Negociação</p>
                  </div>
                  <p className="text-2xl font-black text-emerald-800">
                    {formatCurrency(savingNegociacao)}
                  </p>
                  <p className="text-[11px] text-emerald-600 mt-2 leading-tight">
                    Economia comprando mais barato que a última compra do mesmo produto + marca
                  </p>
                </div>
                <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <TrendingDown className="h-4 w-4 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Saving por Cotação Competitiva */}
          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Scale className="h-4 w-4 text-blue-600" />
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Saving Competitiva</p>
                  </div>
                  <p className="text-2xl font-black text-blue-800">
                    {formatCurrency(savingCompetitiva)}
                  </p>
                  <p className="text-[11px] text-blue-600 mt-2 leading-tight">
                    Diferença entre o 2º melhor preço e o preço que você comprou (benefício da competição)
                  </p>
                </div>
                <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Target className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Saving vs Média Histórica */}
          <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <LineChart className="h-4 w-4 text-purple-600" />
                    <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Saving vs Média</p>
                  </div>
                  <p className="text-2xl font-black text-purple-800">
                    {formatCurrency(savingMedia)}
                  </p>
                  <p className="text-[11px] text-purple-600 mt-2 leading-tight">
                    Quanto pagou abaixo da média histórica do item (preço pago vs média de todas as compras)
                  </p>
                </div>
                <div className="h-9 w-9 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                  <Activity className="h-4 w-4 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Total Saving Summary Bar */}
        <Card className="shadow-sm border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-emerald-700" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Economia Total Real</p>
                  <p className="text-3xl font-black text-emerald-800">{formatCurrency(totalSaving)}</p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Total Comprado</p>
                  <p className="font-bold text-gray-800">{formatCurrency(totalSpend)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">% Saving</p>
                  <p className="font-bold text-emerald-700">{savingPct}%</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Registros</p>
                  <p className="font-bold text-gray-800">{data?.priceHistory?.length || 0}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Row: Saving Breakdown Donut + Supplier Ranking */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Saving Breakdown Donut */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <PieChart className="h-5 w-5 text-emerald-600" />
                Composição da Economia
              </CardTitle>
              <p className="text-xs text-muted-foreground">Como cada tipo de saving contribui para o total</p>
            </CardHeader>
            <CardContent>
              {savingBreakdown.length > 0 ? (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width="50%" height={200}>
                    <RechartsPie>
                      <Pie data={savingBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3} strokeWidth={2} stroke="#fff">
                        {savingBreakdown.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                    </RechartsPie>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-3">
                    {savingBreakdown.map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 truncate">{item.name}</p>
                          <p className="text-sm font-bold">{formatCurrency(item.value)}</p>
                        </div>
                        <span className="text-xs text-gray-500 font-medium">
                          {totalSaving > 0 ? ((item.value / totalSaving) * 100).toFixed(0) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
                  <PieChart className="h-12 w-12 mb-3 opacity-20" />
                  <p className="font-medium">Sem dados de economia ainda</p>
                  <p className="text-xs mt-1 opacity-70">Savings serão calculados com base no histórico de compras.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ranking Fornecedores */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Ranking de Fornecedores por Volume
              </CardTitle>
              <p className="text-xs text-muted-foreground">Top fornecedores por valor total de compras</p>
            </CardHeader>
            <CardContent>
              {supplierRanking.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={supplierRanking} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#374151" }} axisLine={false} tickLine={false} width={130} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="valor" name="Volume" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[240px] flex flex-col items-center justify-center text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mb-3 opacity-20" />
                  <p className="font-medium">Sem dados de fornecedores</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row: Category Distribution + Spend by Unit */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Distribution */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Package className="h-5 w-5 text-amber-600" />
                Distribuição por Categoria
              </CardTitle>
              <p className="text-xs text-muted-foreground">Quantidade de itens cotados por setor</p>
            </CardHeader>
            <CardContent>
              {categoryData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="45%" height={200}>
                    <RechartsPie>
                      <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40} paddingAngle={2} strokeWidth={2} stroke="#fff">
                        {categoryData.map((entry: any, i: number) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number, name: string) => [`${v} itens`, name]} />
                    </RechartsPie>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2 max-h-[200px] overflow-y-auto">
                    {categoryData.map((item: any, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.fill }} />
                        <span className="text-xs text-gray-700 flex-1 truncate">{item.fullName}</span>
                        <span className="text-xs font-bold text-gray-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
                  <Package className="h-12 w-12 mb-3 opacity-20" />
                  <p className="font-medium">Sem dados de categorias</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gasto por Unidade */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600" />
                Gasto por Unidade / Obra
              </CardTitle>
              <p className="text-xs text-muted-foreground">Volume de compras por unidade operacional</p>
            </CardHeader>
            <CardContent>
              {cmvByUnit.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={cmvByUnit} margin={{ top: 10, right: 15, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="valor" name="Volume" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground">
                  <Building2 className="h-12 w-12 mb-3 opacity-20" />
                  <p className="font-medium">Sem dados por unidade</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Price Evolution by Category */}
        <PurchaseEvolutionSection />

        {/* Top Products Price Table */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-gray-700" />
              Top Produtos — Evolução de Preço
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Produtos com mais registros de preço. Variação = último preço vs média histórica.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {topProducts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-gray-50/80">
                      <th className="text-left py-2.5 px-4 font-semibold text-gray-600">Produto</th>
                      <th className="text-left py-2.5 px-3 font-semibold text-gray-600">Marca</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-gray-600">Último</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-gray-600">Média</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-gray-600">Mín</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-gray-600">Máx</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-gray-600">Variação</th>
                      <th className="text-center py-2.5 px-3 font-semibold text-gray-600">Registros</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                        <td className="py-2.5 px-4 font-medium text-gray-800">{p.name}</td>
                        <td className="py-2.5 px-3 text-gray-600">{p.brand || "—"}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium">R$ {p.lastPrice.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-gray-500">R$ {p.avgPrice.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-600">R$ {p.minPrice.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-red-600">R$ {p.maxPrice.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.variation < -2 ? "bg-emerald-100 text-emerald-800" :
                            p.variation > 2 ? "bg-red-100 text-red-800" :
                            "bg-gray-100 text-gray-700"
                          }`}>
                            {p.variation < 0 ? <TrendingDown className="h-3 w-3" /> : p.variation > 0 ? <TrendingUp className="h-3 w-3" /> : null}
                            {p.variation > 0 ? "+" : ""}{p.variation.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-gray-100 text-gray-700 text-[10px] font-bold">
                            {p.entries}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mb-3 opacity-20" />
                <p className="font-medium">Necessários pelo menos 2 registros por produto</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
