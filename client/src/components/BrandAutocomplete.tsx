import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useState, useRef, useEffect } from "react";

interface BrandAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  productName?: string;
  supplierId?: number;
  placeholder?: string;
  className?: string;
}

export default function BrandAutocomplete({
  value,
  onChange,
  productName,
  supplierId,
  placeholder = "Digite a marca...",
  className = "",
}: BrandAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync external value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const { data: suggestions } = trpc.brandRegistry.autocomplete.useQuery(
    { query: localValue, productName, supplierId },
    { enabled: localValue.length >= 2 && showSuggestions }
  );

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    onChange(val);
    if (val.length >= 2) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSelect = (brand: string) => {
    setLocalValue(brand);
    onChange(brand);
    setShowSuggestions(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={localValue}
        onChange={handleInputChange}
        onFocus={() => { if (localValue.length >= 2) setShowSuggestions(true); }}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {showSuggestions && suggestions && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s: any, i: number) => (
            <button
              key={`${s.brand}-${s.supplierName}-${i}`}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between gap-2 border-b border-border/50 last:border-0"
              onClick={() => handleSelect(s.brand)}
            >
              <div className="flex flex-col min-w-0">
                <span className="font-medium truncate">{s.brand}</span>
                <span className="text-xs text-muted-foreground truncate">
                  {s.productName}{s.supplierName ? ` • ${s.supplierName}` : ""}
                </span>
              </div>
              {s.usageCount > 1 && (
                <span className="text-xs text-muted-foreground shrink-0">{s.usageCount}x</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
