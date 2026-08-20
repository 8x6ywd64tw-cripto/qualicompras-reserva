import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Upload, CheckCircle2, ArrowRight, Package, Users, Calendar, AlertTriangle, MessageCircle, Mail, Send, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";

type SendResult = {
  supplierId: number;
  name: string;
  whatsapp: boolean;
  email: boolean;
  whatsappUrl?: string;
  emailUrl?: string;
  supplierLink?: string;
};

const SECTOR_OPTIONS = [
  { value: "Proteína", label: "Proteínas / Carnes" },
  { value: "Cereais", label: "Cereais / Secos / Mercearia" },
  { value: "Hortifruti", label: "Hortifruti / Frutas / Verduras" },
  { value: "Limpeza", label: "Limpeza" },
  { value: "Descartáveis", label: "Descartáveis" },
  { value: "Cereais (Doces)", label: "Cereais (Doces) / Confeitaria" },
  { value: "Pão", label: "Pão / Padaria" },
  { value: "Gás", label: "Gás" },
];

export default function Requisicoes() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.email === MASTER_EMAIL;
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [selectedSuppliers, setSelectedSuppliers] = useState<number[]>([]);
  const [notes, setNotes] = useState("");
  const [deadline, setDeadline] = useState("");
  const [deadlineEnabled, setDeadlineEnabled] = useState(false);
  const [manualCategory, setManualCategory] = useState<string>("");
  const [manualUnitId, setManualUnitId] = useState<string>("");
  const [quotationTitle, setQuotationTitle] = useState<string>("");
  const [reviewItems, setReviewItems] = useState<Array<{ description: string; quantity: string; unit: string; code: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendAllProgress, setSendAllProgress] = useState(0);

  const { data: unitsList } = trpc.units.list.useQuery();
  const utils = trpc.useUtils();

  // Effective category: manual override > detected from PDF
  const effectiveCategory = manualCategory || uploadResult?.header?.category || "";
  // Effective unitId: manual override > detected from PDF
  const effectiveUnitId = manualUnitId ? parseInt(manualUnitId) : (uploadResult?.unitId || null);

  // Query suppliers by unit when we have a unitId
  const { data: unitSuppliersList } = trpc.suppliers.byUnit.useQuery(
    { unitId: effectiveUnitId! },
    { enabled: !!effectiveUnitId }
  );

  // Filter suppliers by category
  const filteredSuppliers = useMemo(() => {
    if (!unitSuppliersList || !effectiveCategory) return [];
    return unitSuppliersList.filter((s: any) => {
      const cats = Array.isArray(s.categories) ? s.categories : (s.categories ? JSON.parse(s.categories) : []);
      return cats.some((c: string) => 
        c.toLowerCase().includes(effectiveCategory.toLowerCase()) || 
        effectiveCategory.toLowerCase().includes(c.toLowerCase())
      );
    });
  }, [unitSuppliersList, effectiveCategory]);

  // Auto-select suppliers: prefer matching detected PDF suppliers, fallback to all filtered
  useEffect(() => {
    if (filteredSuppliers.length === 0) {
      setSelectedSuppliers([]);
      return;
    }
    const detected = uploadResult?.header?.detectedSuppliers;
    if (detected && detected.length > 0) {
      // Match by name similarity (case-insensitive, partial match)
      const matched: number[] = [];
      for (const sup of filteredSuppliers as any[]) {
        const supName = (sup.tradeName || sup.companyName || '').toUpperCase();
        const isDetected = detected.some((d: any) => {
          const dName = (d.name || '').toUpperCase();
          return supName.includes(dName) || dName.includes(supName) ||
            supName.split(' ')[0] === dName.split(' ')[0]; // match first word
        });
        if (isDetected) matched.push(sup.id);
      }
      // If we matched at least one, use only those; otherwise select all
      setSelectedSuppliers(matched.length > 0 ? matched : filteredSuppliers.map((s: any) => s.id));
    } else {
      setSelectedSuppliers(filteredSuppliers.map((s: any) => s.id));
    }
  }, [filteredSuppliers, uploadResult]);

  // When upload result arrives, set the detected values as defaults
  useEffect(() => {
    if (uploadResult) {
      if (uploadResult.header?.category) setManualCategory(uploadResult.header.category);
      if (uploadResult.unitId) setManualUnitId(String(uploadResult.unitId));
    }
  }, [uploadResult]);

  // Auto-generate title when upload result + category + unit are set
  useEffect(() => {
    if (!uploadResult) return;
    const unitName = uploadResult.header?.estabelecimento || '';
    const coleta = uploadResult.header?.numColeta || '';
    const cat = manualCategory || uploadResult.header?.category || '';
    const consumoInicio = uploadResult.header?.consumoInicio || '';
    const consumoFim = uploadResult.header?.consumoFim || '';
    const consumoDias = uploadResult.header?.consumoDias || 0;
    const dataColeta = uploadResult.header?.dataColeta || '';
    
    // Build title: "Coleta DDMMYYYYHHMM - UNIDADE (Setor) - DD/MM a DD/MM (X dias)"
    // Use dataColeta formatted as timestamp for unique ID
    const coletaId = dataColeta ? dataColeta.replace(/\//g, '') : coleta;
    let title = `Coleta ${coletaId}`;
    if (unitName) title += ` - ${unitName}`;
    if (cat) title += ` (${cat})`;
    if (consumoInicio && consumoFim) {
      title += ` - ${consumoInicio} a ${consumoFim}`;
      if (consumoDias > 0) title += ` (${consumoDias} dias)`;
    }
    
    setQuotationTitle(title);
  }, [uploadResult, manualCategory]);

  const openMutation = trpc.quotations.open.useMutation();
  const sendMutation = trpc.quotations.sendToSuppliers.useMutation({
    onSuccess: (data) => {
      const whatsappCount = data.results.filter((r: any) => r.whatsapp).length;
      const emailCount = data.results.filter((r: any) => r.email).length;
      toast.success(`Links gerados para ${data.results.length} fornecedores! (${whatsappCount} WhatsApp, ${emailCount} Email)`);
      // Show modal with individual buttons instead of auto-opening popups
      setSendResults(data.results as SendResult[]);
      setShowSendModal(true);
    },
  });

  const [createdQuotationId, setCreatedQuotationId] = useState<number | null>(null);

  const createQuotationMutation = trpc.quotations.create.useMutation({
    onSuccess: async (data) => {
      toast.success(`Cotação ${data.code} criada!`);
      utils.quotations.list.invalidate();
      setCreatedQuotationId(data.id);
      try {
        await openMutation.mutateAsync({ id: data.id });
        await sendMutation.mutateAsync({ quotationId: data.id });
      } catch (e) {
        // If send fails, still redirect
        setUploadResult(null);
        setSelectedSuppliers([]);
        setNotes("");
        setDeadline("");
        setDeadlineEnabled(false);
        setManualCategory("");
        setManualUnitId("");
        setQuotationTitle("");
        setReviewItems([]);
        setLocation(`/cotacoes/${data.id}`);
        return;
      }
      // Don't navigate away yet - modal will show with supplier links
      // Navigation happens when modal is closed
      setUploadResult(null);
      setSelectedSuppliers([]);
      setNotes("");
      setDeadline("");
      setDeadlineEnabled(false);
      setManualCategory("");
      setManualUnitId("");
      setQuotationTitle("");
      setReviewItems([]);
    },
    onError: (err) => toast.error(err.message),
  });

  // Navigate to quotation detail when send modal is closed
  const handleSendModalClose = (open: boolean) => {
    setShowSendModal(open);
    if (!open && createdQuotationId) {
      setLocation(`/cotacoes/${createdQuotationId}`);
      setCreatedQuotationId(null);
    }
  };

  // Upload PDF handler
  const handlePdfUpload = async (file: File) => {
    setUploading(true);
    setUploadResult(null);
    setSelectedSuppliers([]);
    setNotes("");
    setDeadline("");
    setDeadlineEnabled(false);
    setManualCategory("");
    setManualUnitId("");
    setQuotationTitle("");
    setReviewItems([]);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('manus-auth-token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/fortes/upload-pdf', { method: 'POST', body: formData, headers });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      setUploadResult(data);
      // Initialize reviewItems from parsed data for user review/edit
      if (data.items && data.items.length > 0) {
        setReviewItems(data.items.map((item: any) => ({
          description: item.description || '',
          quantity: String(item.quantity || '0'),
          unit: item.unit || 'UN',
          code: item.code || '',
        })));
      }
      toast.success(`PDF processado: ${data.itemCount} itens extraídos | Setor detectado: ${data.header?.category || 'N/I'}`);
    } catch (err) {
      toast.error("Erro ao processar PDF");
    } finally {
      setUploading(false);
    }
  };

  const handleCreateQuotation = () => {
    if (!uploadResult) return;
    if (selectedSuppliers.length === 0) {
      toast.error("Selecione pelo menos um fornecedor");
      return;
    }
    if (!effectiveCategory) {
      toast.error("Selecione o setor/categoria");
      return;
    }

    // Use reviewItems (user-reviewed) instead of raw uploadResult.items
    const items = reviewItems.map((item) => ({
      productName: item.description,
      quantity: item.quantity,
      unit: item.unit || "UN",
      category: effectiveCategory,
      curveClass: undefined as "A" | "B" | "C" | undefined,
    }));

    const unitName = uploadResult.header?.estabelecimento || '';
    const coleta = uploadResult.header?.numColeta || '';

    createQuotationMutation.mutate({
      title: quotationTitle || `Coleta ${coleta} - ${unitName} (${effectiveCategory})`,
      unitId: effectiveUnitId || undefined,
      deadline: deadline || undefined,
      notes: notes || `PDF Fortes AG importado. ${uploadResult.header?.observacao || ''} | Solicitante: ${uploadResult.header?.usuario || 'N/I'} | Período: ${uploadResult.header?.periodo || 'N/I'}`,
      coletaNumber: coleta || undefined,
      items,
      supplierIds: selectedSuppliers,
    });
  };

  const toggleSupplier = (id: number) => {
    setSelectedSuppliers(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedSuppliers(filteredSuppliers.map((s: any) => s.id));
  const deselectAll = () => setSelectedSuppliers([]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cotações Fortes</h1>
          <p className="text-sm text-muted-foreground">Upload do PDF do Fortes AG → Identificação automática → Cotação com fornecedores</p>
        </div>

        {/* Upload Section */}
        {!uploadResult && (
          <Card className="border-2 border-dashed border-primary/30 hover:border-primary/60 transition-colors">
            <CardContent className="p-8 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Upload do Relatório de Coleta</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Faça upload do PDF gerado pelo Fortes AG. O sistema irá extrair automaticamente todos os itens, quantidades, unidades e identificar o setor.
              </p>
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="h-5 w-5 mr-2" />
                {uploading ? 'Processando PDF...' : 'Selecionar PDF'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePdfUpload(file);
                  e.target.value = '';
                }}
              />
              <p className="text-xs text-muted-foreground mt-3">Formatos aceitos: PDF do Fortes AG (Relatório de Coleta de Preços)</p>
            </CardContent>
          </Card>
        )}

        {/* Result Panel - After PDF is parsed */}
        {uploadResult && (
          <div className="space-y-4">
            {/* Step 1: PDF Info */}
            <Card className="border-green-200 bg-green-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-green-800">
                  <CheckCircle2 className="h-5 w-5" />
                  PDF Identificado — {uploadResult.itemCount} itens extraídos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="bg-white rounded-lg p-3 border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Unidade</p>
                    <p className="font-semibold text-sm">{uploadResult.header?.estabelecimento || 'N/I'}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Setor</p>
                    <p className="font-semibold text-sm">{uploadResult.header?.category || 'N/I'}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Período Consumo</p>
                    <p className="font-semibold text-sm">
                      {uploadResult.header?.consumoInicio && uploadResult.header?.consumoFim
                        ? `${uploadResult.header.consumoInicio} a ${uploadResult.header.consumoFim}`
                        : uploadResult.header?.observacao || 'N/I'}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Dias</p>
                    <p className="font-semibold text-sm">{uploadResult.header?.consumoDias ? `${uploadResult.header.consumoDias} dias` : 'N/I'}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Itens</p>
                    <p className="font-semibold text-sm">{uploadResult.itemCount} produtos</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Fornecedores no PDF</p>
                    <p className="font-semibold text-sm">{uploadResult.header?.detectedSuppliers?.length || 0} detectados</p>
                  </div>
                </div>

                {/* Detected suppliers from PDF */}
                {uploadResult.header?.detectedSuppliers?.length > 0 && (
                  <div className="bg-white rounded-lg border p-3">
                    <p className="text-xs font-medium mb-2 flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      Fornecedores detectados no PDF:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {uploadResult.header.detectedSuppliers.map((sup: any, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-[10px]">
                          {sup.name}{sup.cnpj ? ` (${sup.cnpj})` : ''}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Items Review - Editable Table */}
                <div className="bg-white rounded-lg border p-3">
                  <p className="text-xs font-medium mb-2 flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" />
                    Itens extraídos — <span className="text-amber-600 font-semibold">Revise as quantidades antes de criar a cotação</span>
                  </p>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-white">
                        <tr className="border-b">
                          <th className="text-left py-1.5 px-2 font-medium">Produto</th>
                          <th className="text-center py-1.5 px-2 font-medium w-24">Qtd</th>
                          <th className="text-center py-1.5 px-2 font-medium w-16">Unid</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewItems.map((item, idx) => (
                          <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="py-1.5 px-2 font-medium">{item.description}</td>
                            <td className="py-1.5 px-2">
                              <Input
                                type="number"
                                className="h-7 text-center text-xs w-20 mx-auto"
                                value={item.quantity}
                                onChange={(e) => {
                                  const newItems = [...reviewItems];
                                  newItems[idx] = { ...newItems[idx], quantity: e.target.value };
                                  setReviewItems(newItems);
                                }}
                              />
                            </td>
                            <td className="py-1.5 px-2 text-center">{item.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-amber-600 mt-2">⚠️ Confira se as quantidades estão corretas. O parser pode extrair valores errados do PDF.</p>
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => { setUploadResult(null); setSelectedSuppliers([]); setManualCategory(""); setManualUnitId(""); setReviewItems([]); }}>
                    <Upload className="h-3.5 w-3.5 mr-1" /> Novo Upload
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Confirm/Override Sector and Unit */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Confirme o Setor e a Unidade
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  O sistema detectou automaticamente. Corrija se necessário — isso define quais fornecedores serão convidados.
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Setor / Categoria *</Label>
                    <Select value={manualCategory} onValueChange={setManualCategory}>
                      <SelectTrigger className={!manualCategory ? "border-amber-300" : ""}>
                        <SelectValue placeholder="Selecione o setor..." />
                      </SelectTrigger>
                      <SelectContent>
                        {SECTOR_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Unidade / Obra *</Label>
                    <Select value={manualUnitId} onValueChange={setManualUnitId}>
                      <SelectTrigger className={!manualUnitId ? "border-amber-300" : ""}>
                        <SelectValue placeholder="Selecione a unidade..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(unitsList || []).map((u: any) => (
                          <SelectItem key={u.id} value={u.id.toString()}>{u.name} - {u.state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 3: Supplier Selection */}
            {effectiveUnitId && effectiveCategory && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Fornecedores — {effectiveCategory}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Fornecedores do setor <strong>{effectiveCategory}</strong> vinculados à unidade selecionada. Todos pré-selecionados — desmarque quem não deseja incluir.
                  </p>
                </CardHeader>
                <CardContent>
                  {filteredSuppliers.length === 0 && (
                    <div className="text-center py-6">
                      <p className="text-sm text-amber-600 font-medium">Nenhum fornecedor de "{effectiveCategory}" vinculado a esta unidade.</p>
                      <p className="text-xs text-muted-foreground mt-1">Cadastre fornecedores com a categoria "{effectiveCategory}" e vincule à unidade na aba Fornecedores.</p>
                    </div>
                  )}
                  {filteredSuppliers.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-xs text-muted-foreground">{selectedSuppliers.length} de {filteredSuppliers.length} selecionados</span>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectAll}>Selecionar Todos</Button>
                          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={deselectAll}>Desmarcar Todos</Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                        {filteredSuppliers.map((s: any) => (
                          <label
                            key={s.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              selectedSuppliers.includes(s.id) 
                                ? 'bg-primary/5 border-primary/30' 
                                : 'bg-white hover:bg-muted/30 border-border'
                            }`}
                          >
                            <Checkbox
                              checked={selectedSuppliers.includes(s.id)}
                              onCheckedChange={() => toggleSupplier(s.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{s.tradeName || s.companyName}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {s.city && `${s.city}/${s.state}`}
                                {s.whatsapp && ' • WhatsApp ✓'}
                                {s.email && ' • Email ✓'}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 4: Quotation Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Detalhes da Cotação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Title - auto-generated, editable only by admin */}
                <div>
                  <Label className="text-sm font-medium">Título da Cotação</Label>
                  {isAdmin ? (
                    <Input
                      value={quotationTitle}
                      onChange={e => setQuotationTitle(e.target.value)}
                      placeholder="Título será gerado automaticamente..."
                      className="mt-1"
                    />
                  ) : (
                    <div className="mt-1 px-3 py-2 rounded-md border bg-muted/50 text-sm text-foreground">
                      {quotationTitle || <span className="text-muted-foreground italic">Título gerado automaticamente após upload</span>}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {isAdmin
                      ? 'Gerado automaticamente a partir do PDF. Você pode editar livremente.'
                      : 'Gerado automaticamente a partir do PDF. Apenas o ADM pode alterar.'
                    }
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Definir prazo para respostas?</Label>
                    <div className="flex items-center gap-3 mt-1">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name="deadlineToggleFortes" checked={deadline !== "" || deadlineEnabled} onChange={() => setDeadlineEnabled(true)} className="accent-blue-600" />
                        <span className="text-sm">Sim</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name="deadlineToggleFortes" checked={deadline === "" && !deadlineEnabled} onChange={() => { setDeadlineEnabled(false); setDeadline(""); }} className="accent-blue-600" />
                        <span className="text-sm">Não (sem prazo)</span>
                      </label>
                    </div>
                    {deadlineEnabled && (
                      <Input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} className="mt-2" />
                    )}
                  </div>
                  <div>
                    <Label>Observações</Label>
                    <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações adicionais para os fornecedores..." />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 5: Create & Send */}
            <Button
              size="lg"
              className="w-full bg-green-700 hover:bg-green-800 text-white h-14 text-base"
              onClick={handleCreateQuotation}
              disabled={createQuotationMutation.isPending || selectedSuppliers.length === 0 || !effectiveCategory || !effectiveUnitId}
            >
              <ArrowRight className="h-5 w-5 mr-2" />
              {createQuotationMutation.isPending 
                ? 'Criando cotação...' 
                : selectedSuppliers.length > 0
                  ? `Criar Cotação com ${reviewItems.length} itens → Enviar para ${selectedSuppliers.length} fornecedor${selectedSuppliers.length > 1 ? 'es' : ''}`
                  : 'Selecione setor e unidade para ver fornecedores'
              }
            </Button>
          </div>
        )}
      </div>

      {/* Modal: Send to Suppliers - Individual buttons per supplier */}
      <Dialog open={showSendModal} onOpenChange={handleSendModalClose}>
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
                    <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => { navigator.clipboard.writeText(r.supplierLink!); toast.success('Link copiado!'); }}>
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
    </DashboardLayout>
  );
}
