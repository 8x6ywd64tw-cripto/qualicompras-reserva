import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Plus, Trash2, CheckCircle2, XCircle, HelpCircle, Search, RefreshCw, History, Tag, Package, ShieldBan, MapPin, ArrowRight } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const STATUS_CONFIG = {
  approved: { label: "Aprovada", color: "text-green-700 bg-green-50 border-green-200", icon: CheckCircle2 },
  unknown: { label: "Desconhecida", color: "text-yellow-700 bg-yellow-50 border-yellow-200", icon: HelpCircle },
  rejected: { label: "Reprovada", color: "text-red-700 bg-red-50 border-red-200", icon: XCircle },
};

export default function Marcas() {
  const [activeTab, setActiveTab] = useState("classificacao");
  const { user } = useAuth();
  const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
  const isMaster = user?.email === MASTER_EMAIL;
  const isJunior = user?.role === "buyer_senior";
  const canManage = isMaster || isJunior;
  const [, setLocation] = useLocation();
  // Redirecionar se não é Master nem Júnior
  useEffect(() => {
    if (user && !canManage) {
      setLocation("/");
    }
  }, [user, canManage, setLocation]);
  if (user && !canManage) return null;
  
  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="classificacao" className="flex items-center gap-1 text-xs">
            <Tag className="w-3.5 h-3.5" /> Classificação
          </TabsTrigger>
          <TabsTrigger value="rejeicoes-global" className="flex items-center gap-1 text-xs">
            <ShieldBan className="w-3.5 h-3.5" /> Rejeições Globais
          </TabsTrigger>
          <TabsTrigger value="rejeicoes-unidade" className="flex items-center gap-1 text-xs">
            <MapPin className="w-3.5 h-3.5" /> Rejeições Regionais
          </TabsTrigger>
          <TabsTrigger value="aliases" className="flex items-center gap-1 text-xs">
            <ArrowRight className="w-3.5 h-3.5" /> Aliases
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-1 text-xs">
            <History className="w-3.5 h-3.5" /> Histórico
          </TabsTrigger>
        </TabsList>
        <TabsContent value="classificacao">
          <ClassificacaoTab />
        </TabsContent>
        <TabsContent value="rejeicoes-global">
          <RejeicoesGlobalTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="rejeicoes-unidade">
          <RejeicoesUnidadeTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="historico">
          <HistoricoMarcasTab />
        </TabsContent>
        <TabsContent value="aliases">
          <AliasesTab canManage={canManage} isMaster={isMaster} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ==================== CLASSIFICAÇÃO TAB (existing) ====================
function ClassificacaoTab() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [newBrand, setNewBrand] = useState({ name: "", status: "approved" as "approved" | "unknown" | "rejected", reason: "", category: "" });
  const [rejectingBrand, setRejectingBrand] = useState<{ id: number; name: string; category: string } | null>(null);
  const [rejectJustification, setRejectJustification] = useState("");
  const { user } = useAuth();

  const { data: brands, isLoading } = trpc.brands.list.useQuery({
    status: filterStatus !== "all" ? filterStatus as any : undefined,
  });
  const utils = trpc.useUtils();

  const createMutation = trpc.brands.create.useMutation({
    onSuccess: () => {
      toast.success("Marca cadastrada!");
      utils.brands.list.invalidate();
      setShowAdd(false);
      setNewBrand({ name: "", status: "approved", reason: "", category: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.brands.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado!");
      utils.brands.list.invalidate();
    },
  });

  const deleteMutation = trpc.brands.delete.useMutation({
    onSuccess: () => {
      toast.success("Marca removida!");
      utils.brands.list.invalidate();
    },
  });

  const syncMutation = trpc.brands.syncFromProposals.useMutation({
    onSuccess: (data) => {
      if (data.added > 0) {
        toast.success(`${data.added} novas marcas importadas das propostas!`);
      } else {
        toast.info("Todas as marcas já estão sincronizadas.");
      }
      utils.brands.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const filtered = (brands || []).filter((b: any) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    (b.category || "").toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce((acc: Record<string, any[]>, b: any) => {
    const key = b.name.toUpperCase();
    if (!acc[key]) acc[key] = [];
    acc[key].push(b);
    return acc;
  }, {} as Record<string, any[]>);

  const counts = {
    approved: (brands || []).filter((b: any) => b.status === "approved").length,
    unknown: (brands || []).filter((b: any) => b.status === "unknown").length,
    rejected: (brands || []).filter((b: any) => b.status === "rejected").length,
    total: (brands || []).length,
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Classificação de Marcas</h2>
          <p className="text-sm text-muted-foreground">Verde (aprovada), amarela (desconhecida), vermelha (reprovada)</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => syncMutation.mutate()} size="sm" variant="outline" disabled={syncMutation.isPending}>
            <RefreshCw className={`w-4 h-4 mr-1 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            {syncMutation.isPending ? "Sincronizando..." : "Sincronizar"}
          </Button>
          <Button onClick={() => setShowAdd(true)} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Nova Marca
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:ring-2 ring-border" onClick={() => setFilterStatus("all")}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">{counts.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:ring-2 ring-green-300" onClick={() => setFilterStatus(filterStatus === "approved" ? "all" : "approved")}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-700">{counts.approved}</div>
            <div className="text-xs text-muted-foreground">Aprovadas</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:ring-2 ring-yellow-300" onClick={() => setFilterStatus(filterStatus === "unknown" ? "all" : "unknown")}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-yellow-700">{counts.unknown}</div>
            <div className="text-xs text-muted-foreground">A Classificar</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:ring-2 ring-red-300" onClick={() => setFilterStatus(filterStatus === "rejected" ? "all" : "rejected")}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-red-700">{counts.rejected}</div>
            <div className="text-xs text-muted-foreground">Reprovadas</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar marca ou produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Aprovada</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" /> Desconhecida</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Reprovada</span>
      </div>

      {/* Brand List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {search ? "Nenhuma marca encontrada" : "Nenhuma marca cadastrada. Clique em \"Sincronizar\" para importar."}
            </div>
          ) : (
            <div className="divide-y">
              {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b, "pt-BR")).map(([brandName, items]) => (
                <div key={brandName} className="p-3">
                  <div className="font-semibold text-sm mb-2">{brandName}</div>
                  <div className="space-y-1.5 pl-2">
                    {(items as any[]).map((brand: any) => {
                      const config = STATUS_CONFIG[brand.status as keyof typeof STATUS_CONFIG];
                      const Icon = config.icon;
                      return (
                        <div key={brand.id} className={`flex items-center justify-between p-2 rounded-md border ${config.color}`}>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Icon className="w-4 h-4 shrink-0" />
                            <div className="truncate">
                              <span className="text-sm">{brand.category || "Todos os produtos"}</span>
                              {brand.reason && <span className="text-xs opacity-70 ml-2">({brand.reason})</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:bg-green-100" title="Aprovar" disabled={brand.status === "approved"} onClick={() => updateMutation.mutate({ id: brand.id, status: "approved" })}>
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-yellow-600 hover:bg-yellow-100" title="Desconhecida" disabled={brand.status === "unknown"} onClick={() => updateMutation.mutate({ id: brand.id, status: "unknown" })}>
                              <HelpCircle className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:bg-red-100" title="Reprovar" disabled={brand.status === "rejected"} onClick={() => { setRejectingBrand({ id: brand.id, name: brand.name, category: brand.category || 'Todos' }); setRejectJustification(""); }}>
                              <XCircle className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600" title="Remover" onClick={() => { if (confirm(`Remover "${brand.name}" para "${brand.category || 'todos'}"?`)) deleteMutation.mutate({ id: brand.id }); }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Brand Dialog */}
      {/* Reject Brand Dialog — justificativa obrigatória */}
      <Dialog open={!!rejectingBrand} onOpenChange={() => setRejectingBrand(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-700 flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Rejeitar Marca
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800 font-medium">Marca: {rejectingBrand?.name}</p>
              <p className="text-xs text-red-700">Produto: {rejectingBrand?.category}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Justificativa obrigatória *</label>
              <Textarea className="mt-1" placeholder="Explique o motivo da rejeição desta marca (mín. 10 caracteres)..." value={rejectJustification} onChange={(e) => setRejectJustification(e.target.value)} rows={3} />
              {rejectJustification.length > 0 && rejectJustification.length < 10 && <p className="text-xs text-red-500 mt-1">Mínimo 10 caracteres ({rejectJustification.length}/10)</p>}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-700 flex items-center gap-1 font-medium">🔒 Esta ação é registrada permanentemente na auditoria corporativa.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRejectingBrand(null)}>Cancelar</Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" disabled={rejectJustification.length < 10 || updateMutation.isPending} onClick={() => { if (rejectingBrand) { updateMutation.mutate({ id: rejectingBrand.id, status: "rejected", justification: rejectJustification, reason: rejectJustification }); setRejectingBrand(null); } }}>Confirmar Rejeição</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Brand Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cadastrar Nova Marca</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome da Marca *</label>
              <Input value={newBrand.name} onChange={(e) => setNewBrand({ ...newBrand, name: e.target.value.toUpperCase() })} placeholder="Ex: CRISTAL" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Produto/Item específico</label>
              <Input value={newBrand.category} onChange={(e) => setNewBrand({ ...newBrand, category: e.target.value })} placeholder="Ex: ARROZ TIPO 1 5KG" className="mt-1" />
              <p className="text-[11px] text-muted-foreground mt-1">Se vazio, a regra vale para todos os produtos dessa marca.</p>
            </div>
            <div>
              <label className="text-sm font-medium">Status *</label>
              <Select value={newBrand.status} onValueChange={(val) => setNewBrand({ ...newBrand, status: val as any })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Aprovada</SelectItem>
                  <SelectItem value="unknown">Desconhecida</SelectItem>
                  <SelectItem value="rejected">Reprovada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Motivo (opcional)</label>
              <Input value={newBrand.reason} onChange={(e) => setNewBrand({ ...newBrand, reason: e.target.value })} placeholder="Ex: Qualidade ruim" className="mt-1" />
            </div>
            <Button className="w-full" disabled={!newBrand.name.trim() || createMutation.isPending} onClick={() => createMutation.mutate({ name: newBrand.name.trim(), status: newBrand.status, reason: newBrand.reason || undefined, category: newBrand.category || undefined })}>
              {createMutation.isPending ? "Salvando..." : "Cadastrar Marca"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== HISTÓRICO DE MARCAS TAB (new brand registry) ====================
function HistoricoMarcasTab() {
  const [search, setSearch] = useState("");
  const [filterSupplier, setFilterSupplier] = useState<string>("all");
  const [filterUnit, setFilterUnit] = useState<string>("all");

  const { data: registry, isLoading } = trpc.brandRegistry.list.useQuery({});

  // Extract unique suppliers and units for filters
  const suppliers = useMemo(() => {
    if (!registry) return [];
    const unique = Array.from(new Set(registry.filter((r: any) => r.supplierName).map((r: any) => r.supplierName)));
    return unique.sort((a: any, b: any) => a.localeCompare(b, "pt-BR"));
  }, [registry]);

  const units = useMemo(() => {
    if (!registry) return [];
    const unique = Array.from(new Set(registry.filter((r: any) => r.unitName).map((r: any) => r.unitName)));
    return unique.sort((a: any, b: any) => a.localeCompare(b, "pt-BR"));
  }, [registry]);

  // Filter and group
  const filtered = useMemo(() => {
    if (!registry) return [];
    return registry.filter((r: any) => {
      const matchSearch = !search || 
        r.productName?.toLowerCase().includes(search.toLowerCase()) ||
        r.brand?.toLowerCase().includes(search.toLowerCase()) ||
        r.supplierName?.toLowerCase().includes(search.toLowerCase());
      const matchSupplier = filterSupplier === "all" || r.supplierName === filterSupplier;
      const matchUnit = filterUnit === "all" || r.unitName === filterUnit;
      return matchSearch && matchSupplier && matchUnit;
    });
  }, [registry, search, filterSupplier, filterUnit]);

  // Group by product
  const groupedByProduct = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const item of filtered) {
      const key = item.productName?.toUpperCase() || "SEM PRODUTO";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [filtered]);

  const totalBrands = registry?.length || 0;
  const totalProducts = useMemo(() => {
    if (!registry) return 0;
    return Array.from(new Set(registry.map((r: any) => r.productName?.toUpperCase()))).length;
  }, [registry]);
  const totalSuppliers = suppliers.length;

  return (
    <div className="space-y-4 mt-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold">Histórico de Marcas por Produto</h2>
        <p className="text-sm text-muted-foreground">Todas as marcas registradas por item, fornecedor e setor. Ao digitar, o sistema sugere marcas já usadas.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-700">{totalBrands}</div>
            <div className="text-xs text-muted-foreground">Registros</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-emerald-700">{totalProducts}</div>
            <div className="text-xs text-muted-foreground">Produtos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-purple-700">{totalSuppliers}</div>
            <div className="text-xs text-muted-foreground">Fornecedores</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar produto, marca ou fornecedor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterSupplier} onValueChange={setFilterSupplier}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Fornecedores</SelectItem>
            {suppliers.map((s: any) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterUnit} onValueChange={setFilterUnit}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Unidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Unidades</SelectItem>
            {units.map((u: any) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">Carregando histórico de marcas...</div>
      ) : groupedByProduct.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          {search || filterSupplier !== "all" || filterUnit !== "all" 
            ? "Nenhum resultado para os filtros aplicados" 
            : "Nenhuma marca registrada ainda. As marcas são registradas automaticamente quando propostas são enviadas."}
        </div>
      ) : (
        <div className="space-y-3">
          {groupedByProduct.map(([productName, items]) => (
            <Card key={productName}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-sm">{productName}</span>
                  <Badge variant="secondary" className="text-xs">{items.length} marca{items.length > 1 ? "s" : ""}</Badge>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Marca</TableHead>
                        <TableHead className="text-xs">Fornecedor</TableHead>
                        <TableHead className="text-xs">Unidade/Setor</TableHead>
                        <TableHead className="text-xs text-center">Usos</TableHead>
                        <TableHead className="text-xs">Último Uso</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.sort((a: any, b: any) => (b.usageCount || 0) - (a.usageCount || 0)).map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium text-sm">{item.brand}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.supplierName || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.unitName || item.sector || "—"}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-xs">{item.usageCount || 1}x</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleDateString("pt-BR") : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== REJEIÇÕES GLOBAIS TAB ====================
function RejeicoesGlobalTab({ canManage }: { canManage: boolean }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newRejection, setNewRejection] = useState({ brandName: "", productCategory: "", reason: "" });

  const { data: rejections, isLoading } = trpc.brandRejections.listGlobal.useQuery();
  const utils = trpc.useUtils();

  const addMutation = trpc.brandRejections.addGlobal.useMutation({
    onSuccess: () => {
      toast.success("Marca rejeitada globalmente!");
      utils.brandRejections.listGlobal.invalidate();
      setShowAdd(false);
      setNewRejection({ brandName: "", productCategory: "", reason: "" });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const removeMutation = trpc.brandRejections.removeGlobal.useMutation({
    onSuccess: () => {
      toast.success("Rejeição removida!");
      utils.brandRejections.listGlobal.invalidate();
    },
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Rejeições Globais</h2>
          <p className="text-sm text-muted-foreground">Marcas rejeitadas para TODAS as unidades. Não entram na compra otimizada.</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowAdd(true)} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Nova Rejeição
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : !rejections || rejections.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma marca rejeitada globalmente.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marca</TableHead>
                  <TableHead>Produto/Categoria</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Adicionado por</TableHead>
                  <TableHead>Data</TableHead>
                  {canManage && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rejections.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-semibold text-red-700">{r.brandName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.productCategory || "Todos"}</TableCell>
                    <TableCell className="text-sm">{r.reason || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.createdByName || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.createdAt ? new Date(r.createdAt).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    {canManage && (
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600" onClick={() => { if (confirm(`Remover rejeição de "${r.brandName}"?`)) removeMutation.mutate({ id: r.id }); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Rejeitar Marca Globalmente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome da Marca *</label>
              <Input value={newRejection.brandName} onChange={(e) => setNewRejection({ ...newRejection, brandName: e.target.value.toUpperCase() })} placeholder="Ex: CUZCUZMAIS" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Produto específico (opcional)</label>
              <Input value={newRejection.productCategory} onChange={(e) => setNewRejection({ ...newRejection, productCategory: e.target.value })} placeholder="Ex: Cuscuz, Macarrão" className="mt-1" />
              <p className="text-[11px] text-muted-foreground mt-1">Se vazio, a rejeição vale para todos os produtos dessa marca.</p>
            </div>
            <div>
              <label className="text-sm font-medium">Motivo (opcional)</label>
              <Input value={newRejection.reason} onChange={(e) => setNewRejection({ ...newRejection, reason: e.target.value })} placeholder="Ex: Qualidade ruim" className="mt-1" />
            </div>
            <Button className="w-full" disabled={!newRejection.brandName.trim() || addMutation.isPending} onClick={() => addMutation.mutate({ brandName: newRejection.brandName.trim(), productCategory: newRejection.productCategory || undefined, reason: newRejection.reason || undefined })}>
              {addMutation.isPending ? "Salvando..." : "Rejeitar Marca"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== REJEIÇÕES POR UNIDADE TAB ====================
function RejeicoesUnidadeTab({ canManage }: { canManage: boolean }) {
  const [showAdd, setShowAdd] = useState(false);
  const [filterUnit, setFilterUnit] = useState<string>("all");
  const [newRejection, setNewRejection] = useState({ brandName: "", unitId: 0, unitName: "", productCategory: "", reason: "" });

  const { data: unitsList } = trpc.units.list.useQuery();
  const { data: rejections, isLoading } = trpc.brandRejections.listByUnit.useQuery(
    filterUnit !== "all" ? { unitId: Number(filterUnit) } : undefined
  );
  const utils = trpc.useUtils();

  const addMutation = trpc.brandRejections.addByUnit.useMutation({
    onSuccess: () => {
      toast.success("Marca rejeitada para a unidade!");
      utils.brandRejections.listByUnit.invalidate();
      setShowAdd(false);
      setNewRejection({ brandName: "", unitId: 0, unitName: "", productCategory: "", reason: "" });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const removeMutation = trpc.brandRejections.removeByUnit.useMutation({
    onSuccess: () => {
      toast.success("Rejeição removida!");
      utils.brandRejections.listByUnit.invalidate();
    },
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Rejeições Regionais (por Unidade)</h2>
          <p className="text-sm text-muted-foreground">Marcas rejeitadas para uma unidade específica. Não entram na compra otimizada daquela unidade.</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowAdd(true)} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Nova Rejeição
          </Button>
        )}
      </div>

      {/* Filter by unit */}
      <Select value={filterUnit} onValueChange={setFilterUnit}>
        <SelectTrigger className="w-[250px]"><SelectValue placeholder="Filtrar por unidade" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as Unidades</SelectItem>
          {(unitsList || []).map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : !rejections || rejections.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma rejeição regional cadastrada{filterUnit !== "all" ? " para esta unidade" : ""}.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marca</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Produto/Categoria</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Data</TableHead>
                  {canManage && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rejections.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-semibold text-red-700">{r.brandName}</TableCell>
                    <TableCell className="text-sm">{r.unitName || `Unidade #${r.unitId}`}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.productCategory || "Todos"}</TableCell>
                    <TableCell className="text-sm">{r.reason || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.createdAt ? new Date(r.createdAt).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    {canManage && (
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600" onClick={() => { if (confirm(`Remover rejeição de "${r.brandName}" para ${r.unitName || 'esta unidade'}?`)) removeMutation.mutate({ id: r.id }); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Rejeitar Marca para Unidade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Unidade *</label>
              <Select value={newRejection.unitId ? String(newRejection.unitId) : ""} onValueChange={(val) => {
                const unit = (unitsList || []).find((u: any) => u.id === Number(val));
                setNewRejection({ ...newRejection, unitId: Number(val), unitName: unit?.name || "" });
              }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                <SelectContent>
                  {(unitsList || []).map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Nome da Marca *</label>
              <Input value={newRejection.brandName} onChange={(e) => setNewRejection({ ...newRejection, brandName: e.target.value.toUpperCase() })} placeholder="Ex: DONA CLARA" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Produto específico (opcional)</label>
              <Input value={newRejection.productCategory} onChange={(e) => setNewRejection({ ...newRejection, productCategory: e.target.value })} placeholder="Ex: Cuscuz" className="mt-1" />
              <p className="text-[11px] text-muted-foreground mt-1">Se vazio, a rejeição vale para todos os produtos dessa marca nesta unidade.</p>
            </div>
            <div>
              <label className="text-sm font-medium">Motivo (opcional)</label>
              <Input value={newRejection.reason} onChange={(e) => setNewRejection({ ...newRejection, reason: e.target.value })} placeholder="Ex: Não aceita na região" className="mt-1" />
            </div>
            <Button className="w-full" disabled={!newRejection.brandName.trim() || !newRejection.unitId || addMutation.isPending} onClick={() => addMutation.mutate({ brandName: newRejection.brandName.trim(), unitId: newRejection.unitId, unitName: newRejection.unitName || undefined, productCategory: newRejection.productCategory || undefined, reason: newRejection.reason || undefined })}>
              {addMutation.isPending ? "Salvando..." : "Rejeitar Marca"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== ALIASES TAB ====================
function AliasesTab({ canManage, isMaster }: { canManage: boolean; isMaster: boolean }) {
  const utils = trpc.useUtils();
  const { data: aliases, isLoading } = trpc.brands.listAliases.useQuery();
  const createMutation = trpc.brands.createAlias.useMutation({
    onSuccess: () => { toast.success("Alias cadastrado!"); utils.brands.listAliases.invalidate(); setShowAdd(false); setNewAlias({ aliasName: "", canonicalName: "", reason: "" }); },
    onError: (err: any) => toast.error(err.message),
  });
  const deleteMutation = trpc.brands.deleteAlias.useMutation({
    onSuccess: () => { toast.success("Alias removido!"); utils.brands.listAliases.invalidate(); },
    onError: (err: any) => toast.error(err.message),
  });
  const [showAdd, setShowAdd] = useState(false);
  const [newAlias, setNewAlias] = useState({ aliasName: "", canonicalName: "", reason: "" });
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!aliases) return [];
    if (!search) return aliases;
    const s = search.toLowerCase();
    return aliases.filter((a: any) => a.aliasName.toLowerCase().includes(s) || a.canonicalName.toLowerCase().includes(s));
  }, [aliases, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Aliases de Marca</h3>
          <p className="text-[10px] text-muted-foreground">Quando o fornecedor digitar uma grafia errada, o sistema corrige automaticamente para o nome correto.</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setShowAdd(true)} className="text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> Novo Alias
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input placeholder="Buscar alias ou marca..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 text-xs h-8" />
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Nenhum alias cadastrado.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px]">Grafia Errada</TableHead>
              <TableHead className="text-[10px]"></TableHead>
              <TableHead className="text-[10px]">Marca Correta</TableHead>
              <TableHead className="text-[10px]">Motivo</TableHead>
              <TableHead className="text-[10px]">Criado por</TableHead>
              {isMaster && <TableHead className="text-[10px] w-10"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell className="text-xs font-medium text-red-600">{a.aliasName}</TableCell>
                <TableCell className="text-xs text-muted-foreground">→</TableCell>
                <TableCell className="text-xs font-medium text-green-700">{a.canonicalName}</TableCell>
                <TableCell className="text-[10px] text-muted-foreground max-w-[150px] truncate">{a.reason || "—"}</TableCell>
                <TableCell className="text-[10px] text-muted-foreground">{a.createdByName || "Sistema"}</TableCell>
                {isMaster && (
                  <TableCell>
                    <button className="text-red-500 hover:text-red-700" onClick={() => { if (confirm(`Remover alias "${a.aliasName}" → "${a.canonicalName}"?`)) deleteMutation.mutate({ id: a.id }); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <p className="text-[9px] text-muted-foreground">Total: {filtered.length} alias(es) cadastrado(s)</p>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Alias de Marca</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Grafia errada (como o fornecedor digita):</label>
              <Input className="text-sm mt-1" placeholder="Ex: 3corações" value={newAlias.aliasName} onChange={(e) => setNewAlias({ ...newAlias, aliasName: e.target.value })} />
            </div>
            <div className="flex items-center justify-center text-muted-foreground">
              <ArrowRight className="w-4 h-4" />
            </div>
            <div>
              <label className="text-xs font-medium">Marca correta (como deve aparecer):</label>
              <Input className="text-sm mt-1" placeholder="Ex: 3 Corações" value={newAlias.canonicalName} onChange={(e) => setNewAlias({ ...newAlias, canonicalName: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium">Motivo (opcional):</label>
              <Input className="text-sm mt-1" placeholder="Ex: Fornecedor digita sem espaço" value={newAlias.reason} onChange={(e) => setNewAlias({ ...newAlias, reason: e.target.value })} />
            </div>
            <Button className="w-full" disabled={!newAlias.aliasName.trim() || !newAlias.canonicalName.trim() || createMutation.isPending} onClick={() => createMutation.mutate(newAlias)}>
              {createMutation.isPending ? "Salvando..." : "Cadastrar Alias"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
