import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { XCircle, Calendar, MapPin, FileText, ShoppingCart, Filter } from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Cereais": { bg: "bg-blue-50", text: "text-blue-700" },
  "Limpeza e Descartáveis": { bg: "bg-emerald-50", text: "text-emerald-700" },
  "Limpeza": { bg: "bg-emerald-50", text: "text-emerald-700" },
  "Descartáveis": { bg: "bg-purple-50", text: "text-purple-700" },
  "Proteína": { bg: "bg-red-50", text: "text-red-700" },
  "Hortifruti": { bg: "bg-orange-50", text: "text-orange-700" },
  "Hortifrut": { bg: "bg-orange-50", text: "text-orange-700" },
  "Gás": { bg: "bg-amber-50", text: "text-amber-700" },
  "Pão": { bg: "bg-yellow-50", text: "text-yellow-800" },
  "Cereais (Doces)": { bg: "bg-pink-50", text: "text-pink-700" },
  "Laticínios": { bg: "bg-sky-50", text: "text-sky-700" },
};

function getCategoryColor(category: string) {
  if (!category) return { bg: "bg-slate-50", text: "text-slate-700" };
  if (CATEGORY_COLORS[category]) return CATEGORY_COLORS[category];
  const key = Object.keys(CATEGORY_COLORS).find(k => category.toLowerCase().includes(k.toLowerCase()));
  return key ? CATEGORY_COLORS[key] : { bg: "bg-slate-50", text: "text-slate-700" };
}

function extractCategoryFromTitle(title: string): string {
  if (!title) return "";
  const match = title.match(/\(([^)]+)\)/);
  return match ? match[1] : "";
}

