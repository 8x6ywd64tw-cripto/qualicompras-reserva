# Debug Notes - Bugs 30/07/2026

## Bug 1: Brand not updating when moving item between suppliers
**Root cause:** The adjustment state only stored `{ newSupplierId, newSupplierName, newUnitPrice }`.
When `buildAdjustedSuppliers()` moved items, it did `{ ...item }` which kept the old brand.
**Fix applied:**
- Extended adjustment state type to include `newBrand`, `newPackagingType`, `newUnitsPerPackage`
- Updated `Select onValueChange` (line ~1255) to save brand/packaging from `getAlternativesForItem`
- Updated `buildAdjustedSuppliers` (line ~1150) to use `adj.newBrand` instead of `item.brand`
- Updated `confirmAdjustment` to pass `selectedBrand: adj.newBrand` and correct packaging

## Bug 2: "Confirmar Ajuste e Fechar Pedido" STILL not working
**Previous fix (timeout):** Increased fetch AbortController from 45s to 180s.
**But Afonso says it still fails** — so the issue is NOT just timeout.

**New investigation - Performance bottleneck:**
- Each `recordPrice` call does `getDb()` + individual insert
- With 2 suppliers × 15 items = 30 individual recordPrice DB calls
- Each `getDb()` may create a new connection on serverless
- Total: ~36+ individual DB operations per adjustment

**Solution needed:**
1. Create `recordPriceBatch()` that inserts ALL prices in one query
2. Reduce total DB round-trips from ~36 to ~8
3. Add better error logging to catch the actual error

## Bug 3: Rejected brands not excluded from optimization
**What should happen:**
- Brands marked "reprovada" in Marcas page → excluded from optimization algorithm
- Show red text + strikethrough in cotação comparison view
**Where to fix:**
- `server/routers.ts` optimize endpoint (~line 928): filter out rejected brand items
- Frontend comparison view: check brand status and apply styling

## Key schema info:
- `purchaseOrders` table: code (varchar 20, unique), supplierId (notNull), createdBy (notNull), totalValue (decimal notNull)
- `priceHistory` table: individual inserts via recordPrice()
- Brands table: need to check status field (confiavel/desconhecida/reprovada)

## Bug 4: iOS PWA Login Loop (2026-07-31)
**Symptom:** User sees "Redirecionando para login..." screen with "Entrar no Sistema" button, but never reaches login form.
**Root cause:** iOS PWA caches old JavaScript bundle that uses cookie-based auth. New code uses Bearer token in localStorage.
**Production status:** WORKING. Tested POST /api/auth/login and auth.me with Bearer - both return correct data.
**User fix:** Clear Safari data, re-add PWA shortcut to get fresh JS bundle.
**If persists:** May need to add aggressive cache-busting or force-reload mechanism in the inline script.
