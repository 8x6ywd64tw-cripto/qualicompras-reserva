import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Copy, Send, CheckCircle2, XCircle, Clock, MessageCircle, Mail, TrendingDown, TrendingUp, FileDown, Trophy, BarChart3, Zap, ShoppingCart, Loader2, Download, AlertTriangle, X, Printer, Share2, RefreshCw, Shuffle, FileText, RotateCcw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { useRef, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { computeScenarios, type ScenarioItemInput } from "@shared/scenarios";
import { PriceVariationIndicator } from "@/components/PriceVariationIndicator";
import { Upload } from "lucide-react";

const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";

function PriceBadge({ price, referencePrice }: { price: number; referencePrice?: number | null }) {
  if (!referencePrice || referencePrice <= 0) return null;
  const ratio = price / referencePrice;
  if (ratio <= 1.05) return <Badge className="bg-green-100 text-green-700 text-[10px]">Justo</Badge>;
  if (ratio <= 1.20) return <Badge className="bg-yellow-100 text-yellow-700 text-[10px]">Atenção</Badge>;
  return <Badge className="bg-red-100 text-red-700 text-[10px]">Alto</Badge>;
}

function ItemRowWithHistory({ item, canEdit, quotationId }: { item: any; canEdit?: boolean; quotationId?: number }) {
  const [editing, setEditing] = useState(false);
  const [editQty, setEditQty] = useState("");
  const utils = trpc.useUtils();
  const editMutation = trpc.quotations.editItem.useMutation({
    onSuccess: () => {
      toast.success("Quantidade atualizada!");
      setEditing(false);
      utils.quotations.items.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });
  const { data: history } = trpc.prices.history.useQuery(
    { productName: item.productName, limit: 5 },
    { enabled: !!item.productName }
  );
  
  const lastPrice = history?.[0]?.unitPrice ? parseFloat(history[0].unitPrice) : null;
  const avgPrice = history?.length
    ? history.reduce((sum: number, h: any) => sum + parseFloat(h.unitPrice), 0) / history.length
    : null;
  
  const previousPrice = history && history.length > 1 ? parseFloat(history[1].unitPrice) : null;
  const variation = lastPrice !== null && previousPrice !== null && previousPrice > 0
    ? ((lastPrice - previousPrice) / previousPrice * 100)
    : null;
  
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 font-medium">{item.productName}</td>
      <td className="py-2 text-center">
        {editing ? (
          <div className="flex items-center gap-1 justify-center">
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-20 text-xs border rounded px-1.5 py-0.5 text-center"
              value={editQty}
              onChange={(e) => setEditQty(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && editQty && quotationId) {
                  editMutation.mutate({ itemId: item.id, quotationId, quantity: editQty, justification: "Correção de quantidade via edição rápida" });
                }
                if (e.key === 'Escape') setEditing(false);
              }}
            />
            <button
              className="text-green-600 text-xs font-bold hover:text-green-800"
              onClick={() => { if (editQty && quotationId) editMutation.mutate({ itemId: item.id, quotationId, quantity: editQty, justification: "Correção de quantidade via edição rápida" }); }}
              disabled={editMutation.isPending}
            >✓</button>
            <button className="text-red-500 text-xs font-bold hover:text-red-700" onClick={() => setEditing(false)}>✗</button>
          </div>
        ) : (
          <span
            className={canEdit ? "cursor-pointer hover:bg-blue-50 hover:text-blue-700 px-1.5 py-0.5 rounded transition-colors" : ""}
            onClick={() => { if (canEdit) { setEditQty(String(item.quantity)); setEditing(true); } }}
            title={canEdit ? "Clique para editar quantidade" : undefined}
          >
            {parseFloat(item.quantity).toLocaleString("pt-BR")}
            {canEdit && <span className="text-[9px] text-blue-400 ml-1 opacity-60">✏</span>}
          </span>
        )}
      </td>
      <td className="py-2 text-center">{item.unit}</td>
      <td className="py-2 text-right">
        {lastPrice !== null ? (
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium">R$ {lastPrice.toFixed(2)}</span>
              {variation !== null && (
                <span className={`text-[10px] font-medium ${variation < 0 ? 'text-green-600' : variation > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {variation > 0 ? '+' : ''}{variation.toFixed(1)}%
                </span>
              )}
              {avgPrice && lastPrice < avgPrice ? (
                <TrendingDown className="h-3 w-3 text-green-600" />
              ) : avgPrice && lastPrice > avgPrice ? (
                <TrendingUp className="h-3 w-3 text-red-500" />
              ) : null}
            </div>
            {avgPrice && (
              <span className="text-[10px] text-muted-foreground">méd: R$ {avgPrice.toFixed(2)}</span>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

type SendResult = {
  supplierId: number;
  name: string;
  whatsapp: boolean;
  email: boolean;
  whatsappUrl?: string;
  emailUrl?: string;
  supplierLink?: string;
};

export default function CotacaoDetalhe() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const quotationId = parseInt(params.id || "0");
  const comparisonRef = useRef<HTMLDivElement>(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendAllProgress, setSendAllProgress] = useState(0);
  const [showOptimization, setShowOptimization] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<any>(null);
  const [generatingOrders, setGeneratingOrders] = useState(false);
  const [pdfHtml, setPdfHtml] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<{
    proposalItemId: number;
    unitPrice: string;
    packagingType: "unidade" | "caixa" | "fardo" | "pacote";
    unitsPerPackage: number;
    brand: string;
    notes: string;
    productName: string;
    requestedQty: number;
    requestedUnit: string;
  } | null>(null);

  const closePdfViewer = useCallback(() => setPdfHtml(null), []);

  // Checkbox selection state for items in optimization
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [deselectionReason, setDeselectionReason] = useState("");
  // Adjustment mode state
  const [adjustMode, setAdjustMode] = useState(false);
  const [adjustStep, setAdjustStep] = useState<'justification' | 'selection'>('justification');
  const [adjustments, setAdjustments] = useState<Record<string, { newSupplierId: number; newSupplierName: string; newUnitPrice: number; newBrand?: string; newPackagingType?: string; newUnitsPerPackage?: number }>>({});
  const [adjustJustification, setAdjustJustification] = useState("");
    const [savingAdjustment, setSavingAdjustment] = useState(false);
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const { data: quotation, isLoading: loadingQuotation } = trpc.quotations.get.useQuery({ id: quotationId });
  const { data: items } = trpc.quotations.items.useQuery({ quotationId });
  const { data: qSuppliers } = trpc.quotations.suppliers.useQuery({ quotationId });
  const { data: proposals } = trpc.quotations.proposals.useQuery({ quotationId });
  const { data: suppliersList } = trpc.suppliers.list.useQuery();
  const { data: allProposalItems } = trpc.quotations.allProposalItems.useQuery({ quotationId });

  // Brand classification - collect all brands from proposals to check status
  const allBrandNames = useMemo(() => {
    if (!allProposalItems) return [];
    const brands = new Set<string>();
    for (const pi of allProposalItems as any[]) {
      if (pi.brand && pi.brand !== "—" && pi.brand.trim()) brands.add(pi.brand.trim());
    }
    return Array.from(brands);
  }, [allProposalItems]);

  const { data: brandStatuses } = trpc.brands.getStatusBatch.useQuery(
    { names: allBrandNames },
    { enabled: allBrandNames.length > 0 }
  );

  // Incompatibility rules for visual indication in comparativo
  const { data: incompatibilityData } = trpc.suppliers.listAllIncompatibilities.useQuery();

  // Helper: check if a supplier+item+brand combination is incompatible
  const isIncompatible = useCallback((supplierId: number, productName: string, brand?: string | null) => {
    if (!incompatibilityData) return null;
    const productUpper = (productName || "").toUpperCase();
    const brandUpper = (brand || "").trim().toUpperCase();
    // Check explicit rules
    for (const rule of incompatibilityData.rules) {
      if (rule.supplierId === supplierId && productUpper.includes(rule.productKey)) {
        if (!rule.brandName || brandUpper === rule.brandName) {
          return rule.reason || "Fornecedor/item incompatível";
        }
      }
    }
    // Check supermercado auto-block
    if (incompatibilityData.supermercadoSupplierIds.includes(supplierId)) {
      for (const blocked of incompatibilityData.blockedItems) {
        if (productUpper.includes(blocked)) {
          return `Supermercado não atende (${blocked.toLowerCase()})`;
        }
      }
    }
    return null;
  }, [incompatibilityData]);

  // Build price comparison items from proposals + items for variation indicator
  const priceComparisonItems = useMemo(() => {
    if (!proposals || !items || !allProposalItems) return [];
    const pairs: { productName: string; supplierId: number }[] = [];
    for (const p of proposals) {
      for (const item of items) {
        const pi = allProposalItems.find((api: any) => api.proposalId === p.id && api.quotationItemId === item.id);
        if (pi && parseFloat(pi.unitPrice) > 0) {
          pairs.push({ productName: item.productName, supplierId: (p as any).supplierId });
        }
      }
    }
    return pairs;
  }, [proposals, items, allProposalItems]);

  const { data: priceVariations } = trpc.prices.batchLastPrices.useQuery(
    { items: priceComparisonItems, excludeQuotationId: quotationId },
    { enabled: priceComparisonItems.length > 0 }
  );

  const utils = trpc.useUtils();
  const openMutation = trpc.quotations.open.useMutation({
    onSuccess: () => { toast.success("Cotação aberta!"); utils.quotations.get.invalidate(); },
  });
  const { user } = useAuth();
  const isMaster = user?.email === MASTER_EMAIL;
  const isBuyerSenior = user?.role === "buyer_senior";
  const isJunior = user?.email === "frotas.patrimonio@qualities.com.br";
  const hasWriteAccess = isMaster || isBuyerSenior;
  const canEditPrices = hasWriteAccess;
  const canEditItems = isMaster || isJunior;

  // Reupload PDF - apenas Master
  const reuploadInputRef = useRef<HTMLInputElement>(null);
  const [isReuploading, setIsReuploading] = useState(false);
  const handleReuploadPDF = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error("Apenas arquivos PDF são aceitos");
      return;
    }
    setIsReuploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('quotationId', String(quotationId));
      const resp = await fetch('/api/fortes/upload-pdf', { method: 'POST', body: formData });
      const result = await resp.json();
      if (result.success) {
        toast.success(`PDF substituído! ${result.itemCount || 0} itens processados.`);
        window.location.reload();
      } else {
        toast.error(result.error || "Erro ao substituir PDF");
      }
    } catch (err) {
      toast.error("Erro ao enviar PDF");
    } finally {
      setIsReuploading(false);
      if (reuploadInputRef.current) reuploadInputRef.current.value = '';
    }
  };

  const [editItemModal, setEditItemModal] = useState<{ id: number; productName: string; quantity: string; unit: string } | null>(null);
  const [editItemForm, setEditItemForm] = useState({ productName: "", quantity: "", unit: "", unitsPerPackage: 1, justification: "" });
  const editItemMutation = trpc.quotations.editItem.useMutation({
    onSuccess: () => { toast.success("Item atualizado! Totais recalculados."); setEditItemModal(null); utils.quotations.items.invalidate(); utils.quotations.get.invalidate(); utils.quotations.itemEdits.invalidate(); },
    onError: (err: any) => toast.error(err.message),
  });
  const { data: itemEdits } = trpc.quotations.itemEdits.useQuery({ quotationId }, { enabled: !!quotationId });
  const closeMutation = trpc.quotations.close.useMutation({
    onSuccess: () => { toast.success("Cotação fechada!"); utils.quotations.get.invalidate(); },
  });
  const deleteQuotationMutation = trpc.quotations.delete.useMutation({
    onSuccess: () => { toast.success("Cotação excluída permanentemente"); setLocation('/cotacoes'); },
    onError: (err) => { toast.error(err.message); },
  });
  const reopenMutation = trpc.quotations.reopen.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setShowReopenDialog(false);
      setReopenReason("");
      setShowOptimization(false);
      setOptimizationResult(null);
      utils.quotations.get.invalidate();
      utils.quotations.proposals.invalidate();
    },
    onError: (err) => { toast.error(err.message); },
  });
  const editProposalItemMutation = trpc.quotations.editProposalItem.useMutation({
    onSuccess: () => { toast.success("Item atualizado com sucesso!"); setEditingItem(null); utils.quotations.allProposalItems.invalidate(); utils.quotations.proposals.invalidate(); },
    onError: (err) => { toast.error(err.message); },
  });
  const [addingItem, setAddingItem] = useState<{
    proposalId: number;
    quotationItemId: number;
    unitPrice: string;
    packagingType: "unidade" | "caixa" | "fardo" | "pacote";
    unitsPerPackage: number;
    brand: string;
    notes: string;
    productName: string;
    requestedQty: number;
    requestedUnit: string;
  } | null>(null);
  const addProposalItemMutation = trpc.quotations.addProposalItem.useMutation({
    onSuccess: () => { toast.success("Preço adicionado com sucesso!"); setAddingItem(null); utils.quotations.allProposalItems.invalidate(); utils.quotations.proposals.invalidate(); },
    onError: (err) => { toast.error(err.message); },
  });

  const optimizeMutation = trpc.quotations.optimize.useMutation({
    onSuccess: (data) => {
      setOptimizationResult(data);
      setShowOptimization(true);
      // Initialize all items as selected
      const initial: Record<string, boolean> = {};
      data.suppliers.forEach((s: any, sIdx: number) => {
        s.items.forEach((_: any, iIdx: number) => {
          initial[`${sIdx}-${iIdx}`] = true;
        });
      });
      setSelectedItems(initial);
      setDeselectionReason("");
    },
    onError: (err) => toast.error(err.message),
  });

  const generateOrdersMutation = trpc.quotations.generateOrdersFromOptimization.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.totalOrders} pedido(s) gerado(s) e aprovado(s)! Cotação fechada.`);
      setGeneratingOrders(false);
      setShowOptimization(false);
      setLocation("/pedidos");
    },
    onError: (err) => { toast.error(err.message); setGeneratingOrders(false); },
  });

  const shareOrderWhatsApp = (supplier: any) => {
    const itemsList = supplier.items.map((i: any) => `\u2022 ${i.productName} (${i.brand || ''}) - ${parseFloat(i.quantity).toLocaleString('pt-BR')} ${i.unit} - R$ ${i.unitPrice.toFixed(2)}`).join('\n');
    const economyLine = optimizationResult?.scenarios && optimizationResult.scenarios.economyValue > 0
      ? `\n\n\u2705 *Economia nesta compra: R$ ${optimizationResult.scenarios.economyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${optimizationResult.scenarios.economyPct.toFixed(1)}% vs pior cenário)*`
      : '';
    const msg = `*PEDIDO DE COMPRA - Qualities Refeições*\n\nCotação: ${quotation?.code}\nRef: ${quotation?.title}\n\n*${supplier.itemCount} itens:*\n${itemsList}\n\n*TOTAL: R$ ${supplier.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n${supplier.paymentTerms && supplier.paymentTerms !== '\u2014' ? `\nCondição: ${supplier.paymentTerms}` : ''}${economyLine}\n\nPor favor, confirme o recebimento e prazo de entrega.`;
    // Use share API if available (mobile), otherwise open WhatsApp with text only (user picks contact)
    if (navigator.share) {
      navigator.share({ text: msg }).catch(() => {
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  const runOptimization = () => {
    optimizeMutation.mutate({ quotationId, tolerancePct: 3 });
  };

  const generateSupplierPDF = (supplier: any) => {
    if (!quotation) return;
    const now = new Date().toLocaleDateString("pt-BR");
    const rows = supplier.items.map((item: any) =>
      `<tr><td style="padding:6px 8px;border:1px solid #ddd;font-size:12px;">${item.productName}</td><td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:12px;">${item.brand || '—'}</td><td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:12px;">${parseFloat(item.quantity).toLocaleString('pt-BR')}</td><td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:12px;">${item.unit}</td><td style="padding:6px 8px;border:1px solid #ddd;text-align:right;font-size:12px;">R$ ${item.unitPrice.toFixed(2)}</td><td style="padding:6px 8px;border:1px solid #ddd;text-align:right;font-size:12px;font-weight:bold;">R$ ${item.total.toFixed(2)}</td></tr>`
    ).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pedido - ${supplier.supplierName}</title><style>body{font-family:Arial,sans-serif;padding:20px;color:#1a1a1a;font-size:12px;}h1{font-size:18px;color:#1e3a5f;margin-bottom:4px;}h2{font-size:14px;color:#333;margin-top:20px;margin-bottom:8px;border-bottom:2px solid #1e3a5f;padding-bottom:4px;}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:3px solid #1e3a5f;padding-bottom:12px;}.logo{font-size:22px;font-weight:bold;color:#1e3a5f;}.info{text-align:right;font-size:11px;color:#555;}table{border-collapse:collapse;width:100%;margin-top:8px;}th{background:#1e3a5f;color:white;padding:8px;font-size:11px;text-align:left;}td{padding:6px 8px;border:1px solid #ddd;font-size:12px;}.total-row{background:#f0f7ff;font-weight:bold;}.footer{margin-top:24px;padding-top:12px;border-top:1px solid #ddd;font-size:10px;color:#666;text-align:center;}@media print{body{padding:10px;}}</style></head><body><div class="header"><div><div class="logo">QualiCompras</div><div style="font-size:11px;color:#555;">Qualities Refeições Industrial Ltda</div><div style="font-size:11px;color:#555;">CNPJ: 08.921.152/0001-39</div></div><div class="info"><strong>PEDIDO DE COMPRA</strong><br>Cotação: ${quotation.code}<br>Data: ${now}</div></div><h2>Fornecedor: ${supplier.supplierName}</h2><div style="margin-bottom:12px;font-size:11px;color:#555;">${supplier.paymentTerms && supplier.paymentTerms !== '—' ? `<strong>Condição:</strong> ${supplier.paymentTerms} • ` : ''}<strong>Itens:</strong> ${supplier.itemCount} • <strong>Referência:</strong> ${quotation.title}</div><table><thead><tr><th>Produto</th><th style="text-align:center;">Marca</th><th style="text-align:center;">Qtd</th><th style="text-align:center;">Unid.</th><th style="text-align:right;">P. Unit.</th><th style="text-align:right;">Total</th></tr></thead><tbody>${rows}<tr class="total-row"><td colspan="5" style="padding:8px;border:1px solid #ddd;text-align:right;font-size:13px;">TOTAL DO PEDIDO</td><td style="padding:8px;border:1px solid #ddd;text-align:right;font-size:13px;">R$ ${supplier.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr></tbody></table><div class="footer">QualiCompras - Central de Cotação Inteligente • Qualities Refeições Industrial Ltda<br>Documento gerado automaticamente em ${now}</div></body></html>`;

    setPdfHtml(html);
  };

  const sendOrderWhatsApp = (supplier: any) => {
    const sup = suppliersList?.find((s: any) => s.id === supplier.supplierId);
    const whatsapp = sup?.whatsapp;
    if (!whatsapp) {
      toast.error(`${supplier.supplierName} não tem WhatsApp cadastrado`);
      return;
    }
    const phone = whatsapp.replace(/\D/g, '');
    const phoneFormatted = phone.startsWith('55') ? phone : `55${phone}`;
    const itemsList = supplier.items.map((i: any) => `• ${i.productName} (${i.brand}) - ${parseFloat(i.quantity).toLocaleString('pt-BR')} ${i.unit}`).join('\n');
    const economyLine = optimizationResult?.scenarios && optimizationResult.scenarios.economyValue > 0
      ? `\n\n\u2705 *Economia nesta compra: R$ ${optimizationResult.scenarios.economyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${optimizationResult.scenarios.economyPct.toFixed(1)}% vs pior cenário)*`
      : '';
    const msg = `*PEDIDO DE COMPRA - Qualities Refeições*\n\nCotação: ${quotation?.code}\nRef: ${quotation?.title}\n\n*${supplier.itemCount} itens:*\n${itemsList}\n\n*TOTAL: R$ ${supplier.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n${supplier.paymentTerms && supplier.paymentTerms !== '—' ? `\nCondição: ${supplier.paymentTerms}` : ''}${economyLine}\n\nPor favor, confirme o recebimento e prazo de entrega.`;
    window.open(`https://wa.me/${phoneFormatted}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const hasDeselectedItems = Object.values(selectedItems).some(v => v === false);
  const confirmGenerateOrders = () => {
    if (!optimizationResult) return;
    if (hasDeselectedItems && deselectionReason.trim().length < 10) {
      toast.error("Informe o motivo da exclusão dos itens desmarcados (mín. 10 caracteres)");
      return;
    }
    setGeneratingOrders(true);
    // Filter suppliers to only include selected items
    const filteredSuppliers = optimizationResult.suppliers
      .map((s: any, sIdx: number) => ({
        supplierId: s.supplierId,
        items: s.items
          .filter((_: any, iIdx: number) => selectedItems[`${sIdx}-${iIdx}`] !== false)
          .map((i: any) => ({
            productName: i.productName,
            quantity: i.quantity,
            unit: i.unit,
            unitPrice: i.unitPrice,
            total: i.total,
            packagingType: i.packagingType || null,
            unitsPerPackage: i.unitsPerPackage || null,
          })),
        total: s.items
          .filter((_: any, iIdx: number) => selectedItems[`${sIdx}-${iIdx}`] !== false)
          .reduce((sum: number, i: any) => sum + i.total, 0),
      }))
      .filter((s: any) => s.items.length > 0);
    if (filteredSuppliers.length === 0) {
      toast.error("Selecione ao menos um item para gerar o pedido.");
      setGeneratingOrders(false);
      return;
    }
    generateOrdersMutation.mutate({
      quotationId,
      suppliers: filteredSuppliers,
      deselectionReason: hasDeselectedItems ? deselectionReason.trim() : undefined,
    });
  };

  const adjustmentMutation = trpc.adjustments.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Ajuste registrado! ${data.adjustmentCount} item(ns) redirecionado(s). ${data.orders.length} pedido(s) gerado(s).`);
      setSavingAdjustment(false);
      setAdjustMode(false);
      setAdjustments({});
      setAdjustJustification("");
      setAdjustStep('justification');
      setShowOptimization(false);
      setLocation("/pedidos");
    },
    onError: (err) => {
      console.error('[Adjustment Error]', err);
      toast.error(err.message || 'Erro ao salvar ajuste. Tente novamente.');
      setSavingAdjustment(false);
    },
    onSettled: () => {
      setSavingAdjustment(false);
    },
  });

  const confirmAdjustment = () => {
    try {
      if (!optimizationResult || adjustJustification.length < 10) {
        toast.error("Preencha a justificativa (mínimo 10 caracteres)");
        return;
      }
      const adjustedItemKeys = Object.keys(adjustments);
      if (adjustedItemKeys.length === 0) {
        toast.error("Nenhum item foi ajustado");
        return;
      }
      // Guard: block cancelled quotations on the client side too
      if (quotation?.status === 'cancelled') {
        toast.error("Cotação cancelada não pode gerar pedidos. Reabra a cotação primeiro.");
        return;
      }
      setSavingAdjustment(true);
      console.log('[confirmAdjustment] Starting with', adjustedItemKeys.length, 'adjustments (keyed by quotationItemId), quotationId:', quotationId, 'suppliers:', optimizationResult.suppliers.length);

      // Build a flat lookup of all items by quotationItemId for reliable resolution
      const itemLookup = new Map<string, { item: any; supplier: any }>();
      optimizationResult.suppliers.forEach((s: any) => {
        s.items.forEach((item: any) => {
          itemLookup.set(String(item.quotationItemId), { item, supplier: s });
        });
      });

      // Build the adjustments array matching the API schema
      const adjustmentRecords = adjustedItemKeys.map(key => {
        const lookup = itemLookup.get(key);
        if (!lookup) {
          console.error('[confirmAdjustment] CRITICAL: item not found for quotationItemId key:', key);
          throw new Error(`Item não encontrado (quotationItemId: ${key}). Refaça a otimização.`);
        }
        const { item, supplier } = lookup;
        const adj = adjustments[key];
        if (!adj) {
          console.error('[confirmAdjustment] CRITICAL: adjustment is undefined for key:', key);
          throw new Error(`Ajuste não encontrado para chave ${key}. Tente novamente.`);
        }
        const impactValue = (adj.newUnitPrice - item.unitPrice) * item.quantity;
        const impactPct = item.unitPrice > 0 ? ((adj.newUnitPrice - item.unitPrice) / item.unitPrice) * 100 : 0;
        return {
          quotationItemId: item.quotationItemId,
          productName: item.productName,
          quantity: item.quantity,
          unit: item.unit,
          recommendedSupplierId: supplier.supplierId,
          recommendedSupplierName: supplier.supplierName,
          recommendedUnitPrice: item.unitPrice,
          recommendedTotal: item.total,
          recommendedBrand: item.brand || null,
          recommendedReason: item.reason || null,
          selectedSupplierId: adj.newSupplierId,
          selectedSupplierName: adj.newSupplierName,
          selectedUnitPrice: adj.newUnitPrice,
          selectedTotal: adj.newUnitPrice * item.quantity,
          selectedBrand: adj.newBrand || null,
          impactValue: isFinite(impactValue) ? impactValue : 0,
          impactPct: isFinite(impactPct) ? impactPct : 0,
          justificationCategory: "Ajuste manual",
          justificationText: adjustJustification,
        };
      });

      // Build the final supplier grouping (merge adjusted items into supplier groups)
      const supplierMap = new Map<number, { supplierId: number; items: any[]; total: number }>();
      optimizationResult.suppliers.forEach((s: any) => {
        s.items.forEach((item: any) => {
          const key = String(item.quotationItemId);
          const adj = adjustments[key];
          const finalSupplierId = adj ? adj.newSupplierId : s.supplierId;
          const finalUnitPrice = adj ? adj.newUnitPrice : item.unitPrice;
          const finalTotal = finalUnitPrice * item.quantity;
          if (!supplierMap.has(finalSupplierId)) {
            supplierMap.set(finalSupplierId, { supplierId: finalSupplierId, items: [], total: 0 });
          }
          const group = supplierMap.get(finalSupplierId)!;
          group.items.push({
            productName: item.productName,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: finalUnitPrice,
            total: finalTotal,
            packagingType: (adj ? adj.newPackagingType : item.packagingType) || null,
            unitsPerPackage: (adj ? adj.newUnitsPerPackage : item.unitsPerPackage) || null,
          });
          group.total += finalTotal;
        });
      });

      // Filter out empty supplier groups
      const validSuppliers = Array.from(supplierMap.values()).filter(g => g.items.length > 0);
      if (validSuppliers.length === 0) {
        throw new Error('Nenhum fornecedor com itens válidos. Refaça a otimização.');
      }

      const payload = {
        quotationId,
        adjustments: adjustmentRecords,
        suppliers: validSuppliers,
      };
      console.log('[confirmAdjustment] Calling mutation with', validSuppliers.length, 'suppliers,', adjustmentRecords.length, 'adjustments, payload size:', JSON.stringify(payload).length, 'bytes');
      adjustmentMutation.mutate(payload);
    } catch (err: any) {
      console.error('[confirmAdjustment] CRASH:', err);
      toast.error(`Erro ao preparar ajuste: ${err.message || 'Erro desconhecido'}`);
      setSavingAdjustment(false);
    }
  };

  // Get alternative suppliers for an item from allProposalItems
  const getAlternativesForItem = (productName: string, currentSupplierId: number) => {
    if (!allProposalItems) return [];
    return allProposalItems
      .filter((pi: any) => pi.productName === productName && pi.supplierId !== currentSupplierId && pi.unitPrice > 0)
      .map((pi: any) => ({
        supplierId: pi.supplierId,
        supplierName: getSupplierName(pi.supplierId),
        unitPrice: parseFloat(pi.unitPrice),
        brand: pi.brand,
        packagingType: pi.packagingType,
        unitsPerPackage: pi.unitsPerPackage,
      }))
      .sort((a: any, b: any) => a.unitPrice - b.unitPrice);
  };

  const sendMutation = trpc.quotations.sendToSuppliers.useMutation({
    onSuccess: (data) => {
      const whatsappCount = data.results.filter((r: any) => r.whatsapp).length;
      const emailCount = data.results.filter((r: any) => r.email).length;
      toast.success(`Links gerados para ${data.results.length} fornecedores! (${whatsappCount} WhatsApp, ${emailCount} Email)`);
      setSendResults(data.results as SendResult[]);
      setShowSendModal(true);
      utils.quotations.suppliers.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const getSupplierName = (id: number) => {
    const s = suppliersList?.find((s: any) => s.id === id);
    return s ? (s.tradeName || s.companyName) : `Fornecedor #${id}`;
  };

  const copyPublicLink = () => {
    if (!quotation) return;
    const url = `${window.location.origin}/cotacao/${quotation.publicToken}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const getProposalItemsFor = (proposalId: number) => {
    if (!allProposalItems) return [];
    return allProposalItems.filter((pi: any) => pi.proposalId === proposalId);
  };

  // Calculate real total for a proposal, excluding outlier prices (>R$200/unit)
  const OUTLIER_THRESHOLD = 200;
  const getProposalDisplayTotal = (proposalId: number): number => {
    const pItems = getProposalItemsFor(proposalId);
    if (pItems.length === 0) return 0;
    return pItems.reduce((sum: number, pi: any) => {
      const price = pi.unitPriceNormalized ? parseFloat(pi.unitPriceNormalized) : parseFloat(pi.unitPrice);
      if (isNaN(price) || price <= 0 || price > OUTLIER_THRESHOLD) return sum;
      const total = parseFloat(pi.totalPrice);
      // If totalPrice is also inflated (price * qty where price is outlier), recalculate
      if (price > OUTLIER_THRESHOLD) return sum;
      return sum + (isNaN(total) ? 0 : total);
    }, 0);
  };

  // Export comparison to PDF
  const exportPDF = () => {
    if (!quotation || !proposals || !items) return;
    
    const sorted = [...proposals].sort((a: any, b: any) => {
      const aVal = allProposalItems ? getProposalDisplayTotal(a.id) || Infinity : (a.totalValue ? parseFloat(a.totalValue) : Infinity);
      const bVal = allProposalItems ? getProposalDisplayTotal(b.id) || Infinity : (b.totalValue ? parseFloat(b.totalValue) : Infinity);
      return aVal - bVal;
    });

    const now = new Date().toLocaleString("pt-BR");
    const deadline = quotation.deadline ? new Date(quotation.deadline).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A";
    
    // Build header columns: for each supplier, 2 sub-columns (Unit. and Total)
    const supplierHeaders = sorted.map((p: any, i: number) => {
      const name = getSupplierName(p.supplierId);
      const bg = i === 0 ? 'background:#dcfce7;' : '';
      return `<th colspan="2" style="padding:8px;border:1px solid #ddd;text-align:center;${bg}">${name}${i === 0 ? ' \u2605' : ''}</th>`;
    }).join("");

    const subHeaders = sorted.map((_, i: number) => {
      const bg = i === 0 ? 'background:#f0fdf4;' : 'background:#f9f9f9;';
      return `<th style="padding:4px 6px;border:1px solid #ddd;text-align:center;font-size:10px;${bg}">Unit.</th><th style="padding:4px 6px;border:1px solid #ddd;text-align:center;font-size:10px;${bg}">Total</th>`;
    }).join("");

    let tableRows = "";
    (items || []).forEach((item: any) => {
      const qty = parseFloat(item.quantity) || 0;
      let row = `<tr><td style="padding:6px 8px;border:1px solid #ddd;font-weight:500;white-space:nowrap;">${item.productName}</td><td style="padding:6px 8px;border:1px solid #ddd;text-align:center;white-space:nowrap;">${qty.toLocaleString("pt-BR")} ${item.unit}</td>`;
      
      const allPrices = sorted.map((sp: any) => {
        const spItems = getProposalItemsFor(sp.id);
        const spi = spItems.find((pi: any) => pi.quotationItemId === item.id);
        return spi && parseFloat(spi.unitPrice) > 0 ? parseFloat(spi.unitPrice) : Infinity;
      });
      const minPrice = Math.min(...allPrices.filter(p => p !== Infinity));

      sorted.forEach((p: any) => {
        const pItems = getProposalItemsFor(p.id);
        const pItem = pItems.find((pi: any) => pi.quotationItemId === item.id);
        const price = pItem && parseFloat(pItem.unitPrice) > 0 ? parseFloat(pItem.unitPrice) : null;
        const totalItem = price !== null ? price * qty : null;
        const brand = pItem?.brand || "";
        const isLowest = price !== null && price === minPrice && minPrice !== Infinity;
        const bgColor = isLowest ? "#dcfce7" : "#fff";
        
        // Unit price column
        row += `<td style="padding:6px 8px;border:1px solid #ddd;text-align:center;background:${bgColor};">`;
        if (price !== null) {
          row += `R$ ${price.toFixed(2)}`;
          if (brand) row += `<br><small style="color:#666;">${brand}</small>`;
        } else {
          row += `\u2014`;
        }
        row += `</td>`;
        
        // Total column (unit × qty)
        row += `<td style="padding:6px 8px;border:1px solid #ddd;text-align:center;background:${bgColor};font-weight:${isLowest ? 'bold' : 'normal'};">`;
        if (totalItem !== null && totalItem > 0) {
          row += `R$ ${totalItem.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else if (price !== null) {
          row += `R$ 0,00`;
        } else {
          row += `\u2014`;
        }
        row += `</td>`;
      });
      row += "</tr>";
      tableRows += row;
    });

    // Total row
    let totalRow = `<tr style="font-weight:bold;background:#f8f9fa;"><td style="padding:8px;border:1px solid #ddd;font-size:13px;">TOTAL</td><td style="padding:8px;border:1px solid #ddd;"></td>`;
    sorted.forEach((p: any, idx: number) => {
      const bgColor = idx === 0 ? "#bbf7d0" : "#f8f9fa";
      const displayTotal = allProposalItems ? getProposalDisplayTotal(p.id) : (p.totalValue ? parseFloat(p.totalValue) : 0);
      const totalVal = displayTotal > 0 ? displayTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "\u2014";
      totalRow += `<td style="padding:8px;border:1px solid #ddd;text-align:center;background:${bgColor};"></td>`;
      totalRow += `<td style="padding:8px;border:1px solid #ddd;text-align:center;background:${bgColor};font-size:13px;">R$ ${totalVal}${idx === 0 ? "<br><small style='color:#16a34a;'>VENCEDOR</small>" : ""}</td>`;
    });
    totalRow += "</tr>";

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Comparativo - ${quotation.code}</title><style>body{font-family:Arial,sans-serif;padding:15px;font-size:11px;}h1{font-size:16px;color:#1a1a1a;margin-bottom:5px;}h2{font-size:13px;color:#333;margin-top:15px;}table{border-collapse:collapse;width:100%;margin-top:8px;}.info{margin:8px 0;color:#555;font-size:11px;}@media print{body{padding:10px;font-size:10px;}table{font-size:9px;}}</style></head><body><h1>QualiCompras - Comparativo de Propostas</h1><div class="info"><strong>Cotação:</strong> ${quotation.code} - ${quotation.title}<br><strong>Prazo:</strong> ${deadline}<br><strong>Gerado em:</strong> ${now}</div><h2>Ranking de Fornecedores</h2><table><thead><tr><th style="padding:6px;border:1px solid #ddd;text-align:left;">Pos.</th><th style="padding:6px;border:1px solid #ddd;text-align:left;">Fornecedor</th><th style="padding:6px;border:1px solid #ddd;text-align:right;">Valor Total</th><th style="padding:6px;border:1px solid #ddd;text-align:center;">Entrega</th><th style="padding:6px;border:1px solid #ddd;text-align:left;">Pagamento</th></tr></thead><tbody>${sorted.map((p: any, i: number) => `<tr style="background:${i === 0 ? '#dcfce7' : i % 2 === 0 ? '#f9f9f9' : '#fff'};"><td style="padding:6px;border:1px solid #ddd;font-weight:bold;">${i + 1}\u00BA</td><td style="padding:6px;border:1px solid #ddd;">${getSupplierName(p.supplierId)}</td><td style="padding:6px;border:1px solid #ddd;text-align:right;font-weight:bold;">R$ ${allProposalItems ? (getProposalDisplayTotal(p.id) > 0 ? getProposalDisplayTotal(p.id).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "\u2014") : (p.totalValue ? parseFloat(p.totalValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "\u2014")}</td><td style="padding:6px;border:1px solid #ddd;text-align:center;">${p.deliveryDays ? `${p.deliveryDays} dias` : "\u2014"}</td><td style="padding:6px;border:1px solid #ddd;">${p.paymentTerms || "\u2014"}</td></tr>`).join("")}</tbody></table><h2>Detalhamento por Item</h2><table><thead><tr><th rowspan="2" style="padding:6px;border:1px solid #ddd;text-align:left;vertical-align:middle;">Produto</th><th rowspan="2" style="padding:6px;border:1px solid #ddd;text-align:center;vertical-align:middle;">Qtd</th>${supplierHeaders}</tr><tr>${subHeaders}</tr></thead><tbody>${tableRows}${totalRow}</tbody></table></body></html>`;

    setPdfHtml(html);
  };

  // Sort proposals by total value for ranking (using derived totals excluding outliers)
  const sortedProposals = proposals ? [...proposals].sort((a: any, b: any) => {
    const aVal = allProposalItems ? getProposalDisplayTotal(a.id) || Infinity : (a.totalValue ? parseFloat(a.totalValue) : Infinity);
    const bVal = allProposalItems ? getProposalDisplayTotal(b.id) || Infinity : (b.totalValue ? parseFloat(b.totalValue) : Infinity);
    return aVal - bVal;
  }) : [];
  const rankMap = new Map<number, number>();
  sortedProposals.forEach((p: any, idx: number) => rankMap.set(p.id, idx + 1));

  const respondedCount = qSuppliers?.filter((qs: any) => qs.status === "responded").length || 0;
  const pendingCount = qSuppliers?.filter((qs: any) => qs.status === "pending").length || 0;

  // Compute cost scenarios (Pior / Intermediário / Ideal)
  const scenarioData = useMemo(() => {
    if (!items || !allProposalItems || sortedProposals.length === 0) return null;
    const scenarioItems: ScenarioItemInput[] = (items as any[]).map((item: any) => {
      const qty = parseFloat(item.quantity) || 0;
      const prices = sortedProposals.map((p: any) => {
        const pItems = getProposalItemsFor(p.id);
        const pi = pItems.find((pi: any) => pi.quotationItemId === item.id);
        if (!pi) return null;
        const rawPrice = pi.unitPriceNormalized ? parseFloat(pi.unitPriceNormalized) : parseFloat(pi.unitPrice);
        if (isNaN(rawPrice) || rawPrice <= 0 || rawPrice > OUTLIER_THRESHOLD) return null;
        return {
          supplierId: p.supplierId,
          supplierName: getSupplierName(p.supplierId),
          unitPrice: rawPrice,
          brand: pi.brand || "",
          paymentTerms: p.paymentTerms || null,
        };
      }).filter(Boolean) as any[];
      return {
        quotationItemId: item.id,
        productName: item.productName,
        quantity: qty,
        unit: item.unit,
        prices,
      };
    });
    return computeScenarios(scenarioItems);
  }, [items, allProposalItems, sortedProposals, suppliersList]);

  if (loadingQuotation) return <DashboardLayout><div className="p-8 text-center text-muted-foreground">Carregando...</div></DashboardLayout>;
  
  if (!quotation) return (
    <DashboardLayout>
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">Cotação não encontrada.</p>
        <Button variant="outline" onClick={() => setLocation("/cotacoes")}>
          <ArrowLeft className="h-4 w-4 mr-2" />Voltar para Cotações
        </Button>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header - mobile friendly */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setLocation("/cotacoes")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold truncate">{quotation.title}</h1>
              <p className="text-xs text-muted-foreground">{quotation.code} • {quotation.status === "open" ? "Aberta" : quotation.status === "closed" ? "Fechada" : quotation.status === "ordered" ? "Pedido Gerado" : "Rascunho"}</p>
              {(quotation as any).reopenCount > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-orange-300 text-orange-700 bg-orange-50">
                    <RotateCcw className="h-2.5 w-2.5 mr-0.5" />
                    Reaberta{(quotation as any).reopenCount > 1 ? ` ${(quotation as any).reopenCount}x` : ''} por {(quotation as any).lastReopenedBy || '—'}
                    {(quotation as any).lastReopenedAt && ` em ${new Date((quotation as any).lastReopenedAt).toLocaleDateString('pt-BR')}`}
                  </Badge>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={copyPublicLink}>
              <Copy className="h-3.5 w-3.5 mr-1" />Link
            </Button>
            {hasWriteAccess && quotation.status === "open" && (
              <>
                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => sendMutation.mutate({ quotationId })} disabled={sendMutation.isPending}>
                  <Send className="h-3.5 w-3.5 mr-1" />{sendMutation.isPending ? "..." : "Enviar"}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => closeMutation.mutate({ id: quotationId })}>
                  Fechar
                </Button>
              </>
            )}
            {hasWriteAccess && quotation.status === "draft" && (
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => openMutation.mutate({ id: quotationId })}>
                Abrir
              </Button>
            )}
            {proposals && proposals.length > 0 && (
              <Button size="sm" variant="outline" onClick={exportPDF}>
                <FileDown className="h-3.5 w-3.5 mr-1" />PDF
             </Button>
           )}
            {isMaster && (
              <>
                <input ref={reuploadInputRef} type="file" accept=".pdf" className="hidden" onChange={handleReuploadPDF} />
                <Button size="sm" variant="outline" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50" onClick={() => reuploadInputRef.current?.click()} disabled={isReuploading} title="Substituir PDF/Itens (ADM)">
                  {isReuploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                  {isReuploading ? "Enviando..." : "Reupload PDF"}
                </Button>
              </>
            )}
           {hasWriteAccess && (
              <>
                <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => { if (confirm(`Excluir permanentemente a cotação ${quotation.code}? Todos os dados (propostas, itens) serão perdidos.`)) deleteQuotationMutation.mutate({ id: quotationId }); }} title="Excluir Cotação (ADM)">
                  <XCircle className="h-3.5 w-3.5 mr-1" />Excluir
                </Button>
              </>
            )}
            {hasWriteAccess && proposals && proposals.length >= 1 && quotation.status !== 'ordered' && (
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={runOptimization} disabled={optimizeMutation.isPending}>
                {optimizeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Zap className="h-3.5 w-3.5 mr-1" />}
                {optimizeMutation.isPending ? "Analisando..." : "Executar Compra Otimizada"}
              </Button>
            )}
            {(quotation.status === 'ordered' || quotation.status === 'closed') && (isMaster || user?.email === 'frotas.patrimonio@qualities.com.br') && (
              <Button size="sm" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50" onClick={() => setShowReopenDialog(true)}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" />Reabrir Cotação
              </Button>
            )}
          </div>
        </div>

        {/* Summary Cards - Valor Total por Fornecedor */}
        {sortedProposals.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-500" />
                Resumo: Valor Total por Fornecedor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sortedProposals.map((p: any, idx: number) => {
                  const total = allProposalItems ? getProposalDisplayTotal(p.id) : (p.totalValue ? parseFloat(p.totalValue) : 0);
                  const lastProposal = sortedProposals[sortedProposals.length - 1];
                  const maxTotal = allProposalItems ? getProposalDisplayTotal(lastProposal.id) || total : (lastProposal?.totalValue ? parseFloat(String(lastProposal.totalValue)) : total);
                  const barWidth = maxTotal > 0 ? Math.max((total / maxTotal) * 100, 10) : 10;
                  return (
                    <div key={p.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {idx === 0 && <Trophy className="h-3.5 w-3.5 text-yellow-500 shrink-0" />}
                          <span className={`truncate ${idx === 0 ? "font-bold text-green-700" : ""}`}>
                            {idx + 1}º {getSupplierName(p.supplierId)}
                          </span>
                        </div>
                        <span className={`font-mono font-semibold shrink-0 ml-2 ${idx === 0 ? "text-green-700" : ""}`}>
                          R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${idx === 0 ? "bg-green-500" : idx === 1 ? "bg-blue-400" : "bg-gray-400"}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {p.deliveryDays && <span>Entrega: {p.deliveryDays} dias</span>}
                        {p.paymentTerms && <span>• {p.paymentTerms}</span>}
                        {idx > 0 && (allProposalItems ? getProposalDisplayTotal(sortedProposals[0].id) > 0 : sortedProposals[0]?.totalValue) && (
                          <span className="text-red-500 font-medium">
                            +R$ {(total - (allProposalItems ? getProposalDisplayTotal(sortedProposals[0].id) : parseFloat(sortedProposals[0].totalValue || '0'))).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} vs 1º
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Comparativo Produto × Fornecedor */}
        {sortedProposals.length > 0 && (
          <Card ref={comparisonRef}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-500" />
                Comparativo por Produto
              </CardTitle>
              <p className="text-xs text-muted-foreground">Item elegível com melhor preço destacado em verde • Itens bloqueados aparecem riscados em vermelho</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr className="border-b">
                      <th className="py-2 px-3 text-left font-medium sticky left-0 bg-muted/50 z-10 min-w-[120px]">Produto</th>
                      {sortedProposals.map((p: any, idx: number) => (
                        <th key={p.id} className={`py-2 px-2 text-center font-medium min-w-[90px] ${idx === 0 ? "bg-green-50" : ""}`}>
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="truncate max-w-[80px]">{getSupplierName(p.supplierId).split(" ")[0]}</span>
                            {idx === 0 && <Badge className="bg-green-600 text-white text-[8px] px-1 py-0">1º</Badge>}
                            {idx === 1 && <Badge className="bg-blue-100 text-blue-700 text-[8px] px-1 py-0">2º</Badge>}
                            {idx === 2 && <Badge className="bg-orange-100 text-orange-700 text-[8px] px-1 py-0">3º</Badge>}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(items || []).map((item: any) => {
                      const allPrices = sortedProposals.map((sp: any) => {
                        const spItems = getProposalItemsFor(sp.id);
                        const spi = spItems.find((pi: any) => pi.quotationItemId === item.id);
                        if (!spi || parseFloat(spi.unitPrice) <= 0) return Infinity;
                        // Use normalized price if available (for box/pack pricing)
                        const normalized = spi.unitPriceNormalized ? parseFloat(spi.unitPriceNormalized) : parseFloat(spi.unitPrice);
                        return normalized > 0 ? normalized : Infinity;
                      });
                      const minPrice = Math.min(...allPrices.filter(p => p !== Infinity));
                      // Calculate accepted minimum (excluding incompatible suppliers)
                      const acceptedPrices = sortedProposals.map((sp: any, idx: number) => {
                        const price = allPrices[idx];
                        if (price === Infinity) return Infinity;
                        const spItems = getProposalItemsFor(sp.id);
                        const spi = spItems.find((pi: any) => pi.quotationItemId === item.id);
                        const reason = isIncompatible((sp as any).supplierId, item.productName, spi?.brand);
                        return reason ? Infinity : price;
                      });
                      const acceptedMinPrice = Math.min(...acceptedPrices.filter(p => p !== Infinity));
                      
                      return (
                        <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="py-1.5 px-3 sticky left-0 bg-card z-10 font-medium text-xs">
                            <div className="flex items-start gap-1">
                              <div className="flex-1">
                                <div className="flex items-center gap-1">
                                  {item.productName}
                                  {(() => {
                                    const edits = (itemEdits || []).filter((e: any) => e.itemId === item.id);
                                    if (edits.length === 0) return null;
                                    const lastEdit = edits[0];
                                    const tooltipText = `Editado por ${lastEdit.userName} em ${lastEdit.timestamp ? new Date(lastEdit.timestamp).toLocaleDateString("pt-BR") : "?"} \u2014 ${lastEdit.justification || "sem motivo"}${edits.length > 1 ? ` (${edits.length}x)` : ""}`;
                                    return <span className="inline-flex items-center px-1 py-0 text-[8px] font-medium bg-amber-100 text-amber-700 rounded" title={tooltipText}>Editado{edits.length > 1 ? ` ${edits.length}x` : ""}</span>;
                                  })()}
                                </div>
                                <div className="text-[10px] text-muted-foreground">{parseFloat(item.quantity).toLocaleString("pt-BR")} {item.unit}</div>
                              </div>
                              {canEditItems && quotation?.status !== "ordered" && (
                                <button
                                  className="text-[10px] text-blue-400 hover:text-blue-700 opacity-50 hover:opacity-100 mt-0.5 shrink-0"
                                  title="Editar nome, quantidade ou unidade deste item"
                                  onClick={(e) => { e.stopPropagation(); setEditItemModal({ id: item.id, productName: item.productName, quantity: String(item.quantity), unit: item.unit }); setEditItemForm({ productName: item.productName, quantity: String(parseFloat(item.quantity)), unit: item.unit, unitsPerPackage: 1, justification: "" }); }}
                                >✏️</button>
                              )}
                            </div>
                          </td>
                          {sortedProposals.map((p: any) => {
                            const pItems = getProposalItemsFor(p.id);
                            const pItem = pItems.find((pi: any) => pi.quotationItemId === item.id);
                            const rawPrice = pItem && parseFloat(pItem.unitPrice) > 0 ? parseFloat(pItem.unitPrice) : null;
                            const normalizedPrice = pItem?.unitPriceNormalized ? parseFloat(pItem.unitPriceNormalized) : rawPrice;
                            const displayPrice = normalizedPrice;
                            const qty = parseFloat(item.quantity) || 0;
                            const totalItem = displayPrice !== null ? displayPrice * qty : null;
                            // Check incompatibility for this supplier+item+brand
                            const incompatReason = isIncompatible((p as any).supplierId, item.productName, pItem?.brand);
                            const isRejected = !!incompatReason;
                            // isLowest = accepted winner (green) — only if not rejected
                            const isLowest = !isRejected && displayPrice !== null && acceptedMinPrice !== Infinity && Math.abs(displayPrice - acceptedMinPrice) < 0.001;
                            // Anomaly detection: flag if price is >4x the accepted minimum (likely error)
                            const isAnomaly = !isRejected && displayPrice !== null && acceptedMinPrice > 0 && acceptedMinPrice !== Infinity && displayPrice > acceptedMinPrice * 4;
                            const isPackaged = pItem?.packagingType && pItem.packagingType !== "unidade";
                            const pkgLabel = pItem?.packagingType === "caixa" ? "CX" : pItem?.packagingType === "fardo" ? "FD" : pItem?.packagingType === "pacote" ? "PC" : "";
                            // Calculate total real units offered
                            const unitsPerPkg = isPackaged && pItem?.unitsPerPackage ? parseInt(String(pItem.unitsPerPackage)) : 1;
                            const totalRealUnits = qty * unitsPerPkg;
                            return (
                              <td key={p.id} className={`py-1.5 px-2 text-center ${isRejected ? "bg-red-50/60" : isAnomaly ? "bg-orange-50 text-orange-700" : isLowest ? "bg-green-50 font-bold text-green-700" : ""}`}>
                                {displayPrice !== null ? (
                                  <div>
                                    <div className={`flex items-center justify-center gap-0.5 ${isRejected ? "line-through opacity-60" : ""}`}>
                                      R$ {displayPrice.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}
                                      {isPackaged && <span className="text-[8px] bg-blue-100 text-blue-700 px-1 rounded font-medium ml-0.5">/un</span>}
                                    {isAnomaly && <span className="text-[8px] bg-orange-200 text-orange-800 px-1 rounded font-bold ml-0.5">SUSPEITO</span>}
                                    {isRejected && <span className="text-[8px] bg-red-200 text-red-800 px-1 rounded font-bold ml-0.5" title={incompatReason || ""}>✗</span>}
                                    {/* Price variation indicator */}
                                    {priceVariations && (() => {
                                      const key = `${(p as any).supplierId}::${item.productName}`;
                                      const variation = (priceVariations as any)?.[key];
                                      if (variation && displayPrice !== null) {
                                        return <PriceVariationIndicator currentPrice={displayPrice} lastPrice={variation.lastPrice} lastDate={variation.lastDate} supplierName={getSupplierName((p as any).supplierId)} productName={item.productName} source={variation.source} />;
                                      }
                                      return null;
                                    })()}
                                    </div>
                                    {isPackaged && rawPrice !== null && (
                                      <div className="text-[8px] text-blue-600 font-normal">{qty.toLocaleString("pt-BR")} {pkgLabel} × {unitsPerPkg} un = <strong>{totalRealUnits.toLocaleString("pt-BR")} un</strong></div>
                                    )}
                                    {isPackaged && rawPrice !== null && (
                                      <div className="text-[8px] text-muted-foreground font-normal">({pkgLabel} R${rawPrice.toFixed(2)})</div>
                                    )}
                                    {totalItem !== null && totalItem > 0 && (
                                      <div className="text-[9px] text-muted-foreground font-normal">Total: R$ {totalItem.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                    )}
                                    {isRejected && (
                                      <div className="text-[8px] text-red-600 bg-red-100 rounded px-1 py-0.5 mt-0.5 max-w-[100px] mx-auto truncate font-medium" title={incompatReason || "Incompatível"}>
                                        {incompatReason && incompatReason.length > 30 ? incompatReason.slice(0, 28) + "…" : incompatReason || "Não atende"}
                                      </div>
                                    )}
                                    {pItem?.brand && (() => {
                                      const status = brandStatuses?.[pItem.brand] || "unknown";
                                      const colorClass = status === "approved" ? "text-green-700 bg-green-50" : status === "rejected" ? "text-red-700 bg-red-50 line-through" : "text-yellow-700 bg-yellow-50";
                                      return <div className={`text-[9px] ${colorClass} rounded px-1 py-0.5 mt-0.5 truncate max-w-[80px] mx-auto font-medium`} title={status === "approved" ? "Marca aprovada" : status === "rejected" ? "Marca reprovada" : "Marca desconhecida"}>{pItem.brand}</div>;
                                    })()}
                                    {canEditPrices && pItem && (
                                      <button className="text-[9px] text-blue-500 hover:text-blue-700 mt-0.5 opacity-60 hover:opacity-100" onClick={() => { setEditingItem({ proposalItemId: pItem.id, unitPrice: String(rawPrice || displayPrice || ''), packagingType: pItem.packagingType || 'unidade', unitsPerPackage: pItem.unitsPerPackage || 1, brand: pItem.brand || '', notes: pItem.notes || '', productName: item.productName, requestedQty: qty, requestedUnit: item.unit }); }} title="Editar item (ADM)">✏️</button>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center">
                                    <span className="text-muted-foreground text-[10px] font-medium">N/D</span>
                                    {canEditPrices && (
                                      <button className="text-[9px] text-green-500 hover:text-green-700 mt-0.5 opacity-60 hover:opacity-100" onClick={() => { const qty = parseFloat(item.quantity) || 0; setAddingItem({ proposalId: p.id, quotationItemId: item.id, unitPrice: '', packagingType: 'unidade', unitsPerPackage: 1, brand: '', notes: '', productName: item.productName, requestedQty: qty, requestedUnit: item.unit }); }} title="Adicionar preço (fornecedor informou depois)">+ preço</button>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    {/* Total row */}
                    <tr className="border-t-2 bg-muted/30 font-bold">
                      <td className="py-2 px-3 sticky left-0 bg-muted/30 z-10">TOTAL</td>
                      {sortedProposals.map((p: any, idx: number) => {
                        const displayTotal = allProposalItems ? getProposalDisplayTotal(p.id) : (p.totalValue ? parseFloat(p.totalValue) : 0);
                        return (
                          <td key={p.id} className={`py-2 px-2 text-center ${idx === 0 ? "bg-green-100 text-green-800" : ""}`}>
                            <div className="text-sm">R$ {displayTotal > 0 ? displayTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—"}</div>
                            {idx === 0 && <div className="text-[9px] font-normal text-green-600">Vencedor</div>}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* Legenda do Comparativo */}
              <div className="px-4 py-3 border-t bg-muted/30 flex flex-wrap gap-x-5 gap-y-1.5 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500"></span> Escolhido pela Compra Otimizada</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500"></span> Bloqueado (restrição global/regional)</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-500"></span> Preço suspeito (correção automática)</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400"></span> Sem proposta (N/D)</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Suppliers Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Fornecedores ({qSuppliers?.length || 0})</span>
              <div className="flex items-center gap-2 text-xs font-normal">
                {respondedCount > 0 && <Badge className="bg-green-100 text-green-700">{respondedCount} respondeu</Badge>}
                {pendingCount > 0 && <Badge variant="outline">{pendingCount} aguardando</Badge>}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!qSuppliers || qSuppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum fornecedor convidado</p>
            ) : (
              <div className="space-y-1">
                {qSuppliers.map((qs: any) => (
                  <div key={qs.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm truncate flex-1 min-w-0">{getSupplierName(qs.supplierId)}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5 text-[10px]"
                        onClick={() => {
                          const url = `${window.location.origin}/cotacao/${quotation.publicToken}?s=${qs.supplierId}`;
                          navigator.clipboard.writeText(url);
                          toast.success(`Link copiado`);
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      {qs.status === "responded" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      {qs.status === "pending" && <Clock className="h-4 w-4 text-yellow-500" />}
                      {qs.status === "declined" && <XCircle className="h-4 w-4 text-red-500" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal: Optimization Result */}
      <Dialog open={showOptimization} onOpenChange={setShowOptimization}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Compra Otimizada
            </DialogTitle>
          </DialogHeader>
          {optimizationResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-amber-700">R$ {(() => { let total = 0; optimizationResult.suppliers.forEach((s: any, sIdx: number) => { s.items.forEach((item: any, iIdx: number) => { if (selectedItems[`${sIdx}-${iIdx}`] !== false) total += item.total; }); }); return total.toLocaleString("pt-BR", { minimumFractionDigits: 2 }); })()}</p>
                    <p className="text-xs text-muted-foreground">Total Otimizado{Object.values(selectedItems).some(v => v === false) ? ' (com exclusões)' : ''}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-700">{optimizationResult.totalSuppliers}</p>
                    <p className="text-xs text-muted-foreground">Fornecedor(es)</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">Critério: Fornecedor a prazo tem preferência de até {optimizationResult.tolerancePct}% acima do menor preço</p>
              </div>

              {/* Economy card */}
              {optimizationResult.scenarios && optimizationResult.scenarios.economyValue > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="h-5 w-5 text-green-600" />
                    <p className="text-sm font-bold text-green-700">Economia Realizada</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-lg font-bold text-green-700">R$ {optimizationResult.scenarios.economyValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      <p className="text-[10px] text-green-600">Economia vs Pior</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-green-700">{optimizationResult.scenarios.economyPct.toFixed(1)}%</p>
                      <p className="text-[10px] text-green-600">Redução</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-red-500">R$ {optimizationResult.scenarios.worstTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      <p className="text-[10px] text-red-400">Pior Cenário</p>
                    </div>
                  </div>
                  {optimizationResult.scenarios.economyVsMedian > 0 && (
                    <p className="text-xs text-green-600 text-center mt-2">Também R$ {optimizationResult.scenarios.economyVsMedian.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ({optimizationResult.scenarios.economyVsMedianPct.toFixed(1)}%) abaixo do cenário intermediário</p>
                  )}
                </div>
              )}

              {/* Price target violations warning */}
              <PriceTargetWarning optimizationResult={optimizationResult} />

              {/* Per-supplier breakdown - with real-time adjustment movement */}
              {(() => {
                // Compute adjusted suppliers: move items between cards based on adjustments
                // KEY FIX: Use quotationItemId as adjustment key instead of fragile positional indices
                const buildAdjustedSuppliers = () => {
                  if (!adjustMode || !adjustStep || Object.keys(adjustments).length === 0) {
                    // Always inject _originalKey (quotationItemId) so the dropdown can reference items correctly
                    return optimizationResult.suppliers.map((s: any, sIdx: number) => ({
                      ...s,
                      items: s.items.map((item: any, iIdx: number) => ({ ...item, _originalKey: String(item.quotationItemId), _suppIdx: sIdx, _itemIdx: iIdx }))
                    }));
                  }
                  // Clone suppliers deeply
                  const suppMap = new Map<number, { supplierId: number; supplierName: string; total: number; itemCount: number; items: any[]; paymentTerms: string }>(); 
                  optimizationResult.suppliers.forEach((s: any) => {
                    suppMap.set(s.supplierId, { supplierId: s.supplierId, supplierName: s.supplierName, total: 0, itemCount: 0, items: [], paymentTerms: s.paymentTerms });
                  });
                  // Distribute items based on adjustments (keyed by quotationItemId)
                  optimizationResult.suppliers.forEach((s: any, sIdx: number) => {
                    s.items.forEach((item: any, iIdx: number) => {
                      const key = String(item.quotationItemId);
                      const adj = adjustments[key];
                      if (adj) {
                        // Item moves to new supplier
                        let dest = suppMap.get(adj.newSupplierId);
                        if (!dest) {
                          dest = { supplierId: adj.newSupplierId, supplierName: adj.newSupplierName, total: 0, itemCount: 0, items: [], paymentTerms: '' };
                          suppMap.set(adj.newSupplierId, dest);
                        }
                        const newTotal = adj.newUnitPrice * item.quantity;
                        dest.items.push({ ...item, unitPrice: adj.newUnitPrice, total: newTotal, brand: adj.newBrand || item.brand, packagingType: adj.newPackagingType || item.packagingType, unitsPerPackage: adj.newUnitsPerPackage || item.unitsPerPackage, reason: 'Ajuste manual', _originalKey: key, _suppIdx: sIdx, _itemIdx: iIdx, _movedFrom: s.supplierName });
                        dest.total += newTotal;
                        dest.itemCount += 1;
                      } else {
                        // Item stays
                        const src = suppMap.get(s.supplierId)!;
                        src.items.push({ ...item, _originalKey: key, _suppIdx: sIdx, _itemIdx: iIdx });
                        src.total += item.total;
                        src.itemCount += 1;
                      }
                    });
                  });
                  return Array.from(suppMap.values()).filter(s => s.items.length > 0);
                };
                const displaySuppliers = buildAdjustedSuppliers();
                const colors = ['#d97706', '#3b82f6', '#10b981', '#6b7280', '#8b5cf6', '#ec4899'];
                return displaySuppliers.map((s: any, idx: number) => (
                <Card key={s.supplierId} className="border-l-4" style={{ borderLeftColor: colors[idx % colors.length] }}>
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4" />
                        {s.supplierName}
                      </div>
                      <div className="text-right">
                        <span className="font-bold">R$ {(() => { const selectedTotal = s.items.reduce((sum: number, item: any, iIdx: number) => selectedItems[`${idx}-${iIdx}`] !== false ? sum + item.total : sum, 0); return selectedTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 }); })()}</span>
                        <span className="text-xs text-muted-foreground ml-2">({s.items.filter((_: any, iIdx: number) => selectedItems[`${idx}-${iIdx}`] !== false).length}/{s.items.length} itens)</span>
                      </div>
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      {s.paymentTerms && s.paymentTerms !== "\u2014" && (
                        <Badge variant="outline" className="text-[10px]">{s.paymentTerms}</Badge>
                      )}
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => generateSupplierPDF(s)}>
                        <Download className="h-3 w-3 mr-1" />PDF
                      </Button>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] text-green-700 border-green-300 hover:bg-green-50" onClick={() => sendOrderWhatsApp(s)}>
                        <MessageCircle className="h-3 w-3 mr-1" />WhatsApp
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b text-left">
                            {!adjustMode && <th className="py-1.5 px-1 w-8 text-center font-medium"><Checkbox checked={s.items.every((_: any, iIdx: number) => selectedItems[`${idx}-${iIdx}`] !== false)} onCheckedChange={(checked) => { const next = { ...selectedItems }; s.items.forEach((_: any, iIdx: number) => { next[`${idx}-${iIdx}`] = !!checked; }); setSelectedItems(next); }} /></th>}
                            <th className="py-1.5 px-2 font-medium">Produto</th>
                            <th className="py-1.5 px-2 text-center font-medium">Qtd</th>
                            <th className="py-1.5 px-2 text-right font-medium">Unit.</th>
                            <th className="py-1.5 px-2 text-right font-medium">Total</th>
                            <th className="py-1.5 px-2 font-medium">Marca</th>
                            <th className="py-1.5 px-2 text-right font-medium">Últ. Compra</th>
                            <th className="py-1.5 px-2 font-medium">Motivo</th>
                            {adjustMode && adjustStep === 'selection' && <th className="py-1.5 px-2 font-medium text-blue-700">Ajustar</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {s.items.map((item: any, itemIdx: number) => {
                            const lp = item.lastPurchase;
                            const diff = lp ? ((item.unitPrice - lp.unitPrice) / lp.unitPrice * 100) : null;
                            const isPkg = item.packagingType && item.packagingType !== "unidade";
                            const pkgLbl = item.packagingType === "caixa" ? "CX" : item.packagingType === "fardo" ? "FD" : item.packagingType === "pacote" ? "PC" : "";
                            const adjustKey = item._originalKey;
                            const isAdjusted = !!adjustments[adjustKey];
                            const isMoved = !!item._movedFrom;
                            const alternatives = (adjustMode && adjustStep === 'selection' && !isMoved) ? (item.alternatives || []) : [];
                            const itemKey = `${idx}-${itemIdx}`;
                            const isSelected = selectedItems[itemKey] !== false;
                            return (
                            <tr key={item.quotationItemId + '-' + adjustKey} className={`border-b last:border-0 ${isMoved ? 'bg-green-50' : ''} ${adjustMode && adjustStep === 'selection' && !isMoved ? 'hover:bg-blue-50' : ''} ${!isSelected && !adjustMode ? 'opacity-40 line-through' : ''}`}>
                              {!adjustMode && <td className="py-1.5 px-1 text-center"><Checkbox checked={isSelected} onCheckedChange={(checked) => setSelectedItems(prev => ({ ...prev, [itemKey]: !!checked }))} /></td>}
                              <td className="py-1.5 px-2 font-medium">
                                {item.productName}
                                {isPkg && item.unitsPerPackage > 1 && <div className="text-[9px] text-blue-600">{item.quantity} {pkgLbl} ({item.unitsPerPackage}{item.unit?.toLowerCase() || 'un'}/{pkgLbl.toLowerCase()}) = {item.quantity * item.unitsPerPackage} {item.unit?.toLowerCase() || 'un'}</div>}
                                {isMoved && <div className="text-[9px] text-green-600">← veio de {item._movedFrom}</div>}
                              </td>
                              <td className="py-1.5 px-2 text-center">
                                {item.quantity}{isPkg && <span className="text-[9px] text-blue-600 ml-0.5">{pkgLbl}</span>}
                              </td>
                              <td className="py-1.5 px-2 text-right">R$ {item.unitPrice.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}{isPkg && <span className="text-[9px] text-blue-600">/un</span>}</td>
                              <td className="py-1.5 px-2 text-right font-semibold">R$ {item.total.toFixed(2)}</td>
                              <td className="py-1.5 px-2">{(() => {
                                const status = brandStatuses?.[item.brand] || "unknown";
                                const colorClass = status === "approved" ? "text-green-700" : status === "rejected" ? "text-red-700 line-through" : "text-yellow-700";
                                return <span className={colorClass}>{item.brand}</span>;
                              })()}</td>
                              <td className="py-1.5 px-2 text-right">
                                {lp ? (
                                  <span className={diff !== null && diff > 0 ? 'text-red-600' : diff !== null && diff < 0 ? 'text-green-600' : ''}>
                                    R$ {lp.unitPrice.toFixed(2)}
                                    {diff !== null && <span className="text-[9px] ml-0.5">({diff > 0 ? '+' : ''}{diff.toFixed(1)}%)</span>}
                                  </span>
                                ) : <span className="text-muted-foreground/50">—</span>}
                              </td>
                              <td className="py-1.5 px-2">
                                <Badge variant="outline" className={`text-[9px] px-1 py-0 ${isMoved ? 'border-green-400 text-green-700' : ''}`}>
                                  {item.reason}
                                </Badge>
                              </td>
                              {adjustMode && adjustStep === 'selection' && (
                                <td className="py-1.5 px-2">
                                  {isMoved ? (
                                    <Button size="sm" variant="ghost" className="h-5 px-1 text-[9px] text-red-600 hover:bg-red-50" onClick={() => {
                                      setAdjustments(prev => { const next = { ...prev }; delete next[adjustKey]; return next; });
                                    }}>
                                      ✕ Desfazer
                                    </Button>
                                  ) : alternatives.length > 0 ? (
                                    <Select onValueChange={(val) => {
                                      const alt = alternatives.find((a: any) => a.supplierId === parseInt(val));
                                      if (alt) {
                                        setAdjustments(prev => ({
                                          ...prev,
                                          [adjustKey]: {
                                            newSupplierId: alt.supplierId,
                                            newSupplierName: alt.supplierName,
                                            newUnitPrice: alt.unitPrice,
                                            newBrand: alt.brand || undefined,
                                            newPackagingType: alt.packagingType || null,
                                            newUnitsPerPackage: alt.unitsPerPackage || null,
                                          }
                                        }));
                                      }
                                    }}>
                                      <SelectTrigger className="h-6 text-[9px] w-[120px]">
                                        <SelectValue placeholder="Trocar →" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {alternatives.map((alt: any) => (
                                          <SelectItem key={alt.supplierId} value={String(alt.supplierId)}>
                                            {alt.supplierName} - R$ {alt.unitPrice.toFixed(2)}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <span className="text-[9px] text-muted-foreground">Sem alternativa</span>
                                  )}
                                </td>
                              )}
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
                ));
              })()}

              {/* Anomalies - discrepant prices */}
              {optimizationResult.anomalies && optimizationResult.anomalies.length > 0 && (
                <div className="bg-orange-50 border border-orange-300 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <p className="text-sm font-bold text-orange-700">Preços Suspeitos — Excluídos da Otimização ({optimizationResult.anomalies.length})</p>
                  </div>
                  <p className="text-xs text-orange-600 mb-2">Estes itens foram excluídos automaticamente por terem preço muito acima da média (possível erro de preenchimento).</p>
                  <div className="space-y-1.5">
                    {optimizationResult.anomalies.map((a: any, i: number) => {
                      const correctionUrl = `${window.location.origin}/correcao/${quotation.publicToken}/${a.supplierId}/${a.quotationItemId}`;
                      const whatsappMsg = `Olá! Identificamos que o preço do *${a.productName}* ficou em *R$ ${a.unitPrice.toFixed(2)}* — muito acima dos demais fornecedores (mediana R$ ${a.medianPrice.toFixed(2)}). Pode confirmar se está correto ou corrigir pelo link: ${correctionUrl}`;
                      const supplierData = (optimizationResult as any).suppliers?.find((s: any) => s.id === a.supplierId);
                      return (
                        <div key={i} className="bg-white border border-orange-200 rounded p-2 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-orange-800">{a.productName}</span>
                            <span className="text-orange-600 font-bold">+{a.deviationPct}% acima</span>
                          </div>
                          <div className="flex justify-between text-orange-600 mt-0.5">
                            <span>{a.supplierName}: R$ {a.unitPrice.toFixed(2)}</span>
                            <span>Mediana: R$ {a.medianPrice.toFixed(2)}</span>
                          </div>
                          <div className="flex gap-2 mt-1.5">
                            <button
                              className="flex-1 bg-green-600 text-white rounded px-2 py-1 text-[10px] font-medium hover:bg-green-700 transition-colors"
                              onClick={() => {
                                const phone = a.whatsapp || supplierData?.whatsapp || "";
                                const cleanPhone = phone.replace(/\D/g, "");
                                const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(whatsappMsg)}`;
                                window.open(url, "_blank");
                              }}
                            >
                              Solicitar Correção via WhatsApp
                            </button>
                            <button
                              className="flex-1 bg-orange-100 text-orange-700 rounded px-2 py-1 text-[10px] font-medium hover:bg-orange-200 transition-colors"
                              onClick={() => {
                                navigator.clipboard.writeText(correctionUrl);
                                alert("Link de correção copiado!");
                              }}
                            >
                              Copiar Link
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-orange-500 mt-2">Recomendação: Solicitar correção ao fornecedor ou verificar se cotou por caixa/fardo em vez de unidade.</p>
                </div>
              )}

              {/* Items without supplier */}
              {optimizationResult.noSupplier.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-red-700 mb-1">Sem Fornecedor ({optimizationResult.noSupplier.length})</p>
                  <div className="text-xs text-red-600 space-y-0.5">
                    {optimizationResult.noSupplier.map((item: any, i: number) => (
                      <p key={i}>{item.productName}: {item.quantity} {item.unit}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Unresolved Ties - Manual Brand Choice */}
              {optimizationResult.unresolvedTies && optimizationResult.unresolvedTies.length > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">⚡</span>
                    <p className="text-sm font-bold text-amber-800">Empate de Marca — Escolha Necessária ({optimizationResult.unresolvedTies.length})</p>
                  </div>
                  <p className="text-xs text-amber-700 mb-3">Estes itens têm preço e condição de pagamento iguais entre fornecedores. Escolha a marca preferida antes de gerar os pedidos.</p>
                  <div className="space-y-3">
                    {optimizationResult.unresolvedTies.map((tie: any) => (
                      <div key={tie.quotationItemId} className="bg-white border border-amber-200 rounded-md p-3">
                        <p className="text-sm font-medium text-amber-900 mb-2">{tie.productName}</p>
                        <div className="grid grid-cols-2 gap-2">
                          {tie.tiedSuppliers.map((s: any) => (
                            <button
                              key={s.supplierId}
                              className="text-left p-2 border rounded-md hover:bg-amber-50 transition-colors text-xs"
                              onClick={() => {
                                // Apply manual tie resolution as an adjustment
                                setAdjustments(prev => ({ ...prev, [tie.quotationItemId]: s.supplierId }));
                              }}
                            >
                              <p className="font-medium">{s.supplierName}</p>
                              <p className="text-muted-foreground">Marca: {s.brand || '—'}</p>
                              <p className="text-muted-foreground">R$ {Number(s.unitPrice).toFixed(2)} | {s.paymentTerms || 'À Vista'}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preferred Suppliers Info */}
              {optimizationResult.preferredSuppliers && optimizationResult.preferredSuppliers.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-emerald-700 mb-1">⭐ Fornecedores Preferenciais (tolerância de até 3% sobre o melhor preço):</p>
                  <p className="text-xs text-emerald-600">
                    {optimizationResult.preferredSuppliers.map((ps: any) => ps.supplierName).join(', ')}
                  </p>
                </div>
              )}

              {/* Adjustment Mode Panel */}
              {/* Excluded by Incompatibility Alert */}
              {optimizationResult.excludedByIncompatibility && optimizationResult.excludedByIncompatibility.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <details className="group">
                    <summary className="flex items-center gap-2 cursor-pointer list-none">
                      <span className="text-orange-600 font-bold text-sm">⚠️</span>
                      <span className="text-xs font-semibold text-orange-700">
                        {optimizationResult.excludedByIncompatibility.length} opção(ões) excluída(s) por incompatibilidade
                      </span>
                      <span className="text-[10px] text-orange-500 ml-auto group-open:hidden">▶ detalhes</span>
                      <span className="text-[10px] text-orange-500 ml-auto hidden group-open:inline">▼ ocultar</span>
                    </summary>
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {optimizationResult.excludedByIncompatibility.map((exc: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-[10px] py-1 border-b border-orange-100 last:border-0">
                          <span className="font-medium text-orange-800 truncate max-w-[120px]" title={exc.productName}>{exc.productName}</span>
                          <span className="text-orange-600 truncate max-w-[100px]" title={exc.supplierName}>{exc.supplierName}</span>
                          <span className="font-mono text-orange-500">R$ {exc.unitPrice.toFixed(2)}</span>
                          <span className="text-orange-400 italic truncate max-w-[140px]" title={exc.reason}>{exc.reason}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[9px] text-orange-400 mt-2 italic">Fornecedores cotaram mas foram excluídos. Para alterar, vá em Fornecedores → Tipo/Compatibilidade.</p>
                  </details>
                </div>
              )}

              {/* Adjustment Mode Panel */}
              {adjustMode && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Shuffle className="h-5 w-5 text-blue-600" />
                    <p className="text-sm font-bold text-blue-700">Modo Ajuste de Compra</p>
                  </div>

                  {/* Step 1: Justification */}
                  {adjustStep === 'justification' && (
                    <div className="space-y-3">
                      <p className="text-xs text-blue-600">Informe o motivo pelo qual a compra não será feita no fornecedor mais barato.</p>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-blue-800">Justificativa obrigatória *</label>
                        <Textarea
                          value={adjustJustification}
                          onChange={(e) => setAdjustJustification(e.target.value)}
                          placeholder="Ex: Fornecedor não entrega na região, prazo incompatível, qualidade inferior..."
                          className="text-sm min-h-[80px]"
                        />
                        <p className="text-xs text-muted-foreground">{adjustJustification.length}/10 caracteres mínimos</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          className={`flex-1 ${adjustJustification.length < 10 ? 'bg-gray-400 cursor-not-allowed opacity-60' : 'bg-blue-600 hover:bg-blue-700'}`}
                          disabled={adjustJustification.length < 10}
                          onClick={() => { setAdjustStep('selection'); setTimeout(() => { const el = document.querySelector('[data-slot="dialog-content"]'); if (el) el.scrollTop = 0; }, 100); }}
                        >
                          Continuar → Selecionar Itens
                        </Button>
                        <Button variant="outline" onClick={() => { setAdjustMode(false); setAdjustJustification(""); setAdjustStep('justification'); }}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Item selection */}
                  {adjustStep === 'selection' && (
                    <div className="space-y-3">
                      <div className="bg-white border border-blue-100 rounded p-2">
                        <p className="text-xs text-muted-foreground">Motivo: <span className="font-medium text-foreground">{adjustJustification}</span></p>
                      </div>
                      <p className="text-xs text-blue-600">Clique nos itens acima para mover para outro fornecedor. Selecione o novo fornecedor no dropdown que aparece na coluna “Ajustar”.</p>
                      
                      {/* Show adjusted items */}
                      {Object.keys(adjustments).length > 0 && (
                        <div className="bg-white border border-blue-100 rounded p-2 space-y-1">
                          <p className="text-xs font-medium text-blue-800">{Object.keys(adjustments).length} item(ns) ajustado(s):</p>
                          {Object.entries(adjustments).map(([key, adj]) => {
                            // Resolve item by quotationItemId (key is now quotationItemId string)
                            let foundItem: any = null;
                            let foundSupplier: any = null;
                            for (const s of optimizationResult.suppliers) {
                              const match = s.items.find((it: any) => String(it.quotationItemId) === key);
                              if (match) { foundItem = match; foundSupplier = s; break; }
                            }
                            if (!foundItem) return null;
                            const diff = ((adj.newUnitPrice - foundItem.unitPrice) / foundItem.unitPrice * 100);
                            return (
                              <div key={key} className="flex justify-between items-center text-xs border-b last:border-0 pb-1">
                                <span className="font-medium">{foundItem.productName}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground line-through">R$ {foundItem.unitPrice.toFixed(2)}</span>
                                  <span className="font-bold">→ R$ {adj.newUnitPrice.toFixed(2)}</span>
                                  <span className={diff > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>({diff > 0 ? '+' : ''}{diff.toFixed(1)}%)</span>
                                  <span className="text-blue-600">({adj.newSupplierName})</span>
                                  <button className="text-red-400 hover:text-red-600" onClick={() => { const copy = {...adjustments}; delete copy[key]; setAdjustments(copy); }}>✕</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          className="flex-1 bg-blue-600 hover:bg-blue-700"
                          disabled={savingAdjustment || Object.keys(adjustments).length === 0}
                          onClick={confirmAdjustment}
                        >
                          {savingAdjustment ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                          ) : (
                            <><FileText className="h-4 w-4 mr-2" />Confirmar Ajuste e Fechar Pedido</>
                          )}
                        </Button>
                        <Button variant="outline" onClick={() => setAdjustStep('justification')}>
                          ← Editar Motivo
                        </Button>
                        <Button variant="outline" onClick={() => { setAdjustMode(false); setAdjustments({}); setAdjustJustification(""); setAdjustStep('justification'); }}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              {!adjustMode && (
                <div className="flex flex-col gap-2 pt-3 border-t">
                  {hasDeselectedItems && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs font-medium text-amber-800 mb-1">
                        {Object.values(selectedItems).filter(v => v === false).length} item(ns) desmarcado(s) — informe o motivo:
                      </p>
                      <Textarea
                        placeholder="Ex: Item fora do cardápio desta semana, marca não aprovada pela unidade..."
                        value={deselectionReason}
                        onChange={(e) => setDeselectionReason(e.target.value)}
                        className="text-xs min-h-[60px]"
                      />
                      {deselectionReason.trim().length > 0 && deselectionReason.trim().length < 10 && (
                        <p className="text-[10px] text-red-500 mt-1">Mínimo 10 caracteres</p>
                      )}
                    </div>
                  )}
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={generatingOrders || generateOrdersMutation.isPending || (hasDeselectedItems && deselectionReason.trim().length < 10)}
                    onClick={confirmGenerateOrders}
                  >
                    {generatingOrders || generateOrdersMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando Pedidos...</>
                    ) : (
                      <><ShoppingCart className="h-4 w-4 mr-2" />Fechar Pedido</>  
                    )}
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center">Gera {optimizationResult.totalSuppliers} pedido(s), aprova automaticamente e fecha a cotação</p>
                  <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => setAdjustMode(true)}>
                    <Shuffle className="h-4 w-4 mr-2" />Ajustar Compra
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center">Redirecionar itens para outro fornecedor com justificativa obrigatória</p>
                  <Button variant="outline" onClick={() => setShowOptimization(false)}>
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Send to Suppliers */}
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

      {/* PDF Viewer Overlay - full screen with close/print/share buttons */}
      {pdfHtml && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex flex-col">
          {/* Top bar with actions */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#1e3a5f] text-white shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 gap-2"
              onClick={closePdfViewer}
            >
              <X className="h-5 w-5" />
              Fechar
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20 gap-2"
                onClick={() => {
                  const iframe = document.getElementById('pdf-viewer-iframe') as HTMLIFrameElement;
                  if (iframe?.contentWindow) {
                    iframe.contentWindow.print();
                  }
                }}
              >
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
              {navigator.share && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20 gap-2"
                  onClick={async () => {
                    try {
                      const blob = new Blob([pdfHtml], { type: 'text/html' });
                      const file = new File([blob], 'pedido.html', { type: 'text/html' });
                      await navigator.share({ title: 'Pedido de Compra - QualiCompras', files: [file] });
                    } catch (e) {
                      // User cancelled or not supported
                    }
                  }}
                >
                  <Share2 className="h-4 w-4" />
                  Compartilhar
                </Button>
              )}
            </div>
          </div>
          {/* PDF content iframe */}
          <iframe
            id="pdf-viewer-iframe"
            className="flex-1 w-full bg-white"
            srcDoc={pdfHtml}
            title="Visualização do PDF"
          />
        </div>
      )}
      {/* Modal de Edição Completa - ADM Master */}
      <Dialog open={!!editingItem} onOpenChange={(open) => { if (!open) setEditingItem(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Editar Item da Proposta</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="font-semibold text-sm">{editingItem.productName}</p>
                <p className="text-xs text-muted-foreground">Qtd solicitada: {editingItem.requestedQty} {editingItem.requestedUnit}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Preço (R$)</label>
                  <input type="number" step="0.01" min="0" className="w-full mt-1 px-3 py-2 border rounded-md text-sm" value={editingItem.unitPrice} onChange={(e) => setEditingItem({ ...editingItem, unitPrice: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Embalagem</label>
                  <select className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-background" value={editingItem.packagingType} onChange={(e) => setEditingItem({ ...editingItem, packagingType: e.target.value as any })}>
                    <option value="unidade">Unidade</option>
                    <option value="caixa">Caixa</option>
                    <option value="fardo">Fardo</option>
                    <option value="pacote">Pacote</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Un. por embalagem</label>
                  <input type="number" min="1" className="w-full mt-1 px-3 py-2 border rounded-md text-sm" value={editingItem.unitsPerPackage} onChange={(e) => setEditingItem({ ...editingItem, unitsPerPackage: parseInt(e.target.value) || 1 })} disabled={editingItem.packagingType === 'unidade'} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Marca</label>
                  <input type="text" className="w-full mt-1 px-3 py-2 border rounded-md text-sm" value={editingItem.brand} onChange={(e) => setEditingItem({ ...editingItem, brand: e.target.value })} placeholder="Ex: Cristal" />
                </div>
              </div>

              {/* Live calculation preview */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                <p className="text-xs font-semibold text-blue-800">Cálculo em tempo real:</p>
                {editingItem.packagingType !== 'unidade' && editingItem.unitsPerPackage > 1 ? (
                  <>
                    <p className="text-xs text-blue-700">Preço por {editingItem.packagingType}: <strong>R$ {parseFloat(editingItem.unitPrice || '0').toFixed(2)}</strong></p>
                    <p className="text-xs text-blue-700">÷ {editingItem.unitsPerPackage} un/embalagem</p>
                    <p className="text-sm font-bold text-blue-900">= R$ {(parseFloat(editingItem.unitPrice || '0') / editingItem.unitsPerPackage).toFixed(4)} /unidade</p>
                    <hr className="border-blue-200 my-1" />
                    <p className="text-xs text-blue-700">{editingItem.requestedQty} un ÷ {editingItem.unitsPerPackage} un/{editingItem.packagingType} = <strong>{Math.ceil(editingItem.requestedQty / editingItem.unitsPerPackage)} {editingItem.packagingType}(s)</strong></p>
                    <p className="text-xs text-blue-700">Total: {Math.ceil(editingItem.requestedQty / editingItem.unitsPerPackage)} × R$ {parseFloat(editingItem.unitPrice || '0').toFixed(2)} = <strong>R$ {(Math.ceil(editingItem.requestedQty / editingItem.unitsPerPackage) * parseFloat(editingItem.unitPrice || '0')).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-blue-700">Preço unitário: <strong>R$ {parseFloat(editingItem.unitPrice || '0').toFixed(2)}</strong></p>
                    <p className="text-xs text-blue-700">Total: {editingItem.requestedQty} × R$ {parseFloat(editingItem.unitPrice || '0').toFixed(2)} = <strong>R$ {(editingItem.requestedQty * parseFloat(editingItem.unitPrice || '0')).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
                  </>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Observações</label>
                <input type="text" className="w-full mt-1 px-3 py-2 border rounded-md text-sm" value={editingItem.notes} onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })} placeholder="Observações opcionais" />
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditingItem(null)}>Cancelar</Button>
                <Button className="flex-1" disabled={editProposalItemMutation.isPending} onClick={() => {
                  editProposalItemMutation.mutate({
                    proposalItemId: editingItem.proposalItemId,
                    quotationId,
                    unitPrice: editingItem.unitPrice,
                    packagingType: editingItem.packagingType,
                    unitsPerPackage: editingItem.unitsPerPackage,
                    brand: editingItem.brand || undefined,
                    notes: editingItem.notes || undefined,
                  });
                }}>
                  {editProposalItemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
            </Dialog>

      {/* Modal de Adicionar Preço - Item N/D */}
      <Dialog open={!!addingItem} onOpenChange={(open) => { if (!open) setAddingItem(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Adicionar Preço (Fornecedor informou depois)</DialogTitle>
          </DialogHeader>
          {addingItem && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="font-semibold text-sm">{addingItem.productName}</p>
                <p className="text-xs text-muted-foreground">Qtd solicitada: {addingItem.requestedQty} {addingItem.requestedUnit}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Preço Unitário (R$)</label>
                  <input type="number" step="0.01" min="0" className="w-full mt-1 px-3 py-2 border rounded-md text-sm" value={addingItem.unitPrice} onChange={(e) => setAddingItem({ ...addingItem, unitPrice: e.target.value })} placeholder="0.00" autoFocus />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Embalagem</label>
                  <select className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-background" value={addingItem.packagingType} onChange={(e) => setAddingItem({ ...addingItem, packagingType: e.target.value as any })}>
                    <option value="unidade">Unidade (KG/LT/UN)</option>
                    <option value="caixa">Caixa</option>
                    <option value="fardo">Fardo</option>
                    <option value="pacote">Pacote</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Un. por embalagem</label>
                  <input type="number" min="1" className="w-full mt-1 px-3 py-2 border rounded-md text-sm" value={addingItem.unitsPerPackage} onChange={(e) => setAddingItem({ ...addingItem, unitsPerPackage: parseInt(e.target.value) || 1 })} disabled={addingItem.packagingType === 'unidade'} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Marca</label>
                  <input type="text" className="w-full mt-1 px-3 py-2 border rounded-md text-sm" value={addingItem.brand} onChange={(e) => setAddingItem({ ...addingItem, brand: e.target.value })} placeholder="Ex: Cristal" />
                </div>
              </div>

              {/* Live calculation preview */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
                <p className="text-xs font-semibold text-green-800">Cálculo em tempo real:</p>
                {addingItem.packagingType !== 'unidade' && addingItem.unitsPerPackage > 1 ? (
                  <>
                    <p className="text-xs text-green-700">Preço por {addingItem.packagingType}: <strong>R$ {parseFloat(addingItem.unitPrice || '0').toFixed(2)}</strong></p>
                    <p className="text-xs text-green-700">÷ {addingItem.unitsPerPackage} un/embalagem</p>
                    <p className="text-sm font-bold text-green-900">= R$ {(parseFloat(addingItem.unitPrice || '0') / addingItem.unitsPerPackage).toFixed(4)} /unidade</p>
                    <hr className="border-green-200 my-1" />
                    <p className="text-xs text-green-700">{addingItem.requestedQty} un ÷ {addingItem.unitsPerPackage} un/{addingItem.packagingType} = <strong>{Math.ceil(addingItem.requestedQty / addingItem.unitsPerPackage)} {addingItem.packagingType}(s)</strong></p>
                    <p className="text-xs text-green-700">Total: {Math.ceil(addingItem.requestedQty / addingItem.unitsPerPackage)} × R$ {parseFloat(addingItem.unitPrice || '0').toFixed(2)} = <strong>R$ {(Math.ceil(addingItem.requestedQty / addingItem.unitsPerPackage) * parseFloat(addingItem.unitPrice || '0')).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-green-700">Preço unitário: <strong>R$ {parseFloat(addingItem.unitPrice || '0').toFixed(2)}</strong></p>
                    <p className="text-xs text-green-700">Total: {addingItem.requestedQty} × R$ {parseFloat(addingItem.unitPrice || '0').toFixed(2)} = <strong>R$ {(addingItem.requestedQty * parseFloat(addingItem.unitPrice || '0')).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
                  </>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Observações</label>
                <input type="text" className="w-full mt-1 px-3 py-2 border rounded-md text-sm" value={addingItem.notes} onChange={(e) => setAddingItem({ ...addingItem, notes: e.target.value })} placeholder="Ex: Informado via WhatsApp em 01/08" />
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setAddingItem(null)}>Cancelar</Button>
                <Button className="flex-1 bg-green-600 hover:bg-green-700" disabled={addProposalItemMutation.isPending || !addingItem.unitPrice} onClick={() => {
                  addProposalItemMutation.mutate({
                    proposalId: addingItem.proposalId,
                    quotationItemId: addingItem.quotationItemId,
                    quotationId,
                    unitPrice: addingItem.unitPrice,
                    packagingType: addingItem.packagingType,
                    unitsPerPackage: addingItem.unitsPerPackage,
                    brand: addingItem.brand || undefined,
                    notes: addingItem.notes || undefined,
                  });
                }}>
                  {addProposalItemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Adicionar Preço'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Item da Cotação (nome, qtd, unidade) */}
      <Dialog open={!!editItemModal} onOpenChange={(open) => { if (!open) setEditItemModal(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <span>✏️</span> Editar Item da Cotação
            </DialogTitle>
          </DialogHeader>
          {editItemModal && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Valor original:</p>
                <p className="font-semibold text-sm">{editItemModal.productName}</p>
                <p className="text-xs text-muted-foreground">{parseFloat(editItemModal.quantity).toLocaleString("pt-BR")} {editItemModal.unit}</p>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Nome do Produto</label>
                <input type="text" className="w-full border rounded-md px-3 py-2 text-sm" value={editItemForm.productName} onChange={(e) => setEditItemForm(f => ({ ...f, productName: e.target.value }))} />
              </div>

              {isMaster && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium block mb-1">Quantidade</label>
                    <input type="number" step="0.01" min="0" className="w-full border rounded-md px-3 py-2 text-sm" value={editItemForm.quantity} onChange={(e) => setEditItemForm(f => ({ ...f, quantity: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Unidade</label>
                    <select className="w-full border rounded-md px-3 py-2 text-sm" value={editItemForm.unit} onChange={(e) => setEditItemForm(f => ({ ...f, unit: e.target.value }))}>
                      <option value="KG">KG</option>
                      <option value="UN">UN</option>
                      <option value="PCT">PCT</option>
                      <option value="CX">CX</option>
                      <option value="FD">FD</option>
                      <option value="LT">LT</option>
                      <option value="SC">SC</option>
                      <option value="GL">GL</option>
                    </select>
                  </div>
                </div>
              )}

              {isMaster && ["CX", "FD", "PCT", "SC"].includes(editItemForm.unit) && (
                <div>
                  <label className="text-sm font-medium block mb-1">Quantas unidades por {editItemForm.unit.toLowerCase()}?</label>
                  <input type="number" min="1" className="w-full border rounded-md px-3 py-2 text-sm" value={editItemForm.unitsPerPackage} onChange={(e) => setEditItemForm(f => ({ ...f, unitsPerPackage: parseInt(e.target.value) || 1 }))} />
                  <p className="text-[10px] text-muted-foreground mt-1">Total real: {(parseFloat(editItemForm.quantity) || 0) * editItemForm.unitsPerPackage} unidades</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium block mb-1">Justificativa da Alteração <span className="text-red-500">*</span></label>
                <textarea className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px]" placeholder="Explique o motivo da alteração (ex: erro no Fortes, quantidade correta é 59)" value={editItemForm.justification} onChange={(e) => setEditItemForm(f => ({ ...f, justification: e.target.value }))} />
                {editItemForm.justification.length > 0 && editItemForm.justification.length < 10 && (
                  <p className="text-[10px] text-red-500 mt-0.5">Mínimo 10 caracteres</p>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                <p className="text-[11px] text-amber-700 font-medium flex items-center gap-1.5">
                  <span>🔒</span> Toda alteração é registrada na auditoria e notificada ao ADM Master.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditItemModal(null)}>Cancelar</Button>
                <Button className="flex-1" disabled={editItemMutation.isPending || editItemForm.justification.length < 10} onClick={() => {
                  editItemMutation.mutate({
                    itemId: editItemModal.id,
                    quotationId,
                    productName: editItemForm.productName !== editItemModal.productName ? editItemForm.productName : undefined,
                    quantity: editItemForm.quantity !== editItemModal.quantity ? editItemForm.quantity : undefined,
                    unit: editItemForm.unit !== editItemModal.unit ? editItemForm.unit : undefined,
                    unitsPerPackage: ["CX", "FD", "PCT", "SC"].includes(editItemForm.unit) ? editItemForm.unitsPerPackage : undefined,
                    justification: editItemForm.justification,
                  });
                }}>
                  {editItemMutation.isPending ? "Salvando..." : "Salvar Alteração"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Reabrir Cotação */}
      <Dialog open={showReopenDialog} onOpenChange={setShowReopenDialog}>
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
                Ao reabrir esta cotação, todos os pedidos gerados a partir dela serão <strong>cancelados automaticamente</strong>. A cotação voltará ao status "Aberta" para nova otimização.
              </p>
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <span>🔒</span> Esta ação é registrada na auditoria corporativa e notificada ao ADM Master.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Motivo da reabertura *</label>
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
              <Button variant="outline" onClick={() => { setShowReopenDialog(false); setReopenReason(""); }}>
                Cancelar
              </Button>
              <Button
                className="bg-orange-600 hover:bg-orange-700 text-white"
                disabled={reopenReason.length < 5 || reopenMutation.isPending}
                onClick={() => reopenMutation.mutate({ quotationId, reason: reopenReason })}
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
function PriceTargetWarning({ optimizationResult }: { optimizationResult: any }) {
  const allItems = optimizationResult?.suppliers?.flatMap((s: any) => s.items) || [];
  const itemsInput = allItems.map((i: any) => ({
    productName: i.productName,
    unitPrice: i.unitPrice,
    unit: i.unit || '',
  }));

  const { data: violations } = trpc.priceTargets.checkViolations.useQuery(
    { items: itemsInput },
    { enabled: itemsInput.length > 0 }
  );

  if (!violations || violations.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <p className="text-sm font-bold text-amber-700">
          {violations.length} produto(s) acima da meta de preço
        </p>
      </div>
      <div className="space-y-1">
        {violations.slice(0, 5).map((v, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs">
            <span className="text-amber-800 font-medium">{v.productName}</span>
            <span className="text-amber-700">
              R$ {v.unitPrice.toFixed(2)} <span className="text-red-600">(meta: R$ {v.maxPrice.toFixed(2)}, +{v.exceededPct.toFixed(0)}%)</span>
            </span>
          </div>
        ))}
        {violations.length > 5 && (
          <p className="text-xs text-amber-600 mt-1">...e mais {violations.length - 5} produto(s)</p>
        )}
      </div>
      <p className="text-[10px] text-amber-500 mt-2">Alertas serão gerados automaticamente ao fechar o pedido.</p>
    </div>
  );
}

  // Reupload PDF - apenas Master