export default function Cancelados() {
  const [, setLocation] = useLocation();
  const { data: quotationsList, isLoading: loadingQ } = trpc.quotations.list.useQuery();
  const { data: ordersList, isLoading: loadingO } = trpc.orders.list.useQuery();
  const { data: suppliersList } = trpc.suppliers.list.useQuery();
  const { data: unitsList } = trpc.units.list.useQuery();

  const [filterUnit, setFilterUnit] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  // All cancelled items
  const cancelledQuotations = useMemo(() => {
    if (!quotationsList) return [];
    return quotationsList.filter((q: any) => q.status === "cancelled");
  }, [quotationsList]);

  const cancelledOrders = useMemo(() => {
    if (!ordersList) return [];
    return ordersList.filter((o: any) => o.status === "cancelled");
  }, [ordersList]);

  // Get unit name for a quotation
  const getUnitName = (unitId: number) => {
    const u = unitsList?.find((u: any) => u.id === unitId);
    return u ? `${u.name} - ${u.state}` : "";
  };

  const getSupplierName = (id: number) => {
    const s = suppliersList?.find((s: any) => s.id === id);
    return s ? (s.tradeName || s.companyName) : `#${id}`;
  };

  // Build filter options from cancelled data
  const { units, categories } = useMemo(() => {
    const unitSet = new Set<string>();
    const catSet = new Set<string>();

    cancelledQuotations.forEach((q: any) => {
      const u = unitsList?.find((u: any) => u.id === q.unitId);
      if (u) unitSet.add(`${u.id}|${u.name} - ${u.state}`);
      const cat = extractCategoryFromTitle(q.title);
      if (cat) catSet.add(cat);
    });

    cancelledOrders.forEach((o: any) => {
      if (o.unitName) unitSet.add(`unit_name|${o.unitName}`);
      if (o.category) catSet.add(o.category);
    });

    return {
      units: Array.from(unitSet).sort((a, b) => a.split("|")[1].localeCompare(b.split("|")[1])),
      categories: Array.from(catSet).sort(),
    };
  }, [cancelledQuotations, cancelledOrders, unitsList]);

  // Apply filters
  const filteredItems = useMemo(() => {
    const items: Array<{ type: "quotation" | "order"; data: any; category: string; unitLabel: string; date: string }> = [];

    if (filterType === "all" || filterType === "quotation") {
      cancelledQuotations.forEach((q: any) => {
        const cat = extractCategoryFromTitle(q.title);
        const u = unitsList?.find((u: any) => u.id === q.unitId);
        const unitLabel = u ? `${u.name} - ${u.state}` : "";
        items.push({ type: "quotation", data: q, category: cat, unitLabel, date: q.createdAt || "" });
      });
    }

    if (filterType === "all" || filterType === "order") {
      cancelledOrders.forEach((o: any) => {
        items.push({ type: "order", data: o, category: o.category || "", unitLabel: o.unitName || "", date: o.createdAt || "" });
      });
    }

    return items.filter(item => {
      if (filterUnit !== "all") {
        const filterLabel = filterUnit.split("|")[1];
        if (item.unitLabel !== filterLabel) return false;
      }
      if (filterCategory !== "all" && item.category !== filterCategory) return false;
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [cancelledQuotations, cancelledOrders, filterUnit, filterCategory, filterType, unitsList]);

  const isLoading = loadingQ || loadingO;
  const totalCancelled = cancelledQuotations.length + cancelledOrders.length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-100 rounded-xl">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Cancelados</h1>
              <p className="text-sm text-muted-foreground">Cotações e pedidos que foram cancelados</p>
            </div>
          </div>
          <div className="text-sm font-medium text-red-700 bg-red-50 px-3 py-1.5 rounded-lg">
            {totalCancelled} cancelado(s) no total — {filteredItems.length} exibido(s)
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterUnit} onValueChange={setFilterUnit}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Unidade..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Unidades</SelectItem>
                  {units.map((u) => (
                    <SelectItem key={u} value={u}>{u.split("|")[1]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Setor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Setores</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Tipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Cotações e Pedidos</SelectItem>
                  <SelectItem value="quotation">Apenas Cotações</SelectItem>
                  <SelectItem value="order">Apenas Pedidos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando cancelados...</div>
        ) : filteredItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <XCircle className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">Nenhum item cancelado encontrado</p>
              <p className="text-xs text-muted-foreground mt-1">Ajuste os filtros ou não há cancelamentos registrados</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item, idx) => {
              if (item.type === "quotation") {
                const q = item.data;
                const catColor = getCategoryColor(item.category);
                return (
                  <Card
                    key={`q-${q.id}`}
                    className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-red-400"
                    onClick={() => setLocation(`/cotacoes/${q.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-red-400 shrink-0" />
                            <h3 className="font-semibold text-sm leading-tight line-clamp-1">{q.title || q.code}</h3>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5 ml-6">
                            <Badge variant="outline" className="text-[10px] border-red-200 text-red-600">Cotação</Badge>
                            {item.category && (
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${catColor.bg} ${catColor.text}`}>
                                {item.category}
                              </span>
                            )}
                            {item.unitLabel && (
                              <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <MapPin className="h-2.5 w-2.5" />{item.unitLabel}
                              </span>
                            )}
                            <span className="text-[10px] font-mono text-muted-foreground">{q.code}</span>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                          <Calendar className="h-3 w-3" />
                          {q.createdAt ? new Date(q.createdAt).toLocaleDateString("pt-BR") : 'N/I'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              } else {
                const order = item.data;
                const catColor = getCategoryColor(item.category);
                return (
                  <Card
                    key={`o-${order.id}`}
                    className="border-l-4 border-l-red-400"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4 text-red-400 shrink-0" />
                            <h3 className="font-semibold text-sm">{getSupplierName(order.supplierId)}</h3>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5 ml-6">
                            <Badge variant="outline" className="text-[10px] border-red-200 text-red-600">Pedido</Badge>
                            {item.category && (
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${catColor.bg} ${catColor.text}`}>
                                {item.category}
                              </span>
                            )}
                            {item.unitLabel && (
                              <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <MapPin className="h-2.5 w-2.5" />{item.unitLabel}
                              </span>
                            )}
                            <span className="text-[10px] font-mono text-muted-foreground">{order.code}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="font-medium text-sm text-red-600 line-through">
                            R$ {parseFloat(order.totalValue || "0").toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {order.createdAt ? new Date(order.createdAt).toLocaleDateString("pt-BR") : 'N/I'}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
