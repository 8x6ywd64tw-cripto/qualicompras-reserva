# Fix Context

## Hook Error Analysis
The error "Rendered more hooks than during the previous render" at CotacaoDetalhe.tsx:435 (old line number).

After my fix, the current file has:
- Line 364: `const scenarioData = useMemo(...)` - this is AFTER line 351 (sortedProposals) which depends on `proposals`
- Line 393-404: early returns for loadingQuotation and !quotation

The issue is that `sortedProposals` uses `proposals` which comes from a tRPC query. On first render, `proposals` is undefined, so `sortedProposals` is `[]`. The `useMemo` at line 364 has `sortedProposals` in its dependency array. This should be fine since the useMemo is always called.

BUT WAIT - the problem is the `useMemo` dependency array includes `sortedProposals` which is a NEW array reference every render (because of the spread+sort). This causes the useMemo to re-run every render but shouldn't cause hooks error.

The REAL issue: The error log says line 435 in the OLD version. After my fix, the useMemo is at line 364. The production deployment (version e95f68d9) should have the fix. The user might be seeing cached old version.

Actually looking more carefully at the browser console log timestamp: `2026-07-26T11:47:44.853Z` - this is BEFORE my fix was deployed at 11:49. The user might just need to hard-refresh.

BUT the user says "Ainda permanece com erro" (still has error) - so either:
1. Cache issue on their phone (need hard refresh)
2. There's another hook somewhere I missed

Let me check: the `useMemo` at line 364 depends on `sortedProposals` which is defined at line 352. `sortedProposals` is NOT a hook, it's just a variable. So the hook count should be stable.

The hooks in order are:
1-7: useState (lines 88-106)
8: useCallback (line 108)
9-14: useQuery (lines 110-115)
15: useUtils (line 117)
16: useMutation (line 118)
17: useAuth (line 121)
18: useMutation (line 123)
19: useMutation (line 126)
20: useMutation (line 130)
21: useMutation (line 135)
22: useMutation (line 143)
23: useMutation (line 220)
24: useMemo (line 364) ← the scenarioData

All hooks are unconditional and before any early returns. This should be correct.

The user's error might be from the cached old deployment. Need to verify the production build is correct.

## Task 2: Economy in Compra Otimizada Modal + WhatsApp
- The optimization modal (lines 842-1031) shows grandTotal and supplier cards
- Need to add: "Economia: R$ X (Y%) vs cenário pior" card
- The server optimize endpoint already returns `scenarios` data (from computeScenarios)
- WhatsApp message (line 154-155 and line 195) needs to include economy info
- The `optimizationResult` should already have `scenarios` field from the server

## Server optimize endpoint returns:
- grandTotal, suppliers[], anomalies[], noSupplier[], scenarios (from computeScenarios)
