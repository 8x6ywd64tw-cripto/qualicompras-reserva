import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, TrendingUp, TrendingDown, BarChart3, Package, Users, Building2, Search, ArrowUpDown, AlertTriangle } from "lucide-react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatCurrency(value: number | string) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatNumber(value: number | string, decimals = 1) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return num.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ==================== SUMMARY CARDS ====================
function SummaryPanel() {
  const { data, isLoading } = trpc.purchaseIntelligence.summary.useQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    { label: "Volume Total", value: formatCurrency(data.totalSpend || 0), icon: BarChart3, color: "text-blue-500" },
    { label: "Produtos Únicos", value: data.uniqueProducts?.toString() || "0", icon: Package, color: "text-green-500" },
    { label: "Fornecedores", value: data.uniqueSuppliers?.toString() || "0", icon: Users, color: "text-orange-500" },
    { label: "Unidades", value: data.uniqueUnits?.toString() || "0", icon: Building2, color: "text-purple-500" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {cards.map((c, i) => (
        <Card key={i} className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted ${c.color}`}>
                <c.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-lg font-bold">{c.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ==================== PRICE INDEX PANEL ====================
function PriceIndexPanel({ unitFilter, sectorFilter }: { unitFilter: string; sectorFilter: string }) {
  const [search, setSearch] = useState("");
  const { data, isLoading } = trpc.purchaseIntelligence.priceIndex.useQuery({
    unitName: unitFilter || undefined,
    sector: sectorFilter || undefined,
  });

  const grouped = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    const map = new Map<string, any[]>();
    for (const row of data) {
      const key = row.productName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    // Convert to array with trend calculation
    return Array.from(map.entries())
      .map(([name, rows]) => {
        const sorted = rows.sort((a: any, b: any) => a.weekNumber - b.weekNumber);
        const first = parseFloat(sorted[0].avgPrice);
        const last = parseFloat(sorted[sorted.length - 1].avgPrice);
        const trend = first > 0 ? ((last - first) / first) * 100 : 0;
        return { name, rows: sorted, trend, lastPrice: last, firstPrice: first };
      })
      .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => Math.abs(b.trend) - Math.abs(a.trend));
  }, [data, search]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar produto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Badge variant="secondary">{grouped.length} produtos</Badge>
      </div>
      <div className="max-h-[500px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">1o Preço</TableHead>
              <TableHead className="text-right">Último Preço</TableHead>
              <TableHead className="text-right">Variação</TableHead>
              <TableHead className="text-center">Amostras</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grouped.slice(0, 50).map((p) => (
              <TableRow key={p.name}>
                <TableCell className="font-medium text-sm max-w-[200px] truncate">{p.name}</TableCell>
                <TableCell className="text-right">{formatCurrency(p.firstPrice)}</TableCell>
                <TableCell className="text-right">{formatCurrency(p.lastPrice)}</TableCell>
                <TableCell className="text-right">
                  <span className={`flex items-center justify-end gap-1 ${p.trend > 0 ? "text-red-500" : p.trend < 0 ? "text-green-500" : "text-muted-foreground"}`}>
                    {p.trend > 0 ? <TrendingUp className="h-3 w-3" /> : p.trend < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                    {p.trend > 0 ? "+" : ""}{p.trend.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell className="text-center">{p.rows.length}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ==================== SEASONALITY PANEL ====================
function SeasonalityPanel({ unitFilter, sectorFilter }: { unitFilter: string; sectorFilter: string }) {
  const { data, isLoading } = trpc.purchaseIntelligence.seasonality.useQuery({
    unitName: unitFilter || undefined,
    sector: sectorFilter || undefined,
  });

  const weeklyData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    const weekMap = new Map<number, { week: number; label: string; spend: number; products: number; transactions: number }>();
    for (const row of data) {
      const wk = row.weekNumber;
      if (!weekMap.has(wk)) {
        weekMap.set(wk, { week: wk, label: row.weekLabel || `Sem ${wk}`, spend: 0, products: 0, transactions: 0 });
      }
      const entry = weekMap.get(wk)!;
      entry.spend += parseFloat(row.totalSpend || "0");
      entry.products += parseInt(row.productCount || "0");
      entry.transactions += parseInt(row.transactionCount || "0");
    }
    return Array.from(weekMap.values()).sort((a, b) => a.week - b.week);
  }, [data]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const maxSpend = Math.max(...weeklyData.map(w => w.spend), 1);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Gasto semanal (Abr-Jul/2026) — barras proporcionais ao maior valor</p>
      <div className="space-y-2">
        {weeklyData.map((w) => (
          <div key={w.week} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-20 shrink-0">{w.label}</span>
            <div className="flex-1 h-7 bg-muted rounded-md overflow-hidden relative">
              <div
                className="h-full bg-blue-500/80 rounded-md transition-all"
                style={{ width: `${(w.spend / maxSpend) * 100}%` }}
              />
              <span className="absolute inset-0 flex items-center px-2 text-xs font-medium">
                {formatCurrency(w.spend)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground w-16 text-right">{w.transactions} itens</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== UNIT COMPARISON PANEL (with Discrepancy Alerts) ====================
function UnitComparisonPanel({ sectorFilter }: { sectorFilter: string }) {
  const [search, setSearch] = useState("");
  const [showAlerts, setShowAlerts] = useState(true);
  const { data, isLoading } = trpc.purchaseIntelligence.unitComparison.useQuery({
    sector: sectorFilter || undefined,
  });

  const { grouped, alerts } = useMemo(() => {
    if (!data || !Array.isArray(data)) return { grouped: [], alerts: [] };
    const map = new Map<string, any[]>();
    for (const row of data) {
      if (!map.has(row.productName)) map.set(row.productName, []);
      map.get(row.productName)!.push(row);
    }
    const products = Array.from(map.entries())
      .filter(([, rows]) => rows.length > 1)
      .map(([name, rows]) => {
        const prices = rows.map((r: any) => parseFloat(r.avgPrice));
        const avgAll = prices.reduce((s, p) => s + p, 0) / prices.length;
        const spread = Math.max(...prices) - Math.min(...prices);
        const spreadPct = Math.min(...prices) > 0 ? (spread / Math.min(...prices)) * 100 : 0;
        // Mark each row with deviation from mean
        const enrichedRows = rows.map((r: any) => {
          const price = parseFloat(r.avgPrice);
          const deviationPct = avgAll > 0 ? ((price - avgAll) / avgAll) * 100 : 0;
          const isDiscrepant = deviationPct > 20;
          return { ...r, deviationPct, isDiscrepant, avgAll };
        });
        return { name, rows: enrichedRows, spread, spreadPct, avgAll };
      })
      .sort((a, b) => b.spreadPct - a.spreadPct);

    // Generate alerts: unit+product combos where price is >20% above the cross-unit mean
    const discrepancyAlerts: any[] = [];
    for (const p of products) {
      for (const row of p.rows) {
        if (row.isDiscrepant) {
          discrepancyAlerts.push({
            product: p.name,
            unit: row.unitName,
            price: parseFloat(row.avgPrice),
            avgAll: p.avgAll,
            deviationPct: row.deviationPct,
            spread: p.spread,
            totalSpend: parseFloat(row.totalSpend || "0"),
          });
        }
      }
    }
    discrepancyAlerts.sort((a, b) => b.deviationPct - a.deviationPct);

    const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));
    return { grouped: filtered, alerts: discrepancyAlerts };
  }, [data, search]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      {/* Discrepancy Alerts Banner */}
      {alerts.length > 0 && showAlerts && (
        <Card className="border-red-500/50 bg-red-500/5">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <CardTitle className="text-sm font-bold text-red-500">
                  {alerts.length} Alertas de Discrepância (&gt;20% acima da média)
                </CardTitle>
              </div>
              <button onClick={() => setShowAlerts(false)} className="text-xs text-muted-foreground hover:text-foreground">
                Ocultar
              </button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {alerts.slice(0, 15).map((a, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-border/30 pb-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="text-xs px-1.5 py-0">
                      +{a.deviationPct.toFixed(0)}%
                    </Badge>
                    <span className="font-medium truncate max-w-[200px]">{a.product}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-red-500 font-bold">{a.unit}: {formatCurrency(a.price)}</span>
                    <span className="text-muted-foreground">média: {formatCurrency(a.avgAll)}</span>
                  </div>
                </div>
              ))}
              {alerts.length > 15 && (
                <p className="text-xs text-muted-foreground text-center">+ {alerts.length - 15} alertas adicionais</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search + Counter */}
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar produto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Badge variant="secondary">{grouped.length} produtos com diferença</Badge>
        {!showAlerts && alerts.length > 0 && (
          <button onClick={() => setShowAlerts(true)} className="text-xs text-red-500 hover:underline">
            Mostrar {alerts.length} alertas
          </button>
        )}
      </div>

      {/* Table with discrepancy highlighting */}
      <div className="max-h-[500px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-right">Preço Médio</TableHead>
              <TableHead className="text-right">Desvio</TableHead>
              <TableHead className="text-right">Qtd Total</TableHead>
              <TableHead className="text-right">Spread</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grouped.slice(0, 30).flatMap((p) =>
              p.rows.map((row: any, idx: number) => (
                <TableRow
                  key={`${p.name}-${row.unitName}`}
                  className={`${idx === 0 ? "border-t-2" : ""} ${row.isDiscrepant ? "bg-red-500/5" : ""}`}
                >
                  {idx === 0 ? (
                    <TableCell rowSpan={p.rows.length} className="font-medium text-sm align-top max-w-[180px]">
                      <div className="truncate">{p.name}</div>
                      <Badge variant="outline" className={`mt-1 text-xs ${p.spreadPct > 20 ? "border-red-500 text-red-500" : p.spreadPct > 10 ? "border-orange-500 text-orange-500" : "border-green-500 text-green-500"}`}>
                        {p.spreadPct.toFixed(0)}% spread
                      </Badge>
                    </TableCell>
                  ) : null}
                  <TableCell className="text-sm">{row.unitName}</TableCell>
                  <TableCell className={`text-right ${row.isDiscrepant ? "text-red-500 font-bold" : ""}`}>
                    {formatCurrency(row.avgPrice)}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    <span className={row.deviationPct > 20 ? "text-red-500 font-bold" : row.deviationPct > 10 ? "text-orange-500" : row.deviationPct < -10 ? "text-green-500" : "text-muted-foreground"}>
                      {row.deviationPct > 0 ? "+" : ""}{row.deviationPct.toFixed(0)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(row.totalQty)}</TableCell>
                  {idx === 0 ? (
                    <TableCell rowSpan={p.rows.length} className="text-right align-top font-bold text-red-500">
                      {formatCurrency(p.spread)}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ==================== SUPPLIER BY SECTOR PANEL ====================
function SupplierBySectorPanel({ unitFilter }: { unitFilter: string }) {
  const { data, isLoading } = trpc.purchaseIntelligence.supplierBySector.useQuery({
    unitName: unitFilter || undefined,
  });

  const sectorGroups = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    const map = new Map<string, any[]>();
    for (const row of data) {
      const sector = row.sector || "Sem setor";
      if (!map.has(sector)) map.set(sector, []);
      map.get(sector)!.push(row);
    }
    return Array.from(map.entries())
      .map(([sector, suppliers]) => ({
        sector,
        totalSpend: suppliers.reduce((s: number, r: any) => s + parseFloat(r.totalSpend || "0"), 0),
        suppliers: suppliers.sort((a: any, b: any) => parseFloat(b.totalSpend) - parseFloat(a.totalSpend)),
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend);
  }, [data]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4 max-h-[500px] overflow-y-auto">
      {sectorGroups.map((sg) => (
        <Card key={sg.sector} className="border-border/50">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">{sg.sector}</CardTitle>
              <Badge variant="secondary">{formatCurrency(sg.totalSpend)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="space-y-1">
              {sg.suppliers.slice(0, 5).map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="truncate max-w-[200px]">{s.supplierName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">{s.unitName}</span>
                    <span className="font-medium">{formatCurrency(s.totalSpend)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ==================== ABC CURVE PANEL (with Pareto Chart) ====================
function AbcCurvePanel({ unitFilter, sectorFilter }: { unitFilter: string; sectorFilter: string }) {
  const { data, isLoading } = trpc.purchaseIntelligence.abcCurve.useQuery({
    unitName: unitFilter || undefined,
    sector: sectorFilter || undefined,
  });

  const { classified, chartData } = useMemo(() => {
    if (!data || !Array.isArray(data)) return { classified: { a: [], b: [], c: [], total: 0 }, chartData: [] };
    const total = data.reduce((s: number, r: any) => s + parseFloat(r.totalSpend || "0"), 0);
    let cumulative = 0;
    const items = data.map((r: any) => {
      cumulative += parseFloat(r.totalSpend || "0");
      const pct = (cumulative / total) * 100;
      const cls = pct <= 80 ? "A" : pct <= 95 ? "B" : "C";
      return { ...r, cumulativePct: pct, classification: cls, spend: parseFloat(r.totalSpend || "0") };
    });
    // Chart data: top 25 products for Pareto
    const chart = items.slice(0, 25).map((item: any) => ({
      name: item.productName.length > 18 ? item.productName.slice(0, 16) + "..." : item.productName,
      fullName: item.productName,
      spend: item.spend,
      cumPct: parseFloat(item.cumulativePct.toFixed(1)),
      cls: item.classification,
    }));
    return {
      classified: {
        a: items.filter((i: any) => i.classification === "A"),
        b: items.filter((i: any) => i.classification === "B"),
        c: items.filter((i: any) => i.classification === "C"),
        total,
      },
      chartData: chart,
    };
  }, [data]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const getBarColor = (cls: string) => {
    if (cls === "A") return "#ef4444";
    if (cls === "B") return "#f97316";
    return "#22c55e";
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-500">{classified.a.length}</p>
            <p className="text-xs text-muted-foreground">Classe A (80% gasto)</p>
            <p className="text-xs text-red-400 mt-1">{formatCurrency(classified.a.reduce((s: number, i: any) => s + i.spend, 0))}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-orange-500">{classified.b.length}</p>
            <p className="text-xs text-muted-foreground">Classe B (15% gasto)</p>
            <p className="text-xs text-orange-400 mt-1">{formatCurrency(classified.b.reduce((s: number, i: any) => s + i.spend, 0))}</p>
          </CardContent>
        </Card>
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-500">{classified.c.length}</p>
            <p className="text-xs text-muted-foreground">Classe C (5% gasto)</p>
            <p className="text-xs text-green-400 mt-1">{formatCurrency(classified.c.reduce((s: number, i: any) => s + i.spend, 0))}</p>
          </CardContent>
        </Card>
      </div>

      {/* Pareto Chart */}
      {chartData.length > 0 && (
        <div className="w-full h-[320px] mt-4">
          <p className="text-xs text-muted-foreground mb-2">Diagrama de Pareto — Top 25 produtos (barras = gasto, linha = % acumulado)</p>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 40, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 10 }} />
              <YAxis yAxisId="left" tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(value: any, name: string) => {
                  if (name === "spend") return [formatCurrency(value), "Gasto"];
                  return [`${value}%`, "% Acumulado"];
                }}
                labelFormatter={(label: string, payload: any[]) => payload?.[0]?.payload?.fullName || label}
              />
              <Bar yAxisId="left" dataKey="spend" name="spend" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.cls)} />
                ))}
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="cumPct" name="cumPct" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="max-h-[400px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead className="text-right">Gasto Total</TableHead>
              <TableHead className="text-right">% Acum.</TableHead>
              <TableHead className="text-center">Classe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classified.a.concat(classified.b).slice(0, 40).map((item: any, idx: number) => (
              <TableRow key={idx}>
                <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                <TableCell className="font-medium text-sm max-w-[180px] truncate">{item.productName}</TableCell>
                <TableCell className="text-xs">{item.sector || "-"}</TableCell>
                <TableCell className="text-right">{formatCurrency(item.totalSpend)}</TableCell>
                <TableCell className="text-right text-xs">{parseFloat(item.cumulativePct).toFixed(1)}%</TableCell>
                <TableCell className="text-center">
                  <Badge variant={item.classification === "A" ? "destructive" : "secondary"} className="text-xs">
                    {item.classification}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ==================== WEEKLY EVOLUTION PANEL ====================
function WeeklyEvolutionPanel({ unitFilter, sectorFilter }: { unitFilter: string; sectorFilter: string }) {
  const { data, isLoading } = trpc.purchaseIntelligence.weeklyEvolution.useQuery({
    unitName: unitFilter || undefined,
    sector: sectorFilter || undefined,
  });

  const weeklyByUnit = useMemo((): { units: [string, Map<number, number>][]; weeks: number[] } => {
    if (!data || !Array.isArray(data)) return { units: [], weeks: [] };
    const map = new Map<string, Map<number, number>>();
    const weeks = new Set<number>();
    for (const row of data as any[]) {
      const unit = row.unitName || "Total";
      if (!map.has(unit)) map.set(unit, new Map());
      const wk = row.weekNumber as number;
      weeks.add(wk);
      const current = map.get(unit)!.get(wk) || 0;
      map.get(unit)!.set(wk, current + parseFloat(row.totalSpend || "0"));
    }
    const sortedWeeks = Array.from(weeks).sort((a, b) => a - b);
    return { units: Array.from(map.entries()), weeks: sortedWeeks };
  }, [data]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!weeklyByUnit.weeks.length) return <p className="text-muted-foreground">Sem dados semanais</p>;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unidade</TableHead>
              {weeklyByUnit.weeks.map((wk: number) => (
                <TableHead key={wk} className="text-right text-xs">Sem {wk}</TableHead>
              ))}
              <TableHead className="text-right font-bold">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {weeklyByUnit.units.map(([unit, weekMap]) => {
              const total = Array.from(weekMap.values()).reduce((s, v) => s + v, 0);
              return (
                <TableRow key={unit}>
                  <TableCell className="font-medium text-sm">{unit}</TableCell>
                  {weeklyByUnit.weeks.map((wk: number) => (
                    <TableCell key={wk} className="text-right text-xs">
                      {weekMap.has(wk) ? formatCurrency(weekMap.get(wk)!) : "-"}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-bold">{formatCurrency(total)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ==================== MAIN PAGE ====================
export default function InteligenciaCompras() {
  const [unitFilter, setUnitFilter] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const { data: summary } = trpc.purchaseIntelligence.summary.useQuery();

  const units = summary?.units?.map((u: any) => u.unitName) || [];
  const sectors = summary?.sectors?.map((s: any) => s.sector).filter(Boolean) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Brain className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Inteligência de Compras</h1>
            <p className="text-sm text-muted-foreground">
              Análise retroativa Abr-Jul/2026 — Dados Fortes AG ({summary?.uniqueUnits || 6} unidades)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={unitFilter} onValueChange={setUnitFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas unidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas unidades</SelectItem>
              {units.map((u: string) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sectorFilter} onValueChange={setSectorFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Todos setores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos setores</SelectItem>
              {sectors.map((s: string) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryPanel />

      {/* Tabbed Panels */}
      <Tabs defaultValue="priceIndex" className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6">
          <TabsTrigger value="priceIndex" className="text-xs">Índice Preços</TabsTrigger>
          <TabsTrigger value="seasonality" className="text-xs">Sazonalidade</TabsTrigger>
          <TabsTrigger value="unitComparison" className="text-xs">Comparativo</TabsTrigger>
          <TabsTrigger value="supplierSector" className="text-xs">Forn. x Setor</TabsTrigger>
          <TabsTrigger value="abc" className="text-xs">Curva ABC</TabsTrigger>
          <TabsTrigger value="weekly" className="text-xs">Evolução Semanal</TabsTrigger>
        </TabsList>

        <TabsContent value="priceIndex" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpDown className="h-5 w-5" />
                Índice de Preços por Produto
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Variação de preço entre a primeira e última compra no período. Vermelho = subiu, Verde = caiu.
              </p>
            </CardHeader>
            <CardContent>
              <PriceIndexPanel unitFilter={unitFilter === "all" ? "" : unitFilter} sectorFilter={sectorFilter === "all" ? "" : sectorFilter} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seasonality" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Sazonalidade — Gasto por Semana
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Identifica semanas de pico de compras e padrões sazonais.
              </p>
            </CardHeader>
            <CardContent>
              <SeasonalityPanel unitFilter={unitFilter === "all" ? "" : unitFilter} sectorFilter={sectorFilter === "all" ? "" : sectorFilter} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unitComparison" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Comparativo entre Unidades
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Mesmo produto, preços diferentes entre unidades. Spread alto = oportunidade de negociação.
              </p>
            </CardHeader>
            <CardContent>
              <UnitComparisonPanel sectorFilter={sectorFilter === "all" ? "" : sectorFilter} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="supplierSector" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Fornecedores por Setor
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Quem fornece o quê, quanto gastamos com cada fornecedor por categoria.
              </p>
            </CardHeader>
            <CardContent>
              <SupplierBySectorPanel unitFilter={unitFilter === "all" ? "" : unitFilter} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="abc" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Curva ABC de Produtos
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Classe A = 80% do gasto (foco máximo). Classe B = 15%. Classe C = 5%.
              </p>
            </CardHeader>
            <CardContent>
              <AbcCurvePanel unitFilter={unitFilter === "all" ? "" : unitFilter} sectorFilter={sectorFilter === "all" ? "" : sectorFilter} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weekly" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Evolução Semanal por Unidade
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Gasto total por semana, segmentado por unidade. Identifica picos e tendências.
              </p>
            </CardHeader>
            <CardContent>
              <WeeklyEvolutionPanel unitFilter={unitFilter === "all" ? "" : unitFilter} sectorFilter={sectorFilter === "all" ? "" : sectorFilter} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
