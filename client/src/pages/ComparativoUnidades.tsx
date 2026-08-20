import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowDown, ArrowUp, Trophy, AlertTriangle, TrendingDown, TrendingUp, Filter, Download } from "lucide-react";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function pct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

export default function ComparativoUnidades() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedUnit, setSelectedUnit] = useState<string>("all");
  const [productSearch, setProductSearch] = useState("");
  const [activeTab, setActiveTab] = useState("categoria");

  const { data, isLoading } = trpc.unitBenchmark.getData.useQuery({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    category: selectedCategory !== "all" ? selectedCategory : undefined,
  });

  const categories = useMemo(() => {
    if (!data?.byCategory) return [];
    return data.byCategory.map(c => c.category);
  }, [data]);

  const filteredProducts = useMemo(() => {
    if (!data?.byProduct) return [];
    let products = data.byProduct;
    if (productSearch) {
      const search = productSearch.toLowerCase();
      products = products.filter(p => p.productName.toLowerCase().includes(search));
    }
    if (selectedUnit !== "all") {
      const unitId = parseInt(selectedUnit);
      products = products.filter(p => p.units.some(u => u.unitId === unitId));
    }
    return products;
  }, [data, productSearch, selectedUnit]);

  // Group products by category for "Setor" view
  const bySector = useMemo(() => {
    if (!data?.byProduct) return [];
    const grouped: Record<string, typeof data.byProduct> = {};
    // We don't have category on product level from the API, so use byCategory data
    // For sector view, we show the byCategory aggregation with per-product drill-down
    return data.byCategory;
  }, [data]);

  const handleExportPDF = async () => {
    if (!data) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("COMPARATIVO ENTRE UNIDADES", pageWidth / 2, y, { align: "center" });
    y += 8;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("CONFIDENCIAL - Qualities Refeições / Grupo Comenda", pageWidth / 2, y, { align: "center" });
    y += 5;
    const period = startDate && endDate ? `Período: ${startDate} a ${endDate}` : "Período: Todo o histórico";
    doc.text(period + " | Gerado em: " + new Date().toLocaleDateString("pt-BR"), pageWidth / 2, y, { align: "center" });
    y += 12;

    // By Category section
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("BENCHMARK POR CATEGORIA", 14, y);
    y += 8;

    for (const cat of data.byCategory) {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`${cat.category} (Divergência: ${cat.savingsPotential.toFixed(1)}%)`, 14, y);
      y += 6;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      // Table header
      doc.text("Unidade", 14, y);
      doc.text("Total", 90, y, { align: "right" });
      doc.text("Pedidos", 110, y, { align: "right" });
      doc.text("Média/Pedido", 145, y, { align: "right" });
      doc.text("Ranking", 170, y, { align: "right" });
      y += 4;
      doc.line(14, y, 180, y);
      y += 4;
      cat.units.forEach((u, idx) => {
        if (y > 275) { doc.addPage(); y = 20; }
        const prefix = idx === 0 ? "* " : "";
        doc.text(`${prefix}${u.unitName} (${u.unitState})`, 14, y);
        doc.text(fmt(u.total), 90, y, { align: "right" });
        doc.text(String(u.orders), 110, y, { align: "right" });
        doc.text(fmt(u.avgPerOrder), 145, y, { align: "right" });
        doc.text(`#${idx + 1}`, 170, y, { align: "right" });
        y += 5;
      });
      y += 4;
    }

    // By Product section (top 30 with highest divergence)
    doc.addPage();
    y = 20;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("TOP PRODUTOS COM MAIOR DIVERGÊNCIA DE PREÇO", 14, y);
    y += 8;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Produto", 14, y);
    doc.text("Melhor Preço", 100, y, { align: "right" });
    doc.text("Pior Preço", 130, y, { align: "right" });
    doc.text("Divergência", 160, y, { align: "right" });
    doc.text("Melhor Unid.", 195, y, { align: "right" });
    y += 4;
    doc.line(14, y, 195, y);
    y += 4;

    for (const product of data.byProduct.slice(0, 30)) {
      if (y > 275) { doc.addPage(); y = 20; }
      const name = product.productName.length > 35 ? product.productName.substring(0, 35) + "..." : product.productName;
      doc.text(name, 14, y);
      doc.text(fmt(product.bestPrice), 100, y, { align: "right" });
      doc.text(fmt(product.worstPrice), 130, y, { align: "right" });
      doc.text(`${product.priceDivergence.toFixed(1)}%`, 160, y, { align: "right" });
      doc.text(product.cheapestUnit || "-", 195, y, { align: "right" });
      y += 5;
    }

    doc.save(`comparativo-unidades-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Comparativo entre Unidades</h1>
          <p className="text-muted-foreground">
            Benchmark interno: qual unidade compra mais barato por categoria, setor e produto
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Período de</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-[150px]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Até</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-[150px]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Categoria/Setor</label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Unidade</label>
                <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as unidades</SelectItem>
                    {data?.units.map(u => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name} - {u.state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setStartDate(""); setEndDate(""); setSelectedCategory("all"); setSelectedUnit("all"); setProductSearch(""); }}
              >
                <Filter className="w-4 h-4 mr-1" /> Limpar
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleExportPDF}
                disabled={!data || data.byCategory.length === 0}
              >
                <Download className="w-4 h-4 mr-1" /> Exportar PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : !data || (data.byCategory.length === 0 && data.byProduct.length === 0) ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p className="text-lg font-medium">Sem dados para comparar</p>
              <p className="text-sm mt-1">Precisa de pedidos em pelo menos 2 unidades diferentes para gerar comparativo.</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="categoria">Por Categoria</TabsTrigger>
              <TabsTrigger value="setor">Por Setor</TabsTrigger>
              <TabsTrigger value="produto">Por Produto</TabsTrigger>
            </TabsList>

            {/* === TAB: POR CATEGORIA === */}
            <TabsContent value="categoria" className="space-y-4 mt-4">
              {data.byCategory.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma categoria encontrada no período.</p>
              ) : (
                data.byCategory.map(cat => (
                  <Card key={cat.category} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <CardTitle className="text-lg">{cat.category}</CardTitle>
                          <Badge variant={cat.savingsPotential > 10 ? "destructive" : cat.savingsPotential > 5 ? "secondary" : "outline"}>
                            {cat.savingsPotential > 0 ? `${cat.savingsPotential.toFixed(1)}% divergência` : "Sem divergência"}
                          </Badge>
                        </div>
                        {cat.cheapestUnit && (
                          <div className="flex items-center gap-1 text-sm text-green-600 shrink-0">
                            <Trophy className="w-4 h-4" />
                            <span className="font-medium truncate max-w-[200px]">{cat.cheapestUnit}</span>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Unidade</TableHead>
                            <TableHead className="text-right">Total Gasto</TableHead>
                            <TableHead className="text-right">Pedidos</TableHead>
                            <TableHead className="text-right">Itens</TableHead>
                            <TableHead className="text-right">Média/Pedido</TableHead>
                            <TableHead className="text-center">Ranking</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cat.units.map((u, idx) => (
                            <TableRow key={u.unitId} className={idx === 0 ? "bg-green-50 dark:bg-green-950/20" : idx === cat.units.length - 1 && cat.units.length > 1 ? "bg-red-50 dark:bg-red-950/20" : ""}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {idx === 0 && <Trophy className="w-4 h-4 text-green-600" />}
                                  {idx === cat.units.length - 1 && cat.units.length > 1 && <AlertTriangle className="w-4 h-4 text-red-500" />}
                                  {u.unitName}
                                  <span className="text-xs text-muted-foreground">({u.unitState})</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono">{fmt(u.total)}</TableCell>
                              <TableCell className="text-right">{u.orders}</TableCell>
                              <TableCell className="text-right">{u.items}</TableCell>
                              <TableCell className="text-right font-mono">{fmt(u.avgPerOrder)}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant={idx === 0 ? "default" : idx === cat.units.length - 1 && cat.units.length > 1 ? "destructive" : "secondary"}>
                                  #{idx + 1}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* === TAB: POR SETOR === */}
            <TabsContent value="setor" className="space-y-4 mt-4">
              {data.byCategory.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum setor encontrado no período.</p>
              ) : (
                <>
                  {/* Summary cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {data.byCategory.map(cat => {
                      const totalSpent = cat.units.reduce((s, u) => s + u.total, 0);
                      return (
                        <Card key={cat.category} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => { setSelectedCategory(cat.category); setActiveTab("produto"); }}>
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                              <span className="font-semibold">{cat.category}</span>
                              {cat.savingsPotential > 5 && (
                                <Badge variant="destructive" className="text-xs">
                                  <TrendingUp className="w-3 h-3 mr-1" />{cat.savingsPotential.toFixed(0)}% gap
                                </Badge>
                              )}
                            </div>
                            <p className="text-2xl font-bold">{fmt(totalSpent)}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {cat.units.length} unidade{cat.units.length > 1 ? "s" : ""} • {cat.units.reduce((s, u) => s + u.orders, 0)} pedidos
                            </p>
                            {cat.cheapestUnit && (
                              <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
                                <Trophy className="w-3 h-3" /> Mais barata: {cat.cheapestUnit}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Detailed sector comparison */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Resumo por Setor — Todas as Unidades</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Setor</TableHead>
                            <TableHead className="text-right">Total Geral</TableHead>
                            <TableHead>Mais Barata</TableHead>
                            <TableHead>Mais Cara</TableHead>
                            <TableHead className="text-right">Divergência</TableHead>
                            <TableHead className="text-right">Economia Potencial</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.byCategory.map(cat => {
                            const totalSpent = cat.units.reduce((s, u) => s + u.total, 0);
                            const cheapest = cat.units[0];
                            const mostExpensive = cat.units[cat.units.length - 1];
                            const potentialSaving = mostExpensive && cheapest && cat.units.length > 1
                              ? (mostExpensive.avgPerOrder - cheapest.avgPerOrder) * mostExpensive.orders
                              : 0;
                            return (
                              <TableRow key={cat.category}>
                                <TableCell className="font-medium">{cat.category}</TableCell>
                                <TableCell className="text-right font-mono">{fmt(totalSpent)}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1 text-green-600">
                                    <TrendingDown className="w-3 h-3" />
                                    <span className="text-sm">{cheapest?.unitName || "-"}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1 text-red-500">
                                    <TrendingUp className="w-3 h-3" />
                                    <span className="text-sm">{cat.units.length > 1 ? mostExpensive?.unitName : "-"}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge variant={cat.savingsPotential > 10 ? "destructive" : "secondary"}>
                                    {cat.savingsPotential.toFixed(1)}%
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-mono text-green-600">
                                  {potentialSaving > 0 ? fmt(potentialSaving) : "-"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* === TAB: POR PRODUTO === */}
            <TabsContent value="produto" className="space-y-4 mt-4">
              <div className="flex gap-3 items-center">
                <Input
                  placeholder="Buscar produto..."
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="max-w-xs"
                />
                <span className="text-sm text-muted-foreground">
                  {filteredProducts.length} produto{filteredProducts.length !== 1 ? "s" : ""}
                </span>
              </div>

              {filteredProducts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum produto encontrado.</p>
              ) : (
                <Card>
                  <CardContent className="pt-4 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[200px]">Produto</TableHead>
                          <TableHead>Unid.</TableHead>
                          {data?.units.map(u => (
                            <TableHead key={u.id} className="text-right min-w-[120px]">
                              {u.name}
                              <div className="text-xs font-normal text-muted-foreground">{u.state}</div>
                            </TableHead>
                          ))}
                          <TableHead className="text-right">Divergência</TableHead>
                          <TableHead className="text-center">Melhor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProducts.slice(0, 100).map(product => (
                          <TableRow key={product.productName}>
                            <TableCell className="font-medium text-sm">{product.productName}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{product.unit}</TableCell>
                            {data?.units.map(u => {
                              const unitData = product.units.find(pu => pu.unitId === u.id);
                              const isCheapest = unitData && product.units.length > 1 && unitData.unitId === product.units[0]?.unitId;
                              const isMostExpensive = unitData && product.units.length > 1 && unitData.unitId === product.units[product.units.length - 1]?.unitId;
                              return (
                                <TableCell
                                  key={u.id}
                                  className={`text-right font-mono text-sm ${isCheapest ? "text-green-600 font-bold bg-green-50 dark:bg-green-950/20" : isMostExpensive ? "text-red-500 bg-red-50 dark:bg-red-950/20" : ""}`}
                                >
                                  {unitData ? fmt(unitData.avgPrice) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                  {unitData && unitData.purchases > 1 && (
                                    <div className="text-[10px] text-muted-foreground">{unitData.purchases}x</div>
                                  )}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-right">
                              {product.priceDivergence > 0 ? (
                                <Badge variant={product.priceDivergence > 20 ? "destructive" : product.priceDivergence > 10 ? "secondary" : "outline"}>
                                  {product.priceDivergence.toFixed(1)}%
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {product.cheapestUnit ? (
                                <span className="text-xs text-green-600 font-medium">{product.cheapestUnit}</span>
                              ) : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {filteredProducts.length > 100 && (
                      <p className="text-center text-sm text-muted-foreground mt-4">
                        Mostrando 100 de {filteredProducts.length} produtos. Use o filtro para refinar.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
