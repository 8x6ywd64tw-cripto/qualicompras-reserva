import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Archive, Calendar, MapPin, Mail, FileText, Eye, Filter } from "lucide-react";
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

function statusLabel(status: string) {
  switch (status) {
    case "closed": return "Encerrada";
    case "ordered": return "Pedido Gerado";
    case "cancelled": return "Cancelada";
    default: return status;
  }
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "ordered": return "default";
    case "closed": return "secondary";
    case "cancelled": return "destructive";
    default: return "outline";
  }
}

export default function HistoricoCotacoes() {
  const [, setLocation] = useLocation();
  const { data: quotationsList, isLoading } = trpc.quotations.list.useQuery();
  const { data: unitsList } = trpc.units.list.useQuery();
  const [filterUnit, setFilterUnit] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Only show quotations with status "ordered" (pedido gerado = finalizada com sucesso)
  const historicQuotations = useMemo(() => {
    if (!quotationsList) return [];
    return quotationsList.filter((q: any) => {
      if (q.status !== "ordered") return false;
      if (filterUnit !== "all" && String(q.unitId) !== filterUnit) return false;
      if (filterCategory !== "all") {
        const cat = extractCategoryFromTitle(q.title);
        if (cat !== filterCategory) return false;
      }
      return true;
    });
  }, [quotationsList, filterUnit, filterCategory]);

  const categories = useMemo(() => {
    if (!quotationsList) return [];
    const ordered = quotationsList.filter((q: any) => q.status === "ordered");
    const cats = Array.from(new Set(ordered.map((q: any) => extractCategoryFromTitle(q.title)).filter(Boolean))).sort();
    return cats as string[];
  }, [quotationsList]);

  const units = useMemo(() => {
    if (!unitsList) return [];
    return unitsList;
  }, [unitsList]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 rounded-xl">
              <Archive className="h-6 w-6 text-slate-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Histórico de Cotações</h1>
              <p className="text-sm text-muted-foreground">Cotações que geraram pedido de compra</p>
            </div>
          </div>
          <div className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1.5 rounded-lg">
            {historicQuotations.length} cotação(ões) no histórico
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
                    <SelectItem key={u.id} value={String(u.id)}>{u.name} - {u.state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Setor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Setores</SelectItem>
                  {categories.map((c: string) => (
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
        ) : historicQuotations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Archive className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">Nenhuma cotação no histórico</p>
              <p className="text-xs text-muted-foreground mt-1">Cotações encerradas ou com pedido gerado aparecerão aqui</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {historicQuotations.map((q: any) => {
              const category = extractCategoryFromTitle(q.title);
              const catColor = getCategoryColor(category);
              const unit = units.find((u: any) => u.id === q.unitId);
              return (
                <Card
                  key={q.id}
                  className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
                  style={{ borderLeftColor: q.status === "ordered" ? "#16a34a" : q.status === "cancelled" ? "#dc2626" : "#6b7280" }}
                  onClick={() => setLocation(`/cotacoes/${q.id}`)}
                >
                  <CardContent className="p-4 space-y-2">
                    {/* Title + badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm leading-tight line-clamp-2">{q.title || q.code}</h3>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {category && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${catColor.bg} ${catColor.text}`}>
                              {category}
                            </span>
                          )}
                          {unit && (
                            <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <MapPin className="h-2.5 w-2.5" />{unit.name} - {unit.state}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant={statusVariant(q.status)}
                        className={`text-[10px] px-2 py-0.5 shrink-0 ${q.status === 'ordered' ? 'bg-green-100 text-green-800 border-green-300' : ''}`}
                      >
                        {statusLabel(q.status)}
                      </Badge>
                    </div>

                    {/* Info row */}
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{q.code}</span>
                        {q.suppliersInvited > 0 && (
                          <span className="flex items-center gap-0.5">
                            <Mail className="h-3 w-3" />
                            {q.proposalsReceived}/{q.suppliersInvited} respostas
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{q.createdAt ? new Date(q.createdAt).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/I'}</span>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="flex justify-end pt-1">
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                        <Eye className="h-3 w-3 mr-1" />Ver Detalhes
                      </Button>
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
