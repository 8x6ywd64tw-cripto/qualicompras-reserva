import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, MapPin, Building2 } from "lucide-react";
import BrandAutocomplete from "@/components/BrandAutocomplete";
import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useSearch } from "wouter";
import { toast } from "sonner";

export default function CotacaoPublica() {
  const params = useParams<{ token: string }>();
  const token = params.token || "";
  const searchString = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const supplierIdFromUrl = searchParams.get("s") ? parseInt(searchParams.get("s")!) : null;

  const { data: quotation, isLoading: loadingQuotation } = trpc.quotations.getByToken.useQuery({ token });
  const { data: items, isLoading: loadingItems } = trpc.quotations.itemsByToken.useQuery({ token });
  // Brand autocomplete now handled by BrandAutocomplete component
  // Only fetch full suppliers list if no supplier is pre-identified via URL
  const { data: linkedSuppliers } = trpc.quotations.suppliersByToken.useQuery(
    { token },
    { enabled: !supplierIdFromUrl }
  );
  // Fetch single supplier info when ?s=ID is in URL (personalized link)
  const { data: preIdentifiedSupplier } = trpc.quotations.supplierByToken.useQuery(
    { token, supplierId: supplierIdFromUrl! },
    { enabled: !!supplierIdFromUrl }
  );

  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [canDeliver, setCanDeliver] = useState<string>(""); // "sim" | "nao"
  const [deliveryDays, setDeliveryDays] = useState("");
  const [payAvista, setPayAvista] = useState(false);
  const [payAprazo, setPayAprazo] = useState(false);
  const [paymentDays, setPaymentDays] = useState("");
  const [payOutro, setPayOutro] = useState(false);
  const [payOutroText, setPayOutroText] = useState("");
  const [notes, setNotes] = useState("");
  const [prices, setPrices] = useState<Record<number, { unitPrice: string; brand: string; packagingType: string; unitsPerPackage: string }>>({}); 

  // Track custom input mode per item (so typing doesn't collapse when value matches a preset)
  const [customUnitsMode, setCustomUnitsMode] = useState<Record<number, boolean>>({});

  
  const [submitted, setSubmitted] = useState(false);

  // Auto-select supplier from URL parameter using dedicated endpoint
  useEffect(() => {
    if (preIdentifiedSupplier) {
      setSelectedSupplierId(preIdentifiedSupplier.id);
      setSupplierName(preIdentifiedSupplier.tradeName || preIdentifiedSupplier.companyName);
    }
  }, [preIdentifiedSupplier]);

  const submitMutation = trpc.quotations.submitProposal.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Proposta enviada com sucesso!");
    },
    onError: (err) => toast.error(err.message),
  });

  const updatePrice = (itemId: number, field: "unitPrice" | "brand" | "packagingType" | "unitsPerPackage", value: string) => {
    setPrices(prev => {
      const current = prev[itemId] || { unitPrice: "", brand: "", packagingType: "unidade", unitsPerPackage: "" };
      return {
        ...prev,
        [itemId]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  const handleSubmit = () => {
    if (!selectedSupplierId && !supplierName.trim()) {
      toast.error("Informe o nome da sua empresa");
      return;
    }

    // Build proposal items: only include items where the supplier filled a price
    const proposalItems = (items || []).map((item: any) => {
      const p = prices[item.id];
      const unitPrice = p?.unitPrice || "0";
      const pkgType = p?.packagingType || "unidade";
      const rawUnitsPer = p?.unitsPerPackage === "__custom__" ? "0" : (p?.unitsPerPackage || "1");
      // If selling by unit, always default to 1 (no need to ask)
      const unitsPer = pkgType === "unidade" ? 1 : (parseInt(rawUnitsPer) || 1);
      const qty = parseFloat(item.quantity) || 0;
      const parsedPrice = parseFloat(unitPrice.replace(",", "."));
      const normalizedPrice = pkgType !== "unidade" && unitsPer > 1 ? parsedPrice / unitsPer : parsedPrice;
      const totalPrice = (normalizedPrice * qty).toFixed(2);
      return {
        quotationItemId: item.id,
        unitPrice: unitPrice.replace(",", "."),
        totalPrice,
        brand: (p?.brand?.trim() === "__custom__" ? "" : p?.brand?.trim()) || "",
        packagingType: pkgType as "unidade" | "caixa" | "fardo" | "pacote",
        unitsPerPackage: unitsPer,
        quantity: qty,
        unavailable: false,
      };
    }).filter(i => parseFloat(i.unitPrice) > 0);

    if (proposalItems.length === 0) {
      toast.error("Preencha o preço de pelo menos um item para enviar a proposta.");
      return;
    }

    // Only require brand for items that have price filled
    const itemsWithoutBrand = proposalItems.filter(i => !i.brand);
    if (itemsWithoutBrand.length > 0) {
      toast.error(`Preencha a MARCA de todos os itens cotados. ${itemsWithoutBrand.length} item(ns) sem marca.`);
      return;
    }

    // Only require unitsPerPackage for items sold by caixa/fardo/pacote (not unidade)
    const itemsWithoutUnits = proposalItems.filter(i => {
      const itemId = (items || []).find((it: any) => it.id === i.quotationItemId)?.id;
      if (!itemId) return false;
      const p = prices[itemId];
      const pkgType = p?.packagingType || "unidade";
      return pkgType !== "unidade" && (!i.unitsPerPackage || i.unitsPerPackage < 1);
    });
    if (itemsWithoutUnits.length > 0) {
      toast.error(`Selecione QUANTAS UNIDADES por embalagem em ${itemsWithoutUnits.length} item(ns) vendidos por caixa/fardo/pacote.`);
      return;
    }


    // Validate delivery
    if (!canDeliver) {
      toast.error("Selecione se realiza entrega ou não.");
      return;
    }
    if (canDeliver === "sim" && !deliveryDays) {
      toast.error("Selecione o prazo de entrega.");
      return;
    }

    // Validate payment
    if (!payAvista && !payAprazo && !payOutro) {
      toast.error("Selecione pelo menos uma forma de pagamento.");
      return;
    }
    if (payAprazo && !paymentDays) {
      toast.error("Selecione o prazo do pagamento a prazo.");
      return;
    }
    if (payOutro && !payOutroText.trim()) {
      toast.error("Informe a condição de pagamento em 'Outro'.");
      return;
    }

    // Build paymentTerms string from checkboxes
    const payParts: string[] = [];
    if (payAvista) payParts.push("À Vista");
    if (payAprazo) payParts.push(`A Prazo ${paymentDays} dias`);
    if (payOutro && payOutroText.trim()) payParts.push(payOutroText.trim());
    const paymentTermsStr = payParts.length > 0 ? payParts.join(" / ") : undefined;

    submitMutation.mutate({
      token,
      supplierId: selectedSupplierId || undefined,
      supplierName: supplierName.trim() || undefined,
      deliveryDays: deliveryDays ? parseInt(deliveryDays) : undefined,
      paymentTerms: paymentTermsStr,
      notes: notes || undefined,
      items: proposalItems,
    });
  };

  if (loadingQuotation || loadingItems) {
    return (
      <div className="min-h-screen bg-[#0F1B4C] flex items-center justify-center">
        <div className="text-center">
          <img src="/logo.png" alt="QualiCompras" className="h-12 w-12 rounded-xl mx-auto mb-3 animate-pulse" />
          <p className="text-white/60">Carregando cotação...</p>
        </div>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <img src="/logo.png" alt="QualiCompras" className="h-10 w-10 rounded-xl mx-auto mb-3" />
            <p className="text-lg font-semibold text-destructive">Cotação não encontrada</p>
            <p className="text-sm text-muted-foreground mt-2">O link pode estar expirado ou inválido.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if deadline has passed
  const isExpired = quotation.deadline && new Date(quotation.deadline).getTime() < Date.now();

  if (quotation.status !== "open" || isExpired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <p className="text-lg font-semibold">Cotação encerrada</p>
            <p className="text-sm text-muted-foreground mt-2">
              {isExpired
                ? `O prazo para envio de propostas encerrou em ${new Date(quotation.deadline!).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}.`
                : "Esta cotação não está mais aberta para propostas."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-semibold">Proposta Enviada!</p>
            <p className="text-sm text-muted-foreground mt-2">Sua proposta foi recebida com sucesso. O comprador entrará em contato.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determine if supplier is pre-identified via URL
  const isSupplierPreIdentified = !!supplierIdFromUrl && !!selectedSupplierId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background py-6 px-4">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Header */}
        <div className="text-center">
          <img src="/logo.png" alt="QualiCompras" className="h-12 w-12 rounded-xl mx-auto mb-3" />
          <h1 className="text-xl font-bold text-[#0F1B4C]">QualiCompras</h1>
          <p className="text-sm text-muted-foreground">Qualities Refeições — Grupo Comenda</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{quotation.title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Código: {quotation.code}
            </p>
            {quotation.deadline && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm font-semibold text-amber-900">
                  ⏰ Prazo para envio: {new Date(quotation.deadline).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            )}
            {quotation.notes && <p className="text-sm mt-2">{quotation.notes}</p>}
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Delivery Address */}
            {(quotation as any).unit && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <MapPin className="h-5 w-5 text-green-700 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-green-900">Local de Entrega</p>
                    <p className="text-sm font-semibold text-green-800 mt-1">{(quotation as any).unit.name}</p>
                    {(quotation as any).unit.address && (
                      <p className="text-sm text-green-800 mt-0.5">{(quotation as any).unit.address}</p>
                    )}
                    <p className="text-sm text-green-800">
                      {(quotation as any).unit.city}/{(quotation as any).unit.state}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Supplier Identification */}
            {isSupplierPreIdentified ? (
              /* Supplier already identified via URL - show confirmation only */
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-blue-700 shrink-0" />
                  <div>
                    <p className="text-xs text-blue-700 font-medium">Fornecedor</p>
                    <p className="text-sm font-bold text-blue-900">{supplierName}</p>
                  </div>
                </div>
              </div>
            ) : (
              /* No supplier in URL - show manual identification */
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
                <p className="text-sm font-semibold text-blue-900">Identificação do Fornecedor</p>
                <div>
                  <Label className="text-sm text-blue-800">Nome da Empresa / Contato *</Label>
                  <Input
                    className="mt-1"
                    value={supplierName}
                    onChange={e => setSupplierName(e.target.value)}
                    placeholder="Ex: Distribuidora ABC - João"
                  />
                </div>
              </div>
            )}

            {/* Delivery/Payment Info - All dropdowns */}
            <div className="space-y-3 p-3 bg-gray-50 border rounded-lg">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Entrega e Pagamento</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-semibold text-red-700">Realiza entrega? *</Label>
                  <select
                    className="w-full h-9 px-2 text-sm border rounded-md bg-background"
                    value={canDeliver}
                    onChange={e => { setCanDeliver(e.target.value); if (e.target.value === "nao") setDeliveryDays(""); }}
                    required
                  >
                    <option value="" disabled>Selecione</option>
                    <option value="sim">Sim</option>
                    <option value="nao">Não (retira no local)</option>
                  </select>
                </div>
                {canDeliver === "sim" && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Prazo de entrega *</Label>
                    <select
                      className="w-full h-9 px-2 text-sm border rounded-md bg-background"
                      value={deliveryDays}
                      onChange={e => setDeliveryDays(e.target.value)}
                      required
                    >
                      <option value="" disabled>Selecione</option>
                      {[1,2,3,4,5,6,7,8,9,10,12,14,15,20,21,25,28,30].map(d => (
                        <option key={d} value={String(d)}>{d} {d === 1 ? "dia" : "dias"}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs font-semibold text-red-700">Formas de pagamento aceitas * <span className="text-[10px] text-red-500 font-normal">(obrigatório — pode marcar mais de uma)</span></Label>
                <div className="space-y-2 mt-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={payAvista} onChange={e => setPayAvista(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                    <span className="text-sm">À Vista</span>
                  </label>
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={payAprazo} onChange={e => { setPayAprazo(e.target.checked); if (!e.target.checked) setPaymentDays(""); }} className="h-4 w-4 rounded border-gray-300" />
                      <span className="text-sm">A Prazo</span>
                    </label>
                    {payAprazo && (
                      <div className="ml-6 mt-1">
                        <select
                          className="w-full h-9 px-2 text-sm border rounded-md bg-background"
                          value={paymentDays}
                          onChange={e => setPaymentDays(e.target.value)}
                          required
                        >
                          <option value="" disabled>Quantos dias? *</option>
                          {[7,14,15,21,28,30,45,60,90,120].map(d => (
                            <option key={d} value={String(d)}>{d} dias</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={payOutro} onChange={e => { setPayOutro(e.target.checked); if (!e.target.checked) setPayOutroText(""); }} className="h-4 w-4 rounded border-gray-300" />
                      <span className="text-sm">Outro</span>
                    </label>
                    {payOutro && (
                      <div className="ml-6 mt-1">
                        <Input
                          value={payOutroText}
                          onChange={e => setPayOutroText(e.target.value)}
                          placeholder="Descreva a condição"
                          className="h-9 text-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Observações (opcional)</Label>
                <Input
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Observações gerais"
                />
              </div>
            </div>

            {/* Items to price */}
            <div>
              <h3 className="font-semibold mb-1 text-sm">Preencha os preços unitários (R$):</h3>
              <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-3">
                <p className="text-xs text-red-700 font-semibold">Campos obrigatórios para enviar:</p>
                <p className="text-[11px] text-red-600 mt-0.5">Embalagem • Preço • Marca • Entrega • Pagamento</p>
                <div className="mt-2 bg-blue-50 border border-blue-300 rounded-lg px-3 py-2">
                  <p className="text-xs font-bold text-blue-900">📋 COMO PREENCHER:</p>
                  <p className="text-[11px] text-blue-800 mt-0.5">1. Selecione como você vende (caixa, fardo, pacote ou unidade)</p>
                  <p className="text-[11px] text-blue-800">2. Informe o <strong>preço</strong> (se vende por caixa, informe o preço da caixa; se vende por unidade, informe o preço da unidade)</p>
                  <p className="text-[11px] text-blue-800">3. Se vender por caixa/fardo/pacote, informe quantas unidades (ou KG) vêm em cada embalagem</p>
                </div>
              </div>
              <div className="space-y-3">
                {(items || []).map((item: any) => {
                  const hasPrice = prices[item.id]?.unitPrice && parseFloat(prices[item.id]?.unitPrice.replace(",", ".")) > 0;
                  const brandVal = prices[item.id]?.brand?.trim();
                  const hasBrand = brandVal && brandVal !== "__custom__";
                  const showBrandError = hasPrice && !hasBrand;
                  return (
                    <div key={item.id} className={`p-3 border rounded-lg space-y-2 ${showBrandError ? "border-red-300 bg-red-50/50" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.productName}</p>
                          <div className="mt-1 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
                            <p className="text-xs font-bold text-amber-800">
                              ⚠️ Precisamos de: <span className="text-sm">{parseFloat(item.quantity).toLocaleString("pt-BR")} {item.unit}</span>
                            </p>
                          </div>
                        </div>

                      </div>
                      {/* STEP 1: Packaging type - FIRST */}
                      <div className="space-y-2 pt-1">
                        <div>
                          <Label className="text-xs font-semibold text-blue-800">① Como você vende este produto? *</Label>
                          <select
                            className="w-full h-9 px-2 text-sm border-2 border-blue-200 rounded-md bg-background font-medium"
                            value={prices[item.id]?.packagingType || "unidade"}
                            onChange={e => updatePrice(item.id, "packagingType", e.target.value)}
                          >
                            <option value="unidade">Por Unidade (vendo cada um separado)</option>
                            <option value="caixa">Por Caixa (caixa com várias unidades)</option>
                            <option value="fardo">Por Fardo (fardo com várias unidades)</option>
                            <option value="pacote">Por Pacote (pacote com várias unidades)</option>
                          </select>
                        </div>
                      </div>
                      {/* STEP 2: Price + Brand */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs font-semibold text-green-800">
                            ② {(!prices[item.id]?.packagingType || prices[item.id]?.packagingType === "unidade") ? "Preço por unidade (R$) *" : `Preço de 1 ${prices[item.id]?.packagingType} (R$) *`}
                          </Label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">R$</span>
                            <input
                              type="text"
                              inputMode="text"
                              className="flex h-9 w-full rounded-md border px-3 py-2 text-sm pl-8 border-2 border-green-200 focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-background"
                              placeholder="Digite o valor (ex: 3,48)"
                              value={prices[item.id]?.unitPrice ?? ""}
                              onChange={e => {
                                const val = e.target.value.replace(/[^0-9.,]/g, "");
                                updatePrice(item.id, "unitPrice", val);
                              }}
                              onKeyDown={e => {
                                if (e.key === "-" || e.key === "e") e.preventDefault();
                              }}
                            />
                          </div>
                          <p className="text-[10px] text-green-600 mt-0.5">
                            {(!prices[item.id]?.packagingType || prices[item.id]?.packagingType === "unidade")
                              ? "Digite o preço de 1 unidade"
                              : `Digite o preço de 1 ${prices[item.id]?.packagingType}`}
                          </p>
                        </div>
                        <div>
                          <Label className={`text-xs ${showBrandError ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                            Marca *
                          </Label>
                          <div>
                            <BrandAutocomplete
                              value={prices[item.id]?.brand || ""}
                              onChange={(val) => updatePrice(item.id, "brand", val)}
                              productName={item.productName}
                              supplierId={supplierIdFromUrl || undefined}
                              placeholder="Buscar ou digitar marca *"
                              className={`h-9 text-sm ${showBrandError ? "border-red-400 ring-1 ring-red-300" : ""}`}
                            />
                            {showBrandError && (
                              <p className="text-xs text-red-600 mt-0.5">Informe a marca</p>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* STEP 3: Units per package - only show when NOT selling by unit */}
                      {prices[item.id]?.packagingType && prices[item.id]?.packagingType !== "unidade" && (
                      <div className="space-y-2 pt-1 bg-orange-50 border border-orange-200 rounded-lg p-2">
                        <div>
                          {(() => {
                            const isWeightUnit = ["KG","kg","G","g","TON","ton"].includes(item.unit?.trim());
                            const isVolumeUnit = ["LT","lt","L","l","ML","ml"].includes(item.unit?.trim());
                            const isWeightOrVolume = isWeightUnit || isVolumeUnit;
                            const unitLabel = isWeightUnit ? "KG" : isVolumeUnit ? "LT" : "unidades";
                            const pkgType = prices[item.id]?.packagingType || "embalagem";
                            return (
                              <>
                                <Label className="text-xs font-semibold text-orange-800">
                                  {isWeightOrVolume
                                    ? `③ Quantos ${unitLabel} vêm em cada ${pkgType}? * (OBRIGATÓRIO)`
                                    : `③ Quantas unidades vêm em cada ${pkgType}? * (OBRIGATÓRIO)`}
                                </Label>
                                <p className="text-[10px] text-orange-600 mb-1">
                                  {isWeightOrVolume
                                    ? `Ex: Se 1 ${pkgType} de ${item.productName?.split(' ')[0]?.toLowerCase() || 'produto'} pesa 18${unitLabel.toLowerCase()}, selecione 18 ou clique em "Outro" e digite`
                                    : `Ex: Se 1 ${pkgType} tem 210 unidades, selecione 210 ou clique em "Outro" e digite`}
                                </p>
                              </>
                            );
                          })()}
                          {(() => {
                            const isWeightUnit = ["KG","kg","G","g","TON","ton"].includes(item.unit?.trim());
                            const isVolumeUnit = ["LT","lt","L","l","ML","ml"].includes(item.unit?.trim());
                            const isWeightOrVolume = isWeightUnit || isVolumeUnit;
                            const unitLabel = isWeightUnit ? "kg" : isVolumeUnit ? "lt" : "unidades";
                            const commonWeights = [1,2,3,4,5,6,8,10,12,15,18,20,25,30,40,50];
                            const commonUnits = [1,2,3,4,5,6,8,10,12,15,18,20,24,25,30,36,40,48,50,60,72,80,96,100,120,150,200,210,250,300,400,500,600,750,1000,1500,2000,2500,3000,5000];
                            const options = isWeightOrVolume ? commonWeights : commonUnits;
                            const currentVal = prices[item.id]?.unitsPerPackage || "";
                            const isInCustomMode = customUnitsMode[item.id] === true;
                            const showCustomInput = isInCustomMode || currentVal === "__custom__";
                            return (
                              <div className="space-y-1">
                                <select
                                  className="w-full h-10 px-2 text-base border-2 border-orange-300 rounded-md bg-background font-medium"
                                  value={showCustomInput ? "__custom__" : currentVal}
                                  onChange={e => {
                                    if (e.target.value === "__custom__") {
                                      setCustomUnitsMode(prev => ({ ...prev, [item.id]: true }));
                                      updatePrice(item.id, "unitsPerPackage", "");
                                    } else {
                                      setCustomUnitsMode(prev => ({ ...prev, [item.id]: false }));
                                      updatePrice(item.id, "unitsPerPackage", e.target.value);
                                    }
                                  }}
                                >
                                  <option value="" disabled>{isWeightOrVolume ? `Selecione quantos ${unitLabel} por embalagem` : "Selecione quantas unidades"}</option>
                                  {options.map(n => (
                                    <option key={n} value={String(n)}>{n} {isWeightOrVolume ? unitLabel : (n === 1 ? "unidade (avulso)" : "unidades")}</option>
                                  ))}
                                  <option value="__custom__">✍️ Outro valor (digitar)</option>
                                </select>
                                {showCustomInput && (
                                  <Input
                                    className="h-10 text-base border-2 border-orange-400 font-medium bg-orange-50"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    autoFocus
                                    placeholder={isWeightOrVolume ? `Digite o peso em ${unitLabel} (ex: 18, 20, 25)` : "Digite o número inteiro (ex: 137, 210, 1300)"}
                                    value={currentVal === "__custom__" ? "" : currentVal}
                                    onChange={e => {
                                      const val = e.target.value.replace(/[^0-9]/g, "");
                                      updatePrice(item.id, "unitsPerPackage", val);
                                    }}
                                    onKeyDown={e => {
                                      if (e.key === "." || e.key === "," || e.key === "-" || e.key === "e") e.preventDefault();
                                    }}
                                  />
                                )}
                                {isWeightOrVolume && parseInt(currentVal || "0") <= 1 && currentVal !== "" && currentVal !== "__custom__" && (
                                  <p className="text-[10px] text-red-600 font-bold mt-1 bg-red-50 p-1 rounded">
                                    ⚠️ Atenção: Se vende por {prices[item.id]?.packagingType}, informe o peso real da embalagem (ex: 18 para caixa de 18kg). Se o preço já é por {unitLabel}, volte ao passo ① e selecione "Por Unidade".
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                      </div>
                      )}
                      {/* Show calculated summary - always visible when there's a price */}
                      {prices[item.id]?.unitPrice && parseFloat(prices[item.id]?.unitPrice?.replace(",", ".") || "0") > 0 && (
                        <div className={`rounded-lg px-3 py-2 ${parseInt(prices[item.id]?.unitsPerPackage || "1") > 1 ? "bg-green-50 border-2 border-green-300" : "bg-gray-50 border border-gray-200"}`}>
                          {(() => {
                            const isWeightUnit = ["KG","kg","G","g","TON","ton"].includes(item.unit?.trim());
                            const isVolumeUnit = ["LT","lt","L","l","ML","ml"].includes(item.unit?.trim());
                            const isWeightOrVolume = isWeightUnit || isVolumeUnit;
                            const unitLabel = isWeightUnit ? "KG" : isVolumeUnit ? "LT" : "unidade";
                            const unitsPerPkg = parseInt(prices[item.id]?.unitsPerPackage || "1");
                            const price = parseFloat(prices[item.id]?.unitPrice?.replace(",", ".") || "0");
                            const normalizedPrice = price / (unitsPerPkg || 1);
                            if (unitsPerPkg > 1) {
                              return (
                                <>
                                  <p className="text-xs font-bold text-green-900">✅ RESUMO DO SEU PREÇO:</p>
                                  <p className="text-sm font-bold text-green-900 mt-1">
                                    Preço por {unitLabel}: R$ {normalizedPrice.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}
                                  </p>
                                  {isWeightOrVolume && (
                                    <p className="text-[10px] text-green-700 mt-0.5">
                                      (R$ {price.toFixed(2).replace(".", ",")} por {prices[item.id]?.packagingType} ÷ {unitsPerPkg}{unitLabel.toLowerCase()} = R$ {normalizedPrice.toFixed(2).replace(".", ",")}/{unitLabel.toLowerCase()})
                                    </p>
                                  )}
                                </>
                              );
                            } else {
                              return (
                                <>
                                  <p className="text-xs font-bold text-gray-700">✅ Preço por {unitLabel}: R$ {price.toFixed(2).replace(".", ",")}</p>
                                  <p className="text-[10px] text-gray-500">
                                    {isWeightOrVolume
                                      ? `(Preço informado já é por ${unitLabel.toLowerCase()})`
                                      : "(1 unidade por embalagem — preço informado já é o preço unitário)"}
                                  </p>
                                </>
                              );
                            }
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RESUMO FINAL antes de enviar */}
            {(() => {
              const filledItems = (items || []).filter((item: any) => {
                const p = prices[item.id];
                return p?.unitPrice && parseFloat(p.unitPrice.replace(",", ".")) > 0;
              });
              if (filledItems.length === 0) return null;
              return (
                <div className="mb-4 border-2 border-blue-300 rounded-lg bg-blue-50 p-4">
                  <h3 className="text-sm font-bold text-blue-800 mb-2">📋 Resumo da sua proposta ({filledItems.length} de {(items || []).length} {filledItems.length === 1 ? "item" : "itens"})</h3>
                  <div className="space-y-2">
                    {filledItems.map((item: any) => {
                      const p = prices[item.id];
                      const price = parseFloat(p.unitPrice.replace(",", ".")) || 0;
                      const unitsPer = parseInt(p.unitsPerPackage) || 1;
                      const pkgType = p.packagingType || "unidade";
                      const pricePerUnit = unitsPer > 0 ? price / unitsPer : price;
                      const qty = parseFloat(item.quantity) || 0;
                      const total = pricePerUnit * qty;
                      return (
                        <div key={item.id} className="bg-white rounded-md px-3 py-2 border border-blue-200 text-xs">
                          <div className="flex justify-between items-start">
                            <span className="font-semibold text-gray-800">{item.productName}</span>
                            <span className="font-bold text-green-700">R$ {pricePerUnit.toFixed(4).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",")}/un</span>
                          </div>
                          <div className="text-gray-500 mt-0.5">
                            <span>R$ {pricePerUnit.toFixed(2).replace(".", ",")}/un × {qty} un = <strong className="text-gray-800">R$ {total.toFixed(2).replace(".", ",")}</strong>{unitsPer > 1 ? ` (${unitsPer} un/${pkgType})` : ""}</span>
                            {p.brand && <span className="ml-2 text-blue-600">({p.brand})</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-2 border-t border-blue-200 flex justify-between items-center">
                    <span className="text-xs text-blue-700 font-medium">Total geral estimado:</span>
                    <span className="text-sm font-bold text-blue-900">
                      R$ {filledItems.reduce((acc: number, item: any) => {
                        const p = prices[item.id];
                        const price = parseFloat(p.unitPrice.replace(",", ".")) || 0;
                        const pkgType = p.packagingType || "unidade";
                        const qty = parseFloat(item.quantity) || 0;
                        const unitsPerPkg = parseInt(p.unitsPerPackage) || 1;
                        const boxes = (pkgType !== "unidade" && unitsPerPkg > 1) ? Math.ceil(qty / unitsPerPkg) : qty;
                        return acc + (price * boxes);
                      }, 0).toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                  <p className="text-[10px] text-blue-600 mt-2">✅ Confira os valores acima antes de enviar. Após o envio, a proposta não poderá ser alterada.</p>
                </div>
              );
            })()}

            <Button onClick={handleSubmit} className="w-full" size="lg" disabled={submitMutation.isPending}>
              {submitMutation.isPending ? "Enviando..." : "Enviar Proposta"}
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground pb-4">
          QualiCompras © {new Date().getFullYear()} — Qualities Refeições
        </p>
      </div>
    </div>
  );
}
