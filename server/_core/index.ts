import "dotenv/config";
import express from "express";
import path from "path";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerSecurity } from "../security";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// ==================== FORTES PDF PARSER HELPERS ====================
export function parseFortesHeader(text: string) {
  let estabelecimento = '';
  let centroEstoque = '';
  let usuario = '';
  let periodo = '';
  let observacao = '';
  let numColeta = '';
  
  // pdfjs-dist puts everything on one/two lines with spaces - use regex on full text
  const estabMatch = text.match(/QUALITIES REFEICOES INDUSTRIAL LTDA\s*-\s*([A-ZÀ-Ü]+)/i);
  if (estabMatch) estabelecimento = estabMatch[1].trim();
  
  const centroMatch = text.match(/Centro de Estoque:\s*\d+\s*-\s*([A-ZÀ-Ü ]+?)\s*-/i);
  if (centroMatch) centroEstoque = centroMatch[1].trim();
  
  const userMatch = text.match(/Usu[aá]rio:\s*([A-ZÀ-Ü]+(?:\s[A-ZÀ-Ü]+)?)\s{2}/i);
  if (userMatch) usuario = userMatch[1].trim();
  
  const periodoMatch = text.match(/Per[ííi]odo:\s*(\d{2}\/\d{2}\/\d{4}\s*a\s*\d{2}\/\d{2}\/\d{4})/i);
  if (periodoMatch) periodo = periodoMatch[1].trim();
  
  const obsMatch = text.match(/OBS:\s*([^\n]+?)\s{2,}/i) || text.match(/OBS:\s*(.+?)\s+Fornecedor/i);
  if (obsMatch) observacao = obsMatch[1].trim();
  
  const coletaMatch = text.match(/N[oº]\s*Coleta:\s*(\d+)/i);
  if (coletaMatch) numColeta = coletaMatch[1];
  
  // Detect category/sector from multiple sources:
  // 1. Title line: "Coleta Nº X - PROTEINA - dates" or "Coleta ... - CEREAIS - ..."
  // 2. Centro de Estoque field
  // 3. Product names as last resort
  let category = '';
  
  // Source 1: Title line with sector name (most reliable)
  const titleMatch = text.match(/Coleta\s*(?:N[oº°]?\s*\d+)?\s*-\s*([A-ZÀ-Ü ]+?)\s*-/i);
  const titleSector = titleMatch ? titleMatch[1].trim().toUpperCase() : '';
  
  // Source 2: Centro de Estoque
  const ceUpper = centroEstoque.toUpperCase();
  
  // Combined detection from title and centro de estoque
  const sectorText = titleSector || ceUpper;
  
  if (sectorText.includes('PROTE') || sectorText.includes('CARNE') || sectorText.includes('FRIGO')) {
    category = 'Proteína';
  } else if (sectorText.includes('HORTI') || sectorText.includes('FRUT') || sectorText.includes('VERDURA')) {
    category = 'Hortifruti';
  } else if (sectorText.includes('DESC') && !sectorText.includes('LIMP')) {
    category = 'Descartáveis';
  } else if (sectorText.includes('LIMP') && !sectorText.includes('DESC')) {
    category = 'Limpeza';
  } else if ((sectorText.includes('LIMP') && sectorText.includes('DESC')) || sectorText.includes('HIGIEN')) {
    // Quando o Fortes traz os dois juntos, separar pelo conteúdo dos itens
    category = 'Limpeza e Descartáveis';
  } else if (sectorText.includes('CEREAL') || sectorText.includes('CEREAIS') || sectorText.includes('SECOS') || sectorText.includes('MERCEARIA')) {
    category = 'Cereais';
  } else if (sectorText.includes('DOCE') || sectorText.includes('CONFEIT')) {
    category = 'Cereais (Doces)';
  } else if (sectorText.includes('PAO') || sectorText.includes('PÃO') || sectorText.includes('PADARIA')) {
    category = 'Pão';
  } else if (sectorText.includes('GAS') || sectorText.includes('GÁS')) {
    category = 'Gás';
  }
  
  // Source 3: If still not detected, analyze product names
  if (!category) {
    const textUpper = text.toUpperCase();
    const proteinKeywords = ['CARNE', 'FRANGO', 'LINGUICA', 'LINGUÍCA', 'BACON', 'COSTELA', 'LOMBO', 'FILE', 'FILÉ', 'HAMBURGUER', 'HAMBÚRGUER', 'SUINO', 'SUÍNO', 'BOVINO', 'MASCARA', 'COXAO', 'SOBRECOXA', 'OVO', 'OVOS'];
    const hortifrutiKeywords = ['ALFACE', 'TOMATE', 'CEBOLA', 'BANANA', 'LARANJA', 'BATATA', 'CENOURA', 'REPOLHO', 'PEPINO', 'PIMENT'];
    const cereaisKeywords = ['ARROZ', 'FEIJAO', 'FEIJÃO', 'MACARRAO', 'MACARRÃO', 'OLEO', 'ÓLEO', 'FARINHA', 'ACUCAR', 'AÇÚCAR', 'SAL ', 'CAFE', 'CAFÉ'];
    const limpezaKeywords = ['SANITARIA', 'DESINFETANTE', 'CLORADO', 'DESINCRUSTANTE', 'DETERGENTE', 'ESPONJA', 'RODO', 'VASSOURA', 'SACO DE LIXO', 'PANO DE CHAO', 'ALCOOL LIQ', 'AGUA SANITARIA', 'DESENGORDURANTE', 'SABAO', 'LIMPADOR'];
    const descartaveisKeywords = ['COPO', 'LUVA', 'MARMITA', 'BOBINA', 'FILME PVC', 'PAPEL ALUMIN', 'SACOLA', 'TOUCA', 'GARFO', 'GUARDANAPO', 'MEXEDOR', 'PALITO', 'DESCARTAV', 'HAMBURGUEIRA', 'CANUDO'];
    
    let proteinCount = proteinKeywords.filter(k => textUpper.includes(k)).length;
    let hortifrutiCount = hortifrutiKeywords.filter(k => textUpper.includes(k)).length;
    let cereaisCount = cereaisKeywords.filter(k => textUpper.includes(k)).length;
    let limpezaCount = limpezaKeywords.filter(k => textUpper.includes(k)).length;
    let descartaveisCount = descartaveisKeywords.filter(k => textUpper.includes(k)).length;
    
    // Combine limpeza + descartaveis as they're often in the same category
    const limpDescTotal = limpezaCount + descartaveisCount;
    
    if (proteinCount >= hortifrutiCount && proteinCount >= cereaisCount && proteinCount >= limpDescTotal && proteinCount > 0) {
      category = 'Proteína';
    } else if (hortifrutiCount >= proteinCount && hortifrutiCount >= cereaisCount && hortifrutiCount >= limpDescTotal && hortifrutiCount > 0) {
      category = 'Hortifruti';
    } else if (limpDescTotal >= proteinCount && limpDescTotal >= hortifrutiCount && limpDescTotal >= cereaisCount && limpDescTotal > 0) {
      // Distinguish between pure limpeza, pure descartaveis, or mixed
      if (limpezaCount > descartaveisCount) {
        category = 'Limpeza';
      } else if (descartaveisCount > limpezaCount) {
        category = 'Descartáveis';
      } else {
        category = 'Limpeza e Descartáveis';
      }
    } else if (cereaisCount > 0) {
      category = 'Cereais';
    }
  }
  
  // Final fallback
  if (!category) category = 'Cereais';
  
  // Extract consumption period from OBS (e.g. "CONSUMO DE 16/07 A 26/07 (2ª E 3ª SEMANA)")
  let consumoInicio = '';
  let consumoFim = '';
  let consumoDias = 0;
  const consumoMatch = observacao.match(/CONSUMO\s+(?:DE\s+)?(\d{2}[.\/]\d{2})\s*A\s*(\d{2}[.\/]\d{2})/i);
  if (consumoMatch) {
    consumoInicio = consumoMatch[1].replace('.', '/');
    consumoFim = consumoMatch[2].replace('.', '/');
    // Calculate days
    const [d1, m1] = consumoInicio.split('/').map(Number);
    const [d2, m2] = consumoFim.split('/').map(Number);
    const year = new Date().getFullYear();
    const date1 = new Date(year, m1 - 1, d1);
    const date2 = new Date(year, m2 - 1, d2);
    consumoDias = Math.round((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
    if (consumoDias <= 0) consumoDias = 0;
  }
  
  // Extract suppliers from PDF ("Fornecedor: XXXXX" pattern)
  const supplierMatchesArr = Array.from(text.matchAll(/Fornecedor:\s*([A-ZÀ-Ü][A-ZÀ-Ü0-9 .&,\/-]+?)\s{2,}/gi));
  const detectedSuppliers: Array<{ name: string; cnpj: string }> = [];
  const seenSuppliers = new Set<string>();
  for (const sm of supplierMatchesArr) {
    const name = sm[1].trim();
    if (name && !seenSuppliers.has(name.toUpperCase())) {
      seenSuppliers.add(name.toUpperCase());
      // Try to find CNPJ near the supplier name
      const cnpjPattern = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '.*?(\\d{2}\\.\\d{3}\\.\\d{3}\\/\\d{4}-\\d{2})', 's');
      const cnpjMatch = text.match(cnpjPattern);
      detectedSuppliers.push({ name, cnpj: cnpjMatch ? cnpjMatch[1] : '' });
    }
  }
  
  // Also try CNPJ extraction from lines near "Fornecedor" or "DDD"
  const cnpjMatches = Array.from(text.matchAll(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/g));
  if (detectedSuppliers.length > 0 && cnpjMatches.length > 0) {
    // Assign CNPJs to suppliers in order if not already assigned
    let cnpjIdx = 0;
    for (const sup of detectedSuppliers) {
      if (!sup.cnpj && cnpjIdx < cnpjMatches.length) {
        sup.cnpj = cnpjMatches[cnpjIdx][1];
        cnpjIdx++;
      }
    }
  }
  
  // Extract data (date) from "Data: DD/MM/YYYY"
  let dataColeta = '';
  const dataMatch = text.match(/Data:\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (dataMatch) dataColeta = dataMatch[1];

  return { 
    estabelecimento, centroEstoque, usuario, periodo, observacao, numColeta, category,
    consumoInicio, consumoFim, consumoDias, detectedSuppliers, dataColeta
  };
}

export function parseFortesItems(text: string) {
  const items: Array<{ code: string; description: string; unit: string; quantity: number }> = [];
  
  // pdfjs-dist output uses 2+ spaces between columns
  // Pattern: code (7-10 digits), 2+ spaces, description (uppercase text with special chars), 2+ spaces, unit, 2+ spaces, quantity
  // Units: PC (peça), TB (tubo), RL (rolo), FR (frasco), PT (pote), BL (bloco), RS (resma) added for completeness
  const UNITS = 'KG|UN|PCT|LT|PG|CX|UND|UNI|SC|FD|GL|BD|DZ|MT|ML|GR|PC|TB|RL|FR|PT|BL|RS';
  // Character class includes: letters (A-Z + accented À-Ü), digits, space, comma, dot, slash, parentheses, hyphen, colon, semicolon, #, &, +, ', º, ª
  // Negative lookbehind (?<!\d) prevents matching partial numbers from header (e.g. Nº Coleta: 26072814002 would match '6072814002' without it)
  const regex = new RegExp(`(?<!\\d)(\\d{7,10})\\s{2,}([A-Z\u00c0-\u00dc][A-Z\u00c0-\u00dc0-9 ,./()\\-:;#&+'°ºª]+?)\\s{2,}(${UNITS})\\s{2,}(\\d+[,.]?\\d*)`, 'gi');
  
  const matches = Array.from(text.matchAll(regex));
  const seen = new Map<string, number>(); // description -> index in items array
  for (const match of matches) {
    const quantity = parseFloat((match[4] || '0').replace(',', '.'));
    const description = match[2].trim();
    const descKey = description.toUpperCase();
    
    // Deduplicate: keep first occurrence of each product (by description)
    if (seen.has(descKey)) {
      // If same product appears again with a higher quantity, update it
      const existingIdx = seen.get(descKey)!;
      if (quantity > items[existingIdx].quantity) {
        items[existingIdx].quantity = quantity;
      }
      continue;
    }
    
    seen.set(descKey, items.length);
    items.push({
      code: match[1],
      description,
      unit: match[3].toUpperCase(),
      quantity,
    });
  }
  
  return items;
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // ==================== SECURITY (must be first) ====================
  registerSecurity(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
    registerStorageProxy(app);
  registerOAuthRoutes(app);

  // ==================== EXTERNAL MODE: serve local uploads ====================
  if (process.env.EXTERNAL_MODE === "true") {
    const uploadsDir = path.join(process.cwd(), "uploads");
    app.use("/uploads", express.static(uploadsDir));
    console.log("[RESERVA] Serving uploads from", uploadsDir);
  }

  // ==================== SAFARI ITP FIX ====================
  // Safari blocks Set-Cookie on POST responses (ITP). This GET endpoint
  // allows the Login page to set the session cookie via a GET request,
  // which Safari accepts without restriction.
  app.get('/api/auth/set-session', async (req, res) => {
    const token = req.query.token as string;
    if (!token) {
      return res.status(400).json({ error: 'Missing token' });
    }
    // Verify the token is valid before setting cookie
    try {
      const { sdk } = await import('./sdk');
      const session = await sdk.verifySession(token);
      if (!session) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    } catch (e) {
      return res.status(401).json({ error: 'Token verification failed' });
    }
    // Import cookie options for consistency
    const { getSessionCookieOptions } = await import('./cookies');
    const cookieOptions = getSessionCookieOptions(req);
    const SESSION_EXPIRY_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
    res.cookie('app_session_id', token, { ...cookieOptions, maxAge: SESSION_EXPIRY_MS });
    // Marker cookie (non-HttpOnly) so client JS can detect active session
    res.cookie('app_session_active', '1', {
      path: '/',
      sameSite: 'lax' as const,
      secure: cookieOptions.secure,
      httpOnly: false,
      maxAge: SESSION_EXPIRY_MS,
    });
    res.json({ ok: true });
  });

  // ==================== REST LOGIN (returns JSON with token) ====================
  // Simple REST endpoint: POST JSON → get token back. No cookies needed.
  app.post('/api/auth/login', express.json(), async (req, res) => {
    try {
      const { email, password, operatorName } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Preencha email e senha' });
      }
      const dbModule = await import('../db');
      const { sdk } = await import('./sdk');
      const bcrypt = await import('bcryptjs');

      // Validate credentials
      const user = await dbModule.getUserByEmail(email);
      if (user?.passwordHash) {
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return res.status(401).json({ error: 'Senha inválida' });
      } else {
        const UNIVERSAL_PASSWORD = await dbModule.getUniversalPassword();
        if (password !== UNIVERSAL_PASSWORD) return res.status(401).json({ error: 'Senha inválida' });
      }

      // Handle first login (needs name)
      let actualUser = user;
      if (!actualUser) {
        if (!operatorName?.trim()) {
          return res.status(400).json({ code: 'FIRST_LOGIN_NEEDS_NAME', error: 'Informe seu nome' });
        }
        const { nanoid } = await import('nanoid');
        const openId = `local_${nanoid(16)}`;
        await dbModule.upsertUser({
          openId,
          name: operatorName.trim(),
          email,
          loginMethod: 'email',
          role: 'comprador',
          lastSignedIn: new Date(),
        });
        actualUser = await dbModule.getUserByEmail(email);
        if (!actualUser) return res.status(500).json({ error: 'Erro ao criar conta' });
      } else {
        const genericNames = ['Qualities Refeições', 'Admin', 'Teste', ''];
        if (!actualUser.name || genericNames.includes(actualUser.name)) {
          if (!operatorName?.trim()) {
            return res.status(400).json({ code: 'FIRST_LOGIN_NEEDS_NAME', error: 'Informe seu nome' });
          }
          await dbModule.upsertUser({ openId: actualUser.openId, name: operatorName.trim(), lastSignedIn: new Date() });
        } else {
          await dbModule.upsertUser({ openId: actualUser.openId, lastSignedIn: new Date() });
        }
      }

      // Create session token (7 days)
      const SESSION_EXPIRY_MS = 1000 * 60 * 60 * 24 * 7;
      const actualName = actualUser.name || operatorName?.trim() || '';
      const sessionToken = await sdk.createSessionToken(actualUser.openId, {
        name: actualName,
        expiresInMs: SESSION_EXPIRY_MS,
      });

      // Log login
      const loginIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
      try {
        await dbModule.recordLoginSession({
          userId: actualUser.id,
          userName: actualName,
          userEmail: actualUser.email || '',
          ipAddress: loginIp,
          userAgent: req.headers['user-agent'] || '',
        });
      } catch {}

      return res.json({ token: sessionToken, user: { id: actualUser.id, name: actualName, email: actualUser.email, role: actualUser.role } });
    } catch (e: any) {
      console.error('[REST login] Error:', e.message);
      return res.status(500).json({ error: 'Erro interno. Tente novamente.' });
    }
  });

  // ==================== FORM LOGIN (legacy, kept for backward compat) ====================
  app.post('/api/auth/form-login', express.urlencoded({ extended: false }), async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.redirect('/login?error=missing');
      }
      const dbModule = await import('../db');
      const { sdk } = await import('./sdk');
      const { getSessionCookieOptions } = await import('./cookies');
      const bcrypt = await import('bcryptjs');
      
      // Validate credentials (same logic as tRPC login)
      const user = await dbModule.getUserByEmail(email);
      if (!user) {
        return res.redirect('/login?error=invalid');
      }
      if (user.passwordHash) {
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return res.redirect('/login?error=invalid');
      } else {
        const UNIVERSAL_PASSWORD = await dbModule.getUniversalPassword();
        if (password !== UNIVERSAL_PASSWORD) return res.redirect('/login?error=invalid');
      }
      
      // Create session
      const SESSION_EXPIRY_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || '',
        expiresInMs: SESSION_EXPIRY_MS,
      });
      
      // Set cookies (best effort - may not work in iOS PWA)
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie('app_session_id', sessionToken, { ...cookieOptions, maxAge: SESSION_EXPIRY_MS });
      res.cookie('app_session_active', '1', {
        path: '/', sameSite: 'lax' as const, secure: cookieOptions.secure, httpOnly: false, maxAge: SESSION_EXPIRY_MS,
      });
      
      // Update last signed in
      await dbModule.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
      
      // Redirect with token in hash - the inline script in index.html will save it
      res.redirect(`/#token=${encodeURIComponent(sessionToken)}`);
    } catch (e: any) {
      console.error('[form-login] Error:', e.message);
      res.redirect('/login?error=server');
    }
  });

  // ==================== FORTES AG INTEGRATION ====================
  // API key middleware for Fortes endpoints
  const FORTES_API_KEY = process.env.FORTES_API_KEY || 'qualicompras-fortes-2024';
  const validateFortesApiKey = (req: any, res: any, next: any) => {
    // Allow internal app requests (with session cookie or Bearer token) to bypass API key check
    const cookieHeader = req.headers.cookie || '';
    const hasSession = cookieHeader.includes('app_session_id=');
    const authHeader = req.headers.authorization || '';
    const hasBearer = authHeader.startsWith('Bearer ') && authHeader.length > 10;
    if (hasSession || hasBearer) {
      return next(); // Authenticated app user, no API key needed
    }
    // External API calls require X-Api-Key header
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    if (apiKey !== FORTES_API_KEY) {
      console.warn(`[Security] Fortes API: unauthorized access attempt | IP: ${req.ip} | Path: ${req.path}`);
      return res.status(401).json({ error: 'API key inválida ou ausente. Envie header X-Api-Key.' });
    }
    next();
  };
  app.use('/api/fortes', validateFortesApiKey);

  // Webhook endpoint to receive purchase requisitions from Fortes AG
  app.post('/api/fortes/requisicao', async (req, res) => {
    try {
      const { items, unitName, unitId, requestedBy, notes, urgency } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Items array is required' });
      }
      // Store the requisition for processing
      const { getDb } = await import('../db');
      const db = await getDb();
      if (!db) return res.status(500).json({ error: 'Database unavailable' });
      
      const { fortesRequisitions } = await import('../../drizzle/schema');
      const { nanoid } = await import('nanoid');
      const code = `REQ-${Date.now().toString(36).toUpperCase()}`;
      const result = await db.insert(fortesRequisitions).values({
        code,
        unitName: unitName || null,
        unitId: unitId || null,
        requestedBy: requestedBy || 'Fortes AG',
        notes: notes || null,
        urgency: urgency || 'normal',
        items: items as any,
        status: 'pending',
      });
      
      res.json({ success: true, code, id: result[0].insertId, message: `Requisição ${code} recebida com ${items.length} itens` });
    } catch (err: any) {
      console.error('[Fortes Integration] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get pending requisitions (for the QualiCompras UI)
  app.get('/api/fortes/requisicoes', async (req, res) => {
    try {
      const { getDb } = await import('../db');
      const db = await getDb();
      if (!db) return res.status(500).json({ error: 'Database unavailable' });
      const { fortesRequisitions } = await import('../../drizzle/schema');
      const { desc } = await import('drizzle-orm');
      const reqs = await db.select().from(fortesRequisitions).orderBy(desc(fortesRequisitions.createdAt)).limit(50);
      res.json(reqs.map(r => ({ ...r, items: r.items })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== PDF UPLOAD & PARSING (FORTES AG) ====================
  const multer = (await import('multer')).default;
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
  
  app.post('/api/fortes/upload-pdf', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      
      // Use pdfjs-dist directly for PDF text extraction
      const pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.js');
      const pdfjsLib = pdfjsModule.default || pdfjsModule;
      const uint8Array = new Uint8Array(req.file.buffer);
      const doc = await pdfjsLib.getDocument({ data: uint8Array }).promise;
      let text = '';
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(' ');
        text += pageText + '\n';
      }
      
      // Parse header info
      const headerInfo = parseFortesHeader(text);
      // Parse items
      const items = parseFortesItems(text);
      
      // Store as requisition
      const { getDb } = await import('../db');
      const db = await getDb();
      if (!db) return res.status(500).json({ error: 'Database unavailable' });
      
      const { fortesRequisitions } = await import('../../drizzle/schema');
      const code = `REQ-${Date.now().toString(36).toUpperCase()}`;
      
      // Try to match unit
      const { units } = await import('../../drizzle/schema');
      const { like } = await import('drizzle-orm');
      let unitId: number | null = null;
      if (headerInfo.estabelecimento) {
        const allUnits = await db.select().from(units);
        const match = allUnits.find(u => 
          headerInfo.estabelecimento.toLowerCase().includes(u.name.toLowerCase()) ||
          headerInfo.estabelecimento.toLowerCase().includes((u.city || '').toLowerCase())
        );
        if (match) unitId = match.id;
      }
      
      const result = await db.insert(fortesRequisitions).values({
        code,
        unitName: headerInfo.estabelecimento || null,
        unitId,
        requestedBy: headerInfo.usuario || 'Fortes AG (PDF)',
        notes: headerInfo.observacao || null,
        urgency: 'normal',
        items: items as any,
        status: 'pending',
      });
      
      // Archive the original PDF in S3
      let archiveUrl = '';
      let archiveKey = '';
      try {
        const { storagePut } = await import('../storage');
        const fileName = req.file.originalname || `fortes-${Date.now()}.pdf`;
        const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const key = `fortes-pdfs/${Date.now()}-${safeFileName}`;
        const uploadResult = await storagePut(key, req.file.buffer, 'application/pdf');
        archiveUrl = uploadResult.url;
        archiveKey = uploadResult.key;
        
        // Save archive record
        const { sql: rawSql } = await import('drizzle-orm');
        await db.execute(rawSql`
          INSERT INTO fortes_pdf_archive (fileName, fileUrl, fileKey, unitId, unitName, category, coletaNumber, periodo, observacao, itemCount, uploadedBy)
          VALUES (${fileName}, ${archiveUrl}, ${archiveKey}, ${unitId}, ${headerInfo.estabelecimento || null}, ${headerInfo.category || null}, ${headerInfo.numColeta || null}, ${headerInfo.periodo || null}, ${headerInfo.observacao || null}, ${items.length}, ${null})
        `);
      } catch (archiveErr: any) {
        console.error('[Fortes PDF] Archive error (non-fatal):', archiveErr.message);
      }
      
      res.json({
        success: true,
        code,
        id: Number(result[0].insertId),
        header: headerInfo,
        itemCount: items.length,
        items,
        unitId,
        message: `PDF processado: ${items.length} itens extraídos de ${headerInfo.estabelecimento || 'unidade não identificada'}`,
        archiveUrl,
      });
    } catch (err: any) {
      console.error('[Fortes PDF] Error parsing PDF:', err);
      res.status(500).json({ error: `Erro ao processar PDF: ${err.message}` });
    }
  });

  // ==================== UPLOAD INVOICE PHOTO ====================
  app.post('/api/upload-invoice', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      
      // Validate file type (images only)
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: 'Formato inválido. Aceito: JPEG, PNG, WEBP, HEIC' });
      }
      
      // Validate size (max 5MB)
      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'Arquivo muito grande. Máximo: 5MB' });
      }
      
      const { storagePut } = await import('../storage');
      const ext = req.file.originalname.split('.').pop() || 'jpg';
      const fileName = `invoices/nf_${Date.now()}.${ext}`;
      const { url } = await storagePut(fileName, req.file.buffer, req.file.mimetype);
      
      res.json({ url, fileName });
    } catch (err: any) {
      console.error('[Upload Invoice] Error:', err);
      res.status(500).json({ error: `Erro ao fazer upload: ${err.message}` });
    }
  });

  // ==================== COMPRA EMERGENCIAL — APROVAÇÃO/REJEIÇÃO POR TOKEN ====================
  app.get('/api/emergency/approve/:token', async (req, res) => {
    try {
      const { token } = req.params;
      const { getDb } = await import('../db');
      const database = await getDb();
      if (!database) return res.status(500).send('<html><body><h1>Erro interno</h1></body></html>');
      const { emergencyPurchaseRequests, purchaseOrders, purchaseOrderItems } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      // Find request by token
      const [request] = await database.select().from(emergencyPurchaseRequests).where(eq(emergencyPurchaseRequests.approvalToken, token)).limit(1);
      if (!request) return res.status(404).send('<html><body style="font-family:Inter,sans-serif;text-align:center;padding:40px"><h1 style="color:#dc2626">Token Inválido</h1><p>Este link de aprovação não foi encontrado ou já expirou.</p></body></html>');
      if (request.status !== 'pending_approval') return res.status(400).send(`<html><body style="font-family:Inter,sans-serif;text-align:center;padding:40px"><h1>Solicitação já ${request.status === 'approved' ? 'aprovada' : request.status === 'rejected' ? 'rejeitada' : 'expirada'}</h1><p>Esta compra emergencial já foi processada.</p></body></html>`);
      if (request.approvalTokenExpiresAt && new Date(request.approvalTokenExpiresAt) < new Date()) {
        await database.update(emergencyPurchaseRequests).set({ status: 'expired' }).where(eq(emergencyPurchaseRequests.id, request.id));
        return res.status(400).send('<html><body style="font-family:Inter,sans-serif;text-align:center;padding:40px"><h1 style="color:#dc2626">Link Expirado</h1><p>Este link expirou. Solicite uma nova compra emergencial.</p></body></html>');
      }
      // Get Master user
      const { getUserByEmail } = await import('../db');
      const masterUser = await getUserByEmail('afonsoqueirogagn@gmail.com');
      // Generate emergency order
      const deficitItems = (request.deficitItems as any[]) || [];
      if (deficitItems.length === 0) return res.status(400).send('<html><body><h1>Erro</h1><p>Nenhum item no déficit.</p></body></html>');
      const totalValue = deficitItems.reduce((sum: number, d: any) => sum + (d.deficit * d.emergencyUnitPrice), 0);
      const ts = Date.now().toString(36).toUpperCase();
      const code = `EMG-${ts}-${request.emergencySupplierId}`.slice(0, 20);
      // Get original order for period/unit
      const [origOrder] = await database.select().from(purchaseOrders).where(eq(purchaseOrders.id, request.originalOrderId)).limit(1);
      const { createPurchaseOrder, createPurchaseOrderItems, updatePurchaseOrder } = await import('../db');
      const orderId = await createPurchaseOrder({
        code,
        quotationId: request.quotationId || origOrder?.quotationId || null,
        proposalId: null,
        supplierId: request.emergencySupplierId,
        unitId: origOrder?.unitId || null,
        createdBy: masterUser?.id || request.requestedBy,
        totalValue: totalValue.toFixed(2),
        notes: `COMPRA EMERGENCIAL — Pedido original: ${origOrder?.code || request.originalOrderId}. Justificativa: ${request.justification}`,
        purchaseGroupId: `EMG-${request.id}`,
        period: origOrder?.period || null,
      });
      await createPurchaseOrderItems(deficitItems.map((d: any) => ({
        orderId,
        productName: d.productName,
        quantity: String(d.deficit),
        unit: d.unit,
        unitPrice: String(d.emergencyUnitPrice.toFixed(2)),
        totalPrice: String((d.deficit * d.emergencyUnitPrice).toFixed(2)),
      })));
      // Auto-approve
      await updatePurchaseOrder(orderId, { status: 'approved', approvedBy: masterUser?.id || 0, approvedAt: new Date() });
      // Update request
      await database.update(emergencyPurchaseRequests).set({
        status: 'approved',
        approvedBy: masterUser?.id || 0,
        approvedAt: new Date(),
        generatedOrderId: orderId,
      }).where(eq(emergencyPurchaseRequests.id, request.id));
      // Notify requester via bell
      try {
        const { createUserNotification } = await import('../routers');
        await createUserNotification({
          userId: request.requestedBy,
          type: 'system' as any,
          title: `Compra emergencial APROVADA — ${code}`,
          message: `Sua solicitação de compra emergencial foi aprovada pelo ADM Master. Pedido ${code} gerado com ${deficitItems.length} item(ns), total R$ ${totalValue.toFixed(2)}.`,
          priority: 'critical',
          relatedEntityType: 'purchase_order',
          relatedEntityId: orderId,
          actionUrl: '/pedidos',
        });
      } catch { /* best-effort */ }
      // Audit log
      try {
        const { createAuditLog } = await import('../db');
        await createAuditLog({
          userId: masterUser?.id || 0, userName: 'ADM Master', userEmail: 'afonsoqueirogagn@gmail.com',
          action: 'approve_emergency_purchase', entityType: 'purchase_order', entityId: orderId,
          details: { requestId: request.id, originalOrderId: request.originalOrderId, code, totalValue: totalValue.toFixed(2), itemCount: deficitItems.length, severity: 'critical' },
        });
      } catch { /* best-effort */ }
      res.send(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Inter,system-ui,sans-serif;text-align:center;padding:40px 20px;background:#f0fdf4}h1{color:#16a34a;font-size:24px}p{color:#374151;font-size:16px;line-height:1.6}.code{font-family:monospace;background:#dcfce7;padding:4px 12px;border-radius:6px;font-size:18px;font-weight:bold}.total{font-size:20px;font-weight:bold;color:#16a34a}.box{background:white;border-radius:12px;padding:24px;max-width:500px;margin:0 auto;box-shadow:0 4px 6px rgba(0,0,0,0.1)}</style></head><body><div class="box"><h1>✅ Compra Emergencial Aprovada</h1><p>Pedido <span class="code">${code}</span> gerado com sucesso.</p><p>${deficitItems.length} item(ns) | Fornecedor: ${request.emergencySupplierName}</p><p class="total">Total: R$ ${totalValue.toFixed(2)}</p><p style="margin-top:20px;font-size:14px;color:#6b7280">O pedido já está disponível no QualiCompras para exportação CSV Fortes.</p><a href="https://qualicompra.manus.space/pedidos" style="display:inline-block;margin-top:16px;padding:10px 24px;background:#1b2a4e;color:white;border-radius:8px;text-decoration:none;font-weight:600">Abrir QualiCompras</a></div></body></html>`);
    } catch (err: any) {
      console.error('[Emergency Approve] Error:', err);
      res.status(500).send('<html><body style="font-family:Inter,sans-serif;text-align:center;padding:40px"><h1 style="color:#dc2626">Erro</h1><p>' + (err.message || 'Erro interno') + '</p></body></html>');
    }
  });

  app.get('/api/emergency/reject/:token', async (req, res) => {
    try {
      const { token } = req.params;
      const { getDb } = await import('../db');
      const database = await getDb();
      if (!database) return res.status(500).send('Erro interno');
      const { emergencyPurchaseRequests } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const [request] = await database.select().from(emergencyPurchaseRequests).where(eq(emergencyPurchaseRequests.approvalToken, token)).limit(1);
      if (!request) return res.status(404).send('<html><body style="font-family:Inter,sans-serif;text-align:center;padding:40px"><h1 style="color:#dc2626">Token Inválido</h1></body></html>');
      if (request.status !== 'pending_approval') return res.status(400).send(`<html><body style="font-family:Inter,sans-serif;text-align:center;padding:40px"><h1>Já processada</h1></body></html>`);
      // Show rejection form
      const reason = req.query.reason as string;
      if (!reason) {
        return res.send(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Inter,system-ui,sans-serif;text-align:center;padding:40px 20px;background:#fef2f2}h1{color:#dc2626;font-size:24px}.box{background:white;border-radius:12px;padding:24px;max-width:500px;margin:0 auto;box-shadow:0 4px 6px rgba(0,0,0,0.1)}textarea{width:100%;padding:12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;min-height:80px;margin:12px 0}button{padding:10px 24px;background:#dc2626;color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:16px}</style></head><body><div class="box"><h1>❌ Rejeitar Compra Emergencial</h1><p>Fornecedor: ${request.emergencySupplierName} | R$ ${request.totalEstimated}</p><form method="GET"><label style="font-weight:600;display:block;text-align:left">Motivo da rejeição:</label><textarea name="reason" required placeholder="Explique o motivo da rejeição..."></textarea><button type="submit">Confirmar Rejeição</button></form></div></body></html>`);
      }
      // Process rejection
      await database.update(emergencyPurchaseRequests).set({ status: 'rejected', rejectionReason: reason }).where(eq(emergencyPurchaseRequests.id, request.id));
      // Notify requester
      try {
        const { createUserNotification } = await import('../routers');
        await createUserNotification({
          userId: request.requestedBy,
          type: 'system' as any,
          title: `Compra emergencial REJEITADA`,
          message: `Sua solicitação de compra emergencial com ${request.emergencySupplierName} foi rejeitada. Motivo: ${reason}`,
          priority: 'high',
          relatedEntityType: 'purchase_order',
          relatedEntityId: request.originalOrderId,
          actionUrl: '/pedidos',
        });
      } catch { /* best-effort */ }
      // Audit
      try {
        const { createAuditLog } = await import('../db');
        const { getUserByEmail } = await import('../db');
        const masterUser = await getUserByEmail('afonsoqueirogagn@gmail.com');
        await createAuditLog({
          userId: masterUser?.id || 0, userName: 'ADM Master', userEmail: 'afonsoqueirogagn@gmail.com',
          action: 'reject_emergency_purchase', entityType: 'purchase_order', entityId: request.originalOrderId,
          details: { requestId: request.id, reason, severity: 'critical' },
        });
      } catch { /* best-effort */ }
      res.send('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:Inter,sans-serif;text-align:center;padding:40px 20px;background:#fef2f2"><div style="background:white;border-radius:12px;padding:24px;max-width:500px;margin:0 auto;box-shadow:0 4px 6px rgba(0,0,0,0.1)"><h1 style="color:#dc2626">❌ Compra Emergencial Rejeitada</h1><p>O solicitante foi notificado.</p><a href="https://qualicompra.manus.space/pedidos" style="display:inline-block;margin-top:16px;padding:10px 24px;background:#1b2a4e;color:white;border-radius:8px;text-decoration:none;font-weight:600">Abrir QualiCompras</a></div></body></html>');
    } catch (err: any) {
      console.error('[Emergency Reject] Error:', err);
      res.status(500).send('Erro: ' + (err.message || 'Erro interno'));
    }
  });

  // ==================== APROVAÇÃO/REJEIÇÃO DE EDIÇÃO DE PEDIDO ====================
  app.get('/api/order-edit/:token/approve', async (req, res) => {
    try {
      const { token } = req.params;
      const { getDb, getUserByEmail, createAuditLog } = await import('../db');
      const database = await getDb();
      if (!database) return res.status(500).send('Erro interno');
      const { orderEditRequests } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const rows = await database.select().from(orderEditRequests).where(eq(orderEditRequests.approvalToken, token)).limit(1);
      const request = rows[0];
      if (!request) return res.status(404).send('<html><body style="font-family:Inter,sans-serif;text-align:center;padding:40px"><h1 style="color:#dc2626">Token Inválido</h1></body></html>');
      if (request.status !== 'pending') return res.status(400).send('<html><body style="font-family:Inter,sans-serif;text-align:center;padding:40px"><h1>Já processada</h1></body></html>');
      const masterUser = await getUserByEmail('afonsoqueirogagn@gmail.com');
      // Apply the change
      if (request.requestType === 'change_quantity' && request.itemId && request.newValue) {
        const { updatePurchaseOrderItemFull } = await import('../db');
        const newData = JSON.parse(request.newValue);
        await updatePurchaseOrderItemFull(request.itemId, request.orderId, { quantity: String(newData.quantity) });
      } else if (request.requestType === 'remove_item' && request.itemId) {
        const { deletePurchaseOrderItem } = await import('../db');
        await deletePurchaseOrderItem(request.itemId, request.orderId);
      } else if (request.requestType === 'add_item' && request.newValue) {
        const { addPurchaseOrderItem } = await import('../db');
        const newItem = JSON.parse(request.newValue);
        const totalPrice = (parseFloat(newItem.quantity) * parseFloat(newItem.unitPrice)).toFixed(2);
        await addPurchaseOrderItem(request.orderId, { productName: newItem.productName, quantity: newItem.quantity, unit: newItem.unit, unitPrice: newItem.unitPrice, totalPrice, brand: newItem.brand || null });
      }
      await database.update(orderEditRequests).set({ status: 'approved', reviewedBy: masterUser?.id || 0, reviewedAt: new Date() }).where(eq(orderEditRequests.id, request.id));
      // Notify requester
      try {
        const { createUserNotification } = await import('../routers');
        const typeLabels: Record<string, string> = { change_quantity: "alteração de quantidade", add_item: "adição de item", remove_item: "exclusão de item" };
        await createUserNotification({ userId: request.requestedBy, type: 'system' as any, title: `Solicitação APROVADA`, message: `Sua solicitação de ${typeLabels[request.requestType]} no pedido #${request.orderId} foi aprovada.`, priority: 'high', relatedEntityType: 'purchase_order', relatedEntityId: request.orderId, actionUrl: '/pedidos' });
      } catch { /* best-effort */ }
      await createAuditLog({ userId: masterUser?.id || 0, userName: 'ADM Master', userEmail: 'afonsoqueirogagn@gmail.com', action: 'approve_order_edit', entityType: 'purchase_order', entityId: request.orderId, details: { requestId: request.id, requestType: request.requestType, severity: 'warning' } });
      const typeLabels: Record<string, string> = { change_quantity: "Alteração de Quantidade", add_item: "Adição de Item", remove_item: "Exclusão de Item" };
      res.send(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:Inter,system-ui,sans-serif;text-align:center;padding:40px 20px;background:#f0fdf4"><div style="background:white;border-radius:12px;padding:24px;max-width:500px;margin:0 auto;box-shadow:0 4px 6px rgba(0,0,0,0.1)"><h1 style="color:#16a34a">✅ ${typeLabels[request.requestType]} Aprovada</h1><p>Pedido #${request.orderId} atualizado com sucesso.</p><p style="font-size:14px;color:#6b7280">Solicitante: ${request.requestedByName}</p><a href="https://qualicompra.manus.space/pedidos" style="display:inline-block;margin-top:16px;padding:10px 24px;background:#1b2a4e;color:white;border-radius:8px;text-decoration:none;font-weight:600">Abrir QualiCompras</a></div></body></html>`);
    } catch (err: any) {
      console.error('[Order Edit Approve] Error:', err);
      res.status(500).send('Erro: ' + (err.message || 'Erro interno'));
    }
  });

  app.get('/api/order-edit/:token/reject', async (req, res) => {
    try {
      const { token } = req.params;
      const { getDb, getUserByEmail, createAuditLog } = await import('../db');
      const database = await getDb();
      if (!database) return res.status(500).send('Erro interno');
      const { orderEditRequests } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const rows = await database.select().from(orderEditRequests).where(eq(orderEditRequests.approvalToken, token)).limit(1);
      const request = rows[0];
      if (!request) return res.status(404).send('<html><body style="font-family:Inter,sans-serif;text-align:center;padding:40px"><h1 style="color:#dc2626">Token Inválido</h1></body></html>');
      if (request.status !== 'pending') return res.status(400).send('<html><body style="font-family:Inter,sans-serif;text-align:center;padding:40px"><h1>Já processada</h1></body></html>');
      const masterUser = await getUserByEmail('afonsoqueirogagn@gmail.com');
      await database.update(orderEditRequests).set({ status: 'rejected', reviewedBy: masterUser?.id || 0, reviewedAt: new Date() }).where(eq(orderEditRequests.id, request.id));
      try {
        const { createUserNotification } = await import('../routers');
        const typeLabels: Record<string, string> = { change_quantity: "alteração de quantidade", add_item: "adição de item", remove_item: "exclusão de item" };
        await createUserNotification({ userId: request.requestedBy, type: 'system' as any, title: `Solicitação REJEITADA`, message: `Sua solicitação de ${typeLabels[request.requestType]} no pedido #${request.orderId} foi rejeitada.`, priority: 'high', relatedEntityType: 'purchase_order', relatedEntityId: request.orderId, actionUrl: '/pedidos' });
      } catch { /* best-effort */ }
      await createAuditLog({ userId: masterUser?.id || 0, userName: 'ADM Master', userEmail: 'afonsoqueirogagn@gmail.com', action: 'reject_order_edit', entityType: 'purchase_order', entityId: request.orderId, details: { requestId: request.id, requestType: request.requestType, severity: 'info' } });
      res.send('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:Inter,sans-serif;text-align:center;padding:40px 20px;background:#fef2f2"><div style="background:white;border-radius:12px;padding:24px;max-width:500px;margin:0 auto;box-shadow:0 4px 6px rgba(0,0,0,0.1)"><h1 style="color:#dc2626">❌ Solicitação Rejeitada</h1><p>O solicitante foi notificado.</p><a href="https://qualicompra.manus.space/pedidos" style="display:inline-block;margin-top:16px;padding:10px 24px;background:#1b2a4e;color:white;border-radius:8px;text-decoration:none;font-weight:600">Abrir QualiCompras</a></div></body></html>');
    } catch (err: any) {
      console.error('[Order Edit Reject] Error:', err);
      res.status(500).send('Erro: ' + (err.message || 'Erro interno'));
    }
  });

  // ==================== DOWNLOAD CSV FORTES ====================
  app.get('/api/orders/:id/csv', async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      if (!orderId || isNaN(orderId)) return res.status(400).json({ error: 'ID inválido' });

      const { getDb } = await import('../db');
      const db = await getDb();
      if (!db) return res.status(500).json({ error: 'Database unavailable' });

      const { purchaseOrders, purchaseOrderItems, fortesItems, units } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const { sql: rawSql } = await import('drizzle-orm');

      // Get order
      const orderResult = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, orderId)).limit(1);
      if (!orderResult[0]) return res.status(404).json({ error: 'Pedido não encontrado' });
      const order = orderResult[0];

      // Get items
      const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, orderId));
      if (items.length === 0) return res.status(400).json({ error: 'Pedido sem itens' });

      // Get Fortes items for code mapping
      const allFortesItems = await db.select().from(fortesItems).where(eq(fortesItems.active, true));

      // Get supplier Fortes code
      let supplierFortesCode = 'SEM_CODIGO';
      if (order.supplierId) {
        // Determine which empresa based on unit
        let empresa = '0032'; // default
        if (order.unitId) {
          const [unitRows] = await db.execute(
            rawSql`SELECT fortesEmpresa FROM units WHERE id = ${order.unitId} LIMIT 1`
          );
          const unitArr = unitRows as unknown as any[];
          if (unitArr && unitArr[0]?.fortesEmpresa) {
            empresa = unitArr[0].fortesEmpresa;
          }
        }
        // Try primary empresa first, then fallback to any empresa
        const [codeRows] = await db.execute(
          rawSql`SELECT fortesCode, empresaCode FROM supplier_fortes_codes WHERE supplierId = ${order.supplierId} ORDER BY CASE WHEN empresaCode = ${empresa} THEN 0 ELSE 1 END LIMIT 1`
        );
        const codeResult = codeRows as unknown as any[];
        if (codeResult && codeResult[0]) {
          supplierFortesCode = String(codeResult[0].fortesCode);
        }
      }

      // Get estabelecimento code
      let estabelecimento = '';
      if (order.unitId) {
        const [estRows] = await db.execute(
          rawSql`SELECT fortesEstabelecimento FROM units WHERE id = ${order.unitId} LIMIT 1`
        );
        const estArr = estRows as unknown as any[];
        if (estArr && estArr[0]?.fortesEstabelecimento) {
          estabelecimento = estArr[0].fortesEstabelecimento;
        }
      }

      // Normalize for fuzzy matching
      const normalize = (str: string) => str
        .toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const findFortesCode = (productName: string) => {
        const normProduct = normalize(productName);
        let match = allFortesItems.find(fi => normalize(fi.name) === normProduct);
        if (match) return match;
        match = allFortesItems.find(fi => {
          const normFortes = normalize(fi.name);
          return normFortes.includes(normProduct) || normProduct.includes(normFortes);
        });
        if (match) return match;
        const firstWord = normProduct.split(' ')[0];
        if (firstWord.length >= 4) {
          match = allFortesItems.find(fi => normalize(fi.name).startsWith(firstWord));
        }
        return match || null;
      };

      // Build CSV: CodigoFornecedor,CodigoEstabelecimento,CodigoItem,Descricao,AjusteSaldo,AjusteCustoMedio
      // Get coleta number from quotation
      let coletaNumber = '';
      if (order.quotationId) {
        const { quotations } = await import('../../drizzle/schema');
        const quotResult = await db.select().from(quotations).where(eq(quotations.id, order.quotationId)).limit(1);
        if (quotResult[0]?.coletaNumber) {
          coletaNumber = quotResult[0].coletaNumber;
        }
      }

      // Build CSV with metadata header + product lines (no estabelecimento in product rows)
      const metaLines = [
        `#CodigoFornecedor,${supplierFortesCode}`,
        `#CodigoEstabelecimento,${estabelecimento}`,
        `#NumeroColeta,${coletaNumber}`,
      ];
      const header = 'CodigoItem,Descricao,AjusteSaldo,AjusteCustoMedio';
      const rows = items.map(item => {
        const qty = parseFloat(String(item.quantity)) || 0;
        const unitPrice = parseFloat(String(item.unitPrice)) || 0;
        const fortesMatch = findFortesCode(item.productName);
        const itemCode = fortesMatch ? fortesMatch.code : 'SEM_CODIGO';
        const itemName = fortesMatch ? fortesMatch.name : item.productName.toUpperCase();
        return `${itemCode},${itemName},${qty.toFixed(4)},${unitPrice.toFixed(4)}`;
      });
      const csvContent = [...metaLines, header, ...rows].join('\r\n');

      // Set headers to force file download
      const fileName = `FORTES-${order.code || 'PEDIDO'}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(csvContent);
    } catch (err: any) {
      console.error('[CSV Fortes] Error:', err);
      res.status(500).json({ error: `Erro ao gerar CSV: ${err.message}` });
    }
  });

  // ==================== SCHEDULED JOBS ====================
  app.post('/api/scheduled/monthly-report', async (req, res) => {
    // Validate internal caller (Heartbeat SDK or admin)
    const scheduleKey = (req.headers['x-schedule-key'] as string) || (req.headers['authorization'] as string)?.replace('Bearer ', '');
    const validKeys = [process.env.BUILT_IN_FORGE_API_KEY, process.env.JWT_SECRET].filter(Boolean);
    if (!scheduleKey || !validKeys.includes(scheduleKey)) {
      console.warn(`[Security] Scheduled endpoint: unauthorized access | IP: ${req.ip}`);
      return res.status(401).json({ error: 'Acesso n\u00e3o autorizado ao endpoint agendado.' });
    }
    try {
      const { generateMonthlyReportData, generateMonthlyReportPDF, generateWhatsAppSummary } = await import('../monthlyReport');
      const { storagePut } = await import('../storage');
      const { notifyOwner } = await import('./notification');

      // Determine which month to report on (previous month)
      const now = new Date();
      const reportMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // previous month
      const reportYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

      console.log(`[Monthly Report] Generating report for ${reportMonth}/${reportYear}`);

      // Generate report data
      const reportData = await generateMonthlyReportData(reportMonth, reportYear);

      if (reportData.summary.totalOrders === 0) {
        console.log('[Monthly Report] No orders in period, skipping.');
        return res.json({ success: true, message: 'No orders in period, report skipped.' });
      }

      // Generate PDF
      const pdfBuffer = await generateMonthlyReportPDF(reportData);

      // Upload to S3
      const fileName = `relatorios/mensal_${reportYear}_${String(reportMonth).padStart(2, '0')}.pdf`;
      const { url: pdfUrl } = await storagePut(fileName, pdfBuffer, 'application/pdf');

      // Get full public URL for sharing
      const baseUrl = process.env.VITE_APP_URL || `https://${req.get('host')}`;
      const fullPdfUrl = `${baseUrl}${pdfUrl}`;

      // Send notification to owner
      await notifyOwner({
        title: `📊 Relatório Mensal de Compras — ${reportData.period.label}`,
        content: [
          `Total Comprado: R$ ${reportData.summary.totalPurchased.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          `Economia: R$ ${reportData.savings.totalSavings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${reportData.savings.savingsPercent.toFixed(1)}%)`,
          `Pedidos: ${reportData.summary.totalOrders} | Fornecedores: ${reportData.summary.totalSuppliers}`,
          `PDF: ${fullPdfUrl}`,
        ].join('\n'),
      });

      // Generate WhatsApp message
      const whatsappMsg = generateWhatsAppSummary(reportData, fullPdfUrl);

      console.log(`[Monthly Report] Report generated successfully. PDF: ${pdfUrl}`);

      res.json({
        success: true,
        period: reportData.period.label,
        summary: reportData.summary,
        savings: reportData.savings,
        pdfUrl: fullPdfUrl,
        whatsappMessage: whatsappMsg,
      });
    } catch (err: any) {
      console.error('[Monthly Report] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
