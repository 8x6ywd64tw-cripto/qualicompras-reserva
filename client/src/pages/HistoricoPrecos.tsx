import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { TrendingDown, TrendingUp, Minus, Search, History, Trash2 } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function HistoricoPrecos() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);

  const { user } = useAuth();
  const isMaster = user?.email === "afonsoqueirogagn@gmail.com";
  const utils = trpc.useUtils();

  const { data: suppliersList } = trpc.suppliers.list.useQuery();
  const deleteMutation = trpc.prices.deleteProductHistory.useMutation({
    onSuccess: () => { toast.success("Histórico excluído"); utils.prices.supplierHistory.invalidate(); },
    onError: (err: any) => toast.error(err.message),
  });
  const { data: supplierHistory } = trpc.prices.supplierHistory.useQuery(
    { supplierId: selectedSupplier!, limit: 100 },
    { enabled: !!selectedSupplier }
  );

  // Group history by product
  const groupedByProduct = useMemo(() => {
    if (!supplierHistory) return {};
    const groups: Record<string, typeof supplierHistory> = {};
    supplierHistory.forEach((h: any) => {
      const key = h.productName;
      if (!groups[key]) groups[key] = [];
      groups[key].push(h);
    });
    return groups;
  }, [supplierHistory]);

  // Filter products by search
  const filteredProducts = useMemo(() => {
    const products = Object.keys(groupedByProduct);
    if (!searchTerm) return products;
    return products.filter(p => p.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [groupedByProduct, searchTerm]);

  // Calculate stats for a product group
  const getProductStats = (records: any[]) => {
    if (!records || records.length === 0) return { current: 0, avg: 0, min: 0, max: 0, variation: null, trend: "stable" };
    const prices = records.map((r: any) => parseFloat(r.unitPrice));
    const current = prices[0];
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const variation = prices.length > 1 && prices[1] !== 0 ? ((current - prices[1]) / prices[1]) * 100 : null;
    const trend = variation === null ? "stable" : variation < -2 ? "down" : variation > 2 ? "up" : "stable";
    return { current, avg, min, max, variation, trend };
  };

  const getSupplierName = (id: number) => {
    const s = suppliersList?.find((s: any) => s.id === id);
    return s ? (s.tradeName || s.companyName) : `Fornecedor #${id}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            Histórico de Preços
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe a evolução de preços por fornecedor ao longo das cotações
          </p>
        </div>

        {/* Supplier Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Selecione o Fornecedor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(suppliersList || []).map((s: any) => (
                <Button
                  key={s.id}
                  size="sm"
                  variant={selectedSupplier === s.id ? "default" : "outline"}
                  onClick={() => setSelectedSupplier(s.id)}
                  className="text-xs"
                >
                  {s.tradeName || s.companyName}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Price History */}
        {selectedSupplier && (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Summary Stats */}
            {supplierHistory && supplierHistory.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground">Produtos Cotados</p>
                    <p className="text-2xl font-bold">{Object.keys(groupedByProduct).length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground">Total de Registros</p>
                    <p className="text-2xl font-bold">{supplierHistory.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground">Preços em Alta</p>
                    <p className="text-2xl font-bold text-red-600">
                      {filteredProducts.filter(p => getProductStats(groupedByProduct[p]).trend === "up").length}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground">Preços em Queda</p>
                    <p className="text-2xl font-bold text-green-600">
                      {filteredProducts.filter(p => getProductStats(groupedByProduct[p]).trend === "down").length}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Product Price Cards */}
            {filteredProducts.length > 0 ? (
              <div className="space-y-3">
                {filteredProducts.map(productName => {
                  const records = groupedByProduct[productName];
                  const stats = getProductStats(records);
                  return (
                    <Card key={productName}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm truncate">{productName}</h3>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-lg font-bold">R$ {stats.current.toFixed(2)}</span>
                              {stats.variation !== null && (
                                <span className={`text-sm font-medium flex items-center gap-0.5 ${stats.variation < 0 ? "text-green-600" : stats.variation > 0 ? "text-red-500" : "text-muted-foreground"}`}>
                                  {stats.trend === "up" && <TrendingUp className="h-3.5 w-3.5" />}
                                  {stats.trend === "down" && <TrendingDown className="h-3.5 w-3.5" />}
                                  {stats.trend === "stable" && <Minus className="h-3.5 w-3.5" />}
                                  {stats.variation > 0 ? "+" : ""}{stats.variation.toFixed(1)}%
                                </span>
                              )}
                            </div>
                            <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                              <span>Mín: R$ {stats.min.toFixed(2)}</span>
                              <span>Méd: R$ {stats.avg.toFixed(2)}</span>
                              <span>Máx: R$ {stats.max.toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">
                              {records.length} registro{records.length > 1 ? "s" : ""}
                            </Badge>
                            {isMaster && (
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => {
                                if (confirm(`Excluir TODO o histórico de "${productName}"?`)) {
                                  deleteMutation.mutate({ productName });
                                }
                              }}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {/* Mini timeline */}
                        {records.length > 1 && (
                          <div className="mt-3 pt-3 border-t">
                            <div className="flex items-center gap-1 overflow-x-auto pb-1">
                              {records.slice(0, 8).reverse().map((r: any, idx: number) => {
                                const price = parseFloat(r.unitPrice);
                                const maxP = stats.max;
                                const minP = stats.min;
                                const range = maxP - minP || 1;
                                const height = 12 + ((price - minP) / range) * 24;
                                const date = new Date(r.recordedAt);
                                return (
                                  <div key={idx} className="flex flex-col items-center gap-0.5 min-w-[40px]">
                                    <div
                                      className={`w-6 rounded-sm ${price === stats.current ? "bg-primary" : "bg-muted-foreground/30"}`}
                                      style={{ height: `${height}px` }}
                                      title={`R$ ${price.toFixed(2)} - ${date.toLocaleDateString("pt-BR")}`}
                                    />
                                    <span className="text-[9px] text-muted-foreground">
                                      {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : supplierHistory && supplierHistory.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <History className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhum histórico de preços para {getSupplierName(selectedSupplier)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Os preços são registrados automaticamente quando propostas são recebidas</p>
                </CardContent>
              </Card>
            ) : searchTerm ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">Nenhum produto encontrado para "{searchTerm}"</p>
                </CardContent>
              </Card>
            ) : null}
          </>
        )}

        {!selectedSupplier && (
          <Card>
            <CardContent className="py-12 text-center">
              <History className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Selecione um fornecedor acima para ver o histórico de preços</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
