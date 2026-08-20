# Checkbox Redesign Plan - Compra Otimizada

## Current Structure (CotacaoDetalhe.tsx)
- Dialog opens at line 1070 (`showOptimization`)
- Supplier cards rendered at line 1126-1296 (buildAdjustedSuppliers)
- Table headers at line 1194-1204
- Table rows at line 1207-1289
- "Fechar Pedido" button at line 1461-1471 (calls confirmGenerateOrders)
- "Ajustar Compra" button at line 1473 (enters adjustMode)
- confirmGenerateOrders function at line 248-265

## What needs to change:

### 1. Add checkbox state
- New state: `const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});`
- Initialize all items as selected (true) when optimization result loads
- Key format: `${supplierIdx}-${itemIdx}` (same as adjustments)

### 2. Add checkbox column to table
- Add <th> for checkbox column (first column)
- Add <td> with Checkbox component in each row
- Checkbox checked = item will be purchased
- Unchecked = item excluded from order

### 3. Recalculate totals in real-time
- Supplier total: sum only selected items
- Grand total: sum all supplier totals with selection
- Display updated totals in supplier card header and top summary

### 4. Justification for deselected items
- If any items are deselected, show a justification textarea (min 10 chars)
- Only required when items are deselected

### 5. Update confirmGenerateOrders
- Filter out deselected items from the suppliers payload
- Remove suppliers with 0 selected items
- Include deselection reason in audit log

### 6. Single-supplier simplification
- When only 1 supplier responded: show checkboxes directly without needing "Ajustar" flow
- The "Ajustar Compra" button is for moving between suppliers (still needed when >1 supplier)

## Key state variables already in use:
- adjustMode, adjustStep, adjustments - for the supplier swap flow
- generatingOrders - loading state for order generation
- savingAdjustment - loading state for adjustment confirmation
- optimizationResult.suppliers[].items[] - the items to render

## Important: Checkbox should be available ALWAYS (not just in adjustMode)
- Checkboxes show in normal mode (before clicking "Ajustar")
- When user clicks "Fechar Pedido", only checked items are included
