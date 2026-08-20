import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Plus, Search, Phone, Mail, MapPin, Star, Truck, CreditCard, User, Building2, Filter, Calendar, Wallet, MessageSquare, TrendingUp, Globe, CheckCircle2, Loader2, Pencil, Trash2, Package } from "lucide-react";
import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

// Categorias oficiais extraídas das planilhas da Qualities
const CATEGORIAS_COMPRAS = [
  "Cereais",
  "Cereais (Doces)",
  "Proteína",
  "Hortifruti",
  "Limpeza",
  "Descartáveis",
  "Laticínios",
  "Panificação",
  "Bebidas",
  "Temperos e Condimentos",
  "Óleos e Gorduras",
  "Embalagens",
  "Gás",
  "Gás e Combustível",
  "Pão",
  "Equipamentos",
  "Outros",
];

const MODOS_ENTREGA = [
  "Pega no Local",
  "Entrega na Unidade",
  "Entrega 1x por Semana",
  "Entrega 2x por Semana",
  "Entrega 3x por Semana",
  "Entrega Diária",
  "Sob Demanda",
];

const PRAZOS_PAGAMENTO = [
  "À Vista",
  "7 Dias",
  "8 Dias",
  "14 Dias",
  "21 Dias",
  "27 Dias",
  "28 Dias",
  "30 Dias",
  "Boleto 30/60",
];

const TIPOS_FORNECEDOR = [
  "Supermercado",
  "Atacadão",
  "Distribuidor",
  "Fabricante",
  "Cooperativa",
  "Outro",
];

const FORMAS_PAGAMENTO = [
  "Boleto",
  "PIX",
  "Cartão",
  "Transferência",
  "Depósito",
  "Cheque",
];

const DIAS_ENTREGA = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Todo os Dias",
  "Dia Seguinte da Compra",
];

function SemaforoIndicator({ score }: { score: string }) {
  const config = {
    green: { color: "bg-emerald-500", ring: "ring-emerald-200", label: "Confiável" },
    yellow: { color: "bg-amber-500", ring: "ring-amber-200", label: "Atenção" },
    red: { color: "bg-red-500", ring: "ring-red-200", label: "Crítico" },
  };
  const c = config[score as keyof typeof config] || config.yellow;
  return (
    <div className="flex items-center gap-2">
      <div className={`h-3 w-3 rounded-full ${c.color} ring-2 ${c.ring}`} />
      <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
    </div>
  );
}

const SUPPLIER_TYPES = [
  { value: "supermercado", label: "Supermercado" },
  { value: "atacado", label: "Atacado/Atacarejo" },
  { value: "distribuidor", label: "Distribuidor" },
  { value: "distribuidor_especializado", label: "Distribuidor Especializado" },
  { value: "industria", label: "Indústria" },
  { value: "outro", label: "Outro" },
];

