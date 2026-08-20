import { useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PriceVariationProps {
  currentPrice: number;
  lastPrice: number | null;
  lastDate: string | null;
  supplierName: string;
  productName: string;
  source?: string;
}

export function PriceVariationIndicator({
  currentPrice,
  lastPrice,
  lastDate,
  supplierName,
  productName,
  source,
}: PriceVariationProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (lastPrice === null || lastPrice <= 0) return null;

  const diff = currentPrice - lastPrice;
  const pctChange = ((diff) / lastPrice) * 100;
  const isUp = pctChange > 1; // >1% increase
  const isDown = pctChange < -1; // >1% decrease
  const isStable = !isUp && !isDown;

  // Color scheme
  const bgColor = isUp ? "bg-red-100" : isDown ? "bg-green-100" : "bg-gray-100";
  const borderColor = isUp ? "border-red-400" : isDown ? "border-green-400" : "border-gray-300";
  const textColor = isUp ? "text-red-700" : isDown ? "text-green-700" : "text-gray-600";
  const iconColor = isUp ? "text-red-600" : isDown ? "text-green-600" : "text-gray-500";

  // Format date
  const formattedDate = lastDate
    ? new Date(lastDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
    : "—";

  const sourceLabel = source === "fortes_pedido" ? "Pedido Fortes" : source === "proposal" ? "Cotação anterior" : "Histórico";

  return (
    <div className="relative inline-flex items-center">
      {/* Circular indicator badge */}
      <div
        className={`relative flex items-center justify-center w-[22px] h-[22px] rounded-full border-2 ${bgColor} ${borderColor} cursor-pointer transition-all duration-150 hover:scale-110`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
      >
        {isUp && <TrendingUp className={`w-3 h-3 ${iconColor}`} />}
        {isDown && <TrendingDown className={`w-3 h-3 ${iconColor}`} />}
        {isStable && <Minus className={`w-3 h-3 ${iconColor}`} />}
      </div>

      {/* Percentage badge */}
      <span className={`ml-0.5 text-[8px] font-bold ${textColor}`}>
        {isUp ? "+" : ""}{pctChange.toFixed(1)}%
      </span>
      {/* Reference price (last purchase value) */}
      <span className="ml-0.5 text-[8px] text-muted-foreground font-normal">
        (R${lastPrice.toFixed(2)})
      </span>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-[220px] p-2.5 rounded-lg shadow-xl border bg-white text-left animate-in fade-in-0 zoom-in-95 duration-150">
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white" />

          {/* Header */}
          <div className={`text-[10px] font-bold uppercase tracking-wide mb-1.5 ${textColor}`}>
            {isUp ? "⚠️ Preço subiu" : isDown ? "✅ Preço caiu" : "➖ Preço estável"}
          </div>

          {/* Product */}
          <div className="text-[9px] text-gray-500 mb-1 truncate" title={productName}>
            {productName}
          </div>

          {/* Price comparison */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="text-[10px]">
              <span className="text-gray-500">Anterior:</span>{" "}
              <span className="font-semibold">R$ {lastPrice.toFixed(2)}</span>
            </div>
            <span className="text-gray-300">→</span>
            <div className="text-[10px]">
              <span className="text-gray-500">Atual:</span>{" "}
              <span className={`font-bold ${textColor}`}>R$ {currentPrice.toFixed(2)}</span>
            </div>
          </div>

          {/* Variation */}
          <div className={`text-[10px] font-bold ${textColor} mb-1`}>
            {isUp ? "+" : ""}R$ {diff.toFixed(2)} ({isUp ? "+" : ""}{pctChange.toFixed(1)}%)
          </div>

          {/* Meta info */}
          <div className="border-t pt-1 mt-1 text-[9px] text-gray-400 space-y-0.5">
            <div>📅 Referência: {formattedDate}</div>
            <div>📋 Fonte: {sourceLabel}</div>
            <div>🏪 {supplierName}</div>
          </div>

          {/* Explanation */}
          <div className={`mt-1.5 text-[9px] p-1.5 rounded ${isUp ? "bg-red-50 text-red-700" : isDown ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-600"}`}>
            {isUp
              ? `Este fornecedor aumentou o preço em ${pctChange.toFixed(1)}% desde a última cotação. Considere negociar ou buscar alternativa.`
              : isDown
              ? `Boa notícia! O preço caiu ${Math.abs(pctChange).toFixed(1)}% em relação à última cotação. Fornecedor competitivo.`
              : `Preço mantido dentro da margem de variação normal (±1%). Fornecedor consistente.`}
          </div>
        </div>
      )}
    </div>
  );
}
