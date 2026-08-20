import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ShoppingCart, CheckCircle2, Truck, Package, XCircle, Clock, Download, Star, MessageCircle, Eye, MapPin, Trash2, FileSpreadsheet, Filter, AlertTriangle, Loader2, ArrowRightLeft, Plus, Pencil, Scissors, Camera, ImageIcon, Zap, Upload, Search, Send, Repeat2 } from "lucide-react";
import { PurchaseComparison } from "@/components/PurchaseComparison";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Input } from "@/components/ui/input";
import BrandAutocomplete from "@/components/BrandAutocomplete";

const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";

// Cache-bust: 2026-08-19T02:15 — Color mapping by sector/category
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
  // Try exact match first
  if (CATEGORY_COLORS[category]) return CATEGORY_COLORS[category];
  // Try partial match
  const key = Object.keys(CATEGORY_COLORS).find(k => category.toLowerCase().includes(k.toLowerCase()));
  return key ? CATEGORY_COLORS[key] : DEFAULT_CATEGORY_COLOR;
}

export default function Pedidos() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const isMaster = user?.email === MASTER_EMAIL;
  const isBuyerSenior = user?.role === "buyer_senior";
  const hasWriteAccess = isMaster || isBuyerSenior;
  const { data: ordersList, isLoading } = trpc.orders.list.useQuery();
  const { data: suppliersList } = trpc.suppliers.list.useQuery();
  const { data: unitsList } = trpc.units.list.useQuery();
  const [ratingOrder, setRatingOrder] = useState<any>(null);
  const [ratings, setRatings] = useState({ punctuality: 5, quality: 5, quantity: 5, service: 5 });
  const [ratingComments, setRatingComments] = useState("");

  const approveMutation = trpc.orders.approve.useMutation({
    onSuccess: () => { toast.success("Pedido aprovado!"); utils.orders.list.invalidate(); },
  });
  // sentMutation removed - Enviar ao Fornecedor step eliminated
  const deliveredMutation = trpc.orders.markDelivered.useMutation({
    onSuccess: () => { toast.success("Entrega confirmada!"); utils.orders.list.invalidate(); },
  });
  const cancelMutation = trpc.orders.cancel.useMutation({
    onSuccess: () => { toast.success("Pedido cancelado"); utils.orders.list.invalidate(); },
  });
  const deleteMutation = trpc.orders.delete.useMutation({
    onSuccess: () => { toast.success("Pedido excluído permanentemente"); utils.orders.list.invalidate(); },
    onError: (err) => { toast.error(err.message); },
  });
  const editItemMutation = trpc.orders.editItem.useMutation({
    onSuccess: () => { toast.success("Item atualizado!"); setEditingOrderItem(null); utils.orders.items.invalidate(); utils.orders.list.invalidate(); },
    onError: (err) => { toast.error(err.message); },
  });
  const [editingOrderItem, setEditingOrderItem] = useState<{ itemId: number; orderId: number; field: 'unitPrice' | 'quantity' | 'unit' | 'productName'; value: string } | null>(null);
  const deleteItemMutation = trpc.orders.deleteItem.useMutation({
    onSuccess: () => { toast.success("Item excluído!"); utils.orders.items.invalidate(); utils.orders.list.invalidate(); },
    onError: (err) => { toast.error(err.message); },
  });
  const addItemMutation = trpc.orders.addItem.useMutation({
    onSuccess: () => { toast.success("Item adicionado!"); setAddingItem(null); utils.orders.items.invalidate(); utils.orders.list.invalidate(); },
    onError: (err) => { toast.error(err.message); },
  });
  const [addingItem, setAddingItem] = useState<{ orderId: number; productName: string; quantity: string; unit: string; unitPrice: string; brand: string } | null>(null);
  const swapBrandMutation = trpc.orders.swapBrand.useMutation({
    onSuccess: () => { toast.success("Marca trocada com sucesso!"); setSwappingItem(null); utils.orders.items.invalidate(); utils.orders.list.invalidate(); },
    onError: (err) => { toast.error(err.message); },
  });
  const [swappingItem, setSwappingItem] = useState<{ itemId: number; orderId: number; productName: string; currentBrand: string; currentPrice: string } | null>(null);
  const [swapForm, setSwapForm] = useState({ newBrand: "", newUnitPrice: "", justification: "" });
  // Delivery Adjustment state
  const [adjustingItem, setAdjustingItem] = useState<{ itemId: number; orderId: number; productName: string; currentQty: number; currentPrice: string } | null>(null);
  const [adjustForm, setAdjustForm] = useState<{ type: "remove" | "reduce"; newQuantity: string; justification: string; invoicePhotoUrl: string }>({ type: "remove", newQuantity: "", justification: "", invoicePhotoUrl: "" });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const adjustDeliveryMutation = trpc.orders.adjustDelivery.useMutation({
    onSuccess: () => { toast.success("Ajuste de entrega registrado!"); setAdjustingItem(null); setAdjustForm({ type: "remove", newQuantity: "", justification: "", invoicePhotoUrl: "" }); setPhotoPreview(null); utils.orders.items.invalidate(); utils.orders.list.invalidate(); },
    onError: (err) => { toast.error(err.message); },
  });
  const rateMutation = trpc.orders.rate.useMutation({
    onSuccess: () => { toast.success("Avaliação registrada!"); setRatingOrder(null); utils.orders.list.invalidate(); },
  });

  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [filterUnit, setFilterUnit] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterSupplier, setFilterSupplier] = useState<string>("all");
  // Insufficient stock redirect - 2-step flow (quantities → ranking)
  const [insufficientOrder, setInsufficientOrder] = useState<any>(null);
  const [insufficientItems, setInsufficientItems] = useState<Array<{ productName: string; originalQuantity: number; availableQuantity: string }>>([]);
  const [insufficientStep, setInsufficientStep] = useState<'quantities' | 'ranking'>('quantities');
  const [alternativesData, setAlternativesData] = useState<Array<{
    productName: string;
    deficit: number;
    unit: string;
    originalQuantity: number;
    availableQuantity: number;
    alternatives: Array<{ rank: number; supplierId: number; supplierName: string; brand: string | null; unitPrice: number; totalForDeficit: number }>;
  }> | null>(null);
  const [chosenSuppliers, setChosenSuppliers] = useState<Record<string, number>>({});
  const [justifications, setJustifications] = useState<Record<string, string>>({});
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);
  const REDIRECT_EMAILS = [MASTER_EMAIL, "frotas.patrimonio@qualities.com.br"];
  const canRedirect = isMaster;
  // ==================== CONTROLE DE EDIÇÃO GRANULAR ====================
  const [priceJustModal, setPriceJustModal] = useState<{ itemId: number; orderId: number; oldPrice: string; newPrice: string } | null>(null);
  const [priceJustification, setPriceJustification] = useState("");
  const [qtyJustModal, setQtyJustModal] = useState<{ itemId: number; orderId: number; oldQty: string; newQty: string; productName: string } | null>(null);
  const [qtyJustification, setQtyJustification] = useState("");
  const [editRequestModal, setEditRequestModal] = useState<{ orderId: number; itemId?: number; type: "change_quantity" | "add_item" | "remove_item"; currentValue?: string; productName?: string } | null>(null);
  const [editRequestForm, setEditRequestForm] = useState({ newValue: "", justification: "" });
  const requestEditMutation = trpc.orders.requestEdit.useMutation({
    onSuccess: () => { toast.success("Solicitação enviada ao ADM Master para aprovação!"); setEditRequestModal(null); setEditRequestForm({ newValue: "", justification: "" }); },
    onError: (err) => { toast.error(err.message); },
  });
  // ==================== COMPRA EMERGENCIAL ====================
  const [emgOrder, setEmgOrder] = useState<any>(null);
  const [emgStep, setEmgStep] = useState<1 | 2 | 3 | 4>(1);
  const [emgPhotoUrl, setEmgPhotoUrl] = useState("");
  const [emgPhotoPreview, setEmgPhotoPreview] = useState<string | null>(null);
  const [emgUploading, setEmgUploading] = useState(false);
  const [emgAnalyzing, setEmgAnalyzing] = useState(false);
  const [emgDeficits, setEmgDeficits] = useState<Array<{ productName: string; requestedQty: number; receivedQty: number; deficit: number; unit: string; emergencyUnitPrice: string }>>([]);
  const [emgSupplierId, setEmgSupplierId] = useState<number>(0);
  const [emgJustification, setEmgJustification] = useState("");
  const [emgNfData, setEmgNfData] = useState<any>(null);
  const analyzeNfMutation = trpc.orders.analyzeInvoicePhoto.useMutation({
    onSuccess: (data) => {
      setEmgNfData(data.nfData);
      setEmgDeficits(data.deficits.map((d: any) => ({ ...d, emergencyUnitPrice: "" })));
      setEmgAnalyzing(false);
      setEmgStep(2);
      toast.success("NF analisada com sucesso!");
    },
    onError: (err) => { setEmgAnalyzing(false); toast.error("Erro ao analisar NF: " + err.message); },
  });
  const requestEmgMutation = trpc.orders.requestEmergencyPurchase.useMutation({
    onSuccess: () => {
      toast.success("Solicitação enviada ao ADM Master por e-mail! Aguarde aprovação.");
      setEmgOrder(null); setEmgStep(1); setEmgPhotoUrl(""); setEmgPhotoPreview(null); setEmgDeficits([]); setEmgSupplierId(0); setEmgJustification(""); setEmgNfData(null);
    },
    onError: (err) => { toast.error(err.message); },
  });
  const emgSuppliersList = trpc.suppliers.list.useQuery(undefined, { enabled: !!emgOrder });
  const resetEmg = () => { setEmgOrder(null); setEmgStep(1); setEmgPhotoUrl(""); setEmgPhotoPreview(null); setEmgDeficits([]); setEmgSupplierId(0); setEmgJustification(""); setEmgNfData(null); };

  // ==================== REMANEJAMENTO AUTOMÁTICO ====================
  const [remanejoModal, setRemanejoModal] = useState<{ orderId: number; itemId: number; productName: string; currentQty: number; unit: string; quotationId: number | null } | null>(null);
  const [remanejoStep, setRemanejoStep] = useState<1 | 2 | 3 | 4>(1);
  const [remanejoAvailQty, setRemanejoAvailQty] = useState("");
  const [remanejoPreview, setRemanejoPreview] = useState<any>(null);
  const [remanejoJustification, setRemanejoJustification] = useState("");
  const [remanejoResult, setRemanejoResult] = useState<any>(null);
  const remanejoPreviewMutation = trpc.remanejamento.preview.useMutation({
    onSuccess: (data) => { setRemanejoPreview(data); setRemanejoStep(2); },
    onError: (err) => { toast.error(err.message); },
  });
  const remanejoConfirmMutation = trpc.remanejamento.confirm.useMutation({
    onSuccess: (data) => { setRemanejoResult(data); setRemanejoStep(4); utils.orders.list.invalidate(); utils.orders.items.invalidate(); toast.success("Remanejamento concluído!"); },
    onError: (err) => { toast.error(err.message); },
  });
  const resetRemanejo = () => { setRemanejoModal(null); setRemanejoStep(1); setRemanejoAvailQty(""); setRemanejoPreview(null); setRemanejoJustification(""); setRemanejoResult(null); };

  const handleEmgPhotoUpload = async (file: File) => {
    setEmgUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const resp = await fetch('/api/upload-invoice', { method: 'POST', body: formData });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Erro no upload');
      setEmgPhotoUrl(data.url);
      setEmgPhotoPreview(URL.createObjectURL(file));
      toast.success("Foto da NF enviada!");
    } catch (err: any) { toast.error(err.message); }
    setEmgUploading(false);
  };

  const redirectMutation = trpc.quotations.redirectInsufficientStock.useMutation({
    onSuccess: (data) => {
      const orders = data.complementaryOrders;
      toast.success(`Redirecionamento concluído! ${orders.length} pedido(s) complementar(es) gerado(s): ${orders.map(o => `${o.supplierName} (R$ ${o.total.toFixed(2)})`).join(', ')}`);
      setInsufficientOrder(null);
      setInsufficientItems([]);
      setInsufficientStep('quantities');
      setAlternativesData(null);
      setChosenSuppliers({});
      setJustifications({});
      utils.orders.list.invalidate();
      utils.orders.items.invalidate();
    },
    onError: (err) => { toast.error(err.message || 'Erro ao redirecionar estoque insuficiente'); },
  });

  // Derive unique units from the full units list (not just from orders)
  const { uniqueUnits, uniqueCategories } = useMemo(() => {
    const categories = ordersList
      ? Array.from(new Set(ordersList.map((o: any) => o.category).filter(Boolean))).sort() as string[]
      : [];
    const units = unitsList
      ? unitsList.map((u: any) => u.name).sort() as string[]
      : ordersList
        ? Array.from(new Set(ordersList.map((o: any) => o.unitName).filter(Boolean))).sort() as string[]
        : [];
    return { uniqueUnits: units, uniqueCategories: categories };
  }, [ordersList, unitsList]);

  const getSupplierName = (id: number) => {
    const s = suppliersList?.find((s: any) => s.id === id);
    return s ? (s.tradeName || s.companyName) : `#${id}`;
  };

  const getSupplierWhatsApp = (id: number) => {
    const s = suppliersList?.find((s: any) => s.id === id);
    return s?.whatsapp || null;
  };

  const uniqueSuppliers = useMemo(() => {
    if (!ordersList) return [];
    const suppliers = Array.from(new Set(ordersList.map((o: any) => o.supplierId).filter(Boolean)));
    return suppliers.map(id => ({ id, name: getSupplierName(id as number) })).sort((a, b) => a.name.localeCompare(b.name));
  }, [ordersList, suppliersList]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    if (!ordersList) return [];
    return ordersList.filter((o: any) => {
      if (filterUnit !== "all" && o.unitName !== filterUnit) return false;
      if (filterCategory !== "all" && o.category !== filterCategory) return false;
      if (filterSupplier !== "all" && String(o.supplierId) !== filterSupplier) return false;
      if (filterStatus === "active") {
        if (o.status !== "pending_approval" && o.status !== "approved" && o.status !== "purchased") return false;
      } else if (filterStatus !== "all" && o.status !== filterStatus) return false;
      // Date filter
      if (filterDateFrom || filterDateTo) {
        const orderDate = o.createdAt ? new Date(o.createdAt).toISOString().split('T')[0] : '';
        if (filterDateFrom && orderDate < filterDateFrom) return false;
        if (filterDateTo && orderDate > filterDateTo) return false;
      }
      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const supplierName = getSupplierName(o.supplierId).toLowerCase();
        const unitName = (o.unitName || '').toLowerCase();
        const category = (o.category || '').toLowerCase();
        const code = (o.code || '').toLowerCase();
        const period = (o.consumptionPeriod || '').toLowerCase();
        if (!supplierName.includes(q) && !unitName.includes(q) && !category.includes(q) && !code.includes(q) && !period.includes(q)) return false;
      }
      return true;
    });
  }, [ordersList, filterUnit, filterCategory, filterSupplier, filterStatus, filterDateFrom, filterDateTo, searchQuery]);
  const { data: orderItems } = trpc.orders.items.useQuery(
    { orderId: expandedOrder! },
    { enabled: !!expandedOrder }
  );

  const sendWhatsApp = (order: any) => {
    const whatsapp = getSupplierWhatsApp(order.supplierId);
    if (!whatsapp) { toast.error("Fornecedor sem WhatsApp cadastrado"); return; }
    const phone = whatsapp.replace(/\D/g, '');
    const phoneFormatted = phone.startsWith('55') ? phone : `55${phone}`;
    const msg = `*PEDIDO DE COMPRA - Qualities Refeições*\n\nCódigo: ${order.code}\nFornecedor: ${getSupplierName(order.supplierId)}\nValor: R$ ${parseFloat(order.totalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\nData: ${order.createdAt ? new Date(order.createdAt).toLocaleDateString('pt-BR') : ''}\n\nPor favor, confirme o recebimento e prazo de entrega.`;
    window.open(`https://wa.me/${phoneFormatted}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleDownloadPDF = async (order: any) => {
    toast.info("Gerando PDF...");
    try {
      // Dynamically import jsPDF
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      // Fetch order items if not already loaded
      let items = orderItems && expandedOrder === order.id ? orderItems : null;
      if (!items) {
        // Fetch items via tRPC
        items = await utils.orders.items.fetch({ orderId: order.id });
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header bar
      doc.setFillColor(27, 42, 78); // dark navy
      doc.rect(0, 0, pageWidth, 35, 'F');

      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('PEDIDO DE COMPRA', 14, 16);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('QualiCompras — Qualities Refeições — Grupo Comenda', 14, 25);

      // Order code on right
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(order.code, pageWidth - 14, 16, { align: 'right' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const statusLabel = order.status === 'delivered' ? 'Entrega feita' : order.status === 'purchased' ? 'Compra feita' : order.status === 'sent' ? 'Enviado' : order.status === 'approved' ? 'Aprovado' : order.status === 'cancelled' ? 'Cancelado' : 'Pendente';
      doc.text(`Status: ${statusLabel}`, pageWidth - 14, 25, { align: 'right' });

      // Info section
      let y = 45;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Fornecedor:', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.text(getSupplierName(order.supplierId), 50, y);

      y += 7;
      doc.setFont('helvetica', 'bold');
      doc.text('Data:', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.text(order.createdAt ? new Date(order.createdAt).toLocaleDateString('pt-BR') : '—', 50, y);

      if (order.unitName) {
        y += 7;
        doc.setFont('helvetica', 'bold');
        doc.text('Unidade:', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.text(`${order.unitName}${order.unitState ? ' - ' + order.unitState : ''}`, 50, y);
      }

      if (order.category) {
        y += 7;
        doc.setFont('helvetica', 'bold');
        doc.text('Categoria:', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.text(order.category, 50, y);
      }

      if (order.period) {
        y += 7;
        doc.setFont('helvetica', 'bold');
        doc.text('Período:', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.text(`Consumo ${order.period}`, 50, y);
      }

      if (order.notes) {
        y += 7;
        doc.setFont('helvetica', 'bold');
        doc.text('Observações:', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.text(order.notes, 50, y);
      }

      // Separator
      y += 10;
      doc.setDrawColor(200, 200, 200);
      doc.line(14, y, pageWidth - 14, y);

      // Items table
      y += 5;
      if (items && items.length > 0) {
        const tableData = items.map((item: any) => {
          const qty = parseFloat(item.quantity);
          // Clean quantity display for supplier PDF
          // Just show "73" with the unit column handling the rest (KG, UN, PCT, etc.)
          // Only show packaging info if unitsPerPackage > 1 (meaningful packaging)
          const isPkg = item.packagingType && item.packagingType !== 'unidade';
          const unitsPerPkg = item.unitsPerPackage || 1;
          let qtyDisplay: string;
          if (isPkg && unitsPerPkg > 1) {
            // Meaningful packaging: e.g. "9 CX (18kg/cx)"
            const pkgLbl = item.packagingType === 'caixa' ? 'CX' : item.packagingType === 'fardo' ? 'FD' : item.packagingType === 'pacote' ? 'PC' : '';
            qtyDisplay = `${qty} ${pkgLbl} (${unitsPerPkg}${item.unit.toLowerCase()}/${pkgLbl.toLowerCase()})`;
          } else {
            // Simple: just the number
            qtyDisplay = qty % 1 === 0 ? String(Math.round(qty)) : qty.toLocaleString('pt-BR');
          }
          return [
            item.productName,
            qtyDisplay,
            item.unit,
            `R$ ${parseFloat(item.unitPrice).toFixed(2)}`,
            `R$ ${parseFloat(item.totalPrice).toFixed(2)}`,
          ];
        });

        autoTable(doc, {
          startY: y,
          head: [['Produto', 'Quantidade', 'Unid.', 'Preço Unit.', 'Total']],
          body: tableData,
          foot: [['', '', '', 'TOTAL:', `R$ ${parseFloat(order.totalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]],
          theme: 'grid',
          headStyles: { fillColor: [27, 42, 78], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
          footStyles: { fillColor: [240, 240, 240], textColor: [0, 100, 0], fontStyle: 'bold', fontSize: 10 },
          bodyStyles: { fontSize: 9 },
          columnStyles: {
            0: { cellWidth: 60 },
            3: { halign: 'right' },
            4: { halign: 'right', fontStyle: 'bold' },
          },
          margin: { left: 14, right: 14 },
        });
      } else {
        doc.setFontSize(10);
        doc.text('Itens não disponíveis', 14, y + 5);
      }

      // Footer
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text('QualiCompras — Central de Cota\u00e7\u00e3o Inteligente — Qualities Refei\u00e7\u00f5es — Grupo Comenda', pageWidth / 2, pageHeight - 10, { align: 'center' });

      // Save
      // On iOS/iPad, doc.save() triggers a download that can cause PWA to lose focus and logout.
      // Instead, open the PDF in a new tab as a blob URL which is safer on all platforms.
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${order.code}.pdf`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      // Cleanup after a short delay
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 1000);
      toast.success('PDF do pedido baixado!');
    } catch (err: any) {
      console.error('PDF generation error:', err);
      toast.error('Erro ao gerar PDF: ' + (err.message || 'Tente novamente'));
    }
  };

  const handleExportFortes = async (order: any) => {
    toast.info("Gerando CSV para Fortes...");
    try {
      const downloadUrl = `/api/orders/${order.id}/csv`;
      const fileName = `FORTES-${order.code || 'PEDIDO'}.csv`;

      // Fetch the CSV file as blob
      const response = await fetch(downloadUrl, { credentials: 'include' });
      if (!response.ok) throw new Error('Falha ao gerar CSV');
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: 'text/csv' });

      // Try Web Share API (iOS/Android native share sheet)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `CSV Fortes - ${order.code}`,
          files: [file],
        });
        toast.success('CSV compartilhado com sucesso');
        return;
      }

      // Fallback: force download with object URL
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
      toast.success(`CSV baixado: ${fileName}`);
    } catch (err: any) {
      if (err.name === 'AbortError') return; // User cancelled share
      console.error('Fortes export error:', err);
      toast.error('Erro ao exportar CSV: ' + (err.message || 'Tente novamente'));
    }
  };

  const handleRate = () => {
    if (!ratingOrder) return;
    rateMutation.mutate({
      orderId: ratingOrder.id,
      supplierId: ratingOrder.supplierId,
      ...ratings,
      comments: ratingComments || undefined,
    });
  };

  const statusConfig: Record<string, { label: string; icon: any; color: string; variant: any }> = {
    pending_approval: { label: "Aguardando Aprovação", icon: Clock, color: "text-amber-500", variant: "outline" },
    approved: { label: "Aprovado", icon: CheckCircle2, color: "text-blue-500", variant: "default" },
    purchased: { label: "Compra feita", icon: ShoppingCart, color: "text-purple-500", variant: "secondary" },
    sent: { label: "Enviado", icon: Truck, color: "text-purple-500", variant: "secondary" },
    delivered: { label: "Entrega feita", icon: Package, color: "text-green-500", variant: "default" },
    cancelled: { label: "Cancelado", icon: XCircle, color: "text-red-500", variant: "destructive" },
  };

  const purchasedMutation = trpc.orders.markPurchased.useMutation({
    onSuccess: () => { toast.success("Compra confirmada!"); utils.orders.list.invalidate(); },
    onError: (err) => { toast.error(err.message); },
  });

  const StarRating = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button" onClick={() => onChange(i)} className="p-0.5">
          <Star className={`h-5 w-5 ${i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
        </button>
      ))}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pedidos de Compra</h1>
          <p className="text-muted-foreground mt-1">Workflow completo: aprovação, compra e confirmação de entrega</p>
        </div>

        {/* Filters */}
        {ordersList && ordersList.length > 0 && (
          <div className="space-y-2">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por fornecedor, unidade, setor, código ou período..."
                className="h-10 w-full pl-9 pr-10 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchQuery("")}
                >
                  <XCircle className="h-4 w-4" />
                </button>
              )}
            </div>
            {/* Filter selects */}
            <div className="flex flex-wrap items-center gap-2 bg-muted/40 rounded-lg p-3 border">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <select
                className="h-9 px-3 text-sm border rounded-md bg-background min-w-[140px]"
                value={filterUnit}
                onChange={e => setFilterUnit(e.target.value)}
              >
                <option value="all">Todas Unidades</option>
                {uniqueUnits.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <select
                className="h-9 px-3 text-sm border rounded-md bg-background min-w-[130px]"
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
              >
                <option value="all">Todos Setores</option>
                {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                className="h-9 px-3 text-sm border rounded-md bg-background min-w-[150px]"
                value={filterSupplier}
                onChange={e => setFilterSupplier(e.target.value)}
              >
                <option value="all">Todos Fornecedores</option>
                {uniqueSuppliers.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
              </select>
              <select
                className="h-9 px-3 text-sm border rounded-md bg-background min-w-[130px]"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
              >
                <option value="active">Ativos (pendentes + aprovados + compra feita)</option>
                <option value="all">Todos Status</option>
                <option value="pending_approval">Aguardando</option>
                <option value="approved">Aprovado</option>
                <option value="purchased">Compra feita</option>
                <option value="delivered">Entrega feita</option>
                <option value="cancelled">Cancelado</option>
              </select>
              <div className="flex items-center gap-1">
                <label className="text-xs text-muted-foreground whitespace-nowrap">De:</label>
                <input
                  type="date"
                  className="h-9 px-2 text-sm border rounded-md bg-background w-[130px]"
                  value={filterDateFrom}
                  onChange={e => setFilterDateFrom(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-xs text-muted-foreground whitespace-nowrap">Até:</label>
                <input
                  type="date"
                  className="h-9 px-2 text-sm border rounded-md bg-background w-[130px]"
                  value={filterDateTo}
                  onChange={e => setFilterDateTo(e.target.value)}
                />
              </div>
              {(filterUnit !== "all" || filterCategory !== "all" || filterSupplier !== "all" || (filterStatus !== "all" && filterStatus !== "active") || filterDateFrom || filterDateTo || searchQuery) && (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
                  onClick={() => { setFilterUnit("all"); setFilterCategory("all"); setFilterSupplier("all"); setFilterStatus("active"); setFilterDateFrom(""); setFilterDateTo(""); setSearchQuery(""); }}
                >
                  Limpar filtros
                </button>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {filteredOrders.length} de {ordersList.length} pedidos
              </span>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-6 h-20" /></Card>)}
          </div>
        ) : !ordersList || ordersList.length === 0 ? (
          <Card><CardContent className="p-12 text-center"><ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" /><p className="text-muted-foreground">Nenhum pedido de compra</p><p className="text-xs text-muted-foreground mt-1">Pedidos são gerados automaticamente a partir de propostas aprovadas nas cotações</p></CardContent></Card>
        ) : filteredOrders.length === 0 ? (
          <Card><CardContent className="p-8 text-center"><Filter className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" /><p className="text-muted-foreground">Nenhum pedido com os filtros selecionados</p></CardContent></Card>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order: any) => {
              const config = statusConfig[order.status] || statusConfig.pending_approval;
              const StatusIcon = config.icon;
              const displaySupplier = order.supplierName || getSupplierName(order.supplierId);
              return (
                <Card key={order.id} className={`hover:shadow-sm transition-shadow border-l-4 ${getCategoryColor(order.category).border}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${getCategoryColor(order.category).iconBg}`}>
                          <StatusIcon className={`h-5 w-5 ${config.color}`} />
                        </div>
                        <div className="min-w-0">
                          {/* Primary line: Unit + Period + Sector - 20% larger */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-base leading-snug">
                              {order.unitName || 'Sem unidade'}
                            </h3>
                            <Badge variant={config.variant} className="text-[0.8rem] leading-tight">{config.label}</Badge>
                            {order.code?.startsWith('EMG-') && <Badge className="bg-orange-500 text-white text-[0.7rem] leading-tight">EMG</Badge>}
                            {order.category && (
                              <span className={`text-[12px] font-semibold px-2 py-0.5 rounded-full ${getCategoryColor(order.category).bg} ${getCategoryColor(order.category).text}`}>
                                {order.category}
                              </span>
                            )}
                            {order.period && (
                              <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                                📅 {order.period}
                              </span>
                            )}
                          </div>
                          {/* Secondary line: Supplier + Value + Date - 20% larger */}
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="text-sm font-medium text-foreground leading-snug">{displaySupplier}</span>
                            <span className="text-sm text-muted-foreground">•</span>
                            <span className="text-sm font-semibold text-green-700 leading-snug">R$ {parseFloat(order.totalValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                            {order.createdAt && <><span className="text-sm text-muted-foreground">•</span><span className="text-sm text-muted-foreground leading-snug">{new Date(order.createdAt).toLocaleDateString("pt-BR")}</span></>}
                          </div>
                          {/* Tertiary line: Code (small, secondary) - 20% larger */}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[12px] text-muted-foreground font-mono leading-snug">{order.code}</span>
                            {order.unitName && order.unitState && (
                              <>
                                <span className="text-[12px] text-muted-foreground">•</span>
                                <span className="flex items-center gap-0.5">
                                  <MapPin className="h-2.5 w-2.5 text-blue-600" />
                                  <span className="text-[12px] text-blue-700 leading-snug">{order.unitState}</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 shrink-0 flex-wrap justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)} title="Ver Itens">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDownloadPDF(order)} title="Baixar Pedido">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        {(order.status === "approved" || order.status === "purchased" || order.status === "delivered") && (
                          <Button size="sm" variant="ghost" className="text-teal-700" onClick={() => handleExportFortes(order)} title="Exportar para Fortes (CSV)">
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {hasWriteAccess && (
                          <Button size="sm" variant="ghost" className="text-green-700" onClick={() => sendWhatsApp(order)} title="Enviar WhatsApp">
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {hasWriteAccess && order.status === "pending_approval" && (
                          <>
                            <Button size="sm" onClick={() => approveMutation.mutate({ id: order.id })}>Aprovar</Button>
                            <Button size="sm" variant="outline" onClick={() => cancelMutation.mutate({ id: order.id })}>Cancelar</Button>
                          </>
                        )}
                        {hasWriteAccess && order.status === "approved" && (
                          <Button size="sm" variant="outline" className="text-sm" disabled={purchasedMutation.isPending} onClick={() => purchasedMutation.mutate({ id: order.id })}>
                            <ShoppingCart className="h-3.5 w-3.5 mr-1" />Compra feita
                          </Button>
                        )}
                        {hasWriteAccess && order.status === "purchased" && (
                          <Button size="sm" variant="outline" className="text-sm" disabled={deliveredMutation.isPending} onClick={() => deliveredMutation.mutate({ id: order.id })}>
                            <Package className="h-3.5 w-3.5 mr-1" />Entregue
                          </Button>
                        )}
                        {hasWriteAccess && order.status === "delivered" && (
                          <Button size="sm" variant="outline" onClick={() => { setRatingOrder(order); setRatings({ punctuality: 5, quality: 5, quantity: 5, service: 5 }); setRatingComments(""); }}>
                            <Star className="h-3.5 w-3.5 mr-1" />Avaliar
                          </Button>
                        )}
                        {canRedirect && order.quotationId && order.status !== 'cancelled' && (
                          <Button size="sm" variant="ghost" className="text-amber-600 hover:text-amber-700 hover:bg-amber-50" onClick={async () => {
                            const items = await utils.orders.items.fetch({ orderId: order.id });
                            setInsufficientOrder(order);
                            setInsufficientItems(items.map((it: any) => ({ productName: it.productName, originalQuantity: parseFloat(it.quantity), availableQuantity: '' })));
                          }} title="Estoque Insuficiente - Redirecionar para 2º melhor preço">
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canRedirect && order.status !== 'cancelled' && (
                          <Button size="sm" variant="ghost" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50" onClick={() => { setEmgOrder(order); setEmgStep(1); }} title="Compra Emergencial (entrega insuficiente)">
                            <Zap className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {hasWriteAccess && (
                          <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => { if (confirm(`Excluir permanentemente o pedido ${order.code}? Esta ação não pode ser desfeita.`)) deleteMutation.mutate({ id: order.id }); }} title="Excluir Pedido">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                  {/* Expandable items section */}
                  {expandedOrder === order.id && (
                    <div className="border-t px-4 pb-3 pt-2">
                      {orderItems && orderItems.length > 0 ? (
                        <>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b text-left">
                              <th className="py-1 px-2 font-medium">Produto</th>
                              <th className="py-1 px-2 text-center font-medium">Marca</th>
                              <th className="py-1 px-2 text-center font-medium">Qtd</th>
                              <th className="py-1 px-2 text-center font-medium">Unid.</th>
                              <th className="py-1 px-2 text-right font-medium">Unit.</th>
                              <th className="py-1 px-2 text-right font-medium">Total</th>
                              {hasWriteAccess && <th className="py-1 px-2 text-center font-medium">Ação</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {(orderItems || []).map((item: any) => {
                              const isPkg = item.packagingType && item.packagingType !== "unidade";
                              const pkgLbl = item.packagingType === "caixa" ? "CX" : item.packagingType === "fardo" ? "FD" : item.packagingType === "pacote" ? "PC" : "";
                              const qty = parseFloat(item.quantity);
                              const unitsPerPkg = item.unitsPerPackage || 1;
                              return (
                              <tr key={item.id} className="border-b">
                                <td className="py-1 px-2">
                                  {hasWriteAccess && editingOrderItem?.itemId === item.id && editingOrderItem?.field === 'productName' ? (
                                    <div className="flex items-center gap-1">
                                      <input type="text" className="w-32 text-[10px] border rounded px-1 py-0.5" value={editingOrderItem!.value} onChange={(e) => setEditingOrderItem({ ...editingOrderItem!, value: e.target.value })} autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && editingOrderItem!.value) editItemMutation.mutate({ itemId: item.id, orderId: expandedOrder!, productName: editingOrderItem!.value }); if (e.key === 'Escape') setEditingOrderItem(null); }} />
                                      <button className="text-green-600 text-[10px] font-bold" onClick={() => editingOrderItem!.value && editItemMutation.mutate({ itemId: item.id, orderId: expandedOrder!, productName: editingOrderItem!.value })}>\u2713</button>
                                      <button className="text-red-600 text-[10px] font-bold" onClick={() => setEditingOrderItem(null)}>\u2717</button>
                                    </div>
                                  ) : (
                                    <span className={hasWriteAccess ? "cursor-pointer hover:text-blue-600" : ""} onClick={() => hasWriteAccess && setEditingOrderItem({ itemId: item.id, orderId: expandedOrder!, field: 'productName', value: item.productName })} title={hasWriteAccess ? "Clique para editar nome" : ""}>
                                      {item.productName}
                                    </span>
                                  )}
                                  {isPkg && <div className="text-[9px] text-blue-600">{qty} {pkgLbl} ({unitsPerPkg} un/{pkgLbl.toLowerCase()}) = {qty * unitsPerPkg} un totais</div>}
                                </td>
                                <td className="py-1 px-2 text-center text-[10px]">
                                  {item.brand || <span className="text-muted-foreground">-</span>}
                                </td>
                                <td className="py-1 px-2 text-center">
                  {hasWriteAccess && editingOrderItem?.itemId === item.id && editingOrderItem?.field === 'quantity' ? (
                    <div className="flex items-center gap-1 justify-center">
                      <input type="number" step="0.001" min="0" className="w-14 text-[10px] border rounded px-1 py-0.5 text-center" value={editingOrderItem!.value} onChange={(e) => setEditingOrderItem({ ...editingOrderItem!, value: e.target.value })} autoFocus onKeyDown={(e) => {
                        if (e.key === 'Enter' && editingOrderItem!.value) {
                          if (isMaster) { editItemMutation.mutate({ itemId: item.id, orderId: expandedOrder!, quantity: editingOrderItem!.value }); }
                          else { setQtyJustModal({ itemId: item.id, orderId: expandedOrder!, oldQty: String(qty), newQty: editingOrderItem!.value, productName: item.productName }); }
                        }
                        if (e.key === 'Escape') setEditingOrderItem(null);
                      }} />
                      <button className="text-green-600 text-[10px] font-bold" onClick={() => {
                        if (!editingOrderItem!.value) return;
                        if (isMaster) { editItemMutation.mutate({ itemId: item.id, orderId: expandedOrder!, quantity: editingOrderItem!.value }); }
                        else { setQtyJustModal({ itemId: item.id, orderId: expandedOrder!, oldQty: String(qty), newQty: editingOrderItem!.value, productName: item.productName }); }
                      }}>{"\u2713"}</button>
                      <button className="text-red-600 text-[10px] font-bold" onClick={() => setEditingOrderItem(null)}>{"\u2717"}</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 justify-center">
                      <span className={(isMaster || isBuyerSenior) ? "cursor-pointer hover:text-blue-600" : ""} onClick={() => (isMaster || isBuyerSenior) && setEditingOrderItem({ itemId: item.id, orderId: expandedOrder!, field: 'quantity', value: String(qty) })} title={(isMaster || isBuyerSenior) ? "Clique para editar quantidade" : ""}>
                        {qty.toLocaleString('pt-BR')}{isPkg && <span className="text-[9px] text-blue-600 ml-0.5"> {pkgLbl}</span>}
                      </span>
                    </div>
                  )}
                                </td>
                                <td className="py-1 px-2 text-center">
                                  {hasWriteAccess && editingOrderItem?.itemId === item.id && editingOrderItem?.field === 'unit' ? (
                                    <div className="flex items-center gap-1 justify-center">
                                      <input type="text" className="w-12 text-[10px] border rounded px-1 py-0.5 text-center" value={editingOrderItem!.value} onChange={(e) => setEditingOrderItem({ ...editingOrderItem!, value: e.target.value })} autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && editingOrderItem!.value) editItemMutation.mutate({ itemId: item.id, orderId: expandedOrder!, unit: editingOrderItem!.value }); if (e.key === 'Escape') setEditingOrderItem(null); }} />
                                      <button className="text-green-600 text-[10px] font-bold" onClick={() => editingOrderItem!.value && editItemMutation.mutate({ itemId: item.id, orderId: expandedOrder!, unit: editingOrderItem!.value })}>\u2713</button>
                                      <button className="text-red-600 text-[10px] font-bold" onClick={() => setEditingOrderItem(null)}>\u2717</button>
                                    </div>
                                  ) : (
                                    <span className={hasWriteAccess ? "cursor-pointer hover:text-blue-600" : ""} onClick={() => hasWriteAccess && setEditingOrderItem({ itemId: item.id, orderId: expandedOrder!, field: 'unit', value: item.unit })} title={hasWriteAccess ? "Clique para editar unidade" : ""}>
                                      {item.unit}
                                    </span>
                                  )}
                                </td>
                                <td className="py-1 px-2 text-right">
                                  {hasWriteAccess && editingOrderItem?.itemId === item.id && editingOrderItem?.field === 'unitPrice' ? (
                                    <div className="flex items-center gap-1 justify-end">
                                      <input type="number" step="0.01" min="0" className="w-16 text-[10px] border rounded px-1 py-0.5 text-right" value={editingOrderItem!.value} onChange={(e) => setEditingOrderItem({ ...editingOrderItem!, value: e.target.value })} autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && editingOrderItem!.value) editItemMutation.mutate({ itemId: item.id, orderId: expandedOrder!, unitPrice: editingOrderItem!.value }); if (e.key === 'Escape') setEditingOrderItem(null); }} />
                                      <button className="text-green-600 text-[10px] font-bold" onClick={() => {
                                        if (!editingOrderItem!.value) return;
                                        const newP = parseFloat(editingOrderItem!.value);
                                        const oldP = parseFloat(item.unitPrice);
                                        if (!isMaster && newP > oldP) {
                                          setPriceJustModal({ itemId: item.id, orderId: expandedOrder!, oldPrice: item.unitPrice, newPrice: editingOrderItem!.value });
                                        } else {
                                          editItemMutation.mutate({ itemId: item.id, orderId: expandedOrder!, unitPrice: editingOrderItem!.value });
                                        }
                                      }}>✓</button>
                                      <button className="text-red-600 text-[10px] font-bold" onClick={() => setEditingOrderItem(null)}>\u2717</button>
                                    </div>
                                  ) : (
                                    <span className={hasWriteAccess ? "cursor-pointer hover:text-blue-600" : ""} onClick={() => hasWriteAccess && setEditingOrderItem({ itemId: item.id, orderId: expandedOrder!, field: 'unitPrice', value: parseFloat(item.unitPrice).toFixed(2) })} title={hasWriteAccess ? "Clique para editar" : ""}>
                                      R$ {parseFloat(item.unitPrice).toFixed(2)}{hasWriteAccess && <span className="text-[8px] ml-0.5 text-blue-400">\u270f\ufe0f</span>}
                                    </span>
                                  )}
                                </td>
                                <td className="py-1 px-2 text-right font-semibold">R$ {parseFloat(item.totalPrice).toFixed(2)}</td>
                                {hasWriteAccess && (
                                  <td className="py-1 px-2 text-center">
                                    <div className="flex items-center gap-1 justify-center">
                                      <button
                                        className="text-[9px] text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded px-1 py-0.5 border border-purple-200 transition-colors"
                                        onClick={() => { setSwappingItem({ itemId: item.id, orderId: expandedOrder!, productName: item.productName, currentBrand: item.brand || "", currentPrice: parseFloat(item.unitPrice).toFixed(2) }); setSwapForm({ newBrand: item.brand || "", newUnitPrice: parseFloat(item.unitPrice).toFixed(2), justification: "" }); }}
                                        title="Trocar marca"
                                      >
                                        <ArrowRightLeft className="h-3 w-3" />
                                      </button>
                                      <button
                        className="text-[9px] text-red-600 hover:text-red-800 hover:bg-red-50 rounded px-1 py-0.5 border border-red-200 transition-colors"
                        onClick={() => {
                          if (isMaster) {
                            if (confirm(`Excluir "${item.productName}" deste pedido?`)) deleteItemMutation.mutate({ itemId: item.id, orderId: expandedOrder! });
                          } else {
                            setEditRequestModal({ orderId: expandedOrder!, itemId: item.id, type: "remove_item", currentValue: JSON.stringify({ productName: item.productName, quantity: qty, unit: item.unit }), productName: item.productName });
                          }
                        }}
                        title={isMaster ? "Excluir item" : "Solicitar exclusão ao ADM Master. Preencha o formulário com justificativa → o pedido será enviado para aprovação → após aprovação, o item será removido."}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                      <button
                        className="text-[9px] text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded px-1 py-0.5 border border-amber-200 transition-colors"
                        onClick={() => { setAdjustingItem({ itemId: item.id, orderId: expandedOrder!, productName: item.productName, currentQty: parseFloat(item.quantity), currentPrice: item.unitPrice }); setAdjustForm({ type: "remove", newQuantity: "", justification: "", invoicePhotoUrl: "" }); setPhotoPreview(null); }}
                        title="Ajustar Entrega (com NF)"
                      >
                       <Scissors className="h-3 w-3" />
                     </button>
                      {order.quotationId && (order.status === "approved" || order.status === "sent" || order.status === "purchased") && (
                      <button
                        className="text-[9px] text-cyan-600 hover:text-cyan-800 hover:bg-cyan-50 rounded px-1 py-0.5 border border-cyan-200 transition-colors"
                        onClick={() => { setRemanejoModal({ orderId: expandedOrder!, itemId: item.id, productName: item.productName, currentQty: parseFloat(item.quantity), unit: item.unit, quotationId: order.quotationId }); setRemanejoStep(1); setRemanejoAvailQty(""); setRemanejoPreview(null); setRemanejoJustification(""); setRemanejoResult(null); }}
                        title="Remanejar saldo — Fornecedor não tem a quantidade total? Informe a quantidade disponível e o sistema buscará automaticamente o melhor fornecedor alternativo elegível."
                      >
                        <Repeat2 className="h-3 w-3" />
                      </button>
                      )}
                    </div>
                                  </td>
                                )}
                              </tr>
                              );
                            })}
                            {/* Add Item Row */}
                            {hasWriteAccess && addingItem?.orderId === expandedOrder && (
                              <tr className="border-b bg-green-50/50 dark:bg-green-900/10">
                                <td className="py-1 px-2"><input type="text" placeholder="Nome do produto" className="w-full text-[10px] border rounded px-1 py-0.5" value={addingItem.productName} onChange={(e) => setAddingItem({ ...addingItem, productName: e.target.value })} /></td>
                                <td className="py-1 px-2 text-center"><input type="text" placeholder="Marca" className="w-16 text-[10px] border rounded px-1 py-0.5 text-center" value={addingItem.brand} onChange={(e) => setAddingItem({ ...addingItem, brand: e.target.value })} /></td>
                                <td className="py-1 px-2 text-center"><input type="number" step="0.001" placeholder="Qtd" className="w-14 text-[10px] border rounded px-1 py-0.5 text-center" value={addingItem.quantity} onChange={(e) => setAddingItem({ ...addingItem, quantity: e.target.value })} /></td>
                                <td className="py-1 px-2 text-center"><input type="text" placeholder="UN" className="w-10 text-[10px] border rounded px-1 py-0.5 text-center" value={addingItem.unit} onChange={(e) => setAddingItem({ ...addingItem, unit: e.target.value })} /></td>
                                <td className="py-1 px-2 text-right"><input type="number" step="0.01" placeholder="Pre\u00e7o" className="w-16 text-[10px] border rounded px-1 py-0.5 text-right" value={addingItem.unitPrice} onChange={(e) => setAddingItem({ ...addingItem, unitPrice: e.target.value })} /></td>
                                <td className="py-1 px-2 text-right text-[10px] text-muted-foreground">{addingItem.quantity && addingItem.unitPrice ? `R$ ${(parseFloat(addingItem.quantity || '0') * parseFloat(addingItem.unitPrice || '0')).toFixed(2)}` : '-'}</td>
                                <td className="py-1 px-2 text-center">
                                  <div className="flex items-center gap-1 justify-center">
                                    <button className="text-green-600 text-[10px] font-bold" onClick={() => { if (addingItem.productName && addingItem.quantity && addingItem.unit && addingItem.unitPrice) addItemMutation.mutate({ orderId: expandedOrder!, productName: addingItem.productName, quantity: addingItem.quantity, unit: addingItem.unit, unitPrice: addingItem.unitPrice, brand: addingItem.brand || undefined }); else toast.error('Preencha todos os campos'); }} title="Confirmar">\u2713</button>
                                    <button className="text-red-600 text-[10px] font-bold" onClick={() => setAddingItem(null)} title="Cancelar">\u2717</button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                          <tfoot>
                            <tr className="bg-muted/50">
                              <td colSpan={hasWriteAccess ? 6 : 5} className="py-2 px-2 font-bold text-sm text-right">TOTAL DO PEDIDO:</td>
                              <td className="py-2 px-2 text-right font-bold text-sm text-green-700">R$ {(orderItems || []).reduce((sum: number, item: any) => sum + parseFloat(item.totalPrice), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          </tfoot>
                        </table>
                        {hasWriteAccess && !addingItem && (
                          <button
                            className="mt-2 text-[10px] text-green-700 hover:text-green-900 hover:bg-green-50 rounded px-2 py-1 border border-green-200 transition-colors flex items-center gap-1"
                            onClick={() => setAddingItem({ orderId: expandedOrder!, productName: '', quantity: '', unit: 'KG', unitPrice: '', brand: '' })}
                          >
                            <Plus className="h-3 w-3" />Adicionar Item
                          </button>
                        )}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Carregando itens...</p>
                      )}
                      {/* Historical Comparison Panel */}
                      <PurchaseComparison orderId={order.id} />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Insufficient Stock Redirect Dialog - 2-step flow */}
      <Dialog open={!!insufficientOrder} onOpenChange={() => { setInsufficientOrder(null); setInsufficientItems([]); setInsufficientStep('quantities'); setAlternativesData(null); setChosenSuppliers({}); setJustifications({}); }}>
        <DialogContent className={insufficientStep === 'ranking' ? '!max-w-[90vw] !max-h-[90vh]' : 'max-w-lg'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {insufficientStep === 'quantities' ? 'Estoque Insuficiente' : 'Ranking de Alternativas'}
            </DialogTitle>
          </DialogHeader>
          {insufficientOrder && insufficientStep === 'quantities' && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Fornecedor: <strong>{insufficientOrder.supplierName || getSupplierName(insufficientOrder.supplierId)}</strong><br/>
                Pedido: <strong>{insufficientOrder.code}</strong>
              </p>
              <p className="text-sm">Informe a quantidade que o fornecedor <strong>realmente tem</strong> para cada item.</p>
              <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                {insufficientItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 rounded border bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">Pedido original: {item.originalQuantity}</p>
                    </div>
                    <div className="w-24 shrink-0">
                      <Input
                        type="number"
                        min="0"
                        max={item.originalQuantity}
                        step="1"
                        placeholder="Tem..."
                        value={item.availableQuantity}
                        onChange={(e) => {
                          const updated = [...insufficientItems];
                          updated[idx] = { ...updated[idx], availableQuantity: e.target.value };
                          setInsufficientItems(updated);
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                    {item.availableQuantity !== '' && parseFloat(item.availableQuantity) < item.originalQuantity && (
                      <span className="text-xs text-amber-600 font-medium shrink-0">
                        Déficit: {(item.originalQuantity - parseFloat(item.availableQuantity)).toFixed(0)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <Button
                className="w-full"
                disabled={loadingAlternatives || !insufficientItems.some(it => it.availableQuantity !== '' && parseFloat(it.availableQuantity) < it.originalQuantity)}
                onClick={async () => {
                  const itemsToCheck = insufficientItems
                    .filter(it => it.availableQuantity !== '' && parseFloat(it.availableQuantity) < it.originalQuantity)
                    .map(it => ({ productName: it.productName, originalQuantity: it.originalQuantity, availableQuantity: parseFloat(it.availableQuantity) }));
                  if (itemsToCheck.length === 0) { toast.error('Informe a quantidade disponível para pelo menos um item'); return; }
                  setLoadingAlternatives(true);
                  try {
                    const data = await utils.quotations.getStockAlternatives.fetch({
                      quotationId: insufficientOrder.quotationId,
                      orderId: insufficientOrder.id,
                      items: itemsToCheck,
                    });
                    setAlternativesData(data);
                    // Pre-select the best (rank 1) for each item
                    const preSelected: Record<string, number> = {};
                    for (const item of data) {
                      if (item.alternatives.length > 0) {
                        preSelected[item.productName] = item.alternatives[0].supplierId;
                      }
                    }
                    setChosenSuppliers(preSelected);
                    setJustifications({});
                    setInsufficientStep('ranking');
                  } catch (err: any) {
                    toast.error(err.message || 'Erro ao buscar alternativas');
                  } finally {
                    setLoadingAlternatives(false);
                  }
                }}
              >
                {loadingAlternatives ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Buscando alternativas...</> : <><Eye className="h-4 w-4 mr-2" />Ver Alternativas</>}
              </Button>
            </div>
          )}
          {insufficientOrder && insufficientStep === 'ranking' && alternativesData && (
            <div className="space-y-4 pt-2 overflow-y-auto max-h-[70vh]">
              <p className="text-sm text-muted-foreground">
                Fornecedor original: <strong>{insufficientOrder.supplierName || getSupplierName(insufficientOrder.supplierId)}</strong> | Pedido: <strong>{insufficientOrder.code}</strong>
              </p>
              <p className="text-sm">Selecione o fornecedor alternativo para cada item com déficit. O <strong>2º melhor preço</strong> está destacado em verde. Se escolher outro, justifique.</p>
              {alternativesData.map((item) => (
                <div key={item.productName} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">Déficit: <strong>{item.deficit} {item.unit}</strong> (tinha {item.availableQuantity} de {item.originalQuantity})</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {item.alternatives.map((alt) => {
                      const isSelected = chosenSuppliers[item.productName] === alt.supplierId;
                      const isBest = alt.rank === 1;
                      return (
                        <div
                          key={alt.supplierId}
                          onClick={() => {
                            setChosenSuppliers(prev => ({ ...prev, [item.productName]: alt.supplierId }));
                            // Clear justification if selecting best
                            if (isBest) {
                              setJustifications(prev => { const n = { ...prev }; delete n[item.productName]; return n; });
                            }
                          }}
                          className={`flex items-center gap-3 p-2 rounded border cursor-pointer transition-all ${
                            isSelected
                              ? isBest ? 'border-green-500 bg-green-50 ring-2 ring-green-200' : 'border-amber-500 bg-amber-50 ring-2 ring-amber-200'
                              : isBest ? 'border-green-200 bg-green-50/50 hover:bg-green-50' : 'border-border hover:bg-muted/50'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                          }`}>
                            {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {isBest && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500 text-green-700 bg-green-50">2º MELHOR PREÇO</Badge>}
                              <span className="text-sm font-medium">{alt.supplierName}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Marca: {alt.brand || 'N/I'} | Preço unit.: R$ {alt.unitPrice.toFixed(2)} | Total: R$ {alt.totalForDeficit.toFixed(2)}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-xs shrink-0">#{alt.rank}</Badge>
                        </div>
                      );
                    })}
                  </div>
                  {/* Justification required if not selecting best (rank 1) */}
                  {chosenSuppliers[item.productName] && (() => {
                    const bestSupplierId = item.alternatives[0]?.supplierId;
                    const needsJustification = chosenSuppliers[item.productName] !== bestSupplierId;
                    if (!needsJustification) return null;
                    return (
                      <div className="mt-2">
                        <Label className="text-xs text-amber-700">Justificativa obrigatória (não escolheu o 2º melhor preço):</Label>
                        <Textarea
                          value={justifications[item.productName] || ''}
                          onChange={(e) => setJustifications(prev => ({ ...prev, [item.productName]: e.target.value }))}
                          placeholder="Ex: Marca de melhor qualidade, prazo de entrega mais rápido..."
                          className="mt-1 h-16 text-sm"
                        />
                      </div>
                    );
                  })()}
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setInsufficientStep('quantities')} className="flex-1">
                  Voltar
                </Button>
                <Button
                  className="flex-1"
                  disabled={redirectMutation.isPending || (() => {
                    // Check all items have a chosen supplier and justification if needed
                    for (const item of alternativesData) {
                      if (!chosenSuppliers[item.productName]) return true;
                      const bestSupplierId = item.alternatives[0]?.supplierId;
                      if (chosenSuppliers[item.productName] !== bestSupplierId && !justifications[item.productName]?.trim()) return true;
                    }
                    return false;
                  })()}
                  onClick={() => {
                    const itemsToRedirect = alternativesData.map(item => ({
                      productName: item.productName,
                      originalQuantity: item.originalQuantity,
                      availableQuantity: item.availableQuantity,
                      chosenSupplierId: chosenSuppliers[item.productName],
                      justification: justifications[item.productName] || null,
                    }));
                    redirectMutation.mutate({
                      quotationId: insufficientOrder.quotationId,
                      orderId: insufficientOrder.id,
                      items: itemsToRedirect,
                    });
                  }}
                >
                  {redirectMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Redirecionando...</> : <><CheckCircle2 className="h-4 w-4 mr-2" />Confirmar Redirecionamento</>}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rating Dialog */}
      <Dialog open={!!ratingOrder} onOpenChange={() => setRatingOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Avaliar Entrega - {ratingOrder?.code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <Label>Pontualidade</Label>
              <StarRating value={ratings.punctuality} onChange={v => setRatings({ ...ratings, punctuality: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Qualidade</Label>
              <StarRating value={ratings.quality} onChange={v => setRatings({ ...ratings, quality: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Quantidade</Label>
              <StarRating value={ratings.quantity} onChange={v => setRatings({ ...ratings, quantity: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Atendimento</Label>
              <StarRating value={ratings.service} onChange={v => setRatings({ ...ratings, service: v })} />
            </div>
            <div>
              <Label>Comentários (opcional)</Label>
              <Textarea value={ratingComments} onChange={e => setRatingComments(e.target.value)} placeholder="Observações sobre a entrega..." className="mt-1" />
            </div>
            <Button onClick={handleRate} className="w-full" disabled={rateMutation.isPending}>
              {rateMutation.isPending ? "Salvando..." : "Registrar Avaliação"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Swap Brand Dialog */}
      <Dialog open={!!swappingItem} onOpenChange={() => setSwappingItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-purple-600" />
              Trocar Marca
            </DialogTitle>
          </DialogHeader>
          {swappingItem && (
            <div className="space-y-4 pt-2">
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium">{swappingItem.productName}</p>
                <p className="text-xs text-muted-foreground">Marca atual: <span className="font-medium text-foreground">{swappingItem.currentBrand || "Sem marca"}</span></p>
                <p className="text-xs text-muted-foreground">Preço atual: <span className="font-medium text-foreground">R$ {swappingItem.currentPrice}</span></p>
              </div>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-medium">Nova Marca</Label>
                  <BrandAutocomplete
                    value={swapForm.newBrand}
                    onChange={(val) => setSwapForm({ ...swapForm, newBrand: val })}
                    productName={swappingItem.productName}
                    placeholder="Ex: Betânia, Italac, Piracanjuba..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Novo Preço Unitário (R$)</Label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full border rounded-md px-3 py-2 text-sm mt-1"
                    placeholder="0.00"
                    value={swapForm.newUnitPrice}
                    onChange={(e) => setSwapForm({ ...swapForm, newUnitPrice: e.target.value })}
                  />
                  {swapForm.newUnitPrice && swappingItem.currentPrice && (
                    <p className={`text-[10px] mt-1 ${parseFloat(swapForm.newUnitPrice) > parseFloat(swappingItem.currentPrice) ? 'text-red-600' : 'text-green-600'}`}>
                      {parseFloat(swapForm.newUnitPrice) > parseFloat(swappingItem.currentPrice)
                        ? `+R$ ${(parseFloat(swapForm.newUnitPrice) - parseFloat(swappingItem.currentPrice)).toFixed(2)} a mais`
                        : parseFloat(swapForm.newUnitPrice) < parseFloat(swappingItem.currentPrice)
                        ? `-R$ ${(parseFloat(swappingItem.currentPrice) - parseFloat(swapForm.newUnitPrice)).toFixed(2)} economia`
                        : "Mesmo preço"}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs font-medium">Justificativa (opcional)</Label>
                  <Textarea
                    className="text-sm mt-1"
                    placeholder="Ex: Fornecedor sem estoque da marca anterior"
                    value={swapForm.justification}
                    onChange={(e) => setSwapForm({ ...swapForm, justification: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>
              <Button
                className="w-full bg-purple-600 hover:bg-purple-700"
                disabled={!swapForm.newBrand || !swapForm.newUnitPrice || swapBrandMutation.isPending}
                onClick={() => {
                  swapBrandMutation.mutate({
                    itemId: swappingItem.itemId,
                    orderId: swappingItem.orderId,
                    newBrand: swapForm.newBrand,
                    newUnitPrice: swapForm.newUnitPrice,
                    justification: swapForm.justification,
                  });
                }}
              >
                {swapBrandMutation.isPending ? "Trocando..." : "Confirmar Troca de Marca"}
              </Button>
            </div>
          )}
        </DialogContent>
    </Dialog>

      {/* Delivery Adjustment Dialog */}
      <Dialog open={!!adjustingItem} onOpenChange={() => { setAdjustingItem(null); setPhotoPreview(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-amber-500" />
              Ajuste de Entrega
            </DialogTitle>
          </DialogHeader>
          {adjustingItem && (
            <div className="space-y-4 pt-2">
              <p className="text-xs text-amber-600 flex items-center gap-1 -mt-2">
                <span>🔒</span> Todas as ações são registradas na auditoria corporativa.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 !mt-2">
                <p className="text-sm font-medium text-amber-800">Produto: {adjustingItem.productName}</p>
                <p className="text-xs text-amber-600">Quantidade atual: {adjustingItem.currentQty} | Preço: R$ {parseFloat(adjustingItem.currentPrice).toFixed(2)}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipo de Ajuste</Label>
                <div className="flex gap-2">
                  <Button size="sm" variant={adjustForm.type === "remove" ? "default" : "outline"} onClick={() => setAdjustForm({ ...adjustForm, type: "remove" })} className="flex-1">
                    Remover Item
                  </Button>
                  <Button size="sm" variant={adjustForm.type === "reduce" ? "default" : "outline"} onClick={() => setAdjustForm({ ...adjustForm, type: "reduce" })} className="flex-1">
                    Reduzir Quantidade
                  </Button>
                </div>
              </div>

              {adjustForm.type === "reduce" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Nova Quantidade (deve ser menor que {adjustingItem.currentQty})</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0.001"
                    max={adjustingItem.currentQty - 0.001}
                    placeholder="Ex: 3"
                    value={adjustForm.newQuantity}
                    onChange={(e) => setAdjustForm({ ...adjustForm, newQuantity: e.target.value })}
                  />
                  {adjustForm.newQuantity && parseFloat(adjustForm.newQuantity) >= adjustingItem.currentQty && (
                    <p className="text-xs text-red-600">Quantidade deve ser MENOR que a atual ({adjustingItem.currentQty})</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-medium">Justificativa (obrigatória)</Label>
                <Textarea
                  placeholder="Explique o motivo do ajuste (mín. 10 caracteres). Ex: Fornecedor não tinha o item em estoque na data da entrega."
                  value={adjustForm.justification}
                  onChange={(e) => setAdjustForm({ ...adjustForm, justification: e.target.value })}
                  rows={3}
                />
                {adjustForm.justification.length > 0 && adjustForm.justification.length < 10 && (
                  <p className="text-xs text-red-600">Mínimo 10 caracteres ({adjustForm.justification.length}/10)</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1">
                  <Camera className="h-4 w-4" /> Foto da Nota Fiscal (obrigatória)
                </Label>
                {!adjustForm.invoicePhotoUrl ? (
                  <div className="border-2 border-dashed border-amber-300 rounded-lg p-4 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="invoice-photo-input"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) { toast.error("Arquivo muito grande. Máximo: 5MB"); return; }
                        setUploadingPhoto(true);
                        setPhotoPreview(URL.createObjectURL(file));
                        try {
                          const formData = new FormData();
                          formData.append('file', file);
                          const res = await fetch('/api/upload-invoice', { method: 'POST', body: formData });
                          if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Erro no upload'); }
                          const { url } = await res.json();
                          setAdjustForm(prev => ({ ...prev, invoicePhotoUrl: url }));
                          toast.success("Foto enviada!");
                        } catch (err: any) {
                          toast.error(err.message || "Erro ao enviar foto");
                          setPhotoPreview(null);
                        } finally {
                          setUploadingPhoto(false);
                        }
                      }}
                    />
                    <label htmlFor="invoice-photo-input" className="cursor-pointer flex flex-col items-center gap-2">
                      {uploadingPhoto ? (
                        <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-amber-400" />
                      )}
                      <span className="text-sm text-amber-700">{uploadingPhoto ? "Enviando..." : "Clique para tirar foto ou selecionar imagem"}</span>
                      <span className="text-xs text-muted-foreground">JPEG, PNG, WEBP (máx 5MB)</span>
                    </label>
                  </div>
                ) : (
                  <div className="relative border rounded-lg overflow-hidden">
                    <img src={photoPreview || adjustForm.invoicePhotoUrl} alt="Nota Fiscal" className="w-full h-40 object-cover" />
                    <button
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      onClick={() => { setAdjustForm(prev => ({ ...prev, invoicePhotoUrl: "" })); setPhotoPreview(null); }}
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded">Foto enviada</div>
                  </div>
                )}
              </div>

              <Button
                className="w-full"
                disabled={
                  adjustForm.justification.length < 10 ||
                  !adjustForm.invoicePhotoUrl ||
                  (adjustForm.type === "reduce" && (!adjustForm.newQuantity || parseFloat(adjustForm.newQuantity) >= adjustingItem.currentQty || parseFloat(adjustForm.newQuantity) <= 0)) ||
                  adjustDeliveryMutation.isPending
                }
                onClick={() => {
                  adjustDeliveryMutation.mutate({
                    orderId: adjustingItem.orderId,
                    itemId: adjustingItem.itemId,
                    type: adjustForm.type,
                    newQuantity: adjustForm.type === "reduce" ? adjustForm.newQuantity : undefined,
                    justification: adjustForm.justification,
                    invoicePhotoUrl: adjustForm.invoicePhotoUrl,
                  });
                }}
              >
                {adjustDeliveryMutation.isPending ? "Processando..." : adjustForm.type === "remove" ? "Confirmar Remoção do Item" : "Confirmar Redução de Quantidade"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* ==================== DIALOG COMPRA EMERGENCIAL ==================== */}
      <Dialog open={!!emgOrder} onOpenChange={() => resetEmg()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-700">
              <Zap className="h-5 w-5" />
              Compra Emergencial {emgOrder?.code && `— ${emgOrder.code}`}
            </DialogTitle>
            <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
              <span>🔒</span> Requer aprovação do ADM Master por e-mail.
            </p>
          </DialogHeader>
          <div className="flex items-center gap-1 mb-3">
            {[1,2,3,4].map(s => (
              <div key={s} className={`flex-1 h-1.5 rounded-full ${emgStep >= s ? 'bg-orange-500' : 'bg-gray-200'}`} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Etapa {emgStep}/4: {emgStep === 1 ? 'Upload da Nota Fiscal' : emgStep === 2 ? 'Revisão do Déficit' : emgStep === 3 ? 'Fornecedor e Preços' : 'Justificativa e Envio'}
          </p>
          {emgStep === 1 && (
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm text-orange-800 font-medium">Faça upload da Nota Fiscal</p>
                <p className="text-xs text-orange-700 mt-1">O sistema vai ler automaticamente os itens e quantidades da NF e comparar com o pedido original para calcular o déficit.</p>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                {emgPhotoPreview ? (
                  <div className="space-y-2">
                    <img src={emgPhotoPreview} alt="NF" className="max-h-48 mx-auto rounded-lg shadow" />
                    <p className="text-xs text-green-600 font-medium">✓ Foto enviada</p>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <Camera className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">Clique para fotografar ou selecionar a NF</p>
                    <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WEBP — máx. 5MB</p>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleEmgPhotoUpload(f); }} />
                  </label>
                )}
                {emgUploading && <div className="flex items-center justify-center gap-2 mt-2"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-xs">Enviando...</span></div>}
              </div>
              <Button className="w-full bg-orange-600 hover:bg-orange-700 text-white" disabled={!emgPhotoUrl || emgAnalyzing} onClick={() => { setEmgAnalyzing(true); analyzeNfMutation.mutate({ orderId: emgOrder.id, invoicePhotoUrl: emgPhotoUrl }); }}>
                {emgAnalyzing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analisando NF com IA...</> : <><Search className="h-4 w-4 mr-2" />Analisar Nota Fiscal</>}
              </Button>
            </div>
          )}
          {emgStep === 2 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800 font-medium">Confira o déficit calculado</p>
                <p className="text-xs text-blue-700 mt-1">A IA leu a NF e comparou com o pedido. Ajuste manualmente se necessário.</p>
              </div>
              {emgNfData?.supplierName && <p className="text-xs text-muted-foreground">Fornecedor na NF: <strong>{emgNfData.supplierName}</strong> | NF: {emgNfData.invoiceNumber || '—'}</p>}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b"><th className="py-1 px-1 text-left">Produto</th><th className="py-1 px-1 text-center">Pedido</th><th className="py-1 px-1 text-center">Recebido</th><th className="py-1 px-1 text-center font-bold text-red-600">Déficit</th></tr></thead>
                  <tbody>
                    {emgDeficits.map((d, i) => (
                      <tr key={i} className={`border-b ${d.deficit > 0 ? '' : 'opacity-40'}`}>
                        <td className="py-1 px-1 text-[11px]">{d.productName}</td>
                        <td className="py-1 px-1 text-center">{d.requestedQty} {d.unit}</td>
                        <td className="py-1 px-1 text-center">
                          <input type="number" step="0.01" min="0" className="w-16 text-center border rounded px-1 py-0.5 text-[11px]" value={d.receivedQty} onChange={(e) => { const v = parseFloat(e.target.value) || 0; const newD = [...emgDeficits]; newD[i] = { ...d, receivedQty: v, deficit: Math.max(0, d.requestedQty - v) }; setEmgDeficits(newD); }} />
                        </td>
                        <td className={`py-1 px-1 text-center font-bold ${d.deficit > 0 ? 'text-red-600' : 'text-green-600'}`}>{d.deficit > 0 ? d.deficit : '✓'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {emgDeficits.filter(d => d.deficit > 0).length === 0 && <p className="text-sm text-green-600 text-center font-medium">Todos os itens recebidos corretamente.</p>}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEmgStep(1)} className="flex-1">Voltar</Button>
                <Button className="flex-1 bg-orange-600 hover:bg-orange-700 text-white" disabled={emgDeficits.filter(d => d.deficit > 0).length === 0} onClick={() => setEmgStep(3)}>Próximo: Fornecedor</Button>
              </div>
            </div>
          )}
          {emgStep === 3 && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Fornecedor Emergencial *</Label>
                <select className="w-full mt-1 h-9 px-2 text-sm border rounded-md bg-background" value={emgSupplierId} onChange={(e) => setEmgSupplierId(Number(e.target.value))}>
                  <option value={0}>Selecione o fornecedor...</option>
                  {(emgSuppliersList.data || []).map((s: any) => (
                    <option key={s.id} value={s.id}>{s.tradeName || s.companyName}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-sm font-medium">Preço unitário de cada item *</Label>
                <div className="space-y-2 mt-2">
                  {emgDeficits.filter(d => d.deficit > 0).map((d, i) => {
                    const idx = emgDeficits.findIndex(x => x.productName === d.productName);
                    return (
                      <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                        <span className="text-xs flex-1 min-w-0 truncate">{d.productName} ({d.deficit} {d.unit})</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">R$</span>
                          <input type="text" inputMode="text" className="w-20 text-sm border rounded px-2 py-1 text-right" placeholder="0,00" value={d.emergencyUnitPrice} onChange={(e) => { const newD = [...emgDeficits]; newD[idx] = { ...d, emergencyUnitPrice: e.target.value.replace(',', '.') }; setEmgDeficits(newD); }} />
                        </div>
                        {d.emergencyUnitPrice && <span className="text-xs text-muted-foreground whitespace-nowrap">= R$ {(d.deficit * (parseFloat(d.emergencyUnitPrice) || 0)).toFixed(2)}</span>}
                      </div>
                    );
                  })}
                </div>
                {emgDeficits.filter(d => d.deficit > 0 && d.emergencyUnitPrice).length > 0 && (
                  <p className="text-sm font-bold text-right mt-2">Total: R$ {emgDeficits.filter(d => d.deficit > 0).reduce((sum, d) => sum + d.deficit * (parseFloat(d.emergencyUnitPrice) || 0), 0).toFixed(2)}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEmgStep(2)} className="flex-1">Voltar</Button>
                <Button className="flex-1 bg-orange-600 hover:bg-orange-700 text-white" disabled={!emgSupplierId || emgDeficits.filter(d => d.deficit > 0).some(d => !d.emergencyUnitPrice || parseFloat(d.emergencyUnitPrice) <= 0)} onClick={() => setEmgStep(4)}>Próximo: Justificativa</Button>
              </div>
            </div>
          )}
          {emgStep === 4 && (
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium text-orange-800">Resumo da Compra Emergencial</p>
                <p className="text-xs text-orange-700">Pedido original: <strong>{emgOrder?.code}</strong></p>
                <p className="text-xs text-orange-700">Fornecedor emergencial: <strong>{(emgSuppliersList.data || []).find((s: any) => s.id === emgSupplierId)?.tradeName || (emgSuppliersList.data || []).find((s: any) => s.id === emgSupplierId)?.companyName || '—'}</strong></p>
                <p className="text-xs text-orange-700">Itens com déficit: <strong>{emgDeficits.filter(d => d.deficit > 0).length}</strong></p>
                <p className="text-sm font-bold text-orange-900">Total: R$ {emgDeficits.filter(d => d.deficit > 0).reduce((sum, d) => sum + d.deficit * (parseFloat(d.emergencyUnitPrice) || 0), 0).toFixed(2)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Justificativa detalhada * (mín. 20 caracteres)</Label>
                <Textarea className="mt-1" rows={3} placeholder="Explique por que a compra emergencial é necessária..." value={emgJustification} onChange={(e) => setEmgJustification(e.target.value)} />
                {emgJustification.length > 0 && emgJustification.length < 20 && <p className="text-xs text-red-500 mt-1">Mínimo 20 caracteres ({emgJustification.length}/20)</p>}
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-700 flex items-center gap-1"><span>🔒</span> Esta solicitação será enviada ao ADM Master para aprovação por e-mail. O pedido emergencial só será gerado após aprovação. O CSV Fortes só ficará disponível quando tudo estiver validado.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEmgStep(3)} className="flex-1">Voltar</Button>
                <Button className="flex-1 bg-orange-600 hover:bg-orange-700 text-white" disabled={emgJustification.length < 20 || requestEmgMutation.isPending} onClick={() => {
                  requestEmgMutation.mutate({
                    originalOrderId: emgOrder.id,
                    invoicePhotoUrl: emgPhotoUrl,
                    deficitItems: emgDeficits.filter(d => d.deficit > 0).map(d => ({ productName: d.productName, requestedQty: d.requestedQty, receivedQty: d.receivedQty, deficit: d.deficit, unit: d.unit, emergencyUnitPrice: parseFloat(d.emergencyUnitPrice) || 0 })),
                    emergencySupplierId: emgSupplierId,
                    justification: emgJustification,
                    nfAnalysis: emgNfData,
                  });
                }}>
                  {requestEmgMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enviando...</> : <><Send className="h-4 w-4 mr-2" />Enviar para Aprovação</>}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Justificativa de Aumento de Preço */}
      <Dialog open={!!priceJustModal} onOpenChange={() => { setPriceJustModal(null); setPriceJustification(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" /> Justificativa Obrigatória
            </DialogTitle>
            <p className="text-xs text-amber-600 mt-1">🔒 Alteração de preço para valor superior registrada na auditoria corporativa da Qualities.</p>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              <div className="flex justify-between"><span>Preço atual:</span><span className="font-bold">R$ {priceJustModal ? parseFloat(priceJustModal.oldPrice).toFixed(2) : ""}</span></div>
              <div className="flex justify-between text-red-600"><span>Novo preço:</span><span className="font-bold">R$ {priceJustModal ? parseFloat(priceJustModal.newPrice).toFixed(2) : ""}</span></div>
            </div>
            <div>
              <label className="text-sm font-medium">Justificativa formal (mín. 10 caracteres):</label>
              <textarea className="w-full mt-1 border rounded-lg p-2 text-sm min-h-[80px]" placeholder="Explique o motivo do aumento de preço..." value={priceJustification} onChange={(e) => setPriceJustification(e.target.value)} />
              <p className="text-[10px] text-gray-400 mt-1">{priceJustification.length}/10 caracteres</p>
            </div>
            <Button className="w-full" disabled={priceJustification.length < 10 || editItemMutation.isPending} onClick={() => {
              if (priceJustModal) {
                editItemMutation.mutate({ itemId: priceJustModal.itemId, orderId: priceJustModal.orderId, unitPrice: priceJustModal.newPrice, priceJustification });
                setPriceJustModal(null); setPriceJustification("");
              }
            }}>
              {editItemMutation.isPending ? "Salvando..." : "Confirmar Alteração"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Justificativa de Alteração de Quantidade (Júnior) */}
      <Dialog open={!!qtyJustModal} onOpenChange={() => { setQtyJustModal(null); setQtyJustification(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-blue-700">Alterar Quantidade</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{qtyJustModal?.productName}</p>
            <div className="bg-blue-50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span>Quantidade atual:</span><span className="font-bold">{qtyJustModal?.oldQty}</span></div>
              <div className="flex justify-between text-blue-700"><span>Nova quantidade:</span><span className="font-bold">{qtyJustModal?.newQty}</span></div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Justificativa obrigatória:</label>
              <textarea className="w-full mt-1 border rounded-lg p-2 text-sm min-h-[60px]" placeholder="Ex: Fornecedor informou que só tem 60 unidades disponíveis" value={qtyJustification} onChange={(e) => setQtyJustification(e.target.value)} />
              <p className="text-[10px] text-gray-400 mt-1">{qtyJustification.length}/10 caracteres</p>
            </div>
            <p className="text-[9px] text-gray-400">Registrado na auditoria.</p>
            <Button className="w-full" disabled={qtyJustification.length < 10 || editItemMutation.isPending} onClick={() => {
              if (qtyJustModal) {
                editItemMutation.mutate({ itemId: qtyJustModal.itemId, orderId: qtyJustModal.orderId, quantity: qtyJustModal.newQty, quantityJustification: qtyJustification });
                setQtyJustModal(null); setQtyJustification(""); setEditingOrderItem(null);
              }
            }}>
              {editItemMutation.isPending ? "Salvando..." : "Confirmar Alteração"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Modal: Solicitação de Edição (Quantidade/Adicionar/Excluir) */}
      <Dialog open={!!editRequestModal} onOpenChange={() => { setEditRequestModal(null); setEditRequestForm({ newValue: "", justification: "" }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-700">
              <FileText className="h-5 w-5" />
              {editRequestModal?.type === "change_quantity" ? "Solicitar Alteração de Quantidade" : editRequestModal?.type === "add_item" ? "Solicitar Adição de Item" : "Solicitar Exclusão de Item"}
            </DialogTitle>
            <p className="text-xs text-amber-600 mt-1">🔒 Esta solicitação será enviada ao ADM Master para aprovação. Registrada na auditoria corporativa da Qualities.</p>
          </DialogHeader>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 space-y-1">
            <p className="font-semibold">Como funciona:</p>
            <p>1. Preencha o formulário abaixo com a justificativa detalhada</p>
            <p>2. A solicitação será enviada por e-mail ao ADM Master</p>
            <p>3. O Master analisa e aprova ou rejeita a solicitação</p>
            <p>4. Após aprovação, a alteração é aplicada automaticamente</p>
            <p className="text-amber-700 font-medium mt-1">⚠️ Limite: 2 solicitações por item. Tudo registrado na auditoria.</p>
          </div>
          <div className="space-y-3 mt-2">
            {editRequestModal?.productName && (
              <div className="bg-gray-50 border rounded-lg p-3 text-sm">
                <span className="font-medium">Item:</span> {editRequestModal.productName}
                {editRequestModal.currentValue && <span className="ml-2 text-gray-500">(Qtd atual: {editRequestModal.currentValue})</span>}
              </div>
            )}
            {editRequestModal?.type === "change_quantity" && (
              <div>
                <label className="text-sm font-medium">Nova quantidade:</label>
                <input type="number" step="0.001" min="0" className="w-full mt-1 border rounded-lg p-2 text-sm" placeholder="Digite a nova quantidade" value={editRequestForm.newValue} onChange={(e) => setEditRequestForm({ ...editRequestForm, newValue: e.target.value })} />
              </div>
            )}
            {editRequestModal?.type === "add_item" && (
              <div>
                <label className="text-sm font-medium">Dados do novo item (nome, qtd, unidade, preço):</label>
                <textarea className="w-full mt-1 border rounded-lg p-2 text-sm min-h-[60px]" placeholder='Ex: "Arroz 5kg, 10 pct, R$ 25.00"' value={editRequestForm.newValue} onChange={(e) => setEditRequestForm({ ...editRequestForm, newValue: e.target.value })} />
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Justificativa detalhada (mín. 30 caracteres):</label>
              <textarea className="w-full mt-1 border rounded-lg p-2 text-sm min-h-[100px]" placeholder="Explique detalhadamente o motivo desta alteração em relação ao que foi solicitado originalmente..." value={editRequestForm.justification} onChange={(e) => setEditRequestForm({ ...editRequestForm, justification: e.target.value })} />
              <p className="text-[10px] text-gray-400 mt-1">{editRequestForm.justification.length}/30 caracteres • Limite: 2 solicitações por item</p>
            </div>
            <Button className="w-full" disabled={editRequestForm.justification.length < 30 || requestEditMutation.isPending || (editRequestModal?.type === "change_quantity" && !editRequestForm.newValue)} onClick={() => {
              if (editRequestModal) {
                requestEditMutation.mutate({
                  orderId: editRequestModal.orderId,
                  itemId: editRequestModal.itemId,
                  requestType: editRequestModal.type,
                  currentValue: editRequestModal.currentValue,
                  newValue: editRequestModal.type === "change_quantity" ? JSON.stringify({ quantity: editRequestForm.newValue }) : editRequestForm.newValue || undefined,
                  justification: editRequestForm.justification,
                });
              }
            }}>
              {requestEditMutation.isPending ? "Enviando..." : "Enviar Solicitação ao ADM Master"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================== MODAL REMANEJAMENTO AUTOMÁTICO ==================== */}
      <Dialog open={!!remanejoModal} onOpenChange={(open) => { if (!open) resetRemanejo(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Repeat2 className="h-5 w-5 text-cyan-600" />
              Remanejar Saldo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Step 1: Informar quantidade disponível */}
            {remanejoStep === 1 && remanejoModal && (
              <div className="space-y-4">
                <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-cyan-800">Produto: <span className="font-bold">{remanejoModal.productName}</span></p>
                  <p className="text-sm text-cyan-700 mt-1">Quantidade solicitada: <span className="font-bold">{remanejoModal.currentQty} {remanejoModal.unit}</span></p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Quantidade disponível do fornecedor:</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    max={remanejoModal.currentQty - 0.001}
                    className="mt-1"
                    placeholder={`Menor que ${remanejoModal.currentQty}`}
                    value={remanejoAvailQty}
                    onChange={(e) => setRemanejoAvailQty(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Informe quanto o fornecedor realmente tem disponível. O sistema buscará automaticamente o melhor fornecedor alternativo para o saldo restante.</p>
                </div>
                <Button
                  className="w-full"
                  disabled={!remanejoAvailQty || parseFloat(remanejoAvailQty) >= remanejoModal.currentQty || parseFloat(remanejoAvailQty) < 0 || remanejoPreviewMutation.isPending}
                  onClick={() => {
                    remanejoPreviewMutation.mutate({
                      orderId: remanejoModal.orderId,
                      productName: remanejoModal.productName,
                      availableQuantity: parseFloat(remanejoAvailQty),
                    });
                  }}
                >
                  {remanejoPreviewMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Buscando alternativa...</> : "Buscar Fornecedor Alternativo"}
                </Button>
              </div>
            )}
            {/* Step 2: Preview */}
            {remanejoStep === 2 && remanejoPreview && remanejoModal && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-blue-50 rounded-lg p-2">
                    <p className="text-[10px] text-blue-600 font-medium">Original</p>
                    <p className="text-lg font-bold text-blue-800">{remanejoPreview.originalQuantity}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2">
                    <p className="text-[10px] text-green-600 font-medium">Disponível</p>
                    <p className="text-lg font-bold text-green-800">{remanejoPreview.availableQuantity}</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-2">
                    <p className="text-[10px] text-orange-600 font-medium">Déficit</p>
                    <p className="text-lg font-bold text-orange-800">{remanejoPreview.deficit}</p>
                  </div>
                </div>
                <div className="border rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium">Fornecedor Original:</p>
                  <p className="text-sm text-muted-foreground">{remanejoPreview.originalSupplier.name} — R$ {remanejoPreview.originalSupplier.unitPrice.toFixed(2)}/un</p>
                </div>
                {remanejoPreview.hasAlternative ? (
                  <div className="border border-green-300 bg-green-50 rounded-lg p-3 space-y-2">
                    <p className="text-sm font-medium text-green-800">✅ Alternativa encontrada ({remanejoPreview.alternative.rank}º melhor preço elegível):</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Fornecedor:</span> <span className="font-medium">{remanejoPreview.alternative.supplierName}</span></div>
                      <div><span className="text-muted-foreground">Marca:</span> <span className="font-medium">{remanejoPreview.alternative.brand}</span></div>
                      <div><span className="text-muted-foreground">Preço Unit.:</span> <span className="font-medium">R$ {remanejoPreview.alternative.unitPrice.toFixed(2)}</span></div>
                      <div><span className="text-muted-foreground">Total ({remanejoPreview.deficit} un):</span> <span className="font-bold">R$ {remanejoPreview.alternative.totalCost.toFixed(2)}</span></div>
                    </div>
                    <div className="bg-white border border-green-200 rounded p-2 mt-2">
                      <p className="text-[10px] text-green-700 font-medium">📦 O déficit será adicionado ao pedido já existente de {remanejoPreview.alternative.supplierName} nesta cotação (não cria pedido separado).</p>
                    </div>
                    {remanejoPreview.costImpact !== 0 && (
                      <p className={`text-xs mt-1 ${remanejoPreview.costImpact > 0 ? "text-red-600" : "text-green-600"}`}>
                        {remanejoPreview.costImpact > 0 ? "⚠️" : "💰"} Impacto: {remanejoPreview.costImpact > 0 ? "+" : ""}R$ {remanejoPreview.costImpact.toFixed(2)} no custo total
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="border border-red-300 bg-red-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-red-800">Nenhum fornecedor alternativo elegível encontrado</p>
                    <p className="text-xs text-red-600 mt-1">Todos os {remanejoPreview.totalCandidates} candidatos possuem marca rejeitada ou não cotaram este item.</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setRemanejoStep(1)}>Voltar</Button>
                  {remanejoPreview.hasAlternative && (
                    <Button className="flex-1" onClick={() => setRemanejoStep(3)}>Confirmar Remanejamento</Button>
                  )}
                </div>
              </div>
            )}
            {/* Step 3: Justificativa */}
            {remanejoStep === 3 && remanejoModal && (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800 font-medium">🔒 Todas as ações são registradas na auditoria corporativa.</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Justificativa obrigatória (mín. 20 caracteres):</Label>
                  <Textarea
                    className="mt-1 min-h-[80px]"
                    placeholder="Ex: Fornecedor informou que só tem 60 unidades em estoque no momento..."
                    value={remanejoJustification}
                    onChange={(e) => setRemanejoJustification(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">{remanejoJustification.length}/20 caracteres</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setRemanejoStep(2)}>Voltar</Button>
                  <Button
                    className="flex-1"
                    disabled={remanejoJustification.length < 20 || remanejoConfirmMutation.isPending}
                    onClick={() => {
                      remanejoConfirmMutation.mutate({
                        orderId: remanejoModal.orderId,
                        productName: remanejoModal.productName,
                        availableQuantity: parseFloat(remanejoAvailQty),
                        justification: remanejoJustification,
                      });
                    }}
                  >
                    {remanejoConfirmMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processando...</> : "Confirmar Remanejamento"}
                  </Button>
                </div>
              </div>
            )}
            {/* Step 4: Resultado */}
            {remanejoStep === 4 && remanejoResult && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-300 rounded-lg p-4 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-2" />
                  <p className="text-lg font-bold text-green-800">Remanejamento Concluído!</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Pedido original:</span>
                    <span className="font-medium">{remanejoResult.originalOrder.code} → {remanejoResult.originalOrder.newQuantity} un</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">{remanejoResult.complementaryOrder.addedToExisting ? "Adicionado ao pedido:" : "Novo pedido criado:"}</span>
                    <span className="font-medium">{remanejoResult.complementaryOrder.code} {remanejoResult.complementaryOrder.addedToExisting && <Badge variant="outline" className="ml-1 text-[9px]">existente</Badge>}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Fornecedor alternativo:</span>
                    <span className="font-medium">{remanejoResult.complementaryOrder.supplier}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Quantidade remanejada:</span>
                    <span className="font-medium">{remanejoResult.complementaryOrder.quantity} un</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Preço unitário:</span>
                    <span className="font-medium">R$ {remanejoResult.complementaryOrder.unitPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Impacto no custo:</span>
                    <span className={`font-bold ${remanejoResult.costImpact > 0 ? "text-red-600" : "text-green-600"}`}>
                      {remanejoResult.costImpact > 0 ? "+" : ""}R$ {remanejoResult.costImpact.toFixed(2)}
                    </span>
                  </div>
                </div>
                <Button className="w-full" onClick={resetRemanejo}>Fechar</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}
import { FileText } from "lucide-react";