function SupplierCompatibilityManager({ supplierId, supplierName }: { supplierId: number; supplierName: string }) {
  const { data: rules, refetch } = trpc.suppliers.listCompatibility.useQuery({ supplierId });
  const addMut = trpc.suppliers.addCompatibility.useMutation({ onSuccess: () => { refetch(); toast.success("Regra adicionada"); } });
  const removeMut = trpc.suppliers.removeCompatibility.useMutation({ onSuccess: () => { refetch(); toast.success("Regra removida"); } });
  const [newProduct, setNewProduct] = useState("");
  const [newStatus, setNewStatus] = useState<"nao_atende" | "atende">("nao_atende");
  const [newReason, setNewReason] = useState("");

  return (
    <div className="mt-4 border-t pt-4">
      <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
        <Building2 className="w-4 h-4" /> Compatibilidade de Itens
      </h4>
      {rules && rules.length > 0 && (
        <div className="space-y-1 mb-3">
          {(rules as any[]).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1">
              <div className="flex items-center gap-2">
                <Badge variant={r.status === "nao_atende" ? "destructive" : "default"} className="text-[10px]">
                  {r.status === "nao_atende" ? "Não atende" : "Atende"}
                </Badge>
                <span className="font-medium">{r.productKey}</span>
                {r.reason && <span className="text-muted-foreground">— {r.reason}</span>}
              </div>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => removeMut.mutate({ id: r.id })}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 items-end flex-wrap">
        <div className="flex-1 min-w-[120px]">
          <Input placeholder="Nome do item (ex: PALITO)" value={newProduct} onChange={e => setNewProduct(e.target.value)} className="h-7 text-xs" />
        </div>
        <Select value={newStatus} onValueChange={(v: any) => setNewStatus(v)}>
          <SelectTrigger className="w-[110px] h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="nao_atende">Não atende</SelectItem>
            <SelectItem value="atende">Atende</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Motivo" value={newReason} onChange={e => setNewReason(e.target.value)} className="h-7 text-xs w-[150px]" />
        <Button size="sm" className="h-7 text-xs" disabled={!newProduct.trim()} onClick={() => {
          addMut.mutate({ supplierId, productKey: newProduct.trim(), status: newStatus, reason: newReason || undefined });
          setNewProduct(""); setNewReason("");
        }}>
          <Plus className="w-3 h-3 mr-1" /> Adicionar
        </Button>
      </div>
    </div>
  );
}

function PreferredSuppliersManager({ suppliers }: { suppliers: any[] }) {
  const utils = trpc.useUtils();
  const { data: preferredList, isLoading } = trpc.suppliers.preferredList.useQuery();
  const addMutation = trpc.suppliers.addPreferred.useMutation({
    onSuccess: () => { toast.success("Fornecedor preferencial adicionado"); utils.suppliers.preferredList.invalidate(); },
    onError: (err: any) => toast.error(err.message),
  });
  const removeMutation = trpc.suppliers.removePreferred.useMutation({
    onSuccess: () => { toast.success("Preferência removida"); utils.suppliers.preferredList.invalidate(); },
    onError: (err: any) => toast.error(err.message),
  });
  const [addSupplierId, setAddSupplierId] = useState<string>("");

  const availableToAdd = suppliers.filter((s: any) => 
    s.active && !preferredList?.some((ps: any) => ps.supplierId === s.id)
  );

  return (
    <div className="space-y-3">
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {(preferredList || []).map((ps: any) => (
            <div key={ps.supplierId} className="flex items-center gap-2 bg-white border border-emerald-200 rounded-full px-3 py-1.5">
              <Star className="h-3 w-3 text-emerald-500 fill-emerald-500" />
              <span className="text-sm font-medium">{ps.supplierName}</span>
              <Badge variant="secondary" className="text-[10px]">{ps.tolerancePct}%</Badge>
              <button
                onClick={() => removeMutation.mutate({ supplierId: ps.supplierId })}
                className="text-red-400 hover:text-red-600 ml-1"
                title="Remover preferência"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          {(preferredList || []).length === 0 && (
            <p className="text-xs text-muted-foreground italic">Nenhum fornecedor preferencial configurado.</p>
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Select value={addSupplierId} onValueChange={setAddSupplierId}>
          <SelectTrigger className="w-64 h-8 text-xs">
            <SelectValue placeholder="Adicionar fornecedor preferencial..." />
          </SelectTrigger>
          <SelectContent>
            {availableToAdd.map((s: any) => (
              <SelectItem key={s.id} value={String(s.id)}>{s.tradeName || s.companyName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-100"
          disabled={!addSupplierId || addMutation.isPending}
          onClick={() => {
            if (!addSupplierId) return;
            addMutation.mutate({ supplierId: parseInt(addSupplierId), tolerancePct: 3, reason: "Fornecedor preferencial" });
            setAddSupplierId("");
          }}
        >
          <Plus className="h-3 w-3 mr-1" />Adicionar
        </Button>
      </div>
    </div>
  );
}

export default function Fornecedores() {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterUnit, setFilterUnit] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showSearchNew, setShowSearchNew] = useState(false);
  const [searchUnit, setSearchUnit] = useState("");
  const [searchSector, setSearchSector] = useState("");
  const [searchRadius, setSearchRadius] = useState(150);
  const [minRating, setMinRating] = useState(0);
  const [addedPlaces, setAddedPlaces] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    companyName: "", tradeName: "", cnpj: "", contactName: "", phone: "", email: "", whatsapp: "",
    state: "", city: "", address: "", categories: [] as string[], notes: "",
    deliveryMode: "", deliveryDays: "", paymentTerms: "", paymentMethod: "", responsavelContato: "",
    unitId: "", responsavelNaUnidade: "", escriturario: "",
  });

  const { user } = useAuth();
  const isMaster = user?.email === "afonsoqueirogagn@gmail.com";
  const hasWriteAccess = isMaster || user?.role === "buyer_senior";
  const isDirector = user?.email === "frotas.patrimonio@qualities.com.br";
  const canManagePreferences = isMaster;
  const canManageMultiUnit = isMaster || isDirector; // Master + Júnior podem vincular fornecedor a várias unidades
  const isPaula = user?.email === "paularibeiro@qualities.com.br";
  const canEditFortesCodes = isMaster || isDirector || isPaula;
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [editUnitLinks, setEditUnitLinks] = useState<Array<{ unitId: number; responsavelNaUnidade: string; escriturario: string }>>([]);
  const [unitSearchTerm, setUnitSearchTerm] = useState("");

  const utils = trpc.useUtils();
  const { data: suppliersList, isLoading } = trpc.suppliers.list.useQuery();
  const { data: unitsList } = trpc.units.list.useQuery();
  const deleteMutation = trpc.suppliers.delete.useMutation({
    onSuccess: () => { toast.success("Fornecedor excluído"); utils.suppliers.list.invalidate(); },
    onError: (err: any) => toast.error(err.message),
  });
  const editMutation = trpc.suppliers.update.useMutation({
    onSuccess: () => { toast.success("Fornecedor atualizado"); utils.suppliers.list.invalidate(); setShowEditModal(false); },
    onError: (err: any) => toast.error(err.message),
  });
  const toggleBlockMutation = trpc.suppliers.toggleQuotationBlock.useMutation({
    onSuccess: (_, vars) => { toast.success(vars.blocked ? "Fornecedor bloqueado para cotação" : "Fornecedor desbloqueado para cotação"); utils.suppliers.list.invalidate(); },
    onError: (err: any) => toast.error(err.message),
  });
  const syncUnitsMutation = trpc.suppliers.syncUnits.useMutation({
    onSuccess: (result: any) => {
      const parts: string[] = [];
      if (result.added > 0) parts.push(`${result.added} adicionada(s)`);
      if (result.removed > 0) parts.push(`${result.removed} removida(s)`);
      if (result.updated > 0) parts.push(`${result.updated} atualizada(s)`);
      toast.success(`Unidades sincronizadas: ${parts.join(", ") || "sem alterações"} — Total: ${result.total}`);
      utils.suppliers.list.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });
  const createMutation = trpc.suppliers.create.useMutation({
    onSuccess: (result) => {
      toast.success("Fornecedor cadastrado com sucesso!");
      // Link to unit if selected
      if (form.unitId && result.id && canManageMultiUnit) {
        // Multi-unit: sync all selected units
        const unitIds = form.unitId.split(",").filter(Boolean).map(Number);
        if (unitIds.length > 0) {
          syncUnitsMutation.mutate({
            supplierId: result.id,
            units: unitIds.map(uid => ({
              unitId: uid,
              responsavelNaUnidade: form.responsavelNaUnidade || undefined,
              escriturario: form.escriturario || undefined,
            })),
          });
        }
      } else if (form.unitId && result.id) {
        // Single unit for non-privileged users
        linkUnitMutation.mutate({ supplierId: result.id, unitId: parseInt(form.unitId), responsavelNaUnidade: form.responsavelNaUnidade || undefined, escriturario: form.escriturario || undefined });
      }
      utils.suppliers.list.invalidate();
      setShowCreate(false);
      setForm({ companyName: "", tradeName: "", cnpj: "", contactName: "", phone: "", email: "", whatsapp: "", state: "", city: "", address: "", categories: [], notes: "", deliveryMode: "", deliveryDays: "", paymentTerms: "", paymentMethod: "", responsavelContato: "", unitId: "", responsavelNaUnidade: "", escriturario: "" });
    },
    onError: (err) => toast.error(err.message),
  });
  const linkUnitMutation = trpc.suppliers.linkUnit.useMutation({
    onError: (err) => toast.error("Erro ao vincular unidade: " + err.message),
  });

  // Search Places query
  const { data: placesResults, isLoading: isSearchingPlaces, isError: isSearchError, error: searchError, refetch: searchPlaces } = trpc.suppliers.searchPlaces.useQuery(
    { unitId: parseInt(searchUnit || "0"), sector: searchSector || "Cereais", radiusKm: searchRadius },
    { enabled: false, retry: false }
  );

  // Filter results by minimum rating on frontend
  const filteredPlacesResults = (placesResults || []).filter((p: any) => {
    if (minRating > 0 && (!p.rating || p.rating < minRating)) return false;
    return true;
  });

  const handleSearchPlaces = () => {
    if (!searchUnit || !searchSector) { toast.error("Selecione unidade e setor"); return; }
    searchPlaces().catch(() => toast.error("Erro ao buscar fornecedores. Tente novamente."));
  };

  const handleAddFromSearch = (place: any) => {
    // Check for duplicate by name or phone
    const placeName = place.name.toLowerCase();
    const placePhone = (place.phone || "").replace(/[^\d]/g, "");
    const existing = (suppliersList || []).find((s: any) => {
      const nameMatch = s.companyName.toLowerCase() === placeName || (s.tradeName || "").toLowerCase() === placeName;
      const phoneMatch = placePhone && (s.phone || "").replace(/[^\d]/g, "") === placePhone;
      return nameMatch || phoneMatch;
    });
    if (existing) {
      // Link existing supplier to the unit instead of creating duplicate
      linkUnitMutation.mutate({ supplierId: existing.id, unitId: parseInt(searchUnit) }, {
        onSuccess: () => {
          toast.success(`"${place.name}" já existe. Vinculado à unidade selecionada.`);
          setAddedPlaces(prev => { const next = new Set(Array.from(prev)); next.add(place.placeId); return next; });
        },
        onError: () => toast.info(`"${place.name}" já está cadastrado e vinculado.`),
      });
      setAddedPlaces(prev => { const next = new Set(Array.from(prev)); next.add(place.placeId); return next; });
      return;
    }
    // Extract phone as whatsapp (remove non-digits except +)
    const whatsapp = place.internationalPhone?.replace(/[^\d+]/g, "") || place.phone?.replace(/[^\d]/g, "") || "";
    createMutation.mutate({
      companyName: place.name,
      tradeName: place.name,
      phone: place.phone || undefined,
      whatsapp: whatsapp || undefined,
      address: place.address || undefined,
      categories: [searchSector],
      notes: place.website ? `Site: ${place.website}` : undefined,
    }, {
      onSuccess: (result) => {
        // Link to the searched unit
        if (searchUnit && result.id) {
          linkUnitMutation.mutate({ supplierId: result.id, unitId: parseInt(searchUnit) });
        }
        setAddedPlaces(prev => { const next = new Set(Array.from(prev)); next.add(place.placeId); return next; });
        toast.success(`${place.name} adicionado com sucesso!`);
        utils.suppliers.list.invalidate();
      },
    });
  };

  const filtered = (suppliersList || []).filter((s: any) => {
    const matchSearch = s.companyName.toLowerCase().includes(search.toLowerCase()) ||
      (s.tradeName || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.cnpj || "").includes(search);
    const matchCategory = filterCategory === "all" || (s.categories && (s.categories as string[]).some((c: string) => c.toLowerCase() === filterCategory.toLowerCase()));
    const matchUnit = filterUnit === "all" || (s.unitIds && (s.unitIds as number[]).includes(parseInt(filterUnit)));
    return matchSearch && matchCategory && matchUnit;
  });

  const handleCreate = () => {
    if (!form.companyName.trim()) { toast.error("Razão social é obrigatória"); return; }
    createMutation.mutate({
      ...form,
      email: form.email || undefined,
      categories: form.categories.length > 0 ? form.categories : undefined,
      deliveryMode: form.deliveryMode || undefined,
      deliveryDays: form.deliveryDays || undefined,
      paymentTerms: form.paymentTerms || undefined,
      paymentMethod: form.paymentMethod || undefined,
      responsavelContato: form.responsavelContato || undefined,
      notes: form.notes || undefined,
    });
  };

  const toggleCategory = (cat: string) => {
    setForm(f => ({
      ...f,
      categories: f.categories.includes(cat)
        ? f.categories.filter(c => c !== cat)
        : [...f.categories, cat],
    }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Fornecedores</h1>
            <p className="text-muted-foreground mt-1">Gerencie fornecedores com score de confiabilidade</p>
          </div>
          <div className="flex gap-2">
            <Button size="lg" variant="outline" onClick={() => setShowSearchNew(true)}>
              <Globe className="h-4 w-4 mr-2" />Pesquisar Novos
            </Button>
            {hasWriteAccess && (
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button size="lg"><Plus className="h-4 w-4 mr-2" />Novo Fornecedor</Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Cadastrar Fornecedor</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 pt-4">
                {/* Dados Básicos */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dados da Empresa</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2"><Label>Razão Social *</Label><Input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} placeholder="Razão social completa" /></div>
                    <div><Label>Nome Fantasia</Label><Input value={form.tradeName} onChange={e => setForm(f => ({ ...f, tradeName: e.target.value }))} placeholder="Nome fantasia" /></div>
                    <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" /></div>
                  </div>
                </div>

                {/* Contato */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contato</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><Label>Responsável (Fornecedor)</Label><Input value={form.responsavelContato} onChange={e => setForm(f => ({ ...f, responsavelContato: e.target.value }))} placeholder="Nome do responsável" /></div>
                    <div><Label>Contato Geral</Label><Input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} placeholder="Nome do contato" /></div>
                    <div><Label>Telefone / WhatsApp</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(00) 00000-0000" /></div>
                    <div><Label>E-mail</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@empresa.com" type="email" /></div>
                  </div>
                </div>

                {/* Localização */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Localização</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div><Label>Estado</Label><Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="CE" maxLength={2} /></div>
                    <div><Label>Cidade</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Fortaleza" /></div>
                    <div><Label>Endereço</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Endereço completo" /></div>
                  </div>
                </div>

                {/* Categorias */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Categorias de Compras</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {CATEGORIAS_COMPRAS.map(cat => (
                      <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-md hover:bg-muted/50 transition-colors">
                        <Checkbox
                          checked={form.categories.includes(cat)}
                          onCheckedChange={() => toggleCategory(cat)}
                        />
                        <span>{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Vínculo com Unidade */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> Vínculo com Unidade
                  </h4>
                  {canManageMultiUnit ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto p-2 border rounded-md bg-muted/20">
                        {(unitsList || []).map((u: any) => {
                          const isSelected = form.unitId?.split(",").includes(String(u.id));
                          return (
                            <label key={u.id} className={`flex items-center gap-2 text-sm cursor-pointer p-1.5 rounded transition-colors ${isSelected ? "bg-blue-50 dark:bg-blue-950/20" : "hover:bg-muted/50"}`}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => {
                                  const current = form.unitId ? form.unitId.split(",").filter(Boolean) : [];
                                  const updated = isSelected ? current.filter(id => id !== String(u.id)) : [...current, String(u.id)];
                                  setForm(f => ({ ...f, unitId: updated.join(",") }));
                                }}
                              />
                              <span className="truncate text-xs">{u.name} - {u.state}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div><Label>Responsável na Unidade</Label><Input value={form.responsavelNaUnidade} onChange={e => setForm(f => ({ ...f, responsavelNaUnidade: e.target.value }))} placeholder="Quem recebe na unidade" /></div>
                        <div><Label>Escriturário</Label><Input value={form.escriturario} onChange={e => setForm(f => ({ ...f, escriturario: e.target.value }))} placeholder="Escriturário da unidade" /></div>
                      </div>
                    </>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label>Unidade / Obra</Label>
                        <Select value={form.unitId} onValueChange={v => setForm(f => ({ ...f, unitId: v }))}>
                          <SelectTrigger><SelectValue placeholder="Selecione a unidade..." /></SelectTrigger>
                          <SelectContent>
                            {(unitsList || []).map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name} - {u.state}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Responsável na Unidade</Label><Input value={form.responsavelNaUnidade} onChange={e => setForm(f => ({ ...f, responsavelNaUnidade: e.target.value }))} placeholder="Quem recebe na unidade" /></div>
                      <div><Label>Escriturário</Label><Input value={form.escriturario} onChange={e => setForm(f => ({ ...f, escriturario: e.target.value }))} placeholder="Escriturário da unidade" /></div>
                    </div>
                  )}
                </div>

                {/* Entrega e Pagamento */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Entrega e Pagamento</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Modo de Entrega</Label>
                      <Select value={form.deliveryMode} onValueChange={v => setForm(f => ({ ...f, deliveryMode: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {MODOS_ENTREGA.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Dias de Entrega</Label>
                      <Select value={form.deliveryDays} onValueChange={v => setForm(f => ({ ...f, deliveryDays: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {DIAS_ENTREGA.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Prazo de Pagamento</Label>
                      <Select value={form.paymentTerms} onValueChange={v => setForm(f => ({ ...f, paymentTerms: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {PRAZOS_PAGAMENTO.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Forma de Pagamento</Label>
                      <Select value={form.paymentMethod} onValueChange={v => setForm(f => ({ ...f, paymentMethod: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {FORMAS_PAGAMENTO.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Observações */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Observações</h4>
                  <Textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Observações importantes sobre o fornecedor (ex: valor mínimo de pedido, restrições, condições especiais...)"
                    rows={3}
                  />
                </div>

                <Button onClick={handleCreate} className="w-full" size="lg" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Salvando..." : "Cadastrar Fornecedor"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
            )}
          </div>

          {/* Search New Suppliers Dialog */}
          <Dialog open={showSearchNew} onOpenChange={setShowSearchNew}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />Pesquisar Novos Fornecedores</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">Busque fornecedores na região da unidade por setor. Resultados do Google com telefone para contato.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Unidade</Label>
                    <Select value={searchUnit} onValueChange={setSearchUnit}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {(unitsList || []).map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name} - {u.state}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Setor</Label>
                    <Select value={searchSector} onValueChange={setSearchSector}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS_COMPRAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div>
                    <Label>Distância Máxima</Label>
                    <Select value={String(searchRadius)} onValueChange={(v) => setSearchRadius(Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="50">50 km</SelectItem>
                        <SelectItem value="100">100 km</SelectItem>
                        <SelectItem value="150">150 km</SelectItem>
                        <SelectItem value="200">200 km</SelectItem>
                        <SelectItem value="300">300 km</SelectItem>
                        <SelectItem value="500">500 km</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Nota Mínima (Google)</Label>
                    <Select value={String(minRating)} onValueChange={(v) => setMinRating(Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Todas as notas</SelectItem>
                        <SelectItem value="3">3+ estrelas</SelectItem>
                        <SelectItem value="3.5">3.5+ estrelas</SelectItem>
                        <SelectItem value="4">4+ estrelas</SelectItem>
                        <SelectItem value="4.5">4.5+ estrelas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Button onClick={handleSearchPlaces} disabled={isSearchingPlaces} className="w-full">
                      {isSearchingPlaces ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Buscando...</> : <><Search className="h-4 w-4 mr-2" />Buscar</>}
                    </Button>
                  </div>
                </div>

                {/* Results */}
                {filteredPlacesResults && filteredPlacesResults.length > 0 && (
                  <div className="space-y-3 mt-4">
                    <h4 className="text-sm font-semibold">{filteredPlacesResults.length} resultado{filteredPlacesResults.length > 1 ? 's' : ''} encontrado{filteredPlacesResults.length > 1 ? 's' : ''}{minRating > 0 ? ` (filtrado por ${minRating}+ estrelas)` : ''}</h4>
                    <div className="space-y-2">
                      {filteredPlacesResults.map((place: any) => (
                        <Card key={place.placeId} className="border">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <h5 className="font-medium text-sm">{place.name}</h5>
                                <div className="space-y-1 mt-1">
                                  {place.address && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                      <MapPin className="h-3 w-3 shrink-0" />{place.address}
                                    </p>
                                  )}
                                  {place.phone && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                      <Phone className="h-3 w-3 shrink-0" />{place.phone}
                                    </p>
                                  )}
                                  {place.website && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                      <Globe className="h-3 w-3 shrink-0" />
                                      <a href={place.website} target="_blank" rel="noopener" className="text-primary hover:underline truncate">{place.website}</a>
                                    </p>
                                  )}
                                  {place.rating && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                      <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />{place.rating} ({place.totalRatings} avaliações)
                                    </p>
                                  )}
                                  {place.distanceKm != null && (
                                    <p className="text-xs font-medium text-blue-600 flex items-center gap-1.5">
                                      • ~{place.distanceKm} km da unidade
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div>
                                {addedPlaces.has(place.placeId) ? (
                                  <Button size="sm" variant="outline" disabled className="gap-1">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />Adicionado
                                  </Button>
                                ) : !place.phone ? (
                                  <Button size="sm" variant="ghost" disabled className="gap-1 text-muted-foreground">
                                    Sem telefone
                                  </Button>
                                ) : (
                                  <Button size="sm" onClick={() => handleAddFromSearch(place)} disabled={createMutation.isPending}>
                                    <Plus className="h-4 w-4 mr-1" />Adicionar
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {placesResults && filteredPlacesResults.length === 0 && !isSearchError && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Globe className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum fornecedor encontrado na região.</p>
                    <p className="text-xs">Tente outro setor ou amplie a busca.</p>
                  </div>
                )}

                {isSearchError && (
                  <div className="text-center py-8">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 inline-block">
                      <p className="text-sm text-red-700 font-medium">Erro ao buscar fornecedores</p>
                      <p className="text-xs text-red-600 mt-1">{searchError?.message || "Tente novamente em alguns instantes."}</p>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-10" placeholder="Buscar por nome ou CNPJ..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full sm:w-52">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Todas as Categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Categorias</SelectItem>
              {CATEGORIAS_COMPRAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterUnit} onValueChange={setFilterUnit}>
            <SelectTrigger className="w-full sm:w-52">
              <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Todas as Unidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Unidades</SelectItem>
              {(unitsList || []).map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name} - {u.state}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{filtered.length} fornecedor{filtered.length !== 1 ? "es" : ""}</span>
          <span className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />{(suppliersList || []).filter((s: any) => s.reliabilityScore === "green").length} confiáveis</span>
          <span className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-amber-500" />{(suppliersList || []).filter((s: any) => s.reliabilityScore === "yellow").length} atenção</span>
          <span className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-red-500" />{(suppliersList || []).filter((s: any) => s.reliabilityScore === "red").length} críticos</span>
        </div>

        {/* Preferred Suppliers Section */}
        {canManagePreferences && (
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-emerald-800">Fornecedores Preferenciais</h3>
                  <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700">Tolerância de até 3% na compra otimizada</Badge>
                </div>
              </div>
              <PreferredSuppliersManager suppliers={suppliersList || []} />
            </CardContent>
          </Card>
        )}

        {/* Suppliers Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-6 h-48" /></Card>)}
          </div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="p-12 text-center"><p className="text-muted-foreground">Nenhum fornecedor encontrado</p></CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((supplier: any) => (
              <Card key={supplier.id} className="hover:shadow-md transition-all duration-200 hover:border-primary/20">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm truncate">{supplier.tradeName || supplier.companyName}</h3>
                      {supplier.tradeName && <p className="text-xs text-muted-foreground truncate">{supplier.companyName}</p>}
                      {supplier.quotationBlocked && (
                        <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 text-[9px] font-medium bg-red-100 text-red-700 rounded">
                          🚫 Bloqueado para cotação
                        </span>
                      )}
                    </div>
                    <SemaforoIndicator score={supplier.reliabilityScore} />
                  </div>

                  {supplier.cnpj && <p className="text-xs text-muted-foreground mb-2 font-mono">CNPJ: {supplier.cnpj}</p>}

                  <div className="space-y-1.5 mt-3">
                    {supplier.responsavelContato && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="h-3 w-3 shrink-0" /><span className="truncate">{supplier.responsavelContato}</span>
                      </div>
                    )}
                    {supplier.phone && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3 shrink-0" /><span>{supplier.phone}</span>
                      </div>
                    )}
                    {supplier.email && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3 shrink-0" /><span className="truncate">{supplier.email}</span>
                      </div>
                    )}
                    {(supplier.city || supplier.state) && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" /><span>{supplier.city}{supplier.state ? ` - ${supplier.state}` : ""}</span>
                      </div>
                    )}
                    {supplier.deliveryMode && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Truck className="h-3 w-3 shrink-0" /><span>{supplier.deliveryMode}</span>
                      </div>
                    )}
                    {supplier.deliveryDays && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3 shrink-0" /><span>{supplier.deliveryDays}</span>
                      </div>
                    )}
                    {supplier.paymentTerms && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CreditCard className="h-3 w-3 shrink-0" /><span>{supplier.paymentTerms}{supplier.paymentMethod ? ` • ${supplier.paymentMethod}` : ""}</span>
                      </div>
                    )}
                  </div>

                  {supplier.notes && (
                    <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-md">
                      <div className="flex items-start gap-1.5">
                        <MessageSquare className="h-3 w-3 shrink-0 text-amber-600 mt-0.5" />
                        <p className="text-[11px] text-amber-800 leading-tight">{supplier.notes}</p>
                      </div>
                    </div>
                  )}

                  {supplier.categories && (supplier.categories as string[]).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {(supplier.categories as string[]).slice(0, 3).map((cat: string) => (
                        <Badge key={cat} variant="secondary" className="text-[10px] px-1.5 py-0">{cat}</Badge>
                      ))}
                      {(supplier.categories as string[]).length > 3 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{(supplier.categories as string[]).length - 3}</Badge>
                      )}
                    </div>
                  )}

                  {/* Unit badges */}
                  {supplier.unitIds && (supplier.unitIds as number[]).length > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Building2 className="h-3 w-3 text-blue-600" />
                        <span className="text-[10px] font-medium text-blue-700">
                          {(supplier.unitIds as number[]).length === 1 ? "1 unidade" : `${(supplier.unitIds as number[]).length} unidades`}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(supplier.unitIds as number[]).map((uid: number) => {
                          const unit = (unitsList || []).find((u: any) => u.id === uid);
                          return unit ? (
                            <Badge key={uid} variant="outline" className="text-[10px] px-1.5 py-0 border-blue-300 text-blue-700 bg-blue-50">
                              {unit.name} - {unit.state}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}

                  {/* Edição rápida Cód. Fortes — visível para Master e Júnior */}
                  {canEditFortesCodes && (
                    <FortesQuickEdit supplierId={supplier.id} supplierName={supplier.tradeName || supplier.companyName} />
                  )}

                  {supplier.avgRating && parseFloat(supplier.avgRating) > 0 && (
                    <div className="flex items-center gap-1 mt-3 pt-3 border-t">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-xs font-medium">{parseFloat(supplier.avgRating).toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground">({supplier.totalDeliveries} entregas)</span>
                    </div>
                  )}

                  {/* Price History Button */}
                  <SupplierPriceHistorySection supplierId={supplier.id} />
                  {/* Category Items Filter */}
                  <SupplierCategoryItems
                    supplierId={supplier.id}
                    currentCategories={Array.isArray(supplier.categories) ? supplier.categories as string[] : []}
                    onSuggest={(cats) => {
                      const current = Array.isArray(supplier.categories) ? [...supplier.categories as string[]] : [];
                      const updated = Array.from(new Set([...current, ...cats]));
                      editMutation.mutate({ id: supplier.id, categories: updated });
                    }}
                  />
                  {/* ADM Master + buyer_senior: Edit + Delete */}
                  {hasWriteAccess && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                      <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={async () => {
                        setEditingSupplier(supplier);
                        setEditForm({ companyName: supplier.companyName, tradeName: supplier.tradeName || "", cnpj: supplier.cnpj || "", phone: supplier.phone || "", email: supplier.email || "", whatsapp: supplier.whatsapp || "", state: supplier.state || "", city: supplier.city || "", address: supplier.address || "", responsavelContato: supplier.responsavelContato || "", deliveryMode: supplier.deliveryMode || "", deliveryDays: supplier.deliveryDays || "", paymentTerms: supplier.paymentTerms || "", paymentMethod: supplier.paymentMethod || "", notes: supplier.notes || "", categories: Array.isArray(supplier.categories) ? [...supplier.categories] : [], supplierType: (supplier as any).supplierType || "" });
                        // Load existing unit links
                        try {
                          const links = await utils.suppliers.unitLinks.fetch({ supplierId: supplier.id });
                          setEditUnitLinks((links || []).filter((l: any) => l.active).map((l: any) => ({ unitId: l.unitId, responsavelNaUnidade: l.responsavelNaUnidade || "", escriturario: l.escriturario || "" })));
                        } catch { setEditUnitLinks([]); }
                        setUnitSearchTerm("");
                        setShowEditModal(true);
                      }}>
                        <Pencil className="h-3 w-3 mr-1" /> Editar
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs text-red-600 hover:bg-red-50" onClick={() => { if (confirm(`Excluir ${supplier.tradeName || supplier.companyName}? Esta a\u00e7\u00e3o n\u00e3o pode ser desfeita.`)) deleteMutation.mutate({ id: supplier.id }); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {isMaster && (
                    <SupplierCompatibilityManager supplierId={supplier.id} supplierName={supplier.tradeName || supplier.companyName} />
                  )}
                  {isMaster && (
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant={supplier.quotationBlocked ? "default" : "outline"}
                        className={`w-full text-[10px] ${supplier.quotationBlocked ? "bg-green-600 hover:bg-green-700 text-white" : "text-red-600 hover:bg-red-50 border-red-200"}`}
                        onClick={() => {
                          const action = supplier.quotationBlocked ? "desbloquear" : "bloquear";
                          const reason = supplier.quotationBlocked ? undefined : prompt(`Motivo do bloqueio de "${supplier.tradeName || supplier.companyName}" para cotações:`);
                          if (!supplier.quotationBlocked && !reason) return;
                          toggleBlockMutation.mutate({ supplierId: supplier.id, blocked: !supplier.quotationBlocked, reason: reason || undefined });
                        }}
                      >
                        {supplier.quotationBlocked ? "✅ Desbloquear para cotação" : "🚫 Bloquear para cotação"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit Supplier Modal (Master Only) */}
      {showEditModal && editingSupplier && (
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Fornecedor: {editingSupplier.tradeName || editingSupplier.companyName}</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
              <span>🔒</span> Alterações registradas na auditoria corporativa.
            </p>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Razão Social</Label><Input value={editForm.companyName} onChange={e => setEditForm((f: any) => ({ ...f, companyName: e.target.value }))} /></div>
                <div><Label>Nome Fantasia</Label><Input value={editForm.tradeName} onChange={e => setEditForm((f: any) => ({ ...f, tradeName: e.target.value }))} /></div>
                <div><Label>CNPJ</Label><Input value={editForm.cnpj} onChange={e => setEditForm((f: any) => ({ ...f, cnpj: e.target.value }))} /></div>
                <div><Label>Cód. Fortes (Emp. 0032)</Label><Input value={editForm.fortesCode0032 || ''} onChange={e => setEditForm((f: any) => ({ ...f, fortesCode0032: e.target.value }))} placeholder="000000" maxLength={6} className="font-mono" /></div>
                <div><Label>Cód. Fortes (Emp. 0034 - Queiroz)</Label><Input value={editForm.fortesCode0034 || ''} onChange={e => setEditForm((f: any) => ({ ...f, fortesCode0034: e.target.value }))} placeholder="000000" maxLength={6} className="font-mono" /></div>
                <div><Label>Responsável</Label><Input value={editForm.responsavelContato} onChange={e => setEditForm((f: any) => ({ ...f, responsavelContato: e.target.value }))} /></div>
                <div><Label>Telefone</Label><Input value={editForm.phone} onChange={e => setEditForm((f: any) => ({ ...f, phone: e.target.value }))} /></div>
                <div><Label>WhatsApp</Label><Input value={editForm.whatsapp} onChange={e => setEditForm((f: any) => ({ ...f, whatsapp: e.target.value }))} /></div>
                <div><Label>E-mail</Label><Input value={editForm.email} onChange={e => setEditForm((f: any) => ({ ...f, email: e.target.value }))} /></div>
                <div><Label>Estado</Label><Input value={editForm.state} onChange={e => setEditForm((f: any) => ({ ...f, state: e.target.value.toUpperCase().slice(0, 2) }))} maxLength={2} /></div>
                <div><Label>Cidade</Label><Input value={editForm.city} onChange={e => setEditForm((f: any) => ({ ...f, city: e.target.value }))} /></div>
                <div><Label>Endereço</Label><Input value={editForm.address} onChange={e => setEditForm((f: any) => ({ ...f, address: e.target.value }))} /></div>
                <div><Label>Modo Entrega</Label>
                  <Select value={editForm.deliveryMode} onValueChange={v => setEditForm((f: any) => ({ ...f, deliveryMode: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{MODOS_ENTREGA.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Dias Entrega</Label>
                  <Select value={editForm.deliveryDays} onValueChange={v => setEditForm((f: any) => ({ ...f, deliveryDays: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{DIAS_ENTREGA.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Prazo Pagamento</Label>
                  <Select value={editForm.paymentTerms} onValueChange={v => setEditForm((f: any) => ({ ...f, paymentTerms: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{PRAZOS_PAGAMENTO.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Forma Pagamento</Label>
                  <Select value={editForm.paymentMethod} onValueChange={v => setEditForm((f: any) => ({ ...f, paymentMethod: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{FORMAS_PAGAMENTO.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2"><Label className="font-semibold">Tipo de Fornecedor</Label>
                  <Select value={editForm.supplierType || ""} onValueChange={v => setEditForm((f: any) => ({ ...f, supplierType: v }))}>
                    <SelectTrigger><SelectValue placeholder="Classificar tipo..." /></SelectTrigger>
                    <SelectContent>{TIPOS_FORNECEDOR.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-1">Supermercados têm restrições automáticas para itens como marmita, palito, perflex, saco de lixo</p>
                </div>
                <div className="md:col-span-2">
                  <Label className="font-semibold">Categorias / Setores</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1 mt-2 p-3 border rounded-md bg-muted/30">
                    {CATEGORIAS_COMPRAS.map(cat => (
                      <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer p-1.5 rounded hover:bg-muted/50">
                        <Checkbox
                          checked={(editForm.categories || []).includes(cat)}
                          onCheckedChange={() => setEditForm((f: any) => ({
                            ...f,
                            categories: (f.categories || []).includes(cat)
                              ? (f.categories || []).filter((c: string) => c !== cat)
                              : [...(f.categories || []), cat],
                          }))}
                        />
                        {cat}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2"><Label>Observações</Label><Textarea value={editForm.notes} onChange={e => setEditForm((f: any) => ({ ...f, notes: e.target.value }))} rows={2} /></div>
              </div>
              {/* Seção Multiunidade — visível apenas para Master e Júnior */}
              {canManageMultiUnit && (
                <div className="space-y-3 border-t pt-4">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> Unidades Atendidas
                    <span className="text-xs font-normal normal-case text-blue-600">({editUnitLinks.length} selecionada{editUnitLinks.length !== 1 ? "s" : ""})</span>
                  </h4>
                  <Input
                    placeholder="Buscar unidade..."
                    value={unitSearchTerm}
                    onChange={e => setUnitSearchTerm(e.target.value)}
                    className="text-sm"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[200px] overflow-y-auto p-2 border rounded-md bg-muted/20">
                    {(unitsList || [])
                      .filter((u: any) => !unitSearchTerm || `${u.name} ${u.state}`.toLowerCase().includes(unitSearchTerm.toLowerCase()))
                      .map((u: any) => {
                        const isLinked = editUnitLinks.some(l => l.unitId === u.id);
                        return (
                          <label key={u.id} className={`flex items-center gap-2 text-sm cursor-pointer p-2 rounded transition-colors ${isLinked ? "bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800" : "hover:bg-muted/50"}`}>
                            <Checkbox
                              checked={isLinked}
                              onCheckedChange={() => {
                                if (isLinked) {
                                  setEditUnitLinks(prev => prev.filter(l => l.unitId !== u.id));
                                } else {
                                  setEditUnitLinks(prev => [...prev, { unitId: u.id, responsavelNaUnidade: "", escriturario: "" }]);
                                }
                              }}
                            />
                            <span className="truncate">{u.name} - {u.state}</span>
                          </label>
                        );
                      })}
                  </div>
                  {/* Dados por unidade selecionada */}
                  {editUnitLinks.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">Dados por unidade (opcional):</p>
                      {editUnitLinks.map((link, idx) => {
                        const unit = (unitsList || []).find((u: any) => u.id === link.unitId);
                        return (
                          <div key={link.unitId} className="grid grid-cols-[1fr_1fr_1fr] gap-2 items-center p-2 rounded border bg-muted/10 text-sm">
                            <span className="font-medium text-xs truncate">{unit?.name || `ID ${link.unitId}`}</span>
                            <Input
                              placeholder="Responsável"
                              value={link.responsavelNaUnidade}
                              onChange={e => setEditUnitLinks(prev => prev.map((l, i) => i === idx ? { ...l, responsavelNaUnidade: e.target.value } : l))}
                              className="text-xs h-8"
                            />
                            <Input
                              placeholder="Escriturário"
                              value={link.escriturario}
                              onChange={e => setEditUnitLinks(prev => prev.map((l, i) => i === idx ? { ...l, escriturario: e.target.value } : l))}
                              className="text-xs h-8"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancelar</Button>
                <Button onClick={() => {
                  editMutation.mutate({ id: editingSupplier.id, ...editForm });
                  // Sync units if user has permission
                  if (canManageMultiUnit) {
                    syncUnitsMutation.mutate({
                      supplierId: editingSupplier.id,
                      units: editUnitLinks.map(l => ({
                        unitId: l.unitId,
                        responsavelNaUnidade: l.responsavelNaUnidade || undefined,
                        escriturario: l.escriturario || undefined,
                      })),
                    });
                  }
                }} disabled={editMutation.isPending || syncUnitsMutation.isPending}>
                  {editMutation.isPending || syncUnitsMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}

function SupplierCategoryItems({ supplierId, currentCategories, onSuggest }: { supplierId: number; currentCategories: string[]; onSuggest?: (cats: string[]) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("all");
  const { data: history } = trpc.prices.supplierHistory.useQuery(
    { supplierId, limit: 100 },
    { enabled: expanded }
  );

  const categorizedItems = useMemo(() => {
    if (!history?.length) return { byCategory: {} as Record<string, any[]>, suggestedCategories: [] as string[] };
    const byCategory: Record<string, any[]> = {};
    for (const h of history) {
      const cat = (h as any).sector || "Outros";
      if (!byCategory[cat]) byCategory[cat] = [];
      if (!byCategory[cat].find((x: any) => x.productName === h.productName)) {
        byCategory[cat].push(h);
      }
    }
    const suggestedCategories = Object.keys(byCategory).filter(c => !currentCategories.includes(c) && c !== "Outros");
    return { byCategory, suggestedCategories };
  }, [history, currentCategories]);

  return (
    <div className="mt-2 pt-2 border-t">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
      >
        <Package className="h-3 w-3" />
        {expanded ? 'Ocultar itens por categoria' : 'Ver itens cotados por categoria'}
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          {categorizedItems.suggestedCategories.length > 0 && (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-[10px] font-semibold text-blue-700 mb-1">💡 Categorias sugeridas (baseado no histórico):</p>
              <div className="flex flex-wrap gap-1">
                {categorizedItems.suggestedCategories.map((cat: string) => (
                  <Badge key={cat} variant="outline" className="text-[10px] px-1.5 py-0 border-blue-400 text-blue-700 bg-blue-100 cursor-pointer hover:bg-blue-200" onClick={() => onSuggest?.([cat])}>
                    + {cat}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-1 flex-wrap">
            <Badge variant={filterCat === "all" ? "default" : "outline"} className="text-[9px] cursor-pointer" onClick={() => setFilterCat("all")}>Todos</Badge>
            {Object.keys(categorizedItems.byCategory).map(cat => (
              <Badge key={cat} variant={filterCat === cat ? "default" : "outline"} className="text-[9px] cursor-pointer" onClick={() => setFilterCat(cat)}>
                {cat} ({categorizedItems.byCategory[cat].length})
              </Badge>
            ))}
          </div>
          <div className="max-h-32 overflow-y-auto">
            {(Object.entries(categorizedItems.byCategory) as [string, any[]][])
              .filter(([cat]) => filterCat === "all" || cat === filterCat)
              .map(([cat, items]) => (
                <div key={cat} className="mb-1">
                  {filterCat === "all" && <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mt-1">{cat}</p>}
                  {(items as any[]).slice(0, 10).map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-[10px] py-0.5 border-b border-dashed last:border-0">
                      <span className="truncate max-w-[140px]">{item.productName}</span>
                      <span className="font-mono text-muted-foreground">R$ {parseFloat(item.unitPrice).toFixed(2)}</span>
                    </div>
                  ))}
                  {(items as any[]).length > 10 && <p className="text-[9px] text-muted-foreground">+{(items as any[]).length - 10} itens</p>}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SupplierPriceHistorySection({ supplierId }: { supplierId: number }) {
  const [expanded, setExpanded] = useState(false);
  const { data: history, isLoading } = trpc.prices.supplierHistory.useQuery(
    { supplierId, limit: 8 },
    { enabled: expanded }
  );

  return (
    <div className="mt-3 pt-3 border-t">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-primary hover:underline flex items-center gap-1"
      >
        <TrendingUp className="h-3 w-3" />
        {expanded ? 'Ocultar histórico' : 'Ver histórico de preços'}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1">
          {isLoading ? (
            <p className="text-[10px] text-muted-foreground">Carregando...</p>
          ) : !history?.length ? (
            <p className="text-[10px] text-muted-foreground">Sem histórico de preços</p>
          ) : (
            <div className="max-h-40 overflow-y-auto">
              {history.map((h: any, idx: number) => {
                const price = parseFloat(h.unitPrice);
                const prevEntry = history[idx + 1];
                const prevPrice = prevEntry ? parseFloat(prevEntry.unitPrice) : null;
                const variation = prevPrice && prevPrice > 0 ? ((price - prevPrice) / prevPrice * 100) : null;
                return (
                  <div key={idx} className="flex items-center justify-between text-[10px] py-0.5 border-b border-dashed last:border-0 gap-1">
                    <span className="truncate max-w-[100px]" title={h.productName}>{h.productName}</span>
                    <span className="font-mono font-medium">R$ {price.toFixed(2)}</span>
                    {variation !== null && (
                      <span className={`font-medium ${variation < 0 ? 'text-green-600' : variation > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {variation > 0 ? '+' : ''}{variation.toFixed(1)}%
                      </span>
                    )}
                    <span className="text-muted-foreground">{new Date(h.recordedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FortesQuickEdit({ supplierId, supplierName }: { supplierId: number; supplierName: string }) {
  const [open, setOpen] = useState(false);
  const [code0032, setCode0032] = useState("");
  const [code0034, setCode0034] = useState("");
  const [loaded, setLoaded] = useState(false);
  const utils = trpc.useUtils();

  const { data: codes } = trpc.suppliers.getFortesCode.useQuery(
    { supplierId },
    { enabled: open && !loaded }
  );

  const updateMutation = trpc.suppliers.updateFortesCode.useMutation({
    onSuccess: () => {
      toast.success("Código Fortes atualizado!");
      utils.suppliers.getFortesCode.invalidate({ supplierId });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Load existing codes when data arrives
  if (codes && !loaded) {
    const c32 = codes.find((c: any) => c.empresaCode === "0032");
    const c34 = codes.find((c: any) => c.empresaCode === "0034");
    setCode0032(c32?.fortesCode || "");
    setCode0034(c34?.fortesCode || "");
    setLoaded(true);
  }

  const handleSave = () => {
    const prev0032 = codes?.find((c: any) => c.empresaCode === "0032")?.fortesCode || "";
    const prev0034 = codes?.find((c: any) => c.empresaCode === "0034")?.fortesCode || "";
    if (code0032 !== prev0032) {
      updateMutation.mutate({ supplierId, empresaCode: "0032", fortesCode: code0032 });
    }
    if (code0034 !== prev0034) {
      updateMutation.mutate({ supplierId, empresaCode: "0034", fortesCode: code0034 });
    }
    setOpen(false);
  };

  const has0032 = codes?.find((c: any) => c.empresaCode === "0032")?.fortesCode;
  const has0034 = codes?.find((c: any) => c.empresaCode === "0034")?.fortesCode;
  const hasAnyCode = has0032 || has0034;

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setLoaded(false); }}
        className={`mt-2 flex items-center gap-1.5 text-[10px] px-2 py-1 rounded border transition-colors ${
          hasAnyCode
            ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
            : "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
        }`}
        title="Edição rápida de códigos Fortes"
      >
        <Hash className="h-3 w-3" />
        {hasAnyCode ? (
          <span>Fortes: {has0032 && `0032:${has0032}`}{has0032 && has0034 && " | "}{has0034 && `0034:${has0034}`}</span>
        ) : (
          <span>Adicionar Cód. Fortes</span>
        )}
      </button>
    );
  }

  return (
    <div className="mt-2 p-2.5 border border-blue-200 rounded-lg bg-blue-50/50 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-blue-800 flex items-center gap-1">
          <Hash className="h-3.5 w-3.5" /> Códigos Fortes
        </span>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground font-medium">Emp. 0032</label>
          <input
            value={code0032}
            onChange={e => setCode0032(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            className="w-full text-xs font-mono px-2 py-1.5 border rounded bg-white focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
            maxLength={6}
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground font-medium">Emp. 0034 (Queiroz)</label>
          <input
            value={code0034}
            onChange={e => setCode0034(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            className="w-full text-xs font-mono px-2 py-1.5 border rounded bg-white focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
            maxLength={6}
          />
        </div>
      </div>
      <div className="flex justify-end gap-1.5">
        <button
          onClick={() => setOpen(false)}
          className="text-[10px] px-2.5 py-1 rounded border bg-white hover:bg-gray-50 text-muted-foreground"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="text-[10px] px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
        >
          <Check className="h-3 w-3" />
          {updateMutation.isPending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}
import { Hash, Check, X } from "lucide-react";
