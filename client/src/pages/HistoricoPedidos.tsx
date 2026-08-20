import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Archive, Calendar, MapPin, Package, CheckCircle2, Eye, Filter, Download, MessageCircle } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
  "Cereais": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", iconBg: "bg-blue-100" },
  "Limpeza e Descartáveis": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", iconBg: "bg-emerald-100" },
  "Limpeza": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", iconBg: "bg-emerald-100" },
  "Descartáveis": { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", iconBg: "bg-purple-100" },
  "Proteína": { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", iconBg: "bg-red-100" },
  "Hortifruti": { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", iconBg: "bg-orange-100" },
  "Hortifrut": { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", iconBg: "bg-orange-100" },
  "Gás": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", iconBg: "bg-amber-100" },
  "Pão": { bg: "bg-yellow-50", text: "text-yellow-800", border: "border-yellow-200", iconBg: "bg-yellow-100" },
  "Cereais (Doces)": { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200", iconBg: "bg-pink-100" },
  "Laticínios": { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200", iconBg: "bg-sky-100" },
};
const DEFAULT_CATEGORY_COLOR = { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200", iconBg: "bg-slate-100" };

function getCategoryColor(category: string) {
  if (!category) return DEFAULT_CATEGORY_COLOR;
  if (CATEGORY_COLORS[category]) return CATEGORY_COLORS[category];
  const key = Object.keys(CATEGORY_COLORS).find(k => category.toLowerCase().includes(k.toLowerCase()));
  return key ? CATEGORY_COLORS[key] : DEFAULT_CATEGORY_COLOR;
}

export default function HistoricoPedidos() {
  const { data: ordersList, isLoading } = trpc.orders.list.useQuery();
  const { data: suppliersList } = trpc.suppliers.list.useQuery();
  const [filterUnit, setFilterUnit] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  const { data: orderItems } = trpc.orders.items.useQuery(
    { orderId: expandedOrder! },
    { enabled: !!expandedOrder }
  );

  // Only show delivered orders
  const deliveredOrders = useMemo(() => {
    if (!ordersList) return [];
    return ordersList.filter((o: any) => {
      if (o.status !== "delivered") return false;
      if (filterUnit !== "all" && o.unitName !== filterUnit) return false;
      if (filterCategory !== "all" && o.category !== filterCategory) return false;
      return true;
    });
  }, [ordersList, filterUnit, filterCategory]);
  // Note: This page shows ONLY delivered orders. Cancelled orders go to the Cancelados page.

  const { units, categories } = useMemo(() => {
    if (!ordersList) return { units: [], categories: [] };
    const delivered = ordersList.filter((o: any) => o.status === "delivered");
    const units = Array.from(new Set(delivered.map((o: any) => o.unitName).filter(Boolean))).sort();
    const categories = Array.from(new Set(delivered.map((o: any) => o.category).filter(Boolean))).sort();
    return { units, categories };
  }, [ordersList]);

  const getSupplierName = (id: number) => {
    const s = suppliersList?.find((s: any) => s.id === id);
    return s ? (s.tradeName || s.companyName) : `#${id}`;
  };

  const totalValue = useMemo(() => {
    return deliveredOrders.reduce((sum: number, o: any) => sum + parseFloat(o.totalValue || "0"), 0);
  }, [deliveredOrders]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-100 rounded-xl">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Histórico de Pedidos</h1>
              <p className="text-sm text-muted-foreground">Pedidos entregues e finalizados</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1.5 rounded-lg">
              {deliveredOrders.length} pedido(s) entregue(s)
            </div>
            <div className="text-sm font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
              Total: R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
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
                  {units.map((u: any) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Setor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Setores</SelectItem>
                  {categories.map((c: any) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando histórico...</div>
        ) : deliveredOrders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Archive className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">Nenhum pedido entregue no histórico</p>
              <p className="text-xs text-muted-foreground mt-1">Pedidos marcados como entregues aparecerão aqui</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {deliveredOrders.map((order: any) => {
              const catColor = getCategoryColor(order.category || "");
              return (
                <Card
                  key={order.id}
                  className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-green-500`}
                  onClick={() => setExpandedOrder(order.id)}
                >
                  <CardContent className="p-4 space-y-2">
                    {/* Main info */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm">{getSupplierName(order.supplierId)}</h3>
                          {order.category && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${catColor.bg} ${catColor.text}`}>
                              {order.category}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          {order.unitName && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" />{order.unitName}
                            </span>
                          )}
                          {order.period && (
                            <span className="flex items-center gap-0.5">
                              <Calendar className="h-3 w-3" />{order.period}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-green-700 text-base">
                          R$ {parseFloat(order.totalValue || "0").toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <Badge variant="default" className="bg-green-100 text-green-800 border-green-300 text-[10px] mt-1">
                          <CheckCircle2 className="h-3 w-3 mr-0.5" />Entregue
                        </Badge>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{order.code}</span>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        <span>{order.createdAt ? new Date(order.createdAt).toLocaleDateString("pt-BR") : 'N/I'}</span>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                        <Eye className="h-3 w-3 mr-1" />Ver Itens
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog open={!!expandedOrder} onOpenChange={(open) => { if (!open) setExpandedOrder(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-green-600" />
                Detalhes do Pedido Entregue
              </DialogTitle>
            </DialogHeader>
            {expandedOrder && (() => {
              const order = deliveredOrders.find((o: any) => o.id === expandedOrder);
              if (!order) return <p className="text-muted-foreground">Pedido não encontrado</p>;
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Código:</span> <span className="font-mono font-medium">{order.code}</span></div>
                    <div><span className="text-muted-foreground">Fornecedor:</span> <span className="font-medium">{getSupplierName(order.supplierId)}</span></div>
                    <div><span className="text-muted-foreground">Unidade:</span> <span className="font-medium">{order.unitName || 'N/I'}</span></div>
                    <div><span className="text-muted-foreground">Categoria:</span> <span className="font-medium">{order.category || 'N/I'}</span></div>
                    <div><span className="text-muted-foreground">Data:</span> <span className="font-medium">{order.createdAt ? new Date(order.createdAt).toLocaleDateString("pt-BR") : 'N/I'}</span></div>
                    <div><span className="text-muted-foreground">Total:</span> <span className="font-bold text-green-700">R$ {parseFloat(order.totalValue || "0").toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                  </div>

                  {/* Items table */}
                  {orderItems && orderItems.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium">Produto</th>
                            <th className="text-center px-2 py-2 font-medium">Qtd</th>
                            <th className="text-center px-2 py-2 font-medium">Un</th>
                            <th className="text-right px-3 py-2 font-medium">Preço</th>
                            <th className="text-right px-3 py-2 font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderItems.map((item: any, idx: number) => (
                            <tr key={item.id || idx} className="border-t">
                              <td className="px-3 py-2 font-medium">{item.productName}</td>
                              <td className="text-center px-2 py-2">{item.quantity}</td>
                              <td className="text-center px-2 py-2">{item.unit}</td>
                              <td className="text-right px-3 py-2">R$ {parseFloat(item.unitPrice || "0").toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              <td className="text-right px-3 py-2 font-medium">R$ {parseFloat(item.totalPrice || "0").toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-muted/30">
                          <tr className="border-t-2">
                            <td colSpan={4} className="px-3 py-2 font-bold text-right">TOTAL:</td>
                            <td className="px-3 py-2 font-bold text-right text-green-700">
                              R$ {parseFloat(order.totalValue || "0").toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Carregando itens...</p>
                  )}
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
