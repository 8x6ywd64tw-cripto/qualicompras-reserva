import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Plus, FileText, Send, Copy, Trash2, Upload, MessageCircle, Mail, ExternalLink, Calendar, Filter, MapPin, RotateCcw, Loader2 } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";

type QuotationItem = {
  productName: string;
  quantity: string;
  unit: string;
  category: string;
  curveClass: "A" | "B" | "C" | undefined;
};

type SendResult = {
  supplierId: number;
  name: string;
  whatsapp: boolean;
  email: boolean;
  whatsappUrl?: string;
  emailUrl?: string;
  supplierLink?: string;
};

const SECTOR_OPTIONS_CONV = [
  { value: "all", label: "Todos os Setores" },
  { value: "Proteína", label: "Proteínas / Carnes" },
  { value: "Cereais", label: "Cereais / Secos / Mercearia" },
  { value: "Hortifruti", label: "Hortifruti / Frutas / Verduras" },
  { value: "Limpeza", label: "Limpeza" },
  { value: "Descartáveis", label: "Descartáveis" },
  { value: "Cereais (Doces)", label: "Cereais (Doces) / Confeitaria" },
  { value: "Pão", label: "Pão / Padaria" },
  { value: "Gás", label: "Gás" },
];

// Color mapping by sector/category
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

function extractCategoryFromTitle(title: string): string {
  const match = title.match(/\(([^)]+)\)/);
  return match ? match[1] : '';
}

export default function Cotacoes() {
  const { user } = useAuth();
  const isMaster = user?.email === MASTER_EMAIL;
  const isBuyerSenior = user?.role === "buyer_senior";
  const hasWriteAccess = isMaster || isBuyerSenior;
  const [, setLocation] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [unitId, setUnitId] = useState<string>("");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [deadline, setDeadline] = useState("");
  const [deadlineEnabled, setDeadlineEnabled] = useState(false);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<QuotationItem[]>([{ productName: "", quantity: "", unit: "kg", category: "", curveClass: undefined }]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter state for listing
  const [listUnitFilter, setListUnitFilter] = useState<string>("all");
  const [listSectorFilter, setListSectorFilter] = useState<string>("all");
  const [listStatusFilter, setListStatusFilter] = useState<string>("active");

  // Modal state for sending links to suppliers
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendAllProgress, setSendAllProgress] = useState(0);

  const utils = trpc.useUtils();
  const { data: quotationsList, isLoading } = trpc.quotations.list.useQuery();
  const { data: unitsList } = trpc.units.list.useQuery();
  const { data: suppliersList } = trpc.suppliers.list.useQuery();
  const { data: unitSuppliersList } = trpc.suppliers.byUnit.useQuery(
    { unitId: parseInt(unitId) },
    { enabled: !!unitId }
  );

  // Filter suppliers by sector
  const filteredSuppliers = (unitSuppliersList || []).filter((s: any) => {
    // Excluir fornecedores bloqueados para cotação
    if (s.quotationBlocked) return false;
    if (sectorFilter === "all") return true;
    if (!s.categories) return false;
    const cats: string[] = typeof s.categories === 'string' ? JSON.parse(s.categories) : s.categories;
    return cats.some((c: string) => c.toLowerCase().includes(sectorFilter.toLowerCase()));
  });

  // Auto-select all filtered suppliers when unit or sector changes
  useEffect(() => {
    if (filteredSuppliers.length > 0) {
      // Função para normalizar texto (remover acentos, lowercase)
      const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      // Nomes dos itens da cotação atual
      const itemNames = items.map(i => normalize(i.productName)).filter(n => n.length > 0);
      
      const autoSelected = filteredSuppliers.filter((s: any) => {
        // Se não tem specificProducts, seleciona normalmente
        if (!s.specificProducts || !Array.isArray(s.specificProducts) || s.specificProducts.length === 0) return true;
        // Se tem specificProducts, verifica se algum item da cotação contém alguma palavra-chave
        const keywords: string[] = s.specificProducts.map((k: string) => normalize(k));
        return itemNames.some(itemName => keywords.some(kw => itemName.includes(kw)));
      });
      setSelectedSuppliers(autoSelected.map((s: any) => s.id));
    } else if (unitId) {
      setSelectedSuppliers([]);
    }
  }, [unitSuppliersList, unitId, sectorFilter, items]);

  const createMutation = trpc.quotations.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Cotação ${data.code} criada com sucesso!`);
      utils.quotations.list.invalidate();
      setShowCreate(false);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const openMutation = trpc.quotations.open.useMutation({
    onSuccess: () => {
      toast.success("Cotação aberta para propostas!");
      utils.quotations.list.invalidate();
    },
  });

  const closeMutation = trpc.quotations.close.useMutation({
    onSuccess: () => {
      toast.success("Cotação fechada com sucesso!");
      utils.quotations.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const sendMutation = trpc.quotations.sendToSuppliers.useMutation({
    onSuccess: (data) => {
      const whatsappCount = data.results.filter((r: any) => r.whatsapp).length;
      const emailCount = data.results.filter((r: any) => r.email).length;
      toast.success(`Links gerados para ${data.results.length} fornecedores! (${whatsappCount} WhatsApp, ${emailCount} Email)`);
      // Show modal with individual buttons instead of auto-opening popups
      setSendResults(data.results as SendResult[]);
      setShowSendModal(true);
      utils.quotations.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteQuotationMutation = trpc.quotations.delete.useMutation({
    onSuccess: () => { toast.success("Cotação excluída permanentemente"); utils.quotations.list.invalidate(); },
    onError: (err) => toast.error(err.message),
  });
  const canReopen = isMaster || user?.email === 'frotas.patrimonio@qualities.com.br'; // Only ADM Master and Luiz Antonio Jr
  const [reopenId, setReopenId] = useState<number | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const reopenMutation = trpc.quotations.reopen.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setReopenId(null);
      setReopenReason("");
      utils.quotations.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const resetForm = () => {
    setTitle(""); setUnitId(""); setDeadline(""); setDeadlineEnabled(false); setNotes("");
    setItems([{ productName: "", quantity: "", unit: "kg", category: "", curveClass: undefined }]);
    setSelectedSuppliers([]);
  };

  const addItem = () => setItems([...items, { productName: "", quantity: "", unit: "kg", category: "", curveClass: undefined }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof QuotationItem, value: string) => {
    const newItems = [...items];
    (newItems[idx] as any)[field] = value;
    setItems(newItems);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(l => l.trim());
      const newItems: QuotationItem[] = [];
      // Skip header if present
      const startIdx = lines[0]?.toLowerCase().includes("produto") || lines[0]?.toLowerCase().includes("item") ? 1 : 0;
      for (let i = startIdx; i < lines.length; i++) {
        const cols = lines[i].split(/[;,\t]/);
        if (cols.length >= 2) {
          newItems.push({
            productName: cols[0]?.trim() || "",
            quantity: cols[1]?.trim().replace(",", ".") || "",
            unit: cols[2]?.trim() || "kg",
            category: cols[3]?.trim() || "",
            curveClass: (cols[4]?.trim().toUpperCase() as "A" | "B" | "C") || undefined,
          });
        }
      }
      if (newItems.length > 0) {
        setItems(newItems);
        toast.success(`${newItems.length} itens importados com sucesso!`);
      } else {
        toast.error("Nenhum item válido encontrado no arquivo");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleCreate = () => {
    if (!title.trim()) { toast.error("Título é obrigatório"); return; }
    const validItems = items.filter(i => i.productName.trim() && i.quantity.trim());
    if (validItems.length === 0) { toast.error("Adicione pelo menos um item"); return; }
    createMutation.mutate({
      title,
      unitId: unitId ? parseInt(unitId) : undefined,
      deadline: deadline || undefined,
      notes: notes || undefined,
      items: validItems,
      supplierIds: selectedSuppliers.length > 0 ? selectedSuppliers : undefined,
    });
  };

  const copyPublicLink = (token: string) => {
    const url = `${window.location.origin}/cotacao/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado para a área de transferência!");
  };

  const copySupplierLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "open": return "Aberta";
      case "closed": return "Fechada";
      case "ordered": return "Pedido Gerado";
      case "draft": return "Rascunho";
      case "cancelled": return "Cancelada";
      default: return s;
    }
  };

  const statusVariant = (s: string) => {
    switch (s) {
      case "open": return "default" as const;
      case "closed": return "secondary" as const;
      case "ordered": return "secondary" as const;
      case "draft": return "outline" as const;
      default: return "destructive" as const;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Central de Cotações</h1>
            <p className="text-muted-foreground mt-1">Crie cotações e envie links para fornecedores responderem</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={listUnitFilter} onValueChange={setListUnitFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filtrar por unidade..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Unidades</SelectItem>
              {(unitsList || []).map((u: any) => (
                <SelectItem key={u.id} value={u.id.toString()}>{u.name} - {u.state}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={listSectorFilter} onValueChange={setListSectorFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Setor..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Setores</SelectItem>
              <SelectItem value="Proteína">Proteína</SelectItem>
              <SelectItem value="Cereais">Cereais</SelectItem>
              <SelectItem value="Hortifruti">Hortifruti</SelectItem>
              <SelectItem value="Limpeza">Limpeza</SelectItem>
              <SelectItem value="Descartáveis">Descartáveis</SelectItem>
              <SelectItem value="Cereais (Doces)">Cereais (Doces)</SelectItem>
              <SelectItem value="Pão">Pão</SelectItem>
              <SelectItem value="Gás">Gás</SelectItem>
            </SelectContent>
          </Select>
          <Select value={listStatusFilter} onValueChange={setListStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Ativas (Rascunho + Aberta + Fechada)</SelectItem>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="open">Aberta</SelectItem>
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="closed">Fechada</SelectItem>
              <SelectItem value="ordered">Pedido Gerado</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {quotationsList ? `${quotationsList.filter((q: any) => {
              if (listUnitFilter !== 'all' && String(q.unitId) !== listUnitFilter) return false;
              if (listSectorFilter !== 'all' && !extractCategoryFromTitle(q.title).toLowerCase().includes(listSectorFilter.toLowerCase())) return false;
              if (listStatusFilter === 'active') return q.status === 'open' || q.status === 'draft' || q.status === 'closed';
              if (listStatusFilter !== 'all' && q.status !== listStatusFilter) return false;
              return true;
            }).length} cotação(ões)` : ''}
          </span>
        </div>

        {/* Quotations List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-6 h-20" /></Card>)}
          </div>
        ) : !quotationsList || quotationsList.length === 0 ? (
          <Card><CardContent className="p-12 text-center"><FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" /><p className="text-muted-foreground">Nenhuma cotação criada</p><p className="text-xs text-muted-foreground mt-1">Crie sua primeira cotação ou importe itens do Gastrotec</p></CardContent></Card>
        ) : (
          <div className="space-y-3">
            {quotationsList
              .filter((q: any) => {
                if (listUnitFilter !== 'all' && String(q.unitId) !== listUnitFilter) return false;
                if (listSectorFilter !== 'all' && !extractCategoryFromTitle(q.title).toLowerCase().includes(listSectorFilter.toLowerCase())) return false;
                if (listStatusFilter === 'active') return q.status === 'open' || q.status === 'draft' || q.status === 'closed';
                if (listStatusFilter !== 'all' && q.status !== listStatusFilter) return false;
                return true;
              })
              .map((q: any) => (
              <Card key={q.id} className={`hover:shadow-sm transition-shadow cursor-pointer border-l-4 ${getCategoryColor(extractCategoryFromTitle(q.title)).border}`} onClick={() => setLocation(`/cotacoes/${q.id}`)}>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-2.5">
                    {/* Title row */}
                    <div className="flex items-start gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${getCategoryColor(extractCategoryFromTitle(q.title)).iconBg}`}>
                        <FileText className={`h-4 w-4 ${getCategoryColor(extractCategoryFromTitle(q.title)).text}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm leading-snug break-words">{q.title}</h3>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {extractCategoryFromTitle(q.title) && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getCategoryColor(extractCategoryFromTitle(q.title)).bg} ${getCategoryColor(extractCategoryFromTitle(q.title)).text}`}>
                              {extractCategoryFromTitle(q.title)}
                            </span>
                          )}
                          {q.unitId && (() => {
                            const unit = (unitsList || []).find((u: any) => u.id === q.unitId);
                            return unit ? (
                              <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <MapPin className="h-2.5 w-2.5" />{unit.name} - {unit.state}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    </div>
                    {/* Code + Responses row */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{q.code}</span>
                        {q.suppliersInvited > 0 && (
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                            q.proposalsReceived === q.suppliersInvited
                              ? 'bg-green-100 text-green-700'
                              : q.proposalsReceived > 0
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-50 text-red-600'
                          }`}>
                            <Mail className="h-3 w-3" />
                            {q.proposalsReceived}/{q.suppliersInvited} respostas
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant={statusVariant(q.status)} className={`text-[10px] px-2 py-0.5 ${q.status === 'ordered' ? 'bg-green-100 text-green-800 border-green-300' : ''}`}>{statusLabel(q.status)}</Badge>
                        {q.reopenCount > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-orange-300 text-orange-700 bg-orange-50" title={`Reaberta por ${q.lastReopenedBy || '—'} em ${q.lastReopenedAt ? new Date(q.lastReopenedAt).toLocaleDateString('pt-BR') : '—'}\nMotivo: ${q.lastReopenReason || '—'}`}>
                            <RotateCcw className="h-2.5 w-2.5 mr-0.5" />
                            Reaberta{q.reopenCount > 1 ? ` ${q.reopenCount}x` : ''}
                          </Badge>
                        )}
                        {q.status === "draft" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={(e) => { e.stopPropagation(); openMutation.mutate({ id: q.id }); }}>
                            <Send className="h-3 w-3 mr-1" />Abrir
                          </Button>
                        )}
                        {q.status === "open" && (
                          <>
                            <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700 h-7 text-xs px-2" onClick={(e) => { e.stopPropagation(); sendMutation.mutate({ quotationId: q.id }); }}>
                              <MessageCircle className="h-3 w-3 mr-1" />Enviar
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={(e) => { e.stopPropagation(); copyPublicLink(q.publicToken); }}>
                              <Copy className="h-3 w-3 mr-1" />Link
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-red-600 border-red-200 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); if (confirm('Deseja fechar esta cotação?')) closeMutation.mutate({ id: q.id }); }}>
                              Fechar
                            </Button>
                          </>
                        )}
                        {q.status === "ordered" && canReopen && (
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2 border-orange-300 text-orange-700 hover:bg-orange-50" onClick={(e) => { e.stopPropagation(); setReopenId(q.id); setReopenReason(""); }}>
                            <RotateCcw className="h-3 w-3 mr-1" />Reabrir
                          </Button>
                        )}
                      </div>
                    </div>
                    {/* Date row - separate, bigger */}
                    <div className="flex items-center justify-between gap-1 text-xs text-muted-foreground pt-1 border-t border-border/50">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{q.createdAt ? new Date(q.createdAt).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/I'}</span>
                      </div>
                      {hasWriteAccess && (
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); if (confirm(`Excluir permanentemente a cotação ${q.code}? Todos os dados serão perdidos.`)) deleteQuotationMutation.mutate({ id: q.id }); }}>
                          <Trash2 className="h-3 w-3 mr-0.5" />Excluir
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Send to Suppliers - Individual buttons per supplier */}
      <Dialog open={showSendModal} onOpenChange={setShowSendModal}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-green-600" />
              Enviar para Fornecedores
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Clique no botão de cada fornecedor para abrir o WhatsApp ou Email com a mensagem pronta.
          </p>
          <div className="space-y-3">
            {sendResults.map((r) => (
              <div key={r.supplierId} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{r.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {r.whatsapp && <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-700 border-green-300">WhatsApp</Badge>}
                    {r.email && <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-700 border-blue-300">Email</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {r.whatsappUrl && (
                    <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700 h-8 px-2.5" onClick={() => window.open(r.whatsappUrl, '_blank')}>
                      <MessageCircle className="h-3.5 w-3.5 mr-1" />WhatsApp
                    </Button>
                  )}
                  {r.emailUrl && (
                    <Button size="sm" variant="outline" className="h-8 px-2.5" onClick={() => window.open(r.emailUrl, '_blank')}>
                      <Mail className="h-3.5 w-3.5 mr-1" />Email
                    </Button>
                  )}
                  {r.supplierLink && (
                    <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => copySupplierLink(r.supplierLink!)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {sendResults.length > 0 && (
            <div className="mt-4 pt-3 border-t space-y-3">
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={sendingAll}
                onClick={async () => {
                  setSendingAll(true);
                  setSendAllProgress(0);
                  const whatsappResults = sendResults.filter(r => r.whatsappUrl);
                  for (let i = 0; i < whatsappResults.length; i++) {
                    window.open(whatsappResults[i].whatsappUrl, '_blank');
                    setSendAllProgress(i + 1);
                    if (i < whatsappResults.length - 1) {
                      await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                  }
                  // Also open email links after WhatsApp
                  const emailResults = sendResults.filter(r => r.emailUrl && !r.whatsappUrl);
                  for (const r of emailResults) {
                    window.open(r.emailUrl, '_blank');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                  setSendingAll(false);
                  toast.success('Todos os fornecedores foram abertos!');
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                {sendingAll
                  ? `Enviando... ${sendAllProgress}/${sendResults.filter(r => r.whatsappUrl).length}`
                  : `Enviar Todos (${sendResults.filter(r => r.whatsappUrl).length} WhatsApp)`
                }
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                {sendResults.length} fornecedor(es) • Abre cada WhatsApp com intervalo de 2s
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Reabrir Cotação */}
      <Dialog open={reopenId !== null} onOpenChange={(open) => { if (!open) { setReopenId(null); setReopenReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-700">
              <RotateCcw className="h-5 w-5" />
              Reabrir Cotação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-sm text-orange-800 font-medium">Atenção:</p>
              <p className="text-sm text-orange-700 mt-1">
                Ao reabrir esta cotação, todos os pedidos gerados serão <strong>cancelados automaticamente</strong>. A cotação voltará ao status "Aberta".
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium">Motivo da reabertura *</Label>
              <Textarea
                className="mt-1"
                placeholder="Ex: Necessidade de trocar fornecedor, erro no pedido, renegociação de preço..."
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                rows={3}
              />
              {reopenReason.length > 0 && reopenReason.length < 5 && (
                <p className="text-xs text-red-500 mt-1">Mínimo 5 caracteres</p>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setReopenId(null); setReopenReason(""); }}>
                Cancelar
              </Button>
              <Button
                className="bg-orange-600 hover:bg-orange-700 text-white"
                disabled={reopenReason.length < 5 || reopenMutation.isPending}
                onClick={() => { if (reopenId) reopenMutation.mutate({ quotationId: reopenId, reason: reopenReason }); }}
              >
                {reopenMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Reabrindo...</>
                ) : (
                  <><RotateCcw className="h-4 w-4 mr-2" />Confirmar Reabertura</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
