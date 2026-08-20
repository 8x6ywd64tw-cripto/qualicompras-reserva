import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { uploadFile, trySendEmail } from "./service-wrapper";

// Session expires after 7 days (better UX for mobile/Safari users) 
const SESSION_EXPIRY_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, writeProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { sdk } from "./_core/sdk";
import { z } from "zod";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import * as db from "./db";
import { computeScenarios, type ScenarioItemInput } from "@shared/scenarios";
import { consolidateOrders, comparePurchases, findBestReference, calculateEvolution, type BasketItem, type ConsolidatedPurchase } from "./purchaseComparison";

// Helper: extract period from quotation title or notes (used in order generation)
function extractPeriodFromQuotation(quotation: { title?: string | null; notes?: string | null } | null): string | null {
  if (!quotation) return null;
  const titleMatch = quotation.title?.match(/(\d{2}\/\d{2}(?:\/\d{2,4})?)\s*a\s*(\d{2}\/\d{2}(?:\/\d{2,4})?)/);
  if (titleMatch) return titleMatch[0];
  const notesStr = quotation.notes || '';
  const consumoMatch = notesStr.match(/CONSUMO\s*[-–]\s*(\d{2})[.\/](\d{2})\s*A\s*(\d{2})[.\/](\d{2})/i);
  if (consumoMatch) return `${consumoMatch[1]}/${consumoMatch[2]} a ${consumoMatch[3]}/${consumoMatch[4]}`;
  const notesDateMatch = notesStr.match(/(\d{2}\/\d{2}(?:\/\d{2,4})?)\s*a\s*(\d{2}\/\d{2}(?:\/\d{2,4})?)/);
  if (notesDateMatch) return notesDateMatch[0];
  return null;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => {
      if (!opts.ctx.user) return null;
      const { passwordHash, ...safeUser } = opts.ctx.user;
      return safeUser;
    }),
    login: publicProcedure.input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
      operatorName: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      // Check authentication: individual password first, then universal
      const existingUser = await db.getUserByEmail(input.email);
      
      if (existingUser?.passwordHash) {
        // User has individual password - ONLY their personal password works (exclusive)
        const valid = await bcrypt.compare(input.password, existingUser.passwordHash);
        if (!valid) {
          throw new Error("Senha inválida");
        }
      } else {
        // No individual password - check universal
        const UNIVERSAL_PASSWORD = await db.getUniversalPassword();
        if (input.password !== UNIVERSAL_PASSWORD) {
          throw new Error("Senha inválida");
        }
      }

      // Get or create user
      let user = await db.getUserByEmail(input.email);
      if (!user) {
        // First login - operator name is required
        if (!input.operatorName?.trim()) {
          throw new Error("FIRST_LOGIN_NEEDS_NAME");
        }
        const openId = `local_${nanoid(16)}`;
        await db.upsertUser({
          openId,
          name: input.operatorName.trim(),
          email: input.email,
          loginMethod: "email",
          role: "comprador",
          lastSignedIn: new Date(),
        });
        user = await db.getUserByEmail(input.email);
        if (!user) throw new Error("Erro ao criar conta");
      } else {
        // Existing user - check if name is generic/missing and needs to be set
        const genericNames = ["Qualities Refeições", "Admin", "Teste", ""];
        const isGenericName = !user.name || genericNames.includes(user.name);
        if (isGenericName) {
          if (!input.operatorName?.trim()) {
            throw new Error("FIRST_LOGIN_NEEDS_NAME");
          }
          await db.upsertUser({ openId: user.openId, name: input.operatorName.trim(), lastSignedIn: new Date() });
        } else {
          // Name already set permanently - never changes
          await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
        }
      }

      // Determine the actual name to use:
      // - For new users: user was just created with operatorName, so use it
      // - For existing users with generic names: name was just updated, use operatorName
      // - For existing users with real names: always use their existing name (never override)
      const genericNames2 = ["Qualities Refeições", "Admin", "Teste", ""];
      const wasGenericName = !user.name || genericNames2.includes(user.name);
      const actualName = wasGenericName ? (input.operatorName?.trim() || user.name || "") : (user.name || "");

      // Create session token with 8h expiry (security: auto-logout after inactivity)
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: actualName,
        expiresInMs: SESSION_EXPIRY_MS,
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_EXPIRY_MS });
      // Also set a non-HttpOnly marker cookie so client JS (even old cached versions)
      // can detect that a session exists. The actual auth uses the HttpOnly cookie above.
      ctx.res.cookie('app_session_active', '1', {
        path: '/',
        sameSite: 'lax' as const,
        secure: cookieOptions.secure,
        httpOnly: false,
        maxAge: SESSION_EXPIRY_MS,
      });
      
      // IP Logging: register this login session and check for suspicious multi-IP activity
      const loginIp = (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || ctx.req.socket?.remoteAddress || "unknown";
      const loginUserAgent = ctx.req.headers["user-agent"] || "";
      try {
        await db.recordLoginSession({
          userId: user.id,
          userName: actualName,
          userEmail: user.email || "",
          ipAddress: loginIp,
          userAgent: loginUserAgent,
        });
        // Check if same user logged in from different IP in last 1h
        const suspiciousLogin = await db.checkMultiIpLogin(user.id, loginIp);
        if (suspiciousLogin) {
          // Import and queue WhatsApp alert
          const { pendingWhatsAppAlerts } = await import("./securityGuard");
          const title = `\u26a0\ufe0f LOGIN SUSPEITO - IPs M\u00daLTIPLOS`;
          const msg = `Usu\u00e1rio: ${actualName} (${user.email})\nIP atual: ${loginIp}\nIP anterior: ${suspiciousLogin.previousIp}\nIntervalo: menos de 1h\nPoss\u00edvel compartilhamento de credenciais`;
          const encoded = encodeURIComponent(`${title}\n\n${msg}`);
          pendingWhatsAppAlerts.push({
            phone: "5583993149365",
            title,
            message: msg,
            timestamp: new Date().toISOString(),
            whatsappUrl: `https://wa.me/5583993149365?text=${encoded}`,
          });
          if (pendingWhatsAppAlerts.length > 100) pendingWhatsAppAlerts.shift();
          // Also log as security event
          await db.createSecurityEvent({
            eventType: "multi_ip_login",
            userId: user.id,
            userName: actualName,
            description: `Login de IPs diferentes em <1h: ${loginIp} e ${suspiciousLogin.previousIp}`,
            ipAddress: loginIp,
            userAgent: loginUserAgent,
            details: { currentIp: loginIp, previousIp: suspiciousLogin.previousIp, userEmail: user.email },
          });
        }
      } catch (e) {
        console.error("[Security] IP logging error:", e);
      }
      
      return { success: true, user: { id: user.id, name: actualName, email: user.email, role: user.role }, sessionToken };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ==================== ADMIN SETTINGS (ADM MASTER ONLY) ====================
  adminSettings: router({
    // Get current universal password (only ADM Master can see)
    getPassword: protectedProcedure.query(async ({ ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      if (ctx.user.email !== MASTER_EMAIL) {
        throw new Error("Acesso negado. Apenas o ADM Master pode acessar esta configuração.");
      }
      const password = await db.getUniversalPassword();
      return { password };
    }),
    // Change universal password (only ADM Master can do this)
    changePassword: writeProcedure.input(z.object({
      newPassword: z.string().min(4, "A senha deve ter no mínimo 4 caracteres"),
    })).mutation(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      if (ctx.user.email !== MASTER_EMAIL) {
        throw new Error("Acesso negado. Apenas o ADM Master pode alterar a senha.");
      }
      await db.setSystemSetting("universal_password", input.newPassword, ctx.user.id);
      await db.createAuditLog({
        userId: ctx.user.id,
        userName: ctx.user.name || "",
        userEmail: ctx.user.email || "",
        action: "change_universal_password",
        entityType: "system_settings",
        entityId: 1,
        details: { changed: true },
      });
      return { success: true };
    }),
    // Check if current user is ADM Master
    isMaster: protectedProcedure.query(async ({ ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      return { isMaster: ctx.user.email === MASTER_EMAIL };
    }),
    // List all users (only Master)
    listUsers: protectedProcedure.query(async ({ ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      if (ctx.user.email !== MASTER_EMAIL) {
        throw new Error("Acesso restrito ao ADM Master");
      }
      return db.listAllUsers();
    }),
    // Update user role (only Master)
    updateRole: writeProcedure.input(z.object({
      userId: z.number(),
      role: z.enum(["admin", "comprador", "aprovador", "buyer_senior", "cotador"]),
    })).mutation(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      if (ctx.user.email !== MASTER_EMAIL) {
        throw new Error("Acesso restrito ao ADM Master");
      }
      // Prevent changing own role
      if (input.userId === ctx.user.id) {
        throw new Error("Você não pode alterar seu próprio papel");
      }
      await db.updateUserRole(input.userId, input.role);
      await db.createAuditLog({
        userId: ctx.user.id,
        userName: ctx.user.name || "",
        userEmail: ctx.user.email || "",
        action: "update_role",
        entityType: "users",
        entityId: input.userId,
        details: { newRole: input.role, targetUserId: input.userId },
        severity: "critical",
      });
      return { success: true };
    }),
  }),

  // ==================== DASHBOARD ====================
  dashboard: router({
    kpis: protectedProcedure.query(async () => {
      return db.getDashboardKPIs();
    }),
  }),

  // ==================== UNITS ====================
  units: router({
    list: protectedProcedure.query(async () => {
      return db.listUnits();
    }),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getUnit(input.id);
    }),
    create: writeProcedure.input(z.object({
      name: z.string().min(1),
      state: z.string().length(2),
      city: z.string().min(1),
      address: z.string().optional(),
      costCenter: z.string().optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const id = await db.createUnit(input);
      await db.createAuditLog({ userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "", action: "create_unit", entityType: "unit", entityId: id, details: input });
      return { id };
    }),
    update: writeProcedure.input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      state: z.string().length(2).optional(),
      city: z.string().min(1).optional(),
      address: z.string().optional(),
      costCenter: z.string().optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      active: z.boolean().optional(),
    })).mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await db.updateUnit(id, data);
      await db.createAuditLog({ userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "", action: "update_unit", entityType: "unit", entityId: id, details: data });
      return { success: true };
    }),
    // ADM Master only: delete unit
    delete: writeProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      if (ctx.user?.email !== MASTER_EMAIL) throw new Error("Apenas o ADM Master pode excluir unidades");
      await db.deleteUnit(input.id);
      await db.createAuditLog({ userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "", action: "delete_unit", entityType: "unit", entityId: input.id });
      return { success: true };
    }),
  }),

  // ==================== SUPPLIERS ====================
  suppliers: router({
    list: protectedProcedure.query(async () => {
      return db.listSuppliers();
    }),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getSupplier(input.id);
    }),
    create: writeProcedure.input(z.object({
      cnpj: z.string().optional(),
      companyName: z.string().min(1),
      tradeName: z.string().optional(),
      contactName: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      whatsapp: z.string().optional(),
      state: z.string().length(2).optional(),
      city: z.string().optional(),
      address: z.string().optional(),
      categories: z.array(z.string()).optional(),
      deliveryMode: z.string().optional(),
      deliveryDays: z.string().optional(),
      paymentTerms: z.string().optional(),
      paymentMethod: z.string().optional(),
      responsavelContato: z.string().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const id = await db.createSupplier(input);
      await auditSensitiveAction({
        userId: ctx.user.id, userEmail: ctx.user.email || "", userName: ctx.user.name || "",
        action: "create_supplier", entityType: "supplier", entityId: id,
        details: { companyName: input.companyName, cnpj: input.cnpj },
        severity: "warning",
        notifTitle: `Novo fornecedor cadastrado: ${input.companyName}`,
        notifMessage: `${ctx.user.name || ctx.user.email} cadastrou o fornecedor "${input.companyName}"${input.cnpj ? ` (CNPJ: ${input.cnpj})` : ''}.`,
        actionUrl: "/fornecedores",
      });
      return { id };
    }),
    update: writeProcedure.input(z.object({
      id: z.number(),
      cnpj: z.string().optional(),
      companyName: z.string().optional(),
      tradeName: z.string().optional(),
      contactName: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      whatsapp: z.string().optional(),
      state: z.string().length(2).optional(),
      city: z.string().optional(),
      address: z.string().optional(),
      categories: z.array(z.string()).optional(),
      deliveryMode: z.string().optional(),
      deliveryDays: z.string().optional(),
      paymentTerms: z.string().optional(),
      paymentMethod: z.string().optional(),
      responsavelContato: z.string().optional(),
      reliabilityScore: z.enum(["green", "yellow", "red"]).optional(),
      notes: z.string().optional(),
      active: z.boolean().optional(),
      supplierType: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await db.updateSupplier(id, data);
      const severity: AuditSeverity = data.supplierType ? "warning" : "info";
      await auditSensitiveAction({
        userId: ctx.user.id, userEmail: ctx.user.email || "", userName: ctx.user.name || "",
        action: "update_supplier", entityType: "supplier", entityId: id,
        details: data, severity,
        notifTitle: data.supplierType ? `Tipo de fornecedor alterado (ID ${id})` : undefined,
        notifMessage: data.supplierType ? `${ctx.user.name || ctx.user.email} alterou o tipo do fornecedor para "${data.supplierType}".` : undefined,
        actionUrl: "/fornecedores",
      });
      return { success: true };
    }),
    documents: protectedProcedure.input(z.object({ supplierId: z.number() })).query(async ({ input }) => {
      return db.listSupplierDocuments(input.supplierId);
    }),
    addDocument: writeProcedure.input(z.object({
      supplierId: z.number(),
      docType: z.string(),
      docName: z.string(),
      fileUrl: z.string().optional(),
      expiresAt: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const data = { ...input, expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined };
      const id = await db.createSupplierDocument(data);
      return { id };
    }),
    ratings: protectedProcedure.input(z.object({ supplierId: z.number() })).query(async ({ input }) => {
      return db.listSupplierRatings(input.supplierId);
    }),
    linkUnit: writeProcedure.input(z.object({
      supplierId: z.number(),
      unitId: z.number(),
      responsavelNaUnidade: z.string().optional(),
      escriturario: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      // Protect linkUnit with same Master/Junior policy
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      const JUNIOR_EMAIL = "frotas.patrimonio@qualities.com.br";
      if (ctx.user.email !== MASTER_EMAIL && ctx.user.email !== JUNIOR_EMAIL) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas ADM Master e Diretor de Compras podem vincular unidades" });
      }
      const id = await db.linkSupplierToUnit(input);
      await db.createAuditLog({ userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "", action: "link_supplier_unit", entityType: "supplier", entityId: input.supplierId, details: { unitId: input.unitId } });
      return { id };
    }),
    // Sync all unit links for a supplier (multi-unit assignment)
    syncUnits: writeProcedure.input(z.object({
      supplierId: z.number(),
      units: z.array(z.object({
        unitId: z.number(),
        responsavelNaUnidade: z.string().optional(),
        escriturario: z.string().optional(),
      })),
    })).mutation(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      const JUNIOR_EMAIL = "frotas.patrimonio@qualities.com.br";
      if (ctx.user.email !== MASTER_EMAIL && ctx.user.email !== JUNIOR_EMAIL) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas ADM Master e Diretor de Compras podem vincular unidades" });
      }
      const database = await db.getDb();
      if (!database) throw new Error("DB not available");
      const { sql } = await import("drizzle-orm");
      // Get existing links
      const existingLinks = await db.getSupplierUnits(input.supplierId);
      const existingUnitIds = new Set(existingLinks.filter(l => l.active).map(l => l.unitId));
      const desiredUnitIds = new Set(input.units.map(u => u.unitId));
      const added: number[] = [];
      const removed: number[] = [];
      const updated: number[] = [];
      // Add new links or reactivate inactive ones
      for (const u of input.units) {
        const existing = existingLinks.find(l => l.unitId === u.unitId);
        if (existing) {
          // Update existing link (reactivate if inactive, update fields)
          await database.execute(sql`UPDATE supplier_units SET active = true, responsavelNaUnidade = ${u.responsavelNaUnidade || null}, escriturario = ${u.escriturario || null} WHERE id = ${existing.id}`);
          if (!existing.active) added.push(u.unitId);
          else updated.push(u.unitId);
        } else {
          // Insert new link (with dedup check)
          const [dupCheck] = await database.execute(sql`SELECT id FROM supplier_units WHERE supplierId = ${input.supplierId} AND unitId = ${u.unitId}`) as any;
          if (dupCheck && dupCheck.length > 0) {
            await database.execute(sql`UPDATE supplier_units SET active = true, responsavelNaUnidade = ${u.responsavelNaUnidade || null}, escriturario = ${u.escriturario || null} WHERE id = ${dupCheck[0].id}`);
          } else {
            await database.execute(sql`INSERT INTO supplier_units (supplierId, unitId, responsavelNaUnidade, escriturario, active) VALUES (${input.supplierId}, ${u.unitId}, ${u.responsavelNaUnidade || null}, ${u.escriturario || null}, true)`);
          }
          added.push(u.unitId);
        }
      }
      // Deactivate links for units that were unchecked
      for (const existing of existingLinks) {
        if (existing.active && !desiredUnitIds.has(existing.unitId)) {
          await database.execute(sql`UPDATE supplier_units SET active = false WHERE id = ${existing.id}`);
          removed.push(existing.unitId);
        }
      }
      // Audit log
      await db.createAuditLog({
        userId: ctx.user.id,
        userName: ctx.user.name || "",
        userEmail: ctx.user.email || "",
        action: "sync_supplier_units",
        entityType: "supplier",
        entityId: input.supplierId,
        details: { added, removed, updated, totalUnits: input.units.length },
      });
      return { success: true, added: added.length, removed: removed.length, updated: updated.length, total: input.units.length };
    }),
    unitLinks: protectedProcedure.input(z.object({ supplierId: z.number() })).query(async ({ input }) => {
      return db.getSupplierUnits(input.supplierId);
    }),
    byUnit: protectedProcedure.input(z.object({ unitId: z.number() })).query(async ({ input }) => {
      return db.getSuppliersByUnit(input.unitId);
    }),
    searchPlaces: protectedProcedure.input(z.object({
      unitId: z.number(),
      sector: z.string(),
      radiusKm: z.number().min(10).max(500).optional().default(150),
    })).query(async ({ input }) => {
      const { makeRequest } = await import("./_core/map");
      // Get unit info for location context
      const unit = await db.getUnit(input.unitId);
      if (!unit) throw new Error("Unidade n\u00e3o encontrada");
      
      // Map sector to search keywords
      const sectorKeywords: Record<string, string> = {
        "Prote\u00edna": "frigor\u00edfico a\u00e7ougue distribuidora carnes",
        "Cereais": "distribuidora alimentos atacado supermercado",
        "Hortifruti": "hortifruti frutas verduras sacolao",
        "Limpeza": "distribuidora produtos limpeza higiene",
        "Descart\u00e1veis": "distribuidora embalagens descartaveis",
        "Cereais (Doces)": "distribuidora doces confeitaria",
        "P\u00e3o": "padaria panificadora",
        "G\u00e1s": "revenda gas glp ultragaz",
      };
      const keyword = sectorKeywords[input.sector] || input.sector;
      const query = `${keyword} ${unit.city} ${unit.state}`;
      
      // Use stored coordinates from the unit, fallback to geocoding if not available
      const radiusMeters = (input.radiusKm || 150) * 1000;
      let unitLat: number | null = unit.latitude ? parseFloat(String(unit.latitude)) : null;
      let unitLng: number | null = unit.longitude ? parseFloat(String(unit.longitude)) : null;
      
      if (!unitLat || !unitLng) {
        try {
          const geocodeResult = await makeRequest<any>("/maps/api/geocode/json", {
            address: `${unit.city}, ${unit.state}, Brazil`,
          });
          if (geocodeResult?.results?.[0]?.geometry?.location) {
            unitLat = geocodeResult.results[0].geometry.location.lat;
            unitLng = geocodeResult.results[0].geometry.location.lng;
          }
        } catch { /* fallback to text search without location */ }
      }
      
      // Search using Google Places Text Search with location bias when available
      const searchParams: any = { query, radius: radiusMeters };
      if (unitLat && unitLng) {
        searchParams.location = `${unitLat},${unitLng}`;
      }
      const searchResult = await makeRequest<any>("/maps/api/place/textsearch/json", searchParams);
      
      if (!searchResult?.results?.length) return [];
      
      // Helper to calculate distance between two coordinates (Haversine formula)
      const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng/2) * Math.sin(dLng/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      };
      
      // Filter results by actual distance if we have unit coordinates
      let filteredResults = searchResult.results;
      if (unitLat && unitLng) {
        filteredResults = searchResult.results.filter((place: any) => {
          if (!place.geometry?.location) return true;
          const dist = haversineKm(unitLat!, unitLng!, place.geometry.location.lat, place.geometry.location.lng);
          return dist <= (input.radiusKm || 150);
        });
      }
      
      // Get details (phone, website) for top 10 filtered results
      const detailed = await Promise.all(
        filteredResults.slice(0, 10).map(async (place: any) => {
          // Calculate distance for this place
          let distanceKm: number | null = null;
          if (unitLat && unitLng && place.geometry?.location) {
            distanceKm = Math.round(haversineKm(unitLat, unitLng, place.geometry.location.lat, place.geometry.location.lng));
          }
          try {
            const details = await makeRequest<any>("/maps/api/place/details/json", {
              place_id: place.place_id,
              fields: "name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,business_status",
            });
            return {
              placeId: place.place_id,
              name: details?.result?.name || place.name,
              address: details?.result?.formatted_address || place.formatted_address,
              phone: details?.result?.formatted_phone_number || details?.result?.international_phone_number || null,
              internationalPhone: details?.result?.international_phone_number || null,
              website: details?.result?.website || null,
              rating: details?.result?.rating || place.rating || null,
              totalRatings: details?.result?.user_ratings_total || place.user_ratings_total || 0,
              businessStatus: details?.result?.business_status || place.business_status || null,
              distanceKm,
            };
          } catch {
            return {
              placeId: place.place_id,
              name: place.name,
              address: place.formatted_address,
              phone: null,
              internationalPhone: null,
              website: null,
              rating: place.rating || null,
              totalRatings: place.user_ratings_total || 0,
              businessStatus: place.business_status || null,
              distanceKm,
            };
          }
        })
      );
      
            return detailed.filter((p: any) => p.businessStatus !== "CLOSED_PERMANENTLY");
    }),
    // ADM Master only: delete supplier
    delete: writeProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      if (ctx.user?.email !== MASTER_EMAIL) throw new Error("Apenas o ADM Master pode excluir fornecedores");
      await db.deleteSupplier(input.id);
      await db.createAuditLog({ userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "", action: "delete_supplier", entityType: "supplier", entityId: input.id });
      return { success: true };
    }),
    // ==================== PREFERRED SUPPLIERS ====================
    preferredList: protectedProcedure.query(async () => {
      const preferred = await db.getPreferredSuppliers();
      const allSuppliers = await db.listSuppliers();
      return preferred.map(ps => {
        const s = allSuppliers.find(sup => sup.id === ps.supplierId);
        return {
          ...ps,
          supplierName: s?.tradeName || s?.companyName || `ID ${ps.supplierId}`,
        };
      });
    }),
    addPreferred: writeProcedure.input(z.object({
      supplierId: z.number(),
      unitId: z.number().nullable().optional(),
      tolerancePct: z.number().min(0).max(20).default(3),
      reason: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      if (ctx.user?.email !== MASTER_EMAIL) throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas o ADM Master pode gerenciar fornecedores preferenciais.' });
      const database = await db.getDb();
      if (!database) throw new Error("DB not available");
      const { preferredSuppliers } = await import("../drizzle/schema");
      await database.insert(preferredSuppliers).values({
        supplierId: input.supplierId,
        unitId: input.unitId || null,
        tolerancePct: String(input.tolerancePct),
        reason: input.reason || null,
        createdBy: ctx.user.id,
      });
      return { success: true };
    }),
    removePreferred: writeProcedure.input(z.object({ supplierId: z.number() })).mutation(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      if (ctx.user?.email !== MASTER_EMAIL) throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas o ADM Master pode gerenciar fornecedores preferenciais.' });
      const database = await db.getDb();
      if (!database) throw new Error("DB not available");
      const { preferredSuppliers } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await database.delete(preferredSuppliers).where(eq(preferredSuppliers.supplierId, input.supplierId));
      return { success: true };
    }),
    updateType: writeProcedure.input(z.object({ supplierId: z.number(), supplierType: z.string() })).mutation(async ({ input }) => {
      const database = await db.getDb();
      if (!database) throw new Error("DB not available");
      const { sql } = await import("drizzle-orm");
      await database.execute(sql`UPDATE suppliers SET supplierType = ${input.supplierType} WHERE id = ${input.supplierId}`);
      return { success: true };
    }),
    // Quick edit Fortes codes without opening full profile
    updateFortesCode: writeProcedure.input(z.object({
      supplierId: z.number(),
      empresaCode: z.string(),
      fortesCode: z.string(),
    })).mutation(async ({ input, ctx }) => {
      const FORTES_CODE_EDITORS = [
        "afonsoqueirogagn@gmail.com",
        "frotas.patrimonio@qualities.com.br",
        "paularibeiro@qualities.com.br",
      ];
      if (!FORTES_CODE_EDITORS.includes(ctx.user.email || "")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Afonso, Júnior e Paula podem editar códigos Fortes" });
      }
      const database = await db.getDb();
      if (!database) throw new Error("DB not available");
      const { sql } = await import("drizzle-orm");
      if (!input.fortesCode.trim()) {
        // Remove code if empty
        await database.execute(sql`DELETE FROM supplier_fortes_codes WHERE supplierId = ${input.supplierId} AND empresaCode = ${input.empresaCode}`);
      } else {
        // Upsert
        const [existing] = await database.execute(sql`SELECT id FROM supplier_fortes_codes WHERE supplierId = ${input.supplierId} AND empresaCode = ${input.empresaCode}`) as any;
        if (existing && existing.length > 0) {
          await database.execute(sql`UPDATE supplier_fortes_codes SET fortesCode = ${input.fortesCode.trim()} WHERE id = ${existing[0].id}`);
        } else {
          await database.execute(sql`INSERT INTO supplier_fortes_codes (supplierId, empresaCode, fortesCode) VALUES (${input.supplierId}, ${input.empresaCode}, ${input.fortesCode.trim()})`);
        }
      }
      await auditSensitiveAction({
        userId: ctx.user.id, userEmail: ctx.user.email || "", userName: ctx.user.name || "",
        action: "update_fortes_code", entityType: "supplier", entityId: input.supplierId,
        details: { empresaCode: input.empresaCode, fortesCode: input.fortesCode },
        severity: "warning",
        notifTitle: `Código Fortes alterado (Fornecedor ${input.supplierId})`,
        notifMessage: `${ctx.user.name || ctx.user.email} alterou o código Fortes para "${input.fortesCode}" (empresa ${input.empresaCode}).`,
        actionUrl: "/fornecedores",
      });
      return { success: true };
    }),
    // Get Fortes codes for a supplier
    getFortesCode: protectedProcedure.input(z.object({ supplierId: z.number() })).query(async ({ input, ctx }) => {
      const FORTES_CODE_EDITORS = [
        "afonsoqueirogagn@gmail.com",
        "frotas.patrimonio@qualities.com.br",
        "paularibeiro@qualities.com.br",
      ];
      if (!FORTES_CODE_EDITORS.includes(ctx.user.email || "")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Afonso, Júnior e Paula podem acessar códigos Fortes nesta tela" });
      }
      const database = await db.getDb();
      if (!database) return [];
      const { sql } = await import("drizzle-orm");
      const [rows] = await database.execute(sql`SELECT empresaCode, fortesCode FROM supplier_fortes_codes WHERE supplierId = ${input.supplierId}`) as any;
      return (rows || []).map((r: any) => ({ empresaCode: String(r.empresaCode), fortesCode: String(r.fortesCode) }));
    }),
    // Returns all compatibility rules + supermercado blocked items for frontend comparativo display
    listAllIncompatibilities: protectedProcedure.query(async () => {
      const database = await db.getDb();
      if (!database) return { rules: [], supermercadoSupplierIds: [], blockedItems: [] };
      const { sql } = await import("drizzle-orm");
      const [rulesResult] = await database.execute(sql`SELECT supplierId, productKey, brandName, status, reason FROM supplier_item_compatibility WHERE status = 'nao_atende'`) as any;
      const rules = (rulesResult || []).map((r: any) => ({
        supplierId: Number(r.supplierId),
        productKey: String(r.productKey),
        brandName: r.brandName ? String(r.brandName) : null,
        reason: r.reason ? String(r.reason) : null,
      }));
      const [supResult] = await database.execute(sql`SELECT id FROM suppliers WHERE supplierType = 'supermercado' AND active = true`) as any;
      const supermercadoSupplierIds = (supResult || []).map((r: any) => Number(r.id));
      const SUPERMERCADO_BLOCKED_ITEMS = ["MARMITA", "HAMBURGUEIRA", "PALITO", "PERFLEX", "SACO DE LIXO", "FILME PVC", "LUVA", "TOUCA", "GUARDANAPO", "SACO PARA TALHER"];
      return { rules, supermercadoSupplierIds, blockedItems: SUPERMERCADO_BLOCKED_ITEMS };
    }),
    listCompatibility: protectedProcedure.input(z.object({ supplierId: z.number() })).query(async ({ input }) => {
      const database = await db.getDb();
      if (!database) return [];
      const { sql } = await import("drizzle-orm");
      const result = await database.execute(sql`SELECT * FROM supplier_item_compatibility WHERE supplierId = ${input.supplierId} ORDER BY productKey`);
      const rows = (result as any)?.[0] || result || [];
      return (rows as any[]).map((r: any) => ({ ...r, id: Number(r.id), supplierId: Number(r.supplierId), unitId: r.unitId ? Number(r.unitId) : null, createdBy: r.createdBy ? Number(r.createdBy) : null }));
    }),
    addCompatibility: writeProcedure.input(z.object({
      supplierId: z.number(),
      productKey: z.string(),
      status: z.enum(['atende', 'nao_atende', 'desconhecido']),
      reason: z.string().optional(),
      brandName: z.string().optional(),
      unitId: z.number().optional(),
    })).mutation(async ({ input, ctx }) => {
      const userId = (ctx as any).user?.id || 1;
      const database = await db.getDb();
      if (!database) throw new Error("DB not available");
      const { sql } = await import("drizzle-orm");
      await database.execute(sql`INSERT INTO supplier_item_compatibility (supplierId, productKey, brandName, unitId, status, reason, createdBy)
         VALUES (${input.supplierId}, ${input.productKey.toUpperCase()}, ${input.brandName || null}, ${input.unitId || null}, ${input.status}, ${input.reason || null}, ${userId})
         ON DUPLICATE KEY UPDATE status = VALUES(status), reason = VALUES(reason), updatedBy = VALUES(createdBy)`);
      return { success: true };
    }),
    removeCompatibility: writeProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const database = await db.getDb();
      if (!database) throw new Error("DB not available");
      const { sql } = await import("drizzle-orm");
      await database.execute(sql`DELETE FROM supplier_item_compatibility WHERE id = ${input.id}`);
      return { success: true };
    }),
    // ==================== BLOQUEIO TEMPORÁRIO DE COTAÇÃO ====================
    toggleQuotationBlock: writeProcedure.input(z.object({
      supplierId: z.number(),
      blocked: z.boolean(),
      reason: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      if (ctx.user?.email !== MASTER_EMAIL) throw new TRPCError({ code: 'FORBIDDEN', message: 'Somente o ADM Master pode bloquear/desbloquear fornecedores para cotação.' });
      const database = await db.getDb();
      if (!database) throw new Error("DB not available");
      const { suppliers: suppliersTable } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await database.update(suppliersTable).set({
        quotationBlocked: input.blocked,
        quotationBlockedReason: input.blocked ? (input.reason || 'Bloqueado pela diretoria') : null,
        quotationBlockedAt: input.blocked ? new Date() : null,
        quotationBlockedBy: input.blocked ? (ctx.user.name || ctx.user.email || '') : null,
      }).where(eq(suppliersTable.id, input.supplierId));
      const supplier = await db.getSupplier(input.supplierId);
      const supplierName = supplier?.tradeName || supplier?.companyName || `#${input.supplierId}`;
      await auditSensitiveAction({
        userId: ctx.user.id, userEmail: ctx.user.email || "", userName: ctx.user.name || "",
        action: input.blocked ? "block_supplier_quotation" : "unblock_supplier_quotation",
        entityType: "supplier", entityId: input.supplierId,
        details: { supplierName, blocked: input.blocked, reason: input.reason },
        severity: "warning",
        notifTitle: input.blocked ? `Fornecedor bloqueado: ${supplierName}` : `Fornecedor desbloqueado: ${supplierName}`,
        notifMessage: input.blocked
          ? `${ctx.user.name || ctx.user.email} bloqueou "${supplierName}" para novas cotações. Motivo: ${input.reason || 'Não informado'}.`
          : `${ctx.user.name || ctx.user.email} desbloqueou "${supplierName}" para novas cotações.`,
        actionUrl: "/fornecedores",
      });
      return { success: true };
    }),
  }),
  // ==================== QUOTATIONS ====================
  quotations: router({
    list: protectedProcedure.query(async () => {
      return db.listQuotations();
    }),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getQuotation(input.id);
    }),
    getByToken: publicProcedure.input(z.object({ token: z.string() })).query(async ({ input }) => {
      return db.getQuotationByToken(input.token);
    }),
    items: protectedProcedure.input(z.object({ quotationId: z.number() })).query(async ({ input }) => {
      return db.listQuotationItems(input.quotationId);
    }),
    itemsByToken: publicProcedure.input(z.object({ token: z.string() })).query(async ({ input }) => {
      const quotation = await db.getQuotationByToken(input.token);
      if (!quotation) return [];
      const allItems = await db.listQuotationItems(quotation.id);
      // Defensive deduplication: never show duplicate products to suppliers
      const seen = new Set<string>();
      return allItems.filter((item: any) => {
        const key = item.productName.trim().toUpperCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }),
    brandsByToken: publicProcedure.input(z.object({ token: z.string() })).query(async ({ input }) => {
      const quotation = await db.getQuotationByToken(input.token);
      if (!quotation) return {};
      const items = await db.listQuotationItems(quotation.id);
      const productNames = items.map((i: any) => i.productName);
      return db.getKnownBrandsByProducts(productNames);
    }),
    suppliersByToken: publicProcedure.input(z.object({ token: z.string() })).query(async ({ input }) => {
      const quotation = await db.getQuotationByToken(input.token);
      if (!quotation) return [];
      const qSuppliers = await db.listQuotationSuppliers(quotation.id);
      if (qSuppliers.length === 0) return [];
      const supplierIds = qSuppliers.map(qs => qs.supplierId);
      const allSuppliers = await db.listSuppliers();
      return allSuppliers
        .filter(s => supplierIds.includes(s.id))
        .map(s => ({ id: s.id, companyName: s.companyName, tradeName: s.tradeName }));
    }),
    // Get a single supplier by token + supplierId (for personalized links)
    supplierByToken: publicProcedure.input(z.object({ token: z.string(), supplierId: z.number() })).query(async ({ input }) => {
      const quotation = await db.getQuotationByToken(input.token);
      if (!quotation) return null;
      const qSuppliers = await db.listQuotationSuppliers(quotation.id);
      const isLinked = qSuppliers.some(qs => qs.supplierId === input.supplierId);
      if (!isLinked) return null;
      const allSuppliers = await db.listSuppliers();
      const supplier = allSuppliers.find(s => s.id === input.supplierId);
      if (!supplier) return null;
      return { id: supplier.id, companyName: supplier.companyName, tradeName: supplier.tradeName };
    }),
    suppliers: protectedProcedure.input(z.object({ quotationId: z.number() })).query(async ({ input }) => {
      return db.listQuotationSuppliers(input.quotationId);
    }),
    create: writeProcedure.input(z.object({
      title: z.string().min(1),
      unitId: z.number().optional(),
      deadline: z.string().optional(),
      notes: z.string().optional(),
      coletaNumber: z.string().optional(),
      items: z.array(z.object({
        productName: z.string().min(1),
        quantity: z.string(),
        unit: z.string().min(1),
        category: z.string().optional(),
        curveClass: z.enum(["A", "B", "C"]).optional(),
        referencePrice: z.string().optional(),
      })),
      supplierIds: z.array(z.number()).optional(),
    })).mutation(async ({ input, ctx }) => {
      const code = `COT-${Date.now().toString(36).toUpperCase()}`;
      const publicToken = nanoid(32);
      const quotationId = await db.createQuotation({
        code,
        title: input.title,
        unitId: input.unitId || null,
        createdBy: ctx.user.id,
        status: "draft",
        deadline: input.deadline ? new Date(input.deadline) : null,
        notes: input.notes || null,
        publicToken,
        coletaNumber: input.coletaNumber || null,
      });
      if (input.items.length > 0) {
        // Deduplicate items by productName (case-insensitive) - keep first occurrence
        const seenProducts = new Set<string>();
        const uniqueItems = input.items.filter(item => {
          const key = item.productName.trim().toUpperCase();
          if (seenProducts.has(key)) return false;
          seenProducts.add(key);
          return true;
        });
        await db.createQuotationItems(uniqueItems.map(item => ({
          quotationId,
          productName: item.productName,
          quantity: item.quantity,
          unit: item.unit,
          category: item.category || null,
          curveClass: item.curveClass || null,
          referencePrice: item.referencePrice || null,
        })));
      }
      if (input.supplierIds && input.supplierIds.length > 0) {
        await db.addQuotationSuppliers(input.supplierIds.map(sid => ({ quotationId, supplierId: sid })));
      }
      await db.createAuditLog({ userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "", action: "create_quotation", entityType: "quotation", entityId: quotationId, details: { title: input.title, itemCount: input.items.length } });
      return { id: quotationId, code, publicToken };
    }),
    open: writeProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      await db.updateQuotation(input.id, { status: "open" });
      await db.createAuditLog({ userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "", action: "open_quotation", entityType: "quotation", entityId: input.id });
      return { success: true };
    }),
    close: writeProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      await db.updateQuotation(input.id, { status: "closed" });
      await db.createAuditLog({ userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "", action: "close_quotation", entityType: "quotation", entityId: input.id });
      return { success: true };
    }),
    // ADM Master only: delete quotation permanently
    delete: writeProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      if (ctx.user?.email !== MASTER_EMAIL) throw new Error("Somente o ADM Master pode excluir cotações");
      await db.deleteQuotation(input.id);
      await db.createAuditLog({ userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "", action: "delete_quotation", entityType: "quotation", entityId: input.id });
      return { success: true };
    }),
    // ADM Master only: replace all items in a quotation (reupload PDF)
    replaceItems: writeProcedure.input(z.object({
      quotationId: z.number(),
      title: z.string().optional(),
      items: z.array(z.object({
        productName: z.string(),
        quantity: z.string(),
        unit: z.string(),
        category: z.string().optional(),
        curveClass: z.enum(["A", "B", "C"]).optional(),
        referencePrice: z.string().optional(),
      })),
    })).mutation(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      if (ctx.user?.email !== MASTER_EMAIL) throw new Error("Somente o ADM Master pode substituir itens (reupload PDF)");
      // Delete existing proposals and items
      const existingProposals = await db.listProposals(input.quotationId);
      for (const p of existingProposals) {
        await db.deleteProposalItems(p.id);
      }
      await db.deleteProposals(input.quotationId);
      // Delete existing quotation items
      await db.deleteQuotationItems(input.quotationId);
      // Insert new items
      const seenProducts = new Set<string>();
      const uniqueItems = input.items.filter(item => {
        const key = item.productName.trim().toUpperCase();
        if (seenProducts.has(key)) return false;
        seenProducts.add(key);
        return true;
      });
      await db.createQuotationItems(uniqueItems.map(item => ({
        quotationId: input.quotationId,
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category || null,
        curveClass: item.curveClass || null,
        referencePrice: item.referencePrice || null,
      })));
      // Update title if provided
      if (input.title) {
        await db.updateQuotation(input.quotationId, { title: input.title, status: "open" });
      }
      await db.createAuditLog({ userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "", action: "replace_quotation_items", entityType: "quotation", entityId: input.quotationId, details: { newItemCount: uniqueItems.length, title: input.title } });
      return { success: true, itemCount: uniqueItems.length };
    }),
    // ADM Master + Luiz Jr: edit quotation item (name/qty/unit) with mandatory justification
    editItem: writeProcedure.input(z.object({
      itemId: z.number(),
      quotationId: z.number(),
      productName: z.string().optional(),
      quantity: z.string().optional(),
      unit: z.string().optional(),
      unitsPerPackage: z.number().optional(),
      justification: z.string().min(10, "Justificativa obrigatória (mínimo 10 caracteres)"),
    })).mutation(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      const BUYER_SENIOR_EMAIL = "frotas.patrimonio@qualities.com.br";
      const canEdit = ctx.user?.email === MASTER_EMAIL || ctx.user?.email === BUYER_SENIOR_EMAIL;
      if (!canEdit) throw new Error("Apenas ADM Master e Luiz Antonio Jr podem editar itens da cotação");
      // Quantity changes restricted to Master only
      if (input.quantity && ctx.user?.email !== MASTER_EMAIL) {
        throw new Error("Apenas o Administrador Master pode alterar a quantidade dos itens solicitados");
      }
      // Block edit if quotation is ordered
      const quotation = await db.getQuotation(input.quotationId);
      if (quotation?.status === "ordered") throw new Error("Cotação já possui pedidos gerados. Reabra a cotação para editar itens.");
      // Fetch old values for audit trail
      const oldItem = await db.getQuotationItem(input.itemId);
      const updateData: any = {};
      if (input.productName) updateData.productName = input.productName;
      if (input.quantity) updateData.quantity = input.quantity;
      if (input.unit) updateData.unit = input.unit;
      await db.updateQuotationItem(input.itemId, updateData);
      await db.createAuditLog({
        userId: ctx.user.id,
        userName: ctx.user.name || "",
        userEmail: ctx.user.email || "",
        action: "edit_quotation_item",
        entityType: "quotation",
        entityId: input.quotationId,
        details: {
          itemId: input.itemId,
          justification: input.justification,
          oldProductName: oldItem?.productName,
          newProductName: input.productName || oldItem?.productName,
          oldQuantity: oldItem?.quantity,
          newQuantity: input.quantity || oldItem?.quantity,
          oldUnit: oldItem?.unit,
          newUnit: input.unit || oldItem?.unit,
          unitsPerPackage: input.unitsPerPackage,
        },
      });
      // Notify Master when Júnior edits items
      if (ctx.user?.email !== MASTER_EMAIL) {
        const changes: string[] = [];
        if (input.productName && input.productName !== oldItem?.productName) {
          changes.push(`Nome: "${oldItem?.productName}" → "${input.productName}"`);
        }
        if (input.unit && input.unit !== oldItem?.unit) {
          changes.push(`Unidade: "${oldItem?.unit}" → "${input.unit}"`);
        }
        if (changes.length > 0) {
          const quotationTitle = quotation?.title || `Cotação #${input.quotationId}`;
          try {
            const masterUser = await db.getUserByEmail(MASTER_EMAIL);
            if (masterUser) {
              await createUserNotification({
                userId: masterUser.id,
                type: 'item_edited',
                title: `Item editado por ${ctx.user.name || 'Júnior'}`,
                message: `${ctx.user.name || 'Luiz Antonio Jr'} alterou item "${oldItem?.productName || 'N/A'}" em ${quotationTitle}. Alterações: ${changes.join('; ')}. Justificativa: ${input.justification}`,
                relatedEntityType: 'quotation',
                relatedEntityId: input.quotationId,
                actionUrl: `/cotacoes/${input.quotationId}`,
              });
            }
          } catch (e) { /* notification failure should not block the edit */ }
          // Send email to Master via Gmail MCP
          try {
            const { execSync } = await import('child_process');
            const emailSubject = `[QualiCompras Auditoria] Item editado por ${ctx.user.name || 'Luiz Antonio Jr'}`;
            const emailBody = [
              `RELATÓRIO DE AUDITORIA - QualiCompras`,
              ``,
              `Ação: Edição de item de cotação`,
              `Usuário: ${ctx.user.name || 'Luiz Antonio Jr'} (${ctx.user.email})`,
              `Data/Hora: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })}`,
              `Cotação: ${quotationTitle}`,
              ``,
              `ALTERAÇÕES:`,
              ...changes.map(c => `  - ${c}`),
              ``,
              `JUSTIFICATIVA: ${input.justification}`,
              ``,
              `Acesse: https://qualicompra.manus.space/cotacoes/${input.quotationId}`,
            ].join('\n');
            const emailInput = JSON.stringify({
              messages: [{
                to: [MASTER_EMAIL],
                subject: emailSubject,
                content: emailBody,
              }],
            });
            trySendEmail(emailInput);
          } catch (emailErr) { /* email failure should not block the edit */ }
        }
      }
      return { success: true };
    }),
    // Get item edit history for a quotation (for badge display)
    itemEdits: protectedProcedure.input(z.object({
      quotationId: z.number(),
    })).query(async ({ input }) => {
      const logs = await db.listAuditLogs({ action: "edit_quotation_item", resource: undefined, limit: 200 });
      // Filter logs for this quotation
      const edits = (logs || []).filter((log: any) => {
        const entityId = log.entityId || (log.details as any)?.quotationId;
        return entityId === input.quotationId || String(entityId) === String(input.quotationId);
      }).map((log: any) => {
        const d = log.details as any;
        return {
          itemId: d?.itemId,
          userName: log.userName,
          timestamp: log.createdAt,
          justification: d?.justification,
          oldProductName: d?.oldProductName,
          newProductName: d?.newProductName,
          oldQuantity: d?.oldQuantity,
          newQuantity: d?.newQuantity,
          oldUnit: d?.oldUnit,
          newUnit: d?.newUnit,
        };
      }).filter((e: any) => e.itemId);
      return edits;
    }),
    // ADM Master only: edit proposal item price
    editProposalItem: writeProcedure.input(z.object({
      proposalItemId: z.number(),
      quotationId: z.number(),
      unitPrice: z.string().optional(),
      quantity: z.string().optional(),
      packagingType: z.enum(["unidade", "caixa", "fardo", "pacote"]).optional(),
      unitsPerPackage: z.number().optional(),
      brand: z.string().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      // Admin and buyer_senior can edit proposal items (prices)
      const isAdmin = ctx.user?.email === "afonsoqueirogagn@gmail.com" ;
      const isBuyerSenior = ctx.user?.role === "buyer_senior";
      if (!isAdmin && !isBuyerSenior) throw new Error("Sem permissão para editar propostas");
      const currentItem = await db.getProposalItem(input.proposalItemId);
      if (!currentItem) throw new Error("Item não encontrado");

      // Resolve final values (use input if provided, otherwise keep current)
      const newPrice = input.unitPrice ? parseFloat(input.unitPrice) : parseFloat(String(currentItem.unitPrice));
      const newPkgType = input.packagingType || currentItem.packagingType || "unidade";
      const newUnitsPer = input.unitsPerPackage ?? currentItem.unitsPerPackage ?? 1;

      // Get quantity from quotation_items (the requested qty)
      const qItem = (await db.listQuotationItems(input.quotationId)).find((qi: any) => qi.id === currentItem.quotationItemId);
      const requestedQty = qItem ? parseFloat(String(qItem.quantity)) : 1;

      // Calculation logic:
      // unitPrice = price per package (or per unit if packagingType=unidade)
      // unitPriceNormalized = price per SINGLE unit = unitPrice / unitsPerPackage
      // totalPrice = normalizedPrice * requestedQty (total cost based on per-unit price × units needed)
      const normalizedPrice = newPkgType !== "unidade" && newUnitsPer > 1 ? newPrice / newUnitsPer : newPrice;
      const totalPrice = (normalizedPrice * requestedQty).toFixed(2);

      // Build update payload
      const updateData: any = {
        unitPrice: newPrice.toFixed(2),
        unitPriceNormalized: normalizedPrice.toFixed(4),
        totalPrice: totalPrice,
      };
      if (input.packagingType) updateData.packagingType = newPkgType;
      if (input.unitsPerPackage !== undefined) updateData.unitsPerPackage = newUnitsPer;
      if (input.brand !== undefined) updateData.brand = input.brand;
      if (input.notes !== undefined) updateData.notes = input.notes;

      await db.updateProposalItem(input.proposalItemId, updateData);

      // Recalculate proposal totalValue from all items
      const proposalId = currentItem.proposalId;
      const allItems = await db.listProposalItems(proposalId);
      const newTotal = allItems.reduce((sum: number, pi: any) => {
        if (pi.id === input.proposalItemId) return sum + parseFloat(totalPrice);
        return sum + (parseFloat(String(pi.totalPrice)) || 0);
      }, 0);
      await db.updateProposal(proposalId, { totalValue: newTotal.toFixed(2) });

      await db.createAuditLog({ userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "", action: "edit_proposal_item", entityType: "quotation", entityId: input.quotationId, details: { proposalItemId: input.proposalItemId, changes: { unitPrice: input.unitPrice, packagingType: input.packagingType, unitsPerPackage: input.unitsPerPackage, brand: input.brand }, oldValues: { unitPrice: String(currentItem.unitPrice), packagingType: currentItem.packagingType, unitsPerPackage: currentItem.unitsPerPackage }, newTotal: newTotal.toFixed(2) } });
      return { success: true, normalizedPrice: normalizedPrice.toFixed(4), totalPrice };
    }),
    // Add a new proposal item (for ND items that the supplier later confirmed via WhatsApp)
    addProposalItem: writeProcedure.input(z.object({
      proposalId: z.number(),
      quotationItemId: z.number(),
      quotationId: z.number(),
      unitPrice: z.string(),
      packagingType: z.enum(["unidade", "caixa", "fardo", "pacote"]).default("unidade"),
      unitsPerPackage: z.number().default(1),
      brand: z.string().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const isAdmin = ctx.user?.email === "afonsoqueirogagn@gmail.com" ;
      const isBuyerSenior = ctx.user?.role === "buyer_senior";
      if (!isAdmin && !isBuyerSenior) throw new Error("Sem permissão para adicionar itens à proposta");
      // Get the quotation item to know the requested quantity
      const qItems = await db.listQuotationItems(input.quotationId);
      const qItem = qItems.find((qi: any) => qi.id === input.quotationItemId);
      if (!qItem) throw new Error("Item da cotação não encontrado");
      const requestedQty = parseFloat(String(qItem.quantity)) || 1;
      const price = parseFloat(input.unitPrice);
      const normalizedPrice = input.packagingType !== "unidade" && input.unitsPerPackage > 1 ? price / input.unitsPerPackage : price;
      const totalPrice = (normalizedPrice * requestedQty).toFixed(2);
      // Create the proposal item
      await db.createProposalItems([{
        proposalId: input.proposalId,
        quotationItemId: input.quotationItemId,
        unitPrice: price.toFixed(2),
        totalPrice: totalPrice,
        packagingType: input.packagingType,
        unitsPerPackage: input.unitsPerPackage,
        brand: input.brand || null,
        notes: input.notes || null,
        unitPriceNormalized: normalizedPrice.toFixed(4),
      }]);
      // Recalculate proposal total
      const allItems = await db.listProposalItems(input.proposalId);
      const newTotal = allItems.reduce((sum: number, pi: any) => sum + (parseFloat(String(pi.totalPrice)) || 0), 0) + parseFloat(totalPrice);
      await db.updateProposal(input.proposalId, { totalValue: newTotal.toFixed(2) });
      await db.createAuditLog({ userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "", action: "add_proposal_item", entityType: "quotation", entityId: input.quotationId, details: { proposalId: input.proposalId, quotationItemId: input.quotationItemId, unitPrice: input.unitPrice, brand: input.brand } });
      return { success: true, normalizedPrice: normalizedPrice.toFixed(4), totalPrice };
    }),
    proposals: protectedProcedure.input(z.object({ quotationId: z.number() })).query(async ({ input }) => {
      return db.listProposals(input.quotationId);
    }),
    proposalItems: protectedProcedure.input(z.object({ proposalId: z.number() })).query(async ({ input }) => {
      return db.listProposalItems(input.proposalId);
    }),
    allProposalItems: protectedProcedure.input(z.object({ quotationId: z.number() })).query(async ({ input }) => {
      return db.listProposalItemsByQuotation(input.quotationId);
    }),
    // Send quotation link to all suppliers via WhatsApp/Email
    sendToSuppliers: writeProcedure.input(z.object({
      quotationId: z.number(),
    })).mutation(async ({ input, ctx }) => {
      const quotation = await db.getQuotation(input.quotationId);
      if (!quotation) throw new Error("Cotação não encontrada");
      if (quotation.status !== "open") throw new Error("Cotação precisa estar aberta para enviar");
      
      const suppliersWithContacts = await db.getQuotationSuppliersWithContacts(input.quotationId);
      if (suppliersWithContacts.length === 0) throw new Error("Nenhum fornecedor vinculado a esta cotação");
      
      const baseUrl = `${process.env.VITE_APP_URL || 'https://qualicompra-hp2k3afa.manus.space'}/cotacao/${quotation.publicToken}`;
      
      const results: { supplierId: number; name: string; whatsapp: boolean; email: boolean; whatsappUrl?: string; emailUrl?: string; supplierLink?: string }[] = [];
      
      for (const supplier of suppliersWithContacts) {
        // Generate personalized link for this specific supplier
        const supplierLink = `${baseUrl}?s=${supplier.id}`;
        const message = `\uD83D\uDD14 *QualiCompras - Nova Cotação*\n\n` +
          `Olá! A Qualities Refeições solicita sua proposta para a cotação *${quotation.title}* (${quotation.code}).\n\n` +
          `\uD83D\uDCCB Acesse o link para ver os itens e enviar sua proposta:\n${supplierLink}\n\n` +
          `${quotation.deadline ? `\u23F0 Prazo para envio: ${new Date(quotation.deadline).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}\n\n` : ''}` +
          `Obrigado!\nEquipe QualiCompras - Qualities Refeições`;

        const result: typeof results[0] = {
          supplierId: supplier.id,
          name: supplier.tradeName || supplier.companyName,
          whatsapp: false,
          email: false,
          supplierLink,
        };
        
        // Generate WhatsApp link with personalized URL
        if (supplier.whatsapp) {
          const phone = supplier.whatsapp.replace(/\D/g, '');
          const whatsappPhone = phone.startsWith('55') ? phone : `55${phone}`;
          result.whatsapp = true;
          result.whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
        }
        
        // Generate email link with personalized URL
        if (supplier.email) {
          result.email = true;
          const subject = encodeURIComponent(`Cotação ${quotation.code} - ${quotation.title} | Qualities Refeições`);
          const body = encodeURIComponent(message);
          result.emailUrl = `mailto:${supplier.email}?subject=${subject}&body=${body}`;
        }
        
        // Mark as invited
        await db.markQuotationSupplierInvited(input.quotationId, supplier.id);
        results.push(result);
      }
      
      await db.createAuditLog({
        userId: ctx.user.id,
        userName: ctx.user.name || "",
        userEmail: ctx.user.email || "",
        action: "send_quotation_to_suppliers",
        entityType: "quotation",
        entityId: input.quotationId,
        details: { supplierCount: results.length, title: quotation.title },
      });
      
      return { success: true, results, baseUrl };
    }),

    // Public endpoint for suppliers to submit proposals
    submitProposal: publicProcedure.input(z.object({
      token: z.string(),
      supplierId: z.number().optional(),
      supplierName: z.string().optional(),
      deliveryDays: z.number().optional(),
      paymentTerms: z.string().optional(),
      notes: z.string().optional(),
      items: z.array(z.object({
        quotationItemId: z.number(),
        unitPrice: z.string(),
        totalPrice: z.string(),
        brand: z.string().optional(),
        notes: z.string().optional(),
        packagingType: z.enum(["unidade", "caixa", "fardo", "pacote"]).optional().default("unidade"),
        unitsPerPackage: z.number().optional().default(1),
        unavailable: z.boolean().optional().default(false),
      })),
    })).mutation(async ({ input }) => {
      const quotation = await db.getQuotationByToken(input.token);
      if (!quotation) throw new Error("Cotação não encontrada");
      if (quotation.status !== "open") throw new Error("Cotação não está aberta para propostas");
      
      // Check if deadline has passed
      if (quotation.deadline && new Date(quotation.deadline).getTime() < Date.now()) {
        throw new Error(`O prazo para envio de propostas encerrou em ${new Date(quotation.deadline).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.`);
      }

      try {
      // Check for duplicate submission from same supplier
      const existingProposals = await db.listProposals(quotation.id);
      if (input.supplierId) {
        const alreadySubmitted = existingProposals.some(p => p.supplierId === input.supplierId);
        if (alreadySubmitted) {
          throw new Error("Sua empresa já enviou uma proposta para esta cotação. Não é permitido enviar novamente.");
        }
      }

      // Resolve supplier
      let resolvedSupplierId = input.supplierId || 0;
      let resolvedSupplierName = input.supplierName || "Fornecedor Desconhecido";
      if (input.supplierId) {
        const supplier = await db.getSupplier(input.supplierId);
        if (supplier) {
          resolvedSupplierName = supplier.tradeName || supplier.companyName;
        }
      } else if (input.supplierName && input.supplierName.trim()) {
        // Try to match by name when no supplierId provided (generic link without ?s= param)
        const nameToMatch = input.supplierName.trim().toLowerCase();
        const allSups = await db.listSuppliers();
        const matchedSupplier = allSups.find((s: any) => 
          (s.tradeName && s.tradeName.toLowerCase().includes(nameToMatch)) ||
          (s.companyName && s.companyName.toLowerCase().includes(nameToMatch)) ||
          nameToMatch.includes((s.tradeName || '').toLowerCase()) ||
          nameToMatch.includes((s.companyName || '').toLowerCase())
        );
        if (matchedSupplier) {
          resolvedSupplierId = matchedSupplier.id;
          resolvedSupplierName = matchedSupplier.tradeName || matchedSupplier.companyName;
        }
      }

      // Only include items where the supplier filled a valid price
      const validItems = input.items.filter(item => {
        const price = parseFloat(item.unitPrice);
        return !isNaN(price) && price > 0;
      });
      if (validItems.length === 0) {
        throw new Error("Nenhum item com preço válido. Preencha pelo menos um preço.");
      }
      // Validate brand is required (only for priced items)
      const itemsWithoutBrand = validItems.filter(item => !item.brand || !item.brand.trim());
      if (itemsWithoutBrand.length > 0) {
        throw new Error(`Preencha a marca de todos os itens cotados. ${itemsWithoutBrand.length} item(ns) sem marca.`);
      }

      const totalValue = validItems.reduce((sum, item) => {
        const val = parseFloat(item.totalPrice);
        return sum + (isNaN(val) ? 0 : val);
      }, 0).toFixed(2);
      // AUTO-RESOLVE brand aliases: correct misspellings before saving
      const allBrands = validItems.map(i => i.brand).filter(Boolean) as string[];
      const brandAliasMap = allBrands.length > 0 ? await db.resolveBrandsWithAliases(allBrands) : {};
      const proposalId = await db.createProposal({
        quotationId: quotation.id,
        supplierId: resolvedSupplierId || null,
        supplierName: resolvedSupplierName,
        totalValue,
        deliveryDays: input.deliveryDays || null,
        paymentTerms: input.paymentTerms || null,
        notes: input.notes || null,
      });
      const sanitizedItems = validItems.map(item => {
        const price = parseFloat(item.unitPrice);
        const pkgType = item.packagingType || "unidade";
        const unitsPer = item.unitsPerPackage || 1;
        const normalizedPrice = pkgType !== "unidade" && unitsPer > 1 ? price / unitsPer : price;
        // Resolve brand alias to canonical name
        const resolvedBrand = item.brand && brandAliasMap[item.brand] ? brandAliasMap[item.brand] : (item.brand || null);
        return {
          proposalId: Number(proposalId),
          quotationItemId: Number(item.quotationItemId),
          unitPrice: String(price.toFixed(2)),
          totalPrice: String(parseFloat(item.totalPrice).toFixed(2)),
          brand: resolvedBrand,
          notes: item.notes || null,
          packagingType: pkgType,
          unitsPerPackage: unitsPer,
          unitPriceNormalized: String(normalizedPrice.toFixed(4)),
        };
      });
      // AUTO-CORRECTION: Vale Verde (IDs 120004, 540002, 690007) — DOCE PAÇOQUINHA e PÉ DE MOLEQUE
      // Esse fornecedor preenche errado sistematicamente. Se o preço normalizado for <50% do último pedido,
      // Esse fornecedor preenche errado sistematicamente (valor muito alto ou muito baixo).
      // Se o preço normalizado divergir >50% do último pedido (para cima ou para baixo),
      // corrige automaticamente para o preço do último pedido aprovado.
      const VALE_VERDE_IDS = [120004, 540002, 690007];
      const VALE_VERDE_ITEMS = ["PACOQUINHA", "PE DE MOLEQUE", "PÉ DE MOLEQUE", "PAÇOQUINHA"];
      if (VALE_VERDE_IDS.includes(resolvedSupplierId)) {
        const qItems = await db.listQuotationItems(quotation.id);
        for (const sItem of sanitizedItems) {
          const qItem = qItems.find((qi: any) => qi.id === sItem.quotationItemId);
          if (!qItem) continue;
          const productUpper = (qItem.productName || "").toUpperCase();
          const matchesValeVerdeItem = VALE_VERDE_ITEMS.some(k => productUpper.includes(k));
          if (!matchesValeVerdeItem) continue;
          // Get last order price for this supplier+product
          const lastPrice = await db.getLastPriceForSupplierProduct(resolvedSupplierId, qItem.productName);
          if (lastPrice && lastPrice.unitPrice) {
            const lastUnitPrice = parseFloat(String(lastPrice.unitPrice));
            const currentNormalized = parseFloat(sItem.unitPriceNormalized);
            // If current price diverges >50% from last price (too low OR too high) → suspicious, auto-correct
            const ratio = currentNormalized / lastUnitPrice;
            if (lastUnitPrice > 0 && currentNormalized > 0 && (ratio < 0.5 || ratio > 1.5)) {
              console.log(`[Vale Verde Auto-Correction] ${qItem.productName}: R$${currentNormalized} → R$${lastUnitPrice} (último pedido, ratio=${ratio.toFixed(2)})`);
              const qty = parseFloat(String(qItem.quantity)) || 0;
              sItem.unitPrice = String(lastUnitPrice.toFixed(2));
              sItem.unitPriceNormalized = String(lastUnitPrice.toFixed(4));
              sItem.totalPrice = String((lastUnitPrice * qty).toFixed(2));
            }
          }
        }
      }
      await db.createProposalItems(sanitizedItems);

      // Update quotation_suppliers status if supplierId is known
      if (resolvedSupplierId > 0) {
        try {
          await db.updateQuotationSupplierStatus(quotation.id, resolvedSupplierId, "responded");
        } catch (e) { /* ignore */ }
      }

      // Record prices and detect price increases >10%
      try {
        const qItems = await db.listQuotationItems(quotation.id);
        const priceAlerts: string[] = [];
        for (const item of sanitizedItems) {
          const qItem = qItems.find((qi: any) => qi.id === item.quotationItemId);
          if (!qItem || !resolvedSupplierId) continue;
          // Record price in history
          await db.recordPrice({
            productName: qItem.productName,
            supplierId: resolvedSupplierId,
            supplierName: resolvedSupplierName,
            brand: item.brand || undefined,
            unitId: quotation.unitId || undefined,
            unitPrice: item.unitPrice,
            quantity: String(qItem.quantity),
            unit: qItem.unit,
            quotationId: quotation.id,
            source: "proposal",
          });
          // Register brand in brand registry
          if (item.brand) {
            db.registerBrand({
              productName: qItem.productName,
              brand: item.brand,
              supplierId: resolvedSupplierId,
              supplierName: resolvedSupplierName,
              sector: quotation.title || undefined,
              unitId: quotation.unitId || undefined,
            });
          }
          // Check if price increased >10% vs last recorded price
          const lastPrice = await db.getLastPriceForSupplierProduct(resolvedSupplierId, qItem.productName);
          if (lastPrice && lastPrice.unitPrice) {
            const prevPrice = parseFloat(String(lastPrice.unitPrice));
            const newPrice = parseFloat(item.unitPrice);
            if (prevPrice > 0 && newPrice > prevPrice) {
              const pctIncrease = ((newPrice - prevPrice) / prevPrice) * 100;
              if (pctIncrease > 10) {
                priceAlerts.push(`${qItem.productName}: R$ ${prevPrice.toFixed(2)} → R$ ${newPrice.toFixed(2)} (+${pctIncrease.toFixed(0)}%)`);
              }
            }
          }
        }
        // Create alert if any price increased >10%
        if (priceAlerts.length > 0) {
          await db.createAlert({
            type: "price_increase",
            title: `\u26A0\uFE0F Aumento de preço: ${resolvedSupplierName}`,
            description: `${resolvedSupplierName} subiu preço em ${priceAlerts.length} item(ns) (>10%):\n${priceAlerts.join("\n")}`,
            severity: "high",
            relatedEntityType: "quotation",
            relatedEntityId: quotation.id,
          });
          // Also send push notification for price increase
          try {
            const { notifyOwner } = await import("./_core/notification");
            await notifyOwner({
              title: `\u26A0\uFE0F Alerta: ${resolvedSupplierName} subiu pre\u00E7os`,
              content: `${priceAlerts.length} produto(s) com aumento >10%: ${priceAlerts[0]}${priceAlerts.length > 1 ? ` e mais ${priceAlerts.length - 1}` : ""}`,
            });
          } catch (e) { /* ignore */ }

      // Notify Master + Júnior about price alert
      try {
        await notifyUsersByEmail(
          [...MASTER_EMAILS_NOTIF, ...JUNIOR_EMAILS_NOTIF],
          {
            type: 'price_alert',
            title: `Alerta de preço: ${resolvedSupplierName}`,
            message: `${priceAlerts.length} produto(s) com aumento >10% na cotação ${quotation.code}`,
            priority: 'high',
            relatedEntityType: 'quotation',
            relatedEntityId: quotation.id,
            actionUrl: `/cotacao/${quotation.id}`,
            dedupeKey: `price_alert_${quotation.id}_${resolvedSupplierId}`,
          }
        );
      } catch { /* best-effort */ }
      }
    } catch (e) {
      console.warn("[PriceTracking] Error:", e);
      }

      // Send notification
      try {
        const { notifyOwner } = await import("./_core/notification");
        await notifyOwner({
          title: `\uD83D\uDCE9 Proposta Recebida - ${quotation.code}`,
          content: `O fornecedor ${resolvedSupplierName} respondeu a cotação "${quotation.title}" (${quotation.code}) com valor total de R$ ${totalValue}. Acesse o QualiCompras para comparar as propostas.`,
        });
      } catch (e) {
        console.warn("[Notification] Failed:", e);
      }

      // Notify Paula, Master, Júnior about supplier response
      try {
        await notifyUsersByEmail(
          [...MASTER_EMAILS_NOTIF, ...JUNIOR_EMAILS_NOTIF, ...PAULA_EMAILS_NOTIF],
          {
            type: 'supplier_response',
            title: `${resolvedSupplierName} respondeu cotação`,
            message: `Proposta de R$ ${totalValue} para "${quotation.title}" (${quotation.code})`,
            priority: 'medium',
            relatedEntityType: 'quotation',
            relatedEntityId: quotation.id,
            actionUrl: `/cotacao/${quotation.id}`,
            dedupeKey: `supplier_response_${quotation.id}_${resolvedSupplierId}`,
          }
        );
      } catch { /* best-effort */ }

      // Create alert
      try {
        await db.createAlert({
          type: "supplier_response",
          title: `Proposta recebida: ${resolvedSupplierName}`,
          description: `${resolvedSupplierName} respondeu a cotação ${quotation.code} - ${quotation.title} com valor total R$ ${totalValue}`,
          severity: "info",
          relatedEntityType: "quotation",
          relatedEntityId: quotation.id,
        });
      } catch (e) {
        console.warn("[Alert] Failed:", e);
      }

      return { success: true, proposalId };
      } catch (e: any) {
        console.error("[submitProposal] Error:", e);
        if (e.message && !e.message.includes("query")) throw e;
        throw new Error("Erro ao salvar proposta. Tente novamente.");
      }
    }),
    // ==================== PURCHASE OPTIMIZATION ====================
    optimize: writeProcedure.input(z.object({
      quotationId: z.number(),
      tolerancePct: z.number().min(0).max(20).default(3), // % tolerance for credit suppliers
      excludeSupplierItems: z.array(z.object({
        supplierId: z.number(),
        productName: z.string(),
      })).optional(), // manually exclude specific items (e.g. wrong prices)
    })).mutation(async ({ input }) => {
      // 1. Get all proposals and items for this quotation
      const allProposals = await db.listProposals(input.quotationId);
      if (allProposals.length === 0) throw new Error("Nenhuma proposta recebida nesta cotação.");
      const quotationItems = await db.listQuotationItems(input.quotationId);
      const allSuppliers = await db.listSuppliers();
      
      // Get quotation to know the unitId for brand rejection filtering
      const quotation = await db.getQuotation(input.quotationId);
      const quotationUnitId = quotation?.unitId || 0;
      
      // Load preferred suppliers for this unit
      const preferredSuppliersList = await db.getPreferredSuppliers(quotationUnitId);
      
      // Build proposal items map: { quotationItemId -> [{ supplierId, unitPrice, brand, proposalPaymentTerms, suppliedTotalUnits }] }
      const itemOptions: Record<number, Array<{
        supplierId: number;
        supplierName: string;
        unitPrice: number;
        brand: string;
        paymentTerms: string | null;
        supplierPaymentTerms: string | null;
        packagingType: string;
        unitsPerPackage: number;
        suppliedTotalUnits: number; // total units the supplier is offering
        quantityInsufficient: boolean; // flag if supplier can't meet requested qty
      }>> = {};
      
      for (const proposal of allProposals) {
        // Skip proposals without a valid supplierId (can't generate orders without knowing the supplier)
        if (!proposal.supplierId) continue;
        const pItems = await db.listProposalItems(proposal.id);
        const supplier = allSuppliers.find(s => s.id === proposal.supplierId);
        const supplierName = supplier?.tradeName || supplier?.companyName || `Fornecedor ${proposal.supplierId}`;
        
        for (const pi of pItems) {
          const rawPrice = parseFloat(pi.unitPrice as string);
          if (!rawPrice || rawPrice <= 0) continue;
          
          // Use normalized price (accounts for box/pack pricing)
          const normalizedPrice = pi.unitPriceNormalized ? parseFloat(pi.unitPriceNormalized as string) : rawPrice;
          const effectivePrice = normalizedPrice > 0 ? normalizedPrice : rawPrice;
          
          // Check if this item is excluded
          const qItem = quotationItems.find((qi: any) => qi.id === pi.quotationItemId);
          if (input.excludeSupplierItems?.some(e => e.supplierId === proposal.supplierId && e.productName === qItem?.productName)) continue;
          
          // Calculate total units supplied by this supplier
          // totalPrice / unitPrice = quantity of packages supplied
          // quantity of packages × unitsPerPackage = total units
          const pkgType = (pi as any).packagingType || "unidade";
          const unitsPer = (pi as any).unitsPerPackage || 1;
          const totalPriceVal = parseFloat(String(pi.totalPrice)) || 0;
          const suppliedPkgs = rawPrice > 0 ? Math.round(totalPriceVal / rawPrice) : 0;
          const suppliedTotalUnits = pkgType !== "unidade" && unitsPer > 1 
            ? suppliedPkgs * unitsPer 
            : suppliedPkgs;
          
          // Check if supplier meets the requested quantity
          const requestedQty = qItem ? parseFloat(String(qItem.quantity)) || 0 : 0;
          // For unit items: suppliedPkgs should >= requestedQty
          // For packaged items: suppliedTotalUnits should >= requestedQty (if unit is UN)
          // Simple check: if totalPrice > 0, supplier quoted for the qty we asked (since form uses our qty)
          // But if supplier used packaging, check total units offered vs requested
          let quantityInsufficient = false;
          if (pkgType !== "unidade" && unitsPer > 1 && requestedQty > 0) {
            // Supplier is offering in packages - check if total units meet demand
            if (suppliedTotalUnits < requestedQty * 0.9) { // 10% tolerance
              quantityInsufficient = true;
            }
          }
          
          if (!itemOptions[pi.quotationItemId]) itemOptions[pi.quotationItemId] = [];
          itemOptions[pi.quotationItemId].push({
            supplierId: proposal.supplierId,
            supplierName,
            unitPrice: effectivePrice,
            brand: pi.brand || "—",
            paymentTerms: proposal.paymentTerms || null,
            supplierPaymentTerms: supplier?.paymentTerms || null,
            packagingType: pkgType,
            unitsPerPackage: unitsPer,
            suppliedTotalUnits,
            quantityInsufficient,
          });
        }
      }
      
      // 1.45. Supplier-Item Compatibility filter: remove options where supplier is marked as 'nao_atende'
      const database = await db.getDb();
      let compatRules: any[] = [];
      if (database) {
        const { sql } = await import("drizzle-orm");
        const compatResult = await database.execute(sql`SELECT supplierId, productKey, brandName, status, reason FROM supplier_item_compatibility WHERE status = 'nao_atende'`);
        const rawRows = (compatResult as any)?.[0] || compatResult || [];
        compatRules = (rawRows as any[]).map((r: any) => ({
          supplierId: Number(r.supplierId),
          productKey: String(r.productKey),
          brandName: r.brandName ? String(r.brandName) : null,
          status: String(r.status),
          reason: r.reason ? String(r.reason) : null,
          automatic: false,
        }));
      }
      const incompatibleMap = new Map<string, Array<{ productKey: string; brandName: string | null; reason: string | null; automatic: boolean }>>();
      for (const rule of compatRules as any[]) {
        const supplierKey = String(rule.supplierId);
        if (!incompatibleMap.has(supplierKey)) incompatibleMap.set(supplierKey, []);
        incompatibleMap.get(supplierKey)!.push({
          productKey: rule.productKey.toUpperCase(),
          brandName: rule.brandName?.trim().toUpperCase() || null,
          reason: rule.reason,
          automatic: false,
        });
      }
      
      // 1.46. Auto-inheritance by supplier type: Supermercado suppliers can't serve certain items
      const SUPERMERCADO_BLOCKED_ITEMS = ["MARMITA", "HAMBURGUEIRA", "PALITO", "PERFLEX", "SACO DE LIXO", "FILME PVC", "LUVA", "TOUCA", "GUARDANAPO", "SACO PARA TALHER"];
      const supermercadoSuppliers = allSuppliers.filter(s => (s as any).supplierType === "supermercado");
      for (const sup of supermercadoSuppliers) {
        const key = String(sup.id);
        if (!incompatibleMap.has(key)) incompatibleMap.set(key, []);
        for (const blocked of SUPERMERCADO_BLOCKED_ITEMS) {
          incompatibleMap.get(key)!.push({
            productKey: blocked,
            brandName: null,
            reason: `Supermercado não atende ${blocked.toLowerCase()}`,
            automatic: true,
          });
        }
      }
      
      // Filter out incompatible supplier-item combinations
      const excludedByIncompatibility: Array<{ quotationItemId: number; productName: string; supplierId: number; supplierName: string; unitPrice: number; reason: string }> = [];
      for (const [qItemId, options] of Object.entries(itemOptions)) {
        const qItem = (quotationItems as any[]).find((qi: any) => qi.id === parseInt(qItemId));
        if (!qItem) continue;
        const productNameUpper = (qItem.productName || "").toUpperCase();
        
        const filtered = options.filter(o => {
          const supplierRules = incompatibleMap.get(String(o.supplierId));
          if (!supplierRules) return true; // No rules for this supplier
          // Match fornecedor + item; se houver marca na regra, a rejeição é específica àquela marca.
          const optionBrand = String(o.brand || "").trim().toUpperCase();
          for (const rule of supplierRules) {
            const matchesItem = productNameUpper.includes(rule.productKey);
            const matchesBrand = !rule.brandName || optionBrand === rule.brandName;
            if (matchesItem && matchesBrand) {
              // Track exclusion for UI alert
              const sup = allSuppliers.find(s => s.id === o.supplierId);
              excludedByIncompatibility.push({
                quotationItemId: parseInt(qItemId),
                productName: qItem.productName,
                supplierId: o.supplierId,
                supplierName: sup?.tradeName || sup?.companyName || `ID ${o.supplierId}`,
                unitPrice: o.unitPrice,
                reason: rule.reason || (rule.automatic
                  ? `Supermercado não atende (${rule.productKey.toLowerCase()})`
                  : `Fornecedor marcado como incompatível (${rule.productKey.toLowerCase()})`),
              });
              return false; // Incompatible
            }
          }
          return true;
        });
        
        if (filtered.length > 0 && filtered.length < options.length) {
          // Some options were removed - update the array in place
          itemOptions[parseInt(qItemId)] = filtered;
        }
        // If ALL options are incompatible, keep them all (don't block completely)
      }
      
      // 1.5. Anomaly detection: flag prices that are >300% above median of other suppliers
      const anomalies: Array<{
        quotationItemId: number;
        productName: string;
        quantity: number;
        unit: string;
        supplierId: number;
        supplierName: string;
        unitPrice: number;
        medianPrice: number;
        deviationPct: number;
        brand: string;
      }> = [];
      
      for (const [qItemId, options] of Object.entries(itemOptions)) {
        if (options.length < 2) continue; // Need at least 2 suppliers to detect anomaly
        const prices = options.map(o => o.unitPrice).sort((a, b) => a - b);
        const median = prices.length % 2 === 0
          ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
          : prices[Math.floor(prices.length / 2)];
        
        // Flag any price >300% above median (4x the median)
        const threshold = median * 4;
        const flagged = options.filter(o => o.unitPrice > threshold);
        
        if (flagged.length > 0) {
          const qItem = (quotationItems as any[]).find((qi: any) => qi.id === parseInt(qItemId));
          for (const f of flagged) {
            const deviationPct = Math.round(((f.unitPrice - median) / median) * 100);
            anomalies.push({
              quotationItemId: parseInt(qItemId),
              productName: qItem?.productName || "?",
              quantity: parseFloat(qItem?.quantity) || 0,
              unit: qItem?.unit || "",
              supplierId: f.supplierId,
              supplierName: f.supplierName,
              unitPrice: f.unitPrice,
              medianPrice: Math.round(median * 100) / 100,
              deviationPct,
              brand: f.brand,
            });
            // Remove flagged item from options so it's excluded from optimization
            const idx = itemOptions[parseInt(qItemId)].findIndex(
              o => o.supplierId === f.supplierId
            );
            if (idx !== -1) itemOptions[parseInt(qItemId)].splice(idx, 1);
          }
        }
      }
      
      // 1.6. Brand classification - will check per-product below
      // (brand status depends on product name, so we check inside the per-item loop)
      
      // 2. For each item, determine optimal supplier
      const tolerance = input.tolerancePct / 100;
      const result: Array<{
        quotationItemId: number;
        productName: string;
        quantity: number;
        unit: string;
        selectedSupplierId: number;
        selectedSupplierName: string;
        unitPrice: number;
        total: number;
        brand: string;
        reason: string;
        packagingType: string;
        unitsPerPackage: number;
        alternatives: Array<{ supplierId: number; supplierName: string; unitPrice: number; brand: string }>;
      }> = [];
      const noSupplier: Array<{ productName: string; quantity: number; unit: string }> = [];
      const unresolvedTies: Array<{
        quotationItemId: number;
        productName: string;
        tiedSuppliers: Array<{ supplierId: number; supplierName: string; unitPrice: number; brand: string; paymentTerms: string | null }>;
      }> = [];
      
      for (const qItem of quotationItems as any[]) {
        const qty = parseFloat(qItem.quantity) || 0;
        if (qty === 0) continue;
        
        const options = itemOptions[qItem.id];
        if (!options || options.length === 0) {
          noSupplier.push({ productName: qItem.productName, quantity: qty, unit: qItem.unit });
          continue;
        }
        
        if (options.length === 1) {
          // Only one supplier quoted
          const o = options[0];
          result.push({
            quotationItemId: qItem.id,
            productName: qItem.productName,
            quantity: qty,
            unit: qItem.unit,
            selectedSupplierId: o.supplierId,
            selectedSupplierName: o.supplierName,
            unitPrice: o.unitPrice,
            total: Math.round(o.unitPrice * qty * 100) / 100,
            brand: o.brand,
            reason: "Único fornecedor",
            packagingType: o.packagingType,
            unitsPerPackage: o.unitsPerPackage,
            alternatives: [],
          });
          continue;
        }
        
        // Multiple suppliers - find cheapest
        // First, filter out rejected brands using BOTH the classification system AND the new rejection tables
        const brandsInThisItem = Array.from(new Set(options.map(o => o.brand).filter(b => b && b !== "\u2014"))) as string[];
        const brandStatusesForItem = await db.getBrandStatusBatch(brandsInThisItem, qItem.productName);
        // Also check the new brand rejection tables (global + per-unit)
        const brandRejectionMap = quotationUnitId > 0 
          ? await db.getBrandRejectionBatch(brandsInThisItem, quotationUnitId, qItem.productName)
          : {} as Record<string, boolean>;
        const isRejectedBrand = (brand: string) => {
          if (!brand || brand === "\u2014") return false;
          // Rejected if classified as rejected OR in the rejection tables
          return brandStatusesForItem[brand] === "rejected" || brandRejectionMap[brand] === true;
        };
        const nonRejectedOptions = options.filter(o => !isRejectedBrand(o.brand));
        // If all options have rejected brands, fall back to all options (shouldn't block completely)
        const brandFilteredOptions = nonRejectedOptions.length > 0 ? nonRejectedOptions : options;
        
        // Then, separate suppliers that meet quantity from those that don't
        const sufficientQty = brandFilteredOptions.filter(o => !o.quantityInsufficient);
        const insufficientQty = brandFilteredOptions.filter(o => o.quantityInsufficient);
        
        // Prefer suppliers that meet quantity; only use insufficient ones if no sufficient option exists
        const eligibleOptions = sufficientQty.length > 0 ? sufficientQty : brandFilteredOptions;
        const sorted = [...eligibleOptions].sort((a, b) => a.unitPrice - b.unitPrice);
        const cheapest = sorted[0];
        
        // PREFERRED SUPPLIER RULE: If any preferred supplier is within their configured tolerance of cheapest, they win.
        const limite = cheapest.unitPrice * (1 + tolerance);
        
        let selected = cheapest;
        let reason = "Menor preço";
        let unresolvedTie: { quotationItemId: number; productName: string; options: typeof sorted } | null = null;
        
        // If rejected brands were filtered out, note it in reason
        const rejectedCount = options.length - brandFilteredOptions.length;
        if (rejectedCount > 0) {
          reason += ` (${rejectedCount} marca${rejectedCount > 1 ? 's' : ''} reprovada${rejectedCount > 1 ? 's' : ''} excluída${rejectedCount > 1 ? 's' : ''})`;
        }
        
        // Check if any preferred supplier is in the eligible options and within their tolerance
        const preferredInOptions = sorted.filter(o => 
          preferredSuppliersList.some(ps => ps.supplierId === o.supplierId)
        );
        
        let preferenceApplied = false;
        if (preferredInOptions.length > 0) {
          // Find the cheapest preferred supplier within tolerance
          for (const prefOpt of preferredInOptions) {
            const prefConfig = preferredSuppliersList.find(ps => ps.supplierId === prefOpt.supplierId)!;
            const prefLimite = cheapest.unitPrice * (1 + prefConfig.tolerancePct / 100);
            
            if (prefOpt.supplierId === cheapest.supplierId) {
              // Preferred supplier IS the cheapest - just note it
              reason = `Menor preço (${prefOpt.supplierName})`;
              preferenceApplied = true;
              break;
            } else if (prefOpt.unitPrice <= prefLimite) {
              const diffPct = ((prefOpt.unitPrice - cheapest.unitPrice) / cheapest.unitPrice * 100).toFixed(1);
              reason = `Preferência ${prefOpt.supplierName} (+${diffPct}% dentro de ${prefConfig.tolerancePct}%)`;
              selected = prefOpt;
              preferenceApplied = true;
              break;
            }
          }
        }
        
        // TIEBREAKER CASCADE: When no preference applied and multiple suppliers have similar prices
        if (!preferenceApplied && sorted.length > 1) {
          const EQUAL_THRESHOLD = 0.005; // 0.5% = considered equal price
          const tiedOptions = sorted.filter(o => 
            Math.abs(o.unitPrice - cheapest.unitPrice) / cheapest.unitPrice <= EQUAL_THRESHOLD
          );
          
          if (tiedOptions.length > 1) {
            // Step 1: Payment terms - "A Prazo" beats "À Vista"
            const parsePaymentDays = (terms: string | null): number => {
              if (!terms) return 0;
              const t = terms.toLowerCase().trim();
              if (t.includes('vista') || t === 'a vista' || t === 'à vista') return 0;
              const match = t.match(/(\d+)/);
              return match ? parseInt(match[1]) : 1; // "A Prazo" without number = 1 day (still beats à vista)
            };
            
            const withPayment = tiedOptions.map(o => ({
              ...o,
              paymentDays: parsePaymentDays(o.paymentTerms || o.supplierPaymentTerms),
            }));
            
            // Sort by payment days descending (longer term = better)
            withPayment.sort((a, b) => b.paymentDays - a.paymentDays);
            
            if (withPayment[0].paymentDays > withPayment[1].paymentDays) {
              // Clear winner by payment terms
              selected = tiedOptions.find(o => o.supplierId === withPayment[0].supplierId)!;
              const days = withPayment[0].paymentDays;
              reason = `Desempate: prazo ${days > 0 ? days + 'd' : 'a prazo'} vs ${withPayment[1].paymentDays > 0 ? withPayment[1].paymentDays + 'd' : 'à vista'}`;
            } else if (withPayment[0].paymentDays === withPayment[1].paymentDays) {
              // Step 2: Same payment - check brands
              const samePmtOptions = withPayment.filter(o => o.paymentDays === withPayment[0].paymentDays);
              const brands = samePmtOptions.map(o => o.brand?.toLowerCase().trim() || '');
              const uniqueBrands = new Set(brands.filter(b => b && b !== '—'));
              
              if (uniqueBrands.size > 1) {
                // Different brands, both unclassified - MANUAL TIE (user must choose)
                unresolvedTie = {
                  quotationItemId: qItem.id,
                  productName: qItem.productName,
                  options: samePmtOptions,
                };
                // Default to first (cheapest) but flag for manual resolution
                reason = `⚡ EMPATE: marcas diferentes — escolha manual necessária`;
              } else {
                // Step 3: Same brand or no brand - winner by volume (resolved after all items processed)
                // For now, keep cheapest and mark for volume resolution
                reason = `Desempate: maior volume na cotação`;
                // Will be resolved in post-processing
              }
            }
          }
        }
        
        
        // Add warning if selected supplier has insufficient quantity
        let qtyWarning: string | null = null;
        if (selected.quantityInsufficient) {
          qtyWarning = `⚠️ Qtd insuficiente: fornecedor oferece ${selected.suppliedTotalUnits} un, precisamos de ${qty} ${qItem.unit}`;
        } else if (sufficientQty.length === 0 && insufficientQty.length > 0) {
          qtyWarning = `⚠️ Nenhum fornecedor atende a qtd total solicitada (${qty} ${qItem.unit})`;
        }
        
        // Collect unresolved tie if any
        if (unresolvedTie) {
          unresolvedTies.push({
            quotationItemId: unresolvedTie.quotationItemId,
            productName: unresolvedTie.productName,
            tiedSuppliers: unresolvedTie.options.map(o => ({
              supplierId: o.supplierId,
              supplierName: o.supplierName,
              unitPrice: o.unitPrice,
              brand: o.brand,
              paymentTerms: o.paymentTerms || o.supplierPaymentTerms || null,
            })),
          });
        }
        
        result.push({
          quotationItemId: qItem.id,
          productName: qItem.productName,
          quantity: qty,
          unit: qItem.unit,
          selectedSupplierId: selected.supplierId,
          selectedSupplierName: selected.supplierName,
          unitPrice: selected.unitPrice,
          total: Math.round(selected.unitPrice * qty * 100) / 100,
          brand: selected.brand,
          reason: qtyWarning ? `${reason} | ${qtyWarning}` : reason,
          packagingType: selected.packagingType,
          unitsPerPackage: selected.unitsPerPackage,
          alternatives: sorted.filter(o => o.supplierId !== selected.supplierId).map(o => ({
            supplierId: o.supplierId,
            supplierName: o.supplierName,
            unitPrice: o.unitPrice,
            brand: o.brand,
          })),
        });
      }
      
      // 2.5. Volume-based tiebreaker post-processing
      // For items marked with "Desempate: maior volume na cotação", resolve by checking which supplier won more items
      const supplierWinCount: Record<number, number> = {};
      for (const item of result) {
        supplierWinCount[item.selectedSupplierId] = (supplierWinCount[item.selectedSupplierId] || 0) + 1;
      }
      
      for (const item of result) {
        if (item.reason.includes("maior volume na cotação")) {
          // Re-evaluate: find the tied option with highest volume
          const tiedAlts = [{ supplierId: item.selectedSupplierId, supplierName: item.selectedSupplierName }, ...item.alternatives];
          const byVolume = tiedAlts.sort((a, b) => (supplierWinCount[b.supplierId] || 0) - (supplierWinCount[a.supplierId] || 0));
          const volumeWinner = byVolume[0];
          
          if (volumeWinner.supplierId !== item.selectedSupplierId) {
            // Swap to the volume winner
            const alt = item.alternatives.find(a => a.supplierId === volumeWinner.supplierId);
            if (alt) {
              item.selectedSupplierId = alt.supplierId;
              item.selectedSupplierName = alt.supplierName;
              item.brand = alt.brand;
            }
          }
          item.reason = `Desempate: maior volume (${supplierWinCount[volumeWinner.supplierId] || 0} itens ganhos)`;
        }
      }
      
      // 3. Group by supplier
      const bySupplier: Record<number, {
        supplierId: number;
        supplierName: string;
        items: typeof result;
        total: number;
        paymentTerms: string;
      }> = {};
      
      for (const item of result) {
        if (!bySupplier[item.selectedSupplierId]) {
          const supplier = allSuppliers.find(s => s.id === item.selectedSupplierId);
          bySupplier[item.selectedSupplierId] = {
            supplierId: item.selectedSupplierId,
            supplierName: item.selectedSupplierName,
            items: [],
            total: 0,
            paymentTerms: supplier?.paymentTerms || "—",
          };
        }
        bySupplier[item.selectedSupplierId].items.push(item);
        bySupplier[item.selectedSupplierId].total += item.total;
      }
      
      const suppliers_result = Object.values(bySupplier).sort((a, b) => b.total - a.total);
      const grandTotal = suppliers_result.reduce((s, g) => s + g.total, 0);
      
      // 4. Get last purchase prices for comparison
      const productNames = result.map(r => r.productName);
      const lastPurchases = await db.getLastPurchasePrices(productNames);

      // 5. Compute cost scenarios (Pior / Intermediário / Ideal)
      const scenarioItems: ScenarioItemInput[] = (quotationItems as any[]).map((qItem: any) => {
        const qty = parseFloat(qItem.quantity) || 0;
        const opts = itemOptions[qItem.id] || [];
        return {
          quotationItemId: qItem.id,
          productName: qItem.productName,
          quantity: qty,
          unit: qItem.unit,
          prices: opts.map((o: any) => ({
            supplierId: o.supplierId,
            supplierName: o.supplierName,
            unitPrice: o.unitPrice,
            brand: o.brand || "",
            paymentTerms: o.paymentTerms || null,
          })),
        };
      });
      const scenarios = computeScenarios(scenarioItems);

      return {
        quotationId: input.quotationId,
        tolerancePct: input.tolerancePct,
        totalSuppliers: suppliers_result.length,
        grandTotal: Math.round(grandTotal * 100) / 100,
        suppliers: suppliers_result.map(s => ({
          ...s,
          total: Math.round(s.total * 100) / 100,
          itemCount: s.items.length,
          items: s.items.map(item => ({
            ...item,
            lastPurchase: lastPurchases[item.productName] || null,
          })),
        })),
        noSupplier,
        lastPurchases,
        anomalies,
        scenarios,
        unresolvedTies,
        excludedByIncompatibility,
        preferredSuppliers: preferredSuppliersList.map(ps => {
          const s = allSuppliers.find(sup => sup.id === ps.supplierId);
          return { supplierId: ps.supplierId, supplierName: s?.tradeName || s?.companyName || `ID ${ps.supplierId}`, tolerancePct: ps.tolerancePct };
        }),
      };
    }),
    // Generate purchase orders from optimization result
    generateOrdersFromOptimization: writeProcedure.input(z.object({
      quotationId: z.number(),
      suppliers: z.array(z.object({
        supplierId: z.number(),
        items: z.array(z.object({
          productName: z.string(),
          quantity: z.number(),
          unit: z.string(),
          unitPrice: z.number(),
          total: z.number(),
          brand: z.string().optional().nullable(),
          packagingType: z.string().optional().nullable(),
          unitsPerPackage: z.number().optional().nullable(),
        })),
        total: z.number(),
      })),
      deselectionReason: z.string().optional().nullable(),
    })).mutation(async ({ input, ctx }) => {
      const quotation = await db.getQuotation(input.quotationId);
      if (!quotation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Cotação não encontrada.' });
      }
      if (quotation.status === 'cancelled') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cotação cancelada não pode gerar pedidos. Reabra a cotação primeiro.' });
      }
      if (quotation.status === 'draft') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cotação em rascunho não pode gerar pedidos.' });
      }
      // Allow re-generation: if quotation is already ordered, cancel previous orders and reopen
      if (quotation.status === 'ordered') {
        const existingOrders = await db.listPurchaseOrdersByQuotation(input.quotationId);
        for (const order of existingOrders) {
          await db.updatePurchaseOrder(order.id, { status: 'cancelled' });
        }
        await db.updateQuotation(input.quotationId, { status: 'closed' });
        await db.createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name || "",
          userEmail: ctx.user.email || "",
          action: "reopen_quotation",
          entityType: "quotation",
          entityId: input.quotationId,
          details: { reason: "Re-geração de pedidos", cancelledOrders: existingOrders.length },
        });
      }
      const orders: Array<{ id: number; code: string; supplierName: string }> = [];
      const allSuppliers = await db.listSuppliers();
      const baseTs = Date.now().toString(36);
      const purchaseGroupId = `OPT-${input.quotationId}-${baseTs}`;
      const allPriceRecords: Array<any> = [];
      let orderIdx = 0;
      
      for (const supplierGroup of input.suppliers) {
        const supplier = allSuppliers.find(s => s.id === supplierGroup.supplierId);
        const supplierName = supplier?.tradeName || supplier?.companyName || `Fornecedor ${supplierGroup.supplierId}`;
        orderIdx++;
        const code = `PED-${baseTs.toUpperCase()}${orderIdx}-${supplierGroup.supplierId}`.slice(0, 20);
        
        const orderId = await db.createPurchaseOrder({
          code,
          quotationId: input.quotationId,
          proposalId: null,
          supplierId: supplierGroup.supplierId,
          unitId: quotation?.unitId || null,
          createdBy: ctx.user.id,
          totalValue: supplierGroup.total.toFixed(2),
          notes: `Pedido gerado automaticamente pela Compra Otimizada (Cotação #${input.quotationId})`,
          purchaseGroupId,
          period: extractPeriodFromQuotation(quotation),
        });
        
        await db.createPurchaseOrderItems(supplierGroup.items.map(item => ({
          orderId,
          productName: item.productName,
          quantity: String(item.quantity),
          unit: item.unit,
          unitPrice: String(item.unitPrice.toFixed(2)),
          totalPrice: String(item.total.toFixed(2)),
          packagingType: item.packagingType || null,
          unitsPerPackage: item.unitsPerPackage || null,
        })));
        
        orders.push({ id: orderId, code, supplierName });
        
        // Collect price records for batch insert
        for (const item of supplierGroup.items) {
          allPriceRecords.push({
            productName: item.productName,
            supplierId: supplierGroup.supplierId,
            supplierName,
            brand: (item as any).brand || undefined,
            unitId: quotation?.unitId || undefined,
            unitPrice: String(item.unitPrice.toFixed(2)),
            quantity: String(item.quantity),
            unit: item.unit,
            quotationId: input.quotationId,
            orderId,
            source: "order",
          });
        }
      }
      
      // Batch: record all prices + approve all orders + audit logs in parallel
      await Promise.all([
        db.recordPriceBatch(allPriceRecords),
        ...orders.map(order => 
          db.updatePurchaseOrder(order.id, { status: "approved", approvedBy: ctx.user.id, approvedAt: new Date() })
        ),
        ...orders.map(order =>
          db.createAuditLog({
            userId: ctx.user.id,
            userName: ctx.user.name || "",
            userEmail: ctx.user.email || "",
            action: "create_order",
            entityType: "purchase_order",
            entityId: order.id,
            details: { code: order.code, source: "optimization" },
          })
        ),
      ]);
      
      // Check price targets and generate alerts for violations
      const allItems = input.suppliers.flatMap(s => s.items);
      const productNames = allItems.map(i => i.productName);
      const targets = await db.getPriceTargetsForProducts(productNames);
      const violations: Array<{ productName: string; unitPrice: number; maxPrice: number; pct: number }> = [];
      
      for (const item of allItems) {
        const target = targets.find(t => 
          t.productName.toLowerCase().trim() === item.productName.toLowerCase().trim()
        );
        if (target) {
          const max = parseFloat(target.maxPrice);
          if (item.unitPrice > max) {
            const pct = ((item.unitPrice - max) / max) * 100;
            violations.push({ productName: item.productName, unitPrice: item.unitPrice, maxPrice: max, pct });
          }
        }
      }
      
      // Generate alerts for price target violations
      if (violations.length > 0) {
        const topViolations = violations.sort((a, b) => b.pct - a.pct).slice(0, 5);
        const description = topViolations.map(v => 
          `${v.productName}: R$ ${v.unitPrice.toFixed(2)} (meta: R$ ${v.maxPrice.toFixed(2)}, +${v.pct.toFixed(0)}%)`
        ).join("\n");
        
        await db.createAlert({
          type: "price_anomaly",
          title: `⚠️ ${violations.length} produto(s) acima da meta de preço`,
          description,
          severity: violations.some(v => v.pct > 30) ? "critical" : violations.some(v => v.pct > 15) ? "high" : "medium",
          relatedEntity: "quotation",
          relatedEntityId: input.quotationId,
          unitId: quotation?.unitId || null,
        });
        
        // Send push notification for critical violations
        if (violations.some(v => v.pct > 20)) {
          try {
            const { notifyOwner } = await import('./_core/notification');
            await notifyOwner({
              title: `⚠️ Meta de Preço Excedida`,
              content: `${violations.length} produto(s) acima da meta na compra otimizada. Maior desvio: ${topViolations[0].productName} (+${topViolations[0].pct.toFixed(0)}%)`,
            });
          } catch (e) { /* notification is best-effort */ }
        }
      }
      
      // ═══ INTEGRITY CHECK: compare generated order quantities vs Fortes request ═══
      try {
        const quotationItems = await db.listQuotationItems(input.quotationId);
        const orderItemsByProduct: Record<string, number> = {};
        for (const sg of input.suppliers) {
          for (const item of sg.items) {
            const key = item.productName.toUpperCase().trim();
            orderItemsByProduct[key] = (orderItemsByProduct[key] || 0) + item.quantity;
          }
        }
        const divergences: Array<{ product: string; requested: number; ordered: number; diff: number }> = [];
        for (const qi of quotationItems) {
          const key = qi.productName.toUpperCase().trim();
          const requested = parseFloat(qi.quantity) || 0;
          const ordered = orderItemsByProduct[key] || 0;
          if (requested > 0 && Math.abs(ordered - requested) > 0.01) {
            divergences.push({ product: qi.productName, requested, ordered, diff: ordered - requested });
          }
        }
        if (divergences.length > 0) {
          await auditSensitiveAction({
            userId: ctx.user.id, userEmail: ctx.user.email || "", userName: ctx.user.name || "",
            action: "integrity_divergence", entityType: "quotation", entityId: input.quotationId,
            details: { divergenceCount: divergences.length, samples: divergences.slice(0, 5) },
            severity: "critical",
            notifTitle: `INTEGRIDADE: ${divergences.length} divergência(s) de quantidade`,
            notifMessage: `Pedidos gerados da cotação #${input.quotationId} têm ${divergences.length} item(ns) com quantidade diferente da solicitação Fortes. Ex: ${divergences[0].product} (solicitado: ${divergences[0].requested}, pedido: ${divergences[0].ordered}).`,
            actionUrl: `/cotacao/${input.quotationId}`,
          });
        }
      } catch { /* integrity check is best-effort, never block order generation */ }

      // Close quotation as "ordered" (transformed into purchase order)
      await db.updateQuotation(input.quotationId, { status: "ordered" });
      await db.createAuditLog({ userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "", action: "order_quotation", entityType: "quotation", entityId: input.quotationId, details: { totalOrders: orders.length, purchaseGroupId } });

      // Notify Master, Júnior, Paula about orders generated
      try {
        const quotTitle = quotation?.title || quotation?.code || `#${input.quotationId}`;
        await notifyUsersByEmail(
          [...MASTER_EMAILS_NOTIF, ...JUNIOR_EMAILS_NOTIF, ...PAULA_EMAILS_NOTIF],
          {
            type: 'order_generated',
            title: `${orders.length} pedido(s) gerado(s)`,
            message: `Compra otimizada da cotação "${quotTitle}" gerou ${orders.length} pedido(s)`,
            priority: 'high',
            relatedEntityType: 'quotation',
            relatedEntityId: input.quotationId,
            actionUrl: `/pedidos`,
            dedupeKey: `order_generated_${input.quotationId}_${purchaseGroupId}`,
          }
        );
      } catch { /* best-effort */ }

            return { orders, totalOrders: orders.length, priceViolations: violations };
    }),
    // ==================== ESTOQUE INSUFICIENTE - REDIRECIONAMENTO ====================
    redirectInsufficientStock: writeProcedure.input(z.object({
      quotationId: z.number(),
      orderId: z.number(), // pedido original do fornecedor com estoque insuficiente
      items: z.array(z.object({
        productName: z.string(),
        originalQuantity: z.number(), // quantidade original pedida
        availableQuantity: z.number(), // quantidade que o fornecedor realmente tem
        chosenSupplierId: z.number().optional().nullable(), // fornecedor escolhido pelo ranking (se null/undefined, usa 2º melhor preço)
        justification: z.string().optional().nullable(), // justificativa obrigatória se não for o 2º melhor preço
      })),
    })).mutation(async ({ input, ctx }) => {
      // Permission check: only ADM Master and buyer_senior
      const isMaster = ctx.user.email === "afonsoqueirogagn@gmail.com" ;
      if (!isMaster) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas o ADM Master pode redirecionar estoque.' });
      }
      // 1. Validate quotation and order
      const quotation = await db.getQuotation(input.quotationId);
      if (!quotation) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cotação não encontrada.' });
      const orderItems = await db.listPurchaseOrderItems(input.orderId);
      if (orderItems.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pedido não encontrado ou sem itens.' });
      // Get the order to find the supplier
      const allOrders = await db.listPurchaseOrdersByQuotation(input.quotationId);
      const originalOrder = allOrders.find(o => o.id === input.orderId);
      if (!originalOrder) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pedido não pertence a esta cotação.' });
      if (originalOrder.status === 'cancelled') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Pedido já está cancelado.' });
      const originalSupplierId = originalOrder.supplierId;
      // 2. For each item with insufficient stock, find the 2nd best price
      const proposals = await db.listProposals(input.quotationId);
      const allSuppliers = await db.listSuppliers();
      const redirectedItems: Array<{ productName: string; deficit: number; unit: string; newSupplierId: number; newSupplierName: string; newUnitPrice: number; newTotal: number; justification: string | null }> = [];
      const updatedOriginalItems: Array<{ productName: string; newQuantity: number; newTotal: number }> = [];
      for (const insuffItem of input.items) {
        const deficit = insuffItem.originalQuantity - insuffItem.availableQuantity;
        if (deficit <= 0) continue;
        // Find the order item
        const orderItem = orderItems.find(oi => oi.productName === insuffItem.productName);
        if (!orderItem) continue;
        // Find the quotation item to get all proposal prices
        const qItems = await db.listQuotationItems(input.quotationId);
        const qItem = qItems.find(qi => qi.productName === insuffItem.productName);
        if (!qItem) continue;
        // Get all prices for this item from all proposals (excluding original supplier)
        const pricesForItem: Array<{ supplierId: number; supplierName: string; unitPrice: number; brand: string | null }> = [];
        for (const prop of proposals) {
          if (prop.supplierId === originalSupplierId) continue; // Skip the insufficient supplier
          const pItems = await db.listProposalItems(prop.id);
          const pItem = pItems.find(pi => pi.quotationItemId === qItem.id);
          if (pItem) {
            const supplier = allSuppliers.find(s => s.id === prop.supplierId);
            pricesForItem.push({
              supplierId: prop.supplierId,
              supplierName: supplier?.tradeName || supplier?.companyName || `Fornecedor ${prop.supplierId}`,
              unitPrice: parseFloat(pItem.unitPrice),
              brand: pItem.brand,
            });
          }
        }
        // Sort by price - cheapest first (this is the 2nd best since we excluded the original)
        pricesForItem.sort((a, b) => a.unitPrice - b.unitPrice);
        if (pricesForItem.length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Não há fornecedor alternativo para ${insuffItem.productName}. Nenhum outro fornecedor cotou este item.` });
        }
        // Use chosenSupplierId if provided, otherwise default to cheapest (2nd best)
        let chosenAlternative = pricesForItem[0];
        if (insuffItem.chosenSupplierId) {
          const chosen = pricesForItem.find(p => p.supplierId === insuffItem.chosenSupplierId);
          if (chosen) {
            chosenAlternative = chosen;
          }
        }
        redirectedItems.push({
          productName: insuffItem.productName,
          deficit,
          unit: orderItem.unit,
          newSupplierId: chosenAlternative.supplierId,
          newSupplierName: chosenAlternative.supplierName,
          newUnitPrice: chosenAlternative.unitPrice,
          newTotal: Math.round(deficit * chosenAlternative.unitPrice * 100) / 100,
          justification: insuffItem.justification || null,
        });
        updatedOriginalItems.push({
          productName: insuffItem.productName,
          newQuantity: insuffItem.availableQuantity,
          newTotal: Math.round(insuffItem.availableQuantity * parseFloat(orderItem.unitPrice) * 100) / 100,
        });
      }
      if (redirectedItems.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Nenhum item com déficit para redirecionar.' });
      }
      // 3. Update the original order items (reduce quantities) using existing helper
      for (const updItem of updatedOriginalItems) {
        const orderItem = orderItems.find(oi => oi.productName === updItem.productName);
        if (orderItem) {
          await db.updatePurchaseOrderItem(orderItem.id, input.orderId, { quantity: String(updItem.newQuantity) });
        }
      }
      // Recalculate original order total (already done by updatePurchaseOrderItem)
      const updatedOrderItems = await db.listPurchaseOrderItems(input.orderId);
      const newOriginalTotal = updatedOrderItems.reduce((sum, oi) => sum + parseFloat(oi.totalPrice), 0);
      // 4. Group redirected items by new supplier and create complementary orders
      const byNewSupplier: Record<number, typeof redirectedItems> = {};
      for (const ri of redirectedItems) {
        if (!byNewSupplier[ri.newSupplierId]) byNewSupplier[ri.newSupplierId] = [];
        byNewSupplier[ri.newSupplierId].push(ri);
      }
      const newOrders: Array<{ id: number; code: string; supplierName: string; total: number }> = [];
      const baseTs = Date.now().toString(36);
      let orderIdx = 0;
      for (const [supplierIdStr, items] of Object.entries(byNewSupplier)) {
        const supplierId = Number(supplierIdStr);
        const supplierName = items[0].newSupplierName;
        const total = items.reduce((sum, i) => sum + i.newTotal, 0);
        orderIdx++;
        const code = `CMP-${baseTs.toUpperCase()}${orderIdx}-${supplierId}`.slice(0, 20);
        const orderId = await db.createPurchaseOrder({
          code,
          quotationId: input.quotationId,
          proposalId: null,
          supplierId,
          unitId: quotation?.unitId || null,
          createdBy: ctx.user.id,
          totalValue: total.toFixed(2),
          notes: `Pedido complementar - Estoque insuficiente do fornecedor original (Pedido #${originalOrder.code})`,
          purchaseGroupId: `CMP-${input.quotationId}-${baseTs}`,
          period: extractPeriodFromQuotation(quotation),
        });
        await db.createPurchaseOrderItems(items.map(item => ({
          orderId,
          productName: item.productName,
          quantity: String(item.deficit),
          unit: item.unit,
          unitPrice: String(item.newUnitPrice.toFixed(2)),
          totalPrice: String(item.newTotal.toFixed(2)),
        })));
        // Auto-approve
        await db.updatePurchaseOrder(orderId, { status: 'approved', approvedBy: ctx.user.id, approvedAt: new Date() });
        newOrders.push({ id: orderId, code, supplierName, total });
      }
      // 5. Audit log
      await db.createAuditLog({
        userId: ctx.user.id,
        userName: ctx.user.name || "",
        userEmail: ctx.user.email || "",
        action: "redirect_insufficient_stock",
        entityType: "purchase_order",
        entityId: input.orderId,
        details: {
          quotationId: input.quotationId,
          originalSupplierId,
          items: input.items,
          redirectedTo: newOrders.map(o => ({ code: o.code, supplierName: o.supplierName, total: o.total })),
          justifications: redirectedItems.filter(ri => ri.justification).map(ri => ({ productName: ri.productName, supplierName: ri.newSupplierName, justification: ri.justification })),
        },
      });
      return {
        success: true,
        originalOrderUpdated: { orderId: input.orderId, newTotal: newOriginalTotal },
        complementaryOrders: newOrders,
        redirectedItems,
      };
    }),
    // ==================== STOCK ALTERNATIVES (RANKING) ====================
    getStockAlternatives: protectedProcedure.input(z.object({
      quotationId: z.number(),
      orderId: z.number(),
      items: z.array(z.object({
        productName: z.string(),
        originalQuantity: z.number(),
        availableQuantity: z.number(),
      })),
    })).query(async ({ input, ctx }) => {
      // Permission check: only ADM Master and buyer_senior
      const isMaster = ctx.user.email === "afonsoqueirogagn@gmail.com" ;
      if (!isMaster) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas o ADM Master pode redirecionar estoque.' });
      }
      // Validate quotation and order
      const quotation = await db.getQuotation(input.quotationId);
      if (!quotation) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cotação não encontrada.' });
      const orderItems = await db.listPurchaseOrderItems(input.orderId);
      if (orderItems.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pedido não encontrado ou sem itens.' });
      const allOrders = await db.listPurchaseOrdersByQuotation(input.quotationId);
      const originalOrder = allOrders.find(o => o.id === input.orderId);
      if (!originalOrder) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pedido não pertence a esta cotação.' });
      const originalSupplierId = originalOrder.supplierId;
      const proposals = await db.listProposals(input.quotationId);
      const allSuppliers = await db.listSuppliers();
      const qItems = await db.listQuotationItems(input.quotationId);
      // Build alternatives for each item with deficit
      const result: Array<{
        productName: string;
        deficit: number;
        unit: string;
        originalQuantity: number;
        availableQuantity: number;
        alternatives: Array<{
          rank: number;
          supplierId: number;
          supplierName: string;
          brand: string | null;
          unitPrice: number;
          totalForDeficit: number;
        }>;
      }> = [];
      for (const insuffItem of input.items) {
        const deficit = insuffItem.originalQuantity - insuffItem.availableQuantity;
        if (deficit <= 0) continue;
        const orderItem = orderItems.find(oi => oi.productName === insuffItem.productName);
        if (!orderItem) continue;
        const qItem = qItems.find(qi => qi.productName === insuffItem.productName);
        if (!qItem) continue;
        // Get all prices for this item from all proposals (excluding original supplier)
        const pricesForItem: Array<{ supplierId: number; supplierName: string; unitPrice: number; brand: string | null }> = [];
        for (const prop of proposals) {
          if (prop.supplierId === originalSupplierId) continue;
          const pItems = await db.listProposalItems(prop.id);
          const pItem = pItems.find(pi => pi.quotationItemId === qItem.id);
          if (pItem && parseFloat(pItem.unitPrice) > 0) {
            const supplier = allSuppliers.find(s => s.id === prop.supplierId);
            pricesForItem.push({
              supplierId: prop.supplierId,
              supplierName: supplier?.tradeName || supplier?.companyName || `Fornecedor ${prop.supplierId}`,
              unitPrice: parseFloat(pItem.unitPrice),
              brand: pItem.brand,
            });
          }
        }
        // Sort by price ascending
        pricesForItem.sort((a, b) => a.unitPrice - b.unitPrice);
        if (pricesForItem.length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Não há fornecedor alternativo para ${insuffItem.productName}. Nenhum outro fornecedor cotou este item.` });
        }
        result.push({
          productName: insuffItem.productName,
          deficit,
          unit: orderItem.unit,
          originalQuantity: insuffItem.originalQuantity,
          availableQuantity: insuffItem.availableQuantity,
          alternatives: pricesForItem.map((p, idx) => ({
            rank: idx + 1,
            supplierId: p.supplierId,
            supplierName: p.supplierName,
            brand: p.brand,
            unitPrice: p.unitPrice,
            totalForDeficit: Math.round(deficit * p.unitPrice * 100) / 100,
          })),
        });
      }
      if (result.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Nenhum item com déficit para redirecionar.' });
      }
      return result;
    }),
    // ==================== PRICE CORRECTION ====================
    getCorrectionItem: publicProcedure.input(z.object({
      token: z.string(),
      supplierId: z.number(),
      itemId: z.number(),
    })).query(async ({ input }) => {
      const quotation = await db.getQuotationByToken(input.token);
      if (!quotation) throw new Error("Cotação não encontrada");
      const supplier = await db.getSupplier(input.supplierId);
      if (!supplier) throw new Error("Fornecedor não encontrado");
      const items = await db.listQuotationItems(quotation.id);
      const item = items.find(i => i.id === input.itemId);
      if (!item) throw new Error("Item não encontrado");
      // Get current proposal item value
      const proposals = await db.listProposals(quotation.id);
      const supplierProposal = proposals.find(p => p.supplierId === input.supplierId);
      let currentPrice = null;
      let currentBrand = null;
      let proposalItemId = null;
      if (supplierProposal) {
        const pItems = await db.listProposalItems(supplierProposal.id);
        const pItem = pItems.find(pi => pi.quotationItemId === input.itemId);
        if (pItem) {
          currentPrice = pItem.unitPrice;
          currentBrand = pItem.brand;
          proposalItemId = pItem.id;
        }
      }
      return {
        quotationTitle: quotation.title,
        supplierName: supplier.tradeName || supplier.companyName,
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        currentPrice,
        currentBrand,
        proposalItemId,
      };
    }),

    submitCorrection: publicProcedure.input(z.object({
      token: z.string(),
      supplierId: z.number(),
      itemId: z.number(),
      newPrice: z.number().positive(),
      brand: z.string().min(1),
      packagingType: z.enum(["unidade", "caixa", "fardo", "pacote"]).default("unidade"),
      unitsPerPackage: z.number().int().positive().default(1),
      notes: z.string().optional(),
    })).mutation(async ({ input }) => {
      const quotation = await db.getQuotationByToken(input.token);
      if (!quotation) throw new Error("Cotação não encontrada");
      const proposals = await db.listProposals(quotation.id);
      const supplierProposal = proposals.find(p => p.supplierId === input.supplierId);
      if (!supplierProposal) throw new Error("Proposta não encontrada");
      const pItems = await db.listProposalItems(supplierProposal.id);
      const pItem = pItems.find(pi => pi.quotationItemId === input.itemId);
      if (!pItem) throw new Error("Item da proposta não encontrado");
      // Calculate normalized price
      const normalizedPrice = input.packagingType !== "unidade" && input.unitsPerPackage > 1
        ? input.newPrice / input.unitsPerPackage
        : input.newPrice;
      // Get quantity to recalculate total
      const items = await db.listQuotationItems(quotation.id);
      const qItem = items.find(i => i.id === input.itemId);
      const qty = qItem ? parseFloat(qItem.quantity) : 1;
      const totalPrice = normalizedPrice * qty;
      // Update the proposal item
      await db.updateProposalItem(pItem.id, {
        unitPrice: String(input.newPrice),
        totalPrice: String(totalPrice),
        brand: input.brand,
        packagingType: input.packagingType,
        unitsPerPackage: input.unitsPerPackage,
        unitPriceNormalized: String(normalizedPrice),
        notes: input.notes || `Correção: preço atualizado de R$${pItem.unitPrice} para R$${input.newPrice}`,
      });
      // Recalculate proposal total
      const updatedItems = await db.listProposalItems(supplierProposal.id);
      const newTotal = updatedItems.reduce((sum, i) => sum + parseFloat(i.totalPrice || "0"), 0);
      await db.updateProposal(supplierProposal.id, { totalValue: String(newTotal) });
      // Record in audit
      await db.createAuditLog({
        action: "price_correction",
        entityType: "proposal_item",
        entityId: pItem.id,
        details: { supplierId: input.supplierId, itemId: input.itemId, oldPrice: pItem.unitPrice, newPrice: input.newPrice },
        userId: 0,
      });
            return { success: true, newPrice: input.newPrice, normalizedPrice };
    }),
    // Reopen a closed/ordered quotation - cancels all orders and reverts to open
    reopen: writeProcedure.input(z.object({
      quotationId: z.number(),
      reason: z.string().min(5, "Informe o motivo (mínimo 5 caracteres)"),
    })).mutation(async ({ input, ctx }) => {
      // Only ADM Master (Afonso) and Luiz Antonio Jr can reopen
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      const LUIZ_EMAIL = "frotas.patrimonio@qualities.com.br";
      const allowedEmails = [MASTER_EMAIL, LUIZ_EMAIL];
      if (!allowedEmails.includes(ctx.user.email || '')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas ADM Master e Luiz Antonio Jr podem reabrir cotações.' });
      }
      const quotation = await db.getQuotation(input.quotationId);
      if (!quotation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Cotação não encontrada.' });
      }
      if (quotation.status !== 'ordered' && quotation.status !== 'closed') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Cotação com status "${quotation.status}" não pode ser reaberta. Apenas cotações fechadas/pedidas podem ser reabertas.` });
      }
      // Cancel all existing orders for this quotation
      const existingOrders = await db.listPurchaseOrdersByQuotation(input.quotationId);
      const cancelledOrders: Array<{ id: number; code: string }> = [];
      for (const order of existingOrders) {
        if (order.status !== 'cancelled') {
          await db.updatePurchaseOrder(order.id, { status: 'cancelled' });
          cancelledOrders.push({ id: order.id, code: order.code });
        }
      }
      // Revert quotation status to 'open' and track reopen metadata
      const currentReopenCount = (quotation as any).reopenCount || 0;
      await db.updateQuotation(input.quotationId, {
        status: 'open',
        reopenCount: currentReopenCount + 1,
        lastReopenedAt: new Date(),
        lastReopenedBy: ctx.user.name || ctx.user.email || 'Desconhecido',
        lastReopenReason: input.reason,
      });
      // Audit log
      // Audit via centralized function: >2 reopens = critical
      const reopenSeverity: AuditSeverity = (currentReopenCount + 1) > 2 ? 'critical' : 'warning';
      const quotTitle = quotation.title || quotation.code || `#${input.quotationId}`;
      await auditSensitiveAction({
        userId: ctx.user.id, userEmail: ctx.user.email || "", userName: ctx.user.name || "",
        action: "reopen_quotation", entityType: "quotation", entityId: input.quotationId,
        details: {
          reason: input.reason, previousStatus: quotation.status,
          cancelledOrders: cancelledOrders.length,
          cancelledOrderCodes: cancelledOrders.map(o => o.code),
          reopenCount: currentReopenCount + 1,
        },
        severity: reopenSeverity, justification: input.reason,
        notifTitle: `Cotação reaberta: ${quotTitle}`,
        notifMessage: `${ctx.user.name || ctx.user.email} reabriu a cotação "${quotTitle}". ${cancelledOrders.length} pedido(s) cancelado(s). Motivo: ${input.reason}`,
        actionUrl: `/cotacao/${input.quotationId}`,
      });
      // Also notify Júnior via bell (auditSensitiveAction only notifies Master)
      try {
        const juniorUser = await db.getUserByEmail("frotas.patrimonio@qualities.com.br");
        if (juniorUser && ctx.user.email !== "frotas.patrimonio@qualities.com.br") {
          await createUserNotification({
            userId: juniorUser.id, type: 'quotation_reopened' as any,
            title: `Cotação reaberta: ${quotTitle}`,
            message: `${ctx.user.name || ctx.user.email} reabriu a cotação. ${cancelledOrders.length} pedido(s) cancelado(s).`,
            priority: 'high', relatedEntityType: 'quotation', relatedEntityId: input.quotationId,
            actionUrl: `/cotacao/${input.quotationId}`,
            dedupeKey: `reopen_${input.quotationId}_${currentReopenCount + 1}`,
          });
        }
      } catch { /* best-effort */ }

      return {
        success: true,
        cancelledOrders: cancelledOrders.length,
        message: `Cotação reaberta com sucesso. ${cancelledOrders.length} pedido(s) cancelado(s).`,
      };
    }),
    listPdfArchive: protectedProcedure.query(async () => {
      const database = await db.getDb();
      if (!database) return [];
      const { sql } = await import('drizzle-orm');
      const [rows] = await database.execute(
        sql`SELECT id, fileName, fileUrl, unitName, category, coletaNumber, periodo, observacao, itemCount, uploadedAt FROM fortes_pdf_archive ORDER BY uploadedAt DESC LIMIT 50`
      );
      return (rows as unknown as any[]).map(r => ({
        id: Number(r.id),
        fileName: String(r.fileName),
        fileUrl: String(r.fileUrl),
        unitName: r.unitName ? String(r.unitName) : null,
        category: r.category ? String(r.category) : null,
        coletaNumber: r.coletaNumber ? String(r.coletaNumber) : null,
        periodo: r.periodo ? String(r.periodo) : null,
        observacao: r.observacao ? String(r.observacao) : null,
        itemCount: Number(r.itemCount || 0),
        uploadedAt: r.uploadedAt,
      }));
    }),
  }),
  // ==================== PURCHASE ORDERS ====================
  orders: router({
    list: protectedProcedure.query(async () => {
      return db.listPurchaseOrders();
    }),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getPurchaseOrder(input.id);
    }),
    items: protectedProcedure.input(z.object({ orderId: z.number() })).query(async ({ input }) => {
      return db.listPurchaseOrderItems(input.orderId);
    }),
    exportCsv: protectedProcedure.input(z.object({ orderId: z.number() })).mutation(async ({ input }) => {
      // Fetch order and items
      const order = await db.getPurchaseOrder(input.orderId);
      if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pedido não encontrado' });
      const items = await db.listPurchaseOrderItems(input.orderId);
      if (!items || items.length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Pedido sem itens' });

      // Fetch Fortes items for code mapping
      const fortesItemsList = await db.getFortesItems();

      // Normalize function for fuzzy matching
      const normalize = (str: string) => str
        .toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const findFortesCode = (productName: string) => {
        const normProduct = normalize(productName);
        let match = fortesItemsList.find((fi: any) => normalize(fi.name) === normProduct);
        if (match) return match;
        match = fortesItemsList.find((fi: any) => {
          const normFortes = normalize(fi.name);
          return normFortes.includes(normProduct) || normProduct.includes(normFortes);
        });
        if (match) return match;
        const firstWord = normProduct.split(' ')[0];
        if (firstWord.length >= 4) {
          match = fortesItemsList.find((fi: any) => normalize(fi.name).startsWith(firstWord));
        }
        return match || null;
      };

      // Build CSV content: CodigoItem,Descricao,AjusteSaldo,AjusteCustoMedio
      const header = 'CodigoItem,Descricao,AjusteSaldo,AjusteCustoMedio';
      const rows = items.map((item: any) => {
        const qty = parseFloat(item.quantity) || 0;
        const unitPrice = parseFloat(item.unitPrice) || 0;
        const fortesMatch = findFortesCode(item.productName);
        if (!fortesMatch) {
          return `SEM_CODIGO,${(item.productName || '').toUpperCase()},${qty.toFixed(4)},${unitPrice.toFixed(4)}`;
        }
        return `${fortesMatch.code},${fortesMatch.name},${qty.toFixed(4)},${unitPrice.toFixed(4)}`;
      });
      const csvContent = [header, ...rows].join('\r\n');

      // Save to S3
      // storagePut replaced by uploadFile
      const fileName = `csv-fortes/${(order as any).code || 'PED'}-${Date.now()}.csv`;
      const { url } = await uploadFile(fileName, csvContent, 'text/csv');

      return { url, fileName: `${(order as any).code || 'FORTES'}.csv`, itemCount: rows.length };
    }),
    create: writeProcedure.input(z.object({
      quotationId: z.number().optional(),
      proposalId: z.number().optional(),
      supplierId: z.number(),
      unitId: z.number().optional(),
      totalValue: z.string(),
      notes: z.string().optional(),
      period: z.string().optional(),
      items: z.array(z.object({
        productName: z.string(),
        quantity: z.string(),
        unit: z.string(),
        unitPrice: z.string(),
        totalPrice: z.string(),
      })),
    })).mutation(async ({ input, ctx }) => {
      const code = `PED-${Date.now().toString(36).toUpperCase()}`;
      const orderId = await db.createPurchaseOrder({
        code,
        quotationId: input.quotationId || null,
        proposalId: input.proposalId || null,
        supplierId: input.supplierId,
        unitId: input.unitId || null,
        createdBy: ctx.user.id,
        totalValue: input.totalValue,
        notes: input.notes || null,
        period: input.period || null,
      });
      await db.createPurchaseOrderItems(input.items.map(item => ({
        orderId,
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })));
      await db.createAuditLog({ userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "", action: "create_order", entityType: "purchase_order", entityId: orderId, details: { code, totalValue: input.totalValue } });
      return { id: orderId, code };
    }),
    approve: writeProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      await db.updatePurchaseOrder(input.id, { status: "approved", approvedBy: ctx.user.id, approvedAt: new Date() });
      await db.createAuditLog({ userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "", action: "approve_order", entityType: "purchase_order", entityId: input.id });
      return { success: true };
    }),
    markSent: writeProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      await db.updatePurchaseOrder(input.id, { status: "sent", sentAt: new Date() });
      return { success: true };
    }),
    markPurchased: writeProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      await db.updatePurchaseOrder(input.id, { status: "purchased", purchasedAt: new Date() });
      await db.createAuditLog({ userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "", action: "mark_purchased", entityType: "purchase_order", entityId: input.id });
      return { success: true };
    }),
    markDelivered: writeProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      await db.updatePurchaseOrder(input.id, { status: "delivered", deliveredAt: new Date() });
      await db.createAuditLog({ userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "", action: "mark_delivered", entityType: "purchase_order", entityId: input.id });
      return { success: true };
    }),
    cancel: writeProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      await db.updatePurchaseOrder(input.id, { status: "cancelled" });
      await db.createAuditLog({ userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "", action: "cancel_order", entityType: "purchase_order", entityId: input.id });
      return { success: true };
    }),
    // ADM Master only: delete order permanently
    delete: writeProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      if (ctx.user?.email !== MASTER_EMAIL) throw new Error("Somente o ADM Master pode excluir pedidos");
      await db.deletePurchaseOrder(input.id);
      await db.createAuditLog({ userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "", action: "delete_order", entityType: "purchase_order", entityId: input.id });
      return { success: true };
    }),
    // ADM Master only: edit order item
    editItem: writeProcedure.input(z.object({
      itemId: z.number(),
      orderId: z.number(),
      unitPrice: z.string().optional(),
      quantity: z.string().optional(),
      unit: z.string().optional(),
      productName: z.string().optional(),
      priceJustification: z.string().optional(),
      quantityJustification: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      const canEdit = ctx.user?.email === MASTER_EMAIL || ctx.user?.role === "buyer_senior" ;
      if (!canEdit) throw new Error("Sem permissão para editar pedidos");
      const isMaster = ctx.user?.email === MASTER_EMAIL;
      const isBuyerSenior = ctx.user?.role === "buyer_senior";
      // REGRA: buyer_senior pode alterar quantidade COM justificativa obrigatória
      if (!isMaster && isBuyerSenior && input.quantity) {
        if (!input.quantityJustification || input.quantityJustification.length < 10) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Justificativa obrigatória para alterar quantidade (mínimo 10 caracteres).' });
        }
        // Check variation percentage for critical alert
        const currentItem = await db.getPurchaseOrderItemById(input.itemId);
        if (currentItem) {
          const oldQty = parseFloat(currentItem.quantity);
          const newQty = parseFloat(input.quantity);
          const variationPct = oldQty > 0 ? Math.abs((newQty - oldQty) / oldQty) * 100 : 0;
          if (variationPct > 20) {
            // ALERTA CRÍTICO: variação > 20% — e-mail + notificação ao Master
            await auditSensitiveAction({
              userId: ctx.user.id, userEmail: ctx.user.email || "", userName: ctx.user.name || "",
              action: "edit_order_item_quantity_significant", entityType: "purchase_order", entityId: input.orderId,
              details: { itemId: input.itemId, productName: currentItem.productName, oldQuantity: oldQty, newQuantity: newQty, variationPct: variationPct.toFixed(1), justification: input.quantityJustification },
              severity: "critical",
              notifTitle: `⚠️ Alteração brusca de quantidade (${variationPct.toFixed(0)}%)`,
              notifMessage: `${ctx.user.name || ctx.user.email} alterou ${currentItem.productName}: ${oldQty} → ${newQty} (${variationPct > 0 && newQty > oldQty ? "+" : ""}${((newQty - oldQty) / oldQty * 100).toFixed(1)}%). Justificativa: ${input.quantityJustification}`,
              actionUrl: "/pedidos",
              justification: input.quantityJustification,
            });
          }
        }
      } else if (!isMaster && !isBuyerSenior && input.quantity) {
        // Outros usuários (Paula etc.) não podem alterar quantidade
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para alterar quantidade. Use "Solicitar Alteração".' });
      }
      // REGRA: Júnior alterando preço para MAIS exige justificativa
      if (!isMaster && input.unitPrice) {
        const currentItem = await db.getPurchaseOrderItemById(input.itemId);
        if (currentItem && parseFloat(input.unitPrice) > parseFloat(currentItem.unitPrice)) {
          if (!input.priceJustification || input.priceJustification.length < 10) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Justificativa obrigatória ao aumentar preço (mínimo 10 caracteres).' });
          }
          await auditSensitiveAction({
            userId: ctx.user.id, userEmail: ctx.user.email || "", userName: ctx.user.name || "",
            action: "edit_order_item_price_increase", entityType: "purchase_order", entityId: input.orderId,
            details: { itemId: input.itemId, oldPrice: currentItem.unitPrice, newPrice: input.unitPrice, justification: input.priceJustification },
            severity: "warning",
            notifTitle: `Preço aumentado em pedido #${input.orderId}`,
            notifMessage: `${ctx.user.name || ctx.user.email} aumentou preço de R$${currentItem.unitPrice} para R$${input.unitPrice}. Justificativa: ${input.priceJustification}`,
            actionUrl: "/pedidos",
          });
        }
      }
      // Apply the update — both Master and buyer_senior can change quantity
      const canChangeQty = isMaster || isBuyerSenior;
      await db.updatePurchaseOrderItemFull(input.itemId, input.orderId, { unitPrice: input.unitPrice, quantity: canChangeQty ? input.quantity : undefined, unit: input.unit, productName: input.productName });
      await db.createAuditLog({ userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "", action: "edit_order_item", entityType: "purchase_order", entityId: input.orderId, details: { itemId: input.itemId, unitPrice: input.unitPrice, quantity: input.quantity, unit: input.unit, productName: input.productName, priceJustification: input.priceJustification, quantityJustification: input.quantityJustification } });
      return { success: true };
    }),
    deleteItem: writeProcedure.input(z.object({
      itemId: z.number(),
      orderId: z.number(),
    })).mutation(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      if (ctx.user?.email !== MASTER_EMAIL) throw new TRPCError({ code: 'FORBIDDEN', message: 'Exclusão de itens requer aprovação do ADM Master. Use "Solicitar Exclusão".' });
      const item = await db.getPurchaseOrderItemById(input.itemId);
      await db.deletePurchaseOrderItem(input.itemId, input.orderId);
      await db.createAuditLog({ userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "", action: "delete_order_item", entityType: "purchase_order", entityId: input.orderId, details: { itemId: input.itemId, productName: item?.productName } });
      return { success: true };
    }),
    addItem: writeProcedure.input(z.object({
      orderId: z.number(),
      productName: z.string().min(1),
      quantity: z.string(),
      unit: z.string(),
      unitPrice: z.string(),
      brand: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      if (ctx.user?.email !== MASTER_EMAIL) throw new TRPCError({ code: 'FORBIDDEN', message: 'Adição de itens requer aprovação do ADM Master. Use "Solicitar Adição".' });
      const totalPrice = (parseFloat(input.quantity) * parseFloat(input.unitPrice)).toFixed(2);
      await db.addPurchaseOrderItem(input.orderId, {
        productName: input.productName,
        quantity: input.quantity,
        unit: input.unit,
        unitPrice: input.unitPrice,
        totalPrice,
        brand: input.brand || null,
      });
      await db.createAuditLog({ userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "", action: "add_order_item", entityType: "purchase_order", entityId: input.orderId, details: { productName: input.productName, quantity: input.quantity, unit: input.unit, unitPrice: input.unitPrice, brand: input.brand } });
      return { success: true };
    }),
    swapBrand: writeProcedure.input(z.object({
      itemId: z.number(),
      orderId: z.number(),
      newBrand: z.string().min(1),
      newUnitPrice: z.string(),
      justification: z.string().min(10, "Justificativa obrigatória (mínimo 10 caracteres)"),
    })).mutation(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      const canSwap = ctx.user?.email === MASTER_EMAIL || ctx.user?.role === "buyer_senior" ;
      if (!canSwap) throw new Error("Sem permissão para trocar marca");
      if (ctx.user?.email !== MASTER_EMAIL) {
        await auditSensitiveAction({
          userId: ctx.user!.id, userEmail: ctx.user!.email || "", userName: ctx.user!.name || "",
          action: "swap_brand", entityType: "purchase_order", entityId: input.orderId,
          details: { itemId: input.itemId, newBrand: input.newBrand, newPrice: input.newUnitPrice, justification: input.justification },
          severity: "warning",
          notifTitle: `Marca trocada no pedido #${input.orderId}`,
          notifMessage: `${ctx.user!.name || ctx.user!.email} trocou marca para ${input.newBrand} (R$${input.newUnitPrice}). Justificativa: ${input.justification}`,
          actionUrl: "/pedidos",
        });
      }
      // Get current item data for audit
      const currentItem = await db.getPurchaseOrderItemById(input.itemId);
      const oldBrand = currentItem?.brand || "Sem marca";
      const oldPrice = currentItem?.unitPrice || "0";
      // Update brand and price
      await db.updatePurchaseOrderItemBrand(input.itemId, input.orderId, {
        brand: input.newBrand,
        unitPrice: input.newUnitPrice,
      });
      // Record in price_history
      if (currentItem) {
        await db.recordPrice({
          productName: currentItem.productName,
          unitPrice: input.newUnitPrice,
          supplierId: 0,
          supplierName: "",
          unitName: "",
          source: "brand_swap",
          brand: input.newBrand,
        });
      }
      // Audit log
      await db.createAuditLog({
        userId: ctx.user.id,
        userName: ctx.user.name || "",
        userEmail: ctx.user.email || "",
        action: "swap_brand",
        entityType: "purchase_order",
        entityId: input.orderId,
        details: {
          itemId: input.itemId,
          productName: currentItem?.productName,
          oldBrand,
          newBrand: input.newBrand,
          oldPrice,
          newPrice: input.newUnitPrice,
          justification: input.justification || "",
        },
      });
      return { success: true };
    }),
    // ==================== AJUSTE DE ENTREGA (com foto NF) ====================
    adjustDelivery: writeProcedure.input(z.object({
      orderId: z.number(),
      itemId: z.number(),
      type: z.enum(["remove", "reduce"]),
      newQuantity: z.string().optional(),
      justification: z.string().min(10, "Justificativa deve ter no mínimo 10 caracteres"),
      invoicePhotoUrl: z.string().min(1, "Foto da nota fiscal é obrigatória"),
    })).mutation(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      const canAdjust = ctx.user?.email === MASTER_EMAIL || ctx.user?.role === "buyer_senior" ;
      if (!canAdjust) throw new Error("Sem permissão para ajustar entrega");
      const currentItem = await db.getPurchaseOrderItemById(input.itemId);
      if (!currentItem) throw new Error("Item não encontrado no pedido");
      const { orderDeliveryAdjustments } = await import('../drizzle/schema');
      const { getDb } = await import('./db');
      const database = await getDb();
      if (!database) throw new Error("Database unavailable");
      if (input.type === "remove") {
        await db.deletePurchaseOrderItem(input.itemId, input.orderId);
        await database.insert(orderDeliveryAdjustments).values({
          orderId: input.orderId, itemId: input.itemId, productName: currentItem.productName,
          adjustmentType: "removed", oldQuantity: currentItem.quantity, newQuantity: "0",
          oldUnitPrice: currentItem.unitPrice, justification: input.justification,
          invoicePhotoUrl: input.invoicePhotoUrl, userId: ctx.user.id,
          userName: ctx.user.name || "", userEmail: ctx.user.email || "",
        });
      } else if (input.type === "reduce") {
        if (!input.newQuantity) throw new Error("Nova quantidade é obrigatória para redução");
        const oldQty = parseFloat(currentItem.quantity);
        const newQty = parseFloat(input.newQuantity);
        if (newQty >= oldQty) throw new Error("Nova quantidade deve ser MENOR que a atual (" + oldQty + ")");
        if (newQty <= 0) throw new Error("Nova quantidade deve ser maior que zero");
        const newTotal = (newQty * parseFloat(currentItem.unitPrice)).toFixed(2);
        await db.updatePurchaseOrderItemFull(input.itemId, input.orderId, {
          quantity: input.newQuantity, unitPrice: currentItem.unitPrice,
          unit: currentItem.unit, productName: currentItem.productName,
        });
        await database.insert(orderDeliveryAdjustments).values({
          orderId: input.orderId, itemId: input.itemId, productName: currentItem.productName,
          adjustmentType: "quantity_reduced", oldQuantity: currentItem.quantity,
          newQuantity: input.newQuantity, oldUnitPrice: currentItem.unitPrice,
          justification: input.justification, invoicePhotoUrl: input.invoicePhotoUrl,
          userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "",
        });
      }
      // Recalculate order total
      const items = await db.listPurchaseOrderItems(input.orderId);
      const newOrderTotal = items.reduce((sum: number, i: any) => sum + parseFloat(i.totalPrice || "0"), 0).toFixed(2);
      const { sql } = await import('drizzle-orm');
      await database.execute(sql`UPDATE purchase_orders SET totalValue = ${newOrderTotal} WHERE id = ${input.orderId}`);
      const adjustValue = parseFloat(currentItem.unitPrice) * (parseFloat(currentItem.quantity) - parseFloat(input.newQuantity || "0"));
      const orderTotalWithAdj = parseFloat(newOrderTotal) + adjustValue;
      const adjustPct = orderTotalWithAdj > 0 ? (adjustValue / orderTotalWithAdj) * 100 : 0;
      const adjSeverity: AuditSeverity = adjustPct > 20 ? "critical" : "warning";
      await auditSensitiveAction({
        userId: ctx.user.id, userEmail: ctx.user.email || "", userName: ctx.user.name || "",
        action: "adjust_delivery", entityType: "purchase_order", entityId: input.orderId,
        details: { productName: currentItem.productName, type: input.type, oldQuantity: currentItem.quantity, newQuantity: input.newQuantity || "0", adjustValue: adjustValue.toFixed(2), adjustPct: adjustPct.toFixed(1), justification: input.justification },
        severity: adjSeverity, justification: input.justification,
        notifTitle: `Entrega ajustada: ${currentItem.productName}`,
        notifMessage: `${ctx.user.name || ctx.user.email} ${input.type === 'remove' ? 'removeu' : 'reduziu'} "${currentItem.productName}" do pedido. ${adjSeverity === 'critical' ? `AJUSTE DE ${adjustPct.toFixed(0)}% DO VALOR.` : ''} Justificativa: ${input.justification}`,
        actionUrl: "/pedidos",
      });
      return { success: true };
    }),
    listAdjustments: protectedProcedure.input(z.object({
      orderId: z.number(),
    })).query(async ({ input }) => {
      const { orderDeliveryAdjustments } = await import('../drizzle/schema');
      const { getDb } = await import('./db');
      const { eq, desc } = await import('drizzle-orm');
      const database = await getDb();
      if (!database) return [];
      const results = await database.select().from(orderDeliveryAdjustments).where(eq(orderDeliveryAdjustments.orderId, input.orderId)).orderBy(desc(orderDeliveryAdjustments.createdAt));
      return results;
    }),
    rate: writeProcedure.input(z.object({
      orderId: z.number(),
      supplierId: z.number(),
      punctuality: z.number().min(1).max(5),
      quality: z.number().min(1).max(5),
      quantity: z.number().min(1).max(5),
      service: z.number().min(1).max(5),
      comments: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const overallScore = ((input.punctuality + input.quality + input.quantity + input.service) / 4).toFixed(2);
      await db.createDeliveryRating({
        orderId: input.orderId,
        supplierId: input.supplierId,
        ratedBy: ctx.user.id,
        punctuality: input.punctuality,
        quality: input.quality,
        quantity: input.quantity,
        service: input.service,
        overallScore,
        comments: input.comments || null,
      });
      return { success: true };
        }),
    // ==================== COMPRA EMERGENCIAL ====================
    analyzeInvoicePhoto: writeProcedure.input(z.object({
      orderId: z.number(),
      invoicePhotoUrl: z.string().min(1),
    })).mutation(async ({ input }) => {
      // 1. Get original order items
      const orderItems = await db.listPurchaseOrderItems(input.orderId);
      if (orderItems.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pedido sem itens.' });
      // 2. Call LLM Vision to read the invoice photo
      const { invokeLLM } = await import('./_core/llm');
      const itemsList = orderItems.map(i => `- ${i.productName}: ${i.quantity} ${i.unit}`).join('\n');
      const result = await invokeLLM({
        model: 'gpt-5-mini',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: `Você é um especialista em leitura de notas fiscais brasileiras (NF-e, cupom fiscal, DANFE). Analise a imagem desta nota fiscal e extraia TODOS os itens de produto com suas quantidades e valores.\n\nO pedido de compra original continha estes itens:\n${itemsList}\n\nPara cada item da nota fiscal, retorne em JSON com este schema exato:\n{\n  "items": [\n    {\n      "productName": "nome do produto como aparece na NF",\n      "quantity": 10,\n      "unit": "KG ou UN ou PCT ou CX etc",\n      "unitPrice": 5.50,\n      "totalPrice": 55.00\n    }\n  ],\n  "invoiceNumber": "número da NF se visível",\n  "invoiceDate": "data da NF se visível",\n  "supplierName": "nome do fornecedor na NF se visível",\n  "totalValue": 999.99,\n  "readSuccess": true,\n  "readNotes": "observações sobre a leitura"\n}\n\nSe não conseguir ler a imagem, retorne readSuccess: false com readNotes explicando o problema.` },
            { type: 'image_url', image_url: { url: input.invoicePhotoUrl, detail: 'high' } },
          ],
        }],
        responseFormat: {
          type: 'json_schema',
          json_schema: {
            name: 'invoice_analysis',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                items: { type: 'array', items: { type: 'object', properties: { productName: { type: 'string' }, quantity: { type: 'number' }, unit: { type: 'string' }, unitPrice: { type: 'number' }, totalPrice: { type: 'number' } }, required: ['productName', 'quantity', 'unit', 'unitPrice', 'totalPrice'], additionalProperties: false } },
                invoiceNumber: { type: 'string' },
                invoiceDate: { type: 'string' },
                supplierName: { type: 'string' },
                totalValue: { type: 'number' },
                readSuccess: { type: 'boolean' },
                readNotes: { type: 'string' },
              },
              required: ['items', 'invoiceNumber', 'invoiceDate', 'supplierName', 'totalValue', 'readSuccess', 'readNotes'],
              additionalProperties: false,
            },
          },
        },
        maxTokens: 4000,
      });
      const content = result.choices?.[0]?.message?.content;
      let nfData: any;
      try { nfData = typeof content === 'string' ? JSON.parse(content) : content; } catch { nfData = { items: [], readSuccess: false, readNotes: 'Erro ao parsear resposta da IA' }; }
      // 3. Match NF items with order items and calculate deficit
      const normalize = (s: string) => s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      const deficits: Array<{ productName: string; requestedQty: number; receivedQty: number; deficit: number; unit: string; matched: boolean; nfProductName: string }> = [];
      for (const orderItem of orderItems) {
        const normOrder = normalize(orderItem.productName);
        const requestedQty = parseFloat(String(orderItem.quantity)) || 0;
        // Find best match in NF items
        let bestMatch: any = null;
        let bestScore = 0;
        for (const nfItem of (nfData.items || [])) {
          const normNf = normalize(nfItem.productName);
          // Score: exact match = 3, contains = 2, first word match = 1
          let score = 0;
          if (normNf === normOrder) score = 3;
          else if (normNf.includes(normOrder) || normOrder.includes(normNf)) score = 2;
          else {
            const orderWords = normOrder.split(' ').filter(w => w.length >= 3);
            const nfWords = normNf.split(' ');
            const matchCount = orderWords.filter(w => nfWords.some(nw => nw.includes(w) || w.includes(nw))).length;
            if (matchCount >= 2 || (matchCount >= 1 && orderWords.length <= 2)) score = 1;
          }
          if (score > bestScore) { bestScore = score; bestMatch = nfItem; }
        }
        const receivedQty = bestMatch ? (bestMatch.quantity || 0) : 0;
        const deficit = Math.max(0, requestedQty - receivedQty);
        deficits.push({
          productName: orderItem.productName,
          requestedQty,
          receivedQty,
          deficit,
          unit: orderItem.unit,
          matched: bestScore >= 1,
          nfProductName: bestMatch?.productName || '',
        });
      }
      return { nfData, deficits, orderItems: orderItems.map(i => ({ productName: i.productName, quantity: parseFloat(String(i.quantity)), unit: i.unit, unitPrice: parseFloat(String(i.unitPrice)) })) };
    }),
    requestEmergencyPurchase: writeProcedure.input(z.object({
      originalOrderId: z.number(),
      invoicePhotoUrl: z.string().min(1, 'Foto da NF é obrigatória'),
      deficitItems: z.array(z.object({
        productName: z.string(),
        requestedQty: z.number(),
        receivedQty: z.number(),
        deficit: z.number().min(0.001, 'Déficit deve ser maior que zero'),
        unit: z.string(),
        emergencyUnitPrice: z.number().min(0.01, 'Preço unitário obrigatório'),
      })),
      emergencySupplierId: z.number(),
      justification: z.string().min(20, 'Justificativa deve ter no mínimo 20 caracteres'),
      nfAnalysis: z.any().optional(),
    })).mutation(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      const canRequest = ctx.user?.email === MASTER_EMAIL || ctx.user?.role === "buyer_senior" ;
      if (!canRequest) throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas ADM Master e Diretor de Compras podem solicitar compra emergencial.' });
      // Validate order exists
      const allOrders = await db.listPurchaseOrders();
      const originalOrder = allOrders.find((o: any) => o.id === input.originalOrderId);
      if (!originalOrder) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pedido original não encontrado.' });
      if (originalOrder.status === 'cancelled') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Pedido cancelado não pode gerar compra emergencial.' });
      // Validate supplier
      const suppliers = await db.listSuppliers();
      const emergencySupplier = suppliers.find((s: any) => s.id === input.emergencySupplierId);
      if (!emergencySupplier) throw new TRPCError({ code: 'NOT_FOUND', message: 'Fornecedor emergencial não encontrado.' });
      // Validate deficit items
      const validDeficits = input.deficitItems.filter(d => d.deficit > 0);
      if (validDeficits.length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Nenhum item com déficit para compra emergencial.' });
      // Validate quantities don't exceed original order
      const orderItems = await db.listPurchaseOrderItems(input.originalOrderId);
      for (const defItem of validDeficits) {
        const origItem = orderItems.find(oi => oi.productName === defItem.productName);
        if (origItem) {
          const origQty = parseFloat(String(origItem.quantity)) || 0;
          if (defItem.deficit > origQty) throw new TRPCError({ code: 'BAD_REQUEST', message: `Déficit de "${defItem.productName}" (${defItem.deficit}) excede quantidade original (${origQty}).` });
        }
      }
      // Calculate total
      const totalEstimated = validDeficits.reduce((sum, d) => sum + (d.deficit * d.emergencyUnitPrice), 0);
      // Generate approval token
      const { randomUUID } = await import('crypto');
      const approvalToken = randomUUID();
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h
      // Insert request
      const { emergencyPurchaseRequests } = await import('../drizzle/schema');
      const database = await db.getDb();
      if (!database) throw new Error('Database unavailable');
      const [insertResult] = await database.insert(emergencyPurchaseRequests).values({
        originalOrderId: input.originalOrderId,
        quotationId: originalOrder.quotationId || null,
        requestedBy: ctx.user.id,
        requestedByName: ctx.user.name || '',
        requestedByEmail: ctx.user.email || '',
        emergencySupplierId: input.emergencySupplierId,
        emergencySupplierName: emergencySupplier.tradeName || emergencySupplier.companyName,
        invoicePhotoUrl: input.invoicePhotoUrl,
        nfAnalysis: input.nfAnalysis || null,
        deficitItems: validDeficits,
        justification: input.justification,
        totalEstimated: totalEstimated.toFixed(2),
        approvalToken,
        approvalTokenExpiresAt: expiresAt,
      });
      const requestId = (insertResult as any).insertId;
      // Send email to Master for approval
      const supplierName = emergencySupplier.tradeName || emergencySupplier.companyName;
      const origSupplierName = suppliers.find((s: any) => s.id === originalOrder.supplierId)?.tradeName || suppliers.find((s: any) => s.id === originalOrder.supplierId)?.companyName || 'Desconhecido';
      const itemsTable = validDeficits.map(d => `• ${d.productName}: Pedido ${d.requestedQty} ${d.unit} → Recebido ${d.receivedQty} ${d.unit} → Falta ${d.deficit} ${d.unit} × R$ ${d.emergencyUnitPrice.toFixed(2)} = R$ ${(d.deficit * d.emergencyUnitPrice).toFixed(2)}`).join('\n');
      const approveUrl = `https://qualicompra.manus.space/api/emergency/approve/${approvalToken}`;
      const rejectUrl = `https://qualicompra.manus.space/api/emergency/reject/${approvalToken}`;
      try {
        const { execSync } = await import('child_process');
        const subject = `[QualiCompras] SOLICITAÇÃO DE COMPRA EMERGENCIAL — Aprovação Necessária`;
        const body = [
          `SOLICITAÇÃO DE COMPRA EMERGENCIAL`,
          `═══════════════════════════════════`,
          ``,
          `Solicitante: ${ctx.user.name || ctx.user.email}`,
          `Data: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })}`,
          ``,
          `PEDIDO ORIGINAL: ${originalOrder.code}`,
          `Fornecedor original: ${origSupplierName}`,
          `Unidade: ${originalOrder.unitName || '—'}`,
          `Período: ${originalOrder.period || '—'}`,
          ``,
          `ITENS COM DÉFICIT:`,
          itemsTable,
          ``,
          `FORNECEDOR EMERGENCIAL: ${supplierName}`,
          `VALOR TOTAL ESTIMADO: R$ ${totalEstimated.toFixed(2)}`,
          ``,
          `JUSTIFICATIVA:`,
          input.justification,
          ``,
          `═══════════════════════════════════`,
          `PARA APROVAR, acesse: ${approveUrl}`,
          `PARA REJEITAR, acesse: ${rejectUrl}`,
          ``,
          `Este link expira em 48 horas.`,
          `— Sistema QualiCompras`,
        ].join('\n');
        const emailInput = JSON.stringify({ to: [MASTER_EMAIL], subject, body });
        trySendEmail(emailInput);
      } catch { /* best-effort email */ }
      // Audit
      await auditSensitiveAction({
        userId: ctx.user.id, userEmail: ctx.user.email || '', userName: ctx.user.name || '',
        action: 'request_emergency_purchase', entityType: 'purchase_order', entityId: input.originalOrderId,
        details: { requestId, emergencySupplier: supplierName, totalEstimated: totalEstimated.toFixed(2), itemCount: validDeficits.length },
        severity: 'critical', justification: input.justification,
        notifTitle: `Compra emergencial solicitada: R$ ${totalEstimated.toFixed(2)}`,
        notifMessage: `${ctx.user.name || ctx.user.email} solicitou compra emergencial de ${validDeficits.length} item(ns) com ${supplierName}. Valor: R$ ${totalEstimated.toFixed(2)}. Verifique seu e-mail para aprovar.`,
        actionUrl: '/pedidos',
      });
      return { success: true, requestId, approvalToken, totalEstimated, expiresAt: expiresAt.toISOString() };
    }),
    listEmergencyRequests: protectedProcedure.query(async ({ ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      const canView = ctx.user?.email === MASTER_EMAIL || ctx.user?.role === "buyer_senior" ;
      if (!canView) return [];
      const { emergencyPurchaseRequests } = await import('../drizzle/schema');
      const database = await db.getDb();
      if (!database) return [];
      const { desc } = await import('drizzle-orm');
      const rows = await database.select().from(emergencyPurchaseRequests).orderBy(desc(emergencyPurchaseRequests.createdAt)).limit(50);
      return rows;
    }),
    // ==================== SOLICITAÇÃO DE EDIÇÃO DE PEDIDO ====================
    requestEdit: writeProcedure.input(z.object({
      orderId: z.number(),
      itemId: z.number().optional(),
      requestType: z.enum(["change_quantity", "add_item", "remove_item"]),
      currentValue: z.string().optional(),
      newValue: z.string().optional(),
      justification: z.string().min(30, "Justificativa detalhada obrigatória (mínimo 30 caracteres)"),
    })).mutation(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      if (ctx.user?.email === MASTER_EMAIL) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'ADM Master pode editar diretamente sem solicitar aprovação.' });
      }
      if (ctx.user?.role !== "buyer_senior") {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas o Diretor de Compras pode solicitar alterações.' });
      }
      // Check limit: max 2 requests per item+type
      const { orderEditRequests } = await import('../drizzle/schema');
      const database = await db.getDb();
      if (!database) throw new Error("DB not available");
      const { eq, and, sql: sqlFn } = await import('drizzle-orm');
      if (input.itemId) {
        const existing = await database.select().from(orderEditRequests).where(
          and(eq(orderEditRequests.orderId, input.orderId), eq(orderEditRequests.itemId, input.itemId), eq(orderEditRequests.requestType, input.requestType))
        );
        if (existing.length >= 2) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Limite de 2 solicitações por item atingido. Não é possível solicitar novamente.' });
        }
      }
      const token = `OER-${input.orderId}-${Date.now().toString(36)}`;
      await database.insert(orderEditRequests).values({
        orderId: input.orderId,
        itemId: input.itemId || null,
        requestType: input.requestType,
        requestedBy: ctx.user.id,
        requestedByName: ctx.user.name || "",
        requestedByEmail: ctx.user.email || "",
        currentValue: input.currentValue || null,
        newValue: input.newValue || null,
        justification: input.justification,
        approvalToken: token,
      });
      // Audit
      const typeLabels: Record<string, string> = { change_quantity: "Alteração de Quantidade", add_item: "Adição de Item", remove_item: "Exclusão de Item" };
      await auditSensitiveAction({
        userId: ctx.user.id, userEmail: ctx.user.email || "", userName: ctx.user.name || "",
        action: "request_order_edit", entityType: "purchase_order", entityId: input.orderId,
        details: { requestType: input.requestType, itemId: input.itemId, currentValue: input.currentValue, newValue: input.newValue, justification: input.justification },
        severity: "critical",
        notifTitle: `Solicitação: ${typeLabels[input.requestType] || input.requestType}`,
        notifMessage: `${ctx.user.name || ctx.user.email} solicitou ${typeLabels[input.requestType]?.toLowerCase()} no pedido #${input.orderId}. Justificativa: ${input.justification}`,
        actionUrl: "/pedidos",
      });
      return { success: true, token };
    }),
    listEditRequests: protectedProcedure.input(z.object({
      orderId: z.number(),
    })).query(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      const canView = ctx.user?.email === MASTER_EMAIL || ctx.user?.role === "buyer_senior";
      if (!canView) return [];
      const { orderEditRequests } = await import('../drizzle/schema');
      const database = await db.getDb();
      if (!database) return [];
      const { eq, desc } = await import('drizzle-orm');
      return database.select().from(orderEditRequests).where(eq(orderEditRequests.orderId, input.orderId)).orderBy(desc(orderEditRequests.createdAt));
    }),
    // ==================== PURCHASE COMPARISON ====================
    comparison: protectedProcedure.input(z.object({
      orderId: z.number(),
      referenceGroupId: z.string().optional(),
    })).query(async ({ input }) => {
      // Get all orders with items for consolidation
      const allOrders = await db.listPurchaseOrders();
      const allOrdersWithItems = await Promise.all(allOrders.map(async (o: any) => {
        const items = await db.listPurchaseOrderItems(o.id);
        return {
          ...o,
          items: items.map((i: any) => ({
            productName: i.productName,
            quantity: parseFloat(i.quantity),
            unit: i.unit,
            unitPrice: parseFloat(i.unitPrice),
            totalPrice: parseFloat(i.totalPrice),
            supplierId: o.supplierId,
            supplierName: o.supplierName || '',
          } as BasketItem)),
        };
      }));
      
      const consolidated = consolidateOrders(allOrdersWithItems);
      
      // Find current purchase group
      const currentOrder = allOrdersWithItems.find((o: any) => o.id === input.orderId);
      if (!currentOrder) return { error: 'Order not found' };
      
      const currentGroupId = currentOrder.purchaseGroupId || `QID-${currentOrder.quotationId}` || `SINGLE-${currentOrder.id}`;
      const currentPurchase = consolidated.find(c => c.id === currentGroupId);
      if (!currentPurchase) return { error: 'Purchase group not found' };
      
      // Find reference
      let reference: ConsolidatedPurchase | null = null;
      if (input.referenceGroupId) {
        reference = consolidated.find(c => c.id === input.referenceGroupId) || null;
      } else {
        reference = findBestReference(currentPurchase, consolidated);
      }
      
      if (!reference) {
        return {
          noReference: true,
          current: {
            totalValue: currentPurchase.totalValue,
            period: currentPurchase.period,
            unitName: currentPurchase.unitName,
            category: currentPurchase.category,
            itemCount: currentPurchase.items.length,
            date: currentPurchase.date.toISOString(),
          },
          availableReferences: consolidated
            .filter(c => c.id !== currentGroupId && c.unitId === currentPurchase.unitId && c.category.toLowerCase() === currentPurchase.category.toLowerCase())
            .slice(0, 5)
            .map(c => ({ id: c.id, period: c.period, date: c.date.toISOString(), totalValue: c.totalValue, itemCount: c.items.length })),
        };
      }
      
      const result = comparePurchases(currentPurchase, reference);
      return { comparison: result };
    }),
    evolution: protectedProcedure.input(z.object({
      unitId: z.number().optional(),
      category: z.string(),
      granularity: z.enum(['weekly', 'monthly']).optional(),
    })).query(async ({ input }) => {
      const allOrders = await db.listPurchaseOrders();
      const allOrdersWithItems = await Promise.all(allOrders.map(async (o: any) => {
        const items = await db.listPurchaseOrderItems(o.id);
        return {
          ...o,
          items: items.map((i: any) => ({
            productName: i.productName,
            quantity: parseFloat(i.quantity),
            unit: i.unit,
            unitPrice: parseFloat(i.unitPrice),
            totalPrice: parseFloat(i.totalPrice),
            supplierId: o.supplierId,
            supplierName: o.supplierName || '',
          } as BasketItem)),
        };
      }));
      
      const consolidated = consolidateOrders(allOrdersWithItems);
      const evolution = calculateEvolution(consolidated, input.unitId || null, input.category, input.granularity || 'weekly');
      return { evolution };
    }),
  }),
  // ==================== ALERTS ====================
  alerts: router({
    list: protectedProcedure.input(z.object({ resolved: z.boolean().optional() }).optional()).query(async ({ input }) => {
      return db.listAlerts(input?.resolved);
    }),
    resolve: writeProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      await db.resolveAlert(input.id, ctx.user.id);
      return { success: true };
    }),
  }),

  // ==================== AUDIT ====================
  audit: router({
    list: protectedProcedure.input(z.object({
      limit: z.number().optional(),
      userId: z.number().optional(),
      action: z.string().optional(),
      resource: z.string().optional(),
      severity: z.string().optional(),
      offset: z.number().optional(),
    }).optional()).query(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      if (ctx.user?.email !== MASTER_EMAIL) {
        throw new Error("Acesso restrito ao ADM Master");
      }
      return db.listAuditLogs({
        limit: input?.limit || 100,
        userId: input?.userId,
        action: input?.action,
        resource: input?.resource,
        severity: input?.severity,
        offset: input?.offset || 0,
      });
    }),
    securityEvents: protectedProcedure.input(z.object({
      limit: z.number().optional(),
      resolved: z.boolean().optional(),
      eventType: z.string().optional(),
    }).optional()).query(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      if (ctx.user?.email !== MASTER_EMAIL) {
        throw new Error("Acesso restrito ao ADM Master");
      }
      return db.listSecurityEvents({
        limit: input?.limit || 50,
        resolved: input?.resolved,
        eventType: input?.eventType,
      });
    }),
    resolveEvent: writeProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      if (ctx.user?.email !== MASTER_EMAIL) {
        throw new Error("Acesso restrito ao ADM Master");
      }
      const { resolveSecurityEvent } = await import("./db");
      await resolveSecurityEvent(input.id, ctx.user.name || ctx.user.email || "admin");
      return { success: true };
    }),
    // Login sessions (IP tracking) - only Master can see
    loginSessions: protectedProcedure.input(z.object({
      userId: z.number().optional(),
    }).optional()).query(async ({ ctx, input }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      if (ctx.user?.email !== MASTER_EMAIL) {
        return { sessions: [] };
      }
      if (input?.userId) {
        const sessions = await db.getLoginSessionsByUser(input.userId);
        return { sessions };
      }
      const sessions = await db.getRecentLoginSessions(50);
      return { sessions };
    }),
    // WhatsApp security alerts - only Master can see
    whatsappAlerts: protectedProcedure.query(async ({ ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      if (ctx.user?.email !== MASTER_EMAIL) {
        return { alerts: [] };
      }
      const { pendingWhatsAppAlerts } = await import("./securityGuard");
      return { alerts: [...pendingWhatsAppAlerts].reverse() };
    }),
  }),

  // ==================== PRICE REFERENCES ====================
  prices: router({
    getReference: protectedProcedure.input(z.object({ productName: z.string() })).query(async ({ input }) => {
      return db.getPriceReference(input.productName);
    }),
    history: protectedProcedure.input(z.object({ productName: z.string(), limit: z.number().optional() })).query(async ({ input }) => {
      return db.getProductPriceHistory(input.productName, input.limit || 10);
    }),
    supplierHistory: protectedProcedure.input(z.object({ supplierId: z.number(), limit: z.number().optional() })).query(async ({ input }) => {
      return db.getSupplierPriceHistory(input.supplierId, input.limit || 20);
    }),
    record: writeProcedure.input(z.object({
      productName: z.string(),
      productCode: z.string().optional(),
      supplierId: z.number(),
      supplierName: z.string().optional(),
      unitId: z.number().optional(),
      unitName: z.string().optional(),
      brand: z.string().optional(),
      unitPrice: z.string(),
      quantity: z.string().optional(),
      unit: z.string().optional(),
      quotationId: z.number().optional(),
      orderId: z.number().optional(),
      source: z.string().optional(),
    })).mutation(async ({ input }) => {
      await db.recordPrice(input);
      return { success: true };
    }),
        crossComparison: protectedProcedure.input(z.object({
      unitId: z.number().optional(),
      category: z.string().optional(),
    })).query(async ({ input }) => {
      return db.getCrossComparison(input.unitId, input.category);
    }),
    // ADM Master only: delete price history entry
    deleteHistory: writeProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      if (ctx.user?.email !== MASTER_EMAIL) throw new Error("Apenas o ADM Master pode excluir hist\u00f3rico");
      await db.deletePriceHistoryEntry(input.id);
      await db.createAuditLog({ userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "", action: "delete_price_history", entityType: "price_history", entityId: input.id });
      return { success: true };
    }),
    // Batch: get last known price for each product+supplier pair (for price variation indicator)
    batchLastPrices: protectedProcedure.input(z.object({
      items: z.array(z.object({ productName: z.string(), supplierId: z.number() })),
      excludeQuotationId: z.number().optional(),
    })).query(async ({ input }) => {
      const results: Record<string, { lastPrice: number; lastDate: string; supplierName: string; source: string } | null> = {};
      for (const item of input.items) {
        const key = `${item.supplierId}::${item.productName}`;
        const record = await db.getLastPriceForSupplierProduct(item.supplierId, item.productName);
        if (record && record.unitPrice) {
          // Skip if it's from the same quotation we're comparing against
          if (input.excludeQuotationId && record.quotationId === input.excludeQuotationId) {
            // Try to get the one before this
            const olderRecords = await db.getProductPriceHistoryForSupplier(item.supplierId, item.productName, input.excludeQuotationId);
            if (olderRecords) {
              results[key] = { lastPrice: parseFloat(String(olderRecords.unitPrice)), lastDate: String(olderRecords.recordedAt), supplierName: olderRecords.supplierName || '', source: olderRecords.source || 'proposal' };
            } else {
              results[key] = null;
            }
          } else {
            results[key] = { lastPrice: parseFloat(String(record.unitPrice)), lastDate: String(record.recordedAt), supplierName: record.supplierName || '', source: record.source || 'proposal' };
          }
        } else {
          results[key] = null;
        }
      }
      return results;
    }),
    // ADM Master only: delete all price history for a product
    deleteProductHistory: writeProcedure.input(z.object({ productName: z.string() })).mutation(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      if (ctx.user?.email !== MASTER_EMAIL) throw new Error("Apenas o ADM Master pode excluir hist\u00f3rico");
      await db.deletePriceHistoryByProduct(input.productName);
      await db.createAuditLog({ userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "", action: "delete_product_history", entityType: "price_history", entityId: 0, details: { productName: input.productName } });
      return { success: true };
    }),
  }),
  // ==================== ANALYTICS ====================
  analytics: router({
    data: protectedProcedure.query(async () => {
      return db.getAnalyticsData();
    }),
    supplierScores: protectedProcedure.input(z.object({
      category: z.string(),
      unitName: z.string().optional(),
    })).query(async ({ input }) => {
      return db.getSupplierScores(input.category, input.unitName);
    }),
  }),
  // ==================== RELATÓRIO MENSAL ====================
  monthlyReport: router({
    generate: writeProcedure.input(z.object({
      month: z.number().min(1).max(12),
      year: z.number().min(2024).max(2030),
    })).mutation(async ({ input }) => {
      const { generateMonthlyReportData, generateMonthlyReportPDF, generateWhatsAppSummary } = await import('./monthlyReport');
      // storagePut replaced by uploadFile

      const reportData = await generateMonthlyReportData(input.month, input.year);
      if (reportData.summary.totalOrders === 0) {
        return { success: false, message: 'Nenhum pedido no período selecionado.' };
      }

      const pdfBuffer = await generateMonthlyReportPDF(reportData);
      const fileName = `relatorios/mensal_${input.year}_${String(input.month).padStart(2, '0')}.pdf`;
      const { url: pdfUrl } = await uploadFile(fileName, pdfBuffer, 'application/pdf');

      const whatsappMsg = generateWhatsAppSummary(reportData, pdfUrl);

      return {
        success: true,
        data: reportData,
        pdfUrl,
        whatsappMessage: whatsappMsg,
      };
    }),
    preview: protectedProcedure.input(z.object({
      month: z.number().min(1).max(12),
      year: z.number().min(2024).max(2030),
    })).query(async ({ input }) => {
      const { generateMonthlyReportData } = await import('./monthlyReport');
      return generateMonthlyReportData(input.month, input.year);
    }),
    setupSchedule: writeProcedure.input(z.object({
      dayOfMonth: z.number().min(1).max(28).default(1),
      hour: z.number().min(0).max(23).default(9),
    })).mutation(async ({ input, ctx }) => {
      const { createHeartbeatJob } = await import('./_core/heartbeat');
      // Schedule for day X at hour Y UTC (6-field cron: sec min hour dom mon dow)
      const cron = `0 0 ${input.hour} ${input.dayOfMonth} * *`;
      const result = await createHeartbeatJob({
        name: 'monthly-purchase-report',
        cron,
        path: '/api/scheduled/monthly-report',
        method: 'POST',
        description: `Relatório mensal de compras - dia ${input.dayOfMonth} às ${input.hour}h UTC`,
      }, (ctx as any).sessionId || '');
      return { success: true, taskUid: result.taskUid, nextExecution: result.nextExecutionAt };
    }),
    listSchedules: protectedProcedure.query(async ({ ctx }) => {
      const { listHeartbeatJobs } = await import('./_core/heartbeat');
      const result = await listHeartbeatJobs((ctx as any).sessionId || '');
      const reportJobs = result.jobs.filter(j => j.name === 'monthly-purchase-report');
      return reportJobs;
    }),
  }),

  // ==================== PRICE TARGETS ====================
  priceTargets: router({
    list: protectedProcedure.input(z.object({
      category: z.string().optional(),
      unitId: z.number().optional(),
      isActive: z.boolean().optional(),
    }).optional()).query(async ({ input }) => {
      return db.listPriceTargets(input || {});
    }),

    create: writeProcedure.input(z.object({
      productName: z.string().min(1),
      productUnit: z.string().min(1),
      maxPrice: z.string(),
      category: z.string().optional(),
      unitId: z.number().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const id = await db.createPriceTarget({
        ...input,
        createdBy: ctx.user.id,
      });
      return { id };
    }),

    update: writeProcedure.input(z.object({
      id: z.number(),
      productName: z.string().optional(),
      productUnit: z.string().optional(),
      maxPrice: z.string().optional(),
      category: z.string().optional(),
      unitId: z.number().nullable().optional(),
      notes: z.string().nullable().optional(),
      isActive: z.boolean().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updatePriceTarget(id, data);
      return { success: true };
    }),

    delete: writeProcedure.input(z.object({
      id: z.number(),
    })).mutation(async ({ input }) => {
      await db.deletePriceTarget(input.id);
      return { success: true };
    }),

    checkViolations: protectedProcedure.input(z.object({
      items: z.array(z.object({
        productName: z.string(),
        unitPrice: z.number(),
        unit: z.string().optional(),
      })),
    })).query(async ({ input }) => {
      const productNames = input.items.map(i => i.productName);
      const targets = await db.getPriceTargetsForProducts(productNames);
      const violations: Array<{
        productName: string;
        unitPrice: number;
        maxPrice: number;
        exceededBy: number;
        exceededPct: number;
      }> = [];
      for (const item of input.items) {
        const target = targets.find(t => 
          t.productName.toLowerCase().trim() === item.productName.toLowerCase().trim()
        );
        if (target) {
          const max = parseFloat(target.maxPrice);
          if (item.unitPrice > max) {
            violations.push({
              productName: item.productName,
              unitPrice: item.unitPrice,
              maxPrice: max,
              exceededBy: item.unitPrice - max,
              exceededPct: ((item.unitPrice - max) / max) * 100,
            });
          }
        }
      }
      return violations;
    }),
  }),

  unitBenchmark: router({
    getData: protectedProcedure.input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      category: z.string().optional(),
      unitId: z.number().optional(),
    })).query(async ({ input }) => {
      const { getUnitBenchmarkData } = await import('./db');
      const filters: { startDate?: Date; endDate?: Date; category?: string } = {};
      if (input.startDate) filters.startDate = new Date(input.startDate);
      if (input.endDate) filters.endDate = new Date(input.endDate);
      if (input.category) filters.category = input.category;
      return getUnitBenchmarkData(filters);
    }),
  }),
    fortesItems: router({
    list: protectedProcedure.query(async () => {
      const { getFortesItems } = await import('./db');
      return getFortesItems();
    }),
  }),
  adjustments: router({
    create: writeProcedure.input(z.object({
      quotationId: z.number(),
      adjustments: z.array(z.object({
        quotationItemId: z.number(),
        productName: z.string(),
        quantity: z.number(),
        unit: z.string(),
        recommendedSupplierId: z.number(),
        recommendedSupplierName: z.string(),
        recommendedUnitPrice: z.number(),
        recommendedTotal: z.number(),
        recommendedBrand: z.string().optional().nullable(),
        recommendedReason: z.string().optional().nullable(),
        cheapestSupplierId: z.number().optional().nullable(),
        cheapestSupplierName: z.string().optional().nullable(),
        cheapestUnitPrice: z.number().optional().nullable(),
        selectedSupplierId: z.number(),
        selectedSupplierName: z.string(),
        selectedUnitPrice: z.number(),
        selectedTotal: z.number(),
        selectedBrand: z.string().optional().nullable(),
        impactValue: z.number(),
        impactPct: z.number(),
        justificationCategory: z.string(),
        justificationText: z.string().min(10),
      })),
      // The final supplier grouping for order generation
      suppliers: z.array(z.object({
        supplierId: z.number(),
        items: z.array(z.object({
          productName: z.string(),
          quantity: z.number(),
          unit: z.string(),
          unitPrice: z.number(),
          total: z.number(),
          brand: z.string().optional().nullable(),
          packagingType: z.string().optional().nullable(),
          unitsPerPackage: z.number().optional().nullable(),
        })),
        total: z.number(),
      })),
    })).mutation(async ({ input, ctx }) => {
      const startTime = Date.now();
      console.log('[adjustments.create] START - quotationId:', input.quotationId, 'user:', ctx.user.id, ctx.user.name, 'adjustments:', input.adjustments.length, 'suppliers:', input.suppliers.length, 'totalItems:', input.suppliers.reduce((s, g) => s + g.items.length, 0));
      try {
      const quotation = await db.getQuotation(input.quotationId);
      console.log('[adjustments.create] Step 1/7: Got quotation, status:', quotation?.status, 'elapsed:', Date.now() - startTime, 'ms');
      
      if (!quotation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Cotação não encontrada.' });
      }
      if (quotation.status === 'cancelled') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cotação cancelada não pode gerar pedidos. Reabra a cotação primeiro.' });
      }
      if (quotation.status === 'draft') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cotação em rascunho não pode gerar pedidos. Envie para fornecedores primeiro.' });
      }
      
      // Allow re-adjustment: if quotation is already ordered, cancel previous orders and reopen
      if (quotation.status === 'ordered') {
        const existingOrders = await db.listPurchaseOrdersByQuotation(input.quotationId);
        console.log('[adjustments.create] Step 2/7: Re-adjustment - cancelling', existingOrders.length, 'existing orders, elapsed:', Date.now() - startTime, 'ms');
        for (const order of existingOrders) {
          if (order.status !== 'cancelled') {
            await db.updatePurchaseOrder(order.id, { status: 'cancelled' });
          }
        }
        await db.updateQuotation(input.quotationId, { status: 'closed' });
        await db.createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name || "",
          userEmail: ctx.user.email || "",
          action: "reopen_quotation",
          entityType: "quotation",
          entityId: input.quotationId,
          details: { reason: "Re-ajuste de compra", cancelledOrders: existingOrders.length },
        });
      } else {
        console.log('[adjustments.create] Step 2/7: No re-adjustment needed (status:', quotation.status, '), elapsed:', Date.now() - startTime, 'ms');
      }
      
      // 3. Generate orders from the adjusted supplier grouping
      const allSuppliers = await db.listSuppliers();
      const baseTs = Date.now().toString(36);
      const purchaseGroupId = `ADJ-${input.quotationId}-${baseTs}`;
      const orders: Array<{ id: number; code: string; supplierName: string; supplierId: number }> = [];
      const allPriceRecords: Array<any> = [];
      let orderIdx = 0;
      
      console.log('[adjustments.create] Step 3/7: Creating orders for', input.suppliers.length, 'suppliers, elapsed:', Date.now() - startTime, 'ms');
      
      // Filter out suppliers with 0 items (edge case from adjustment moves)
      const validSuppliers = input.suppliers.filter(s => s.items.length > 0);
      
      for (const supplierGroup of validSuppliers) {
        const supplier = allSuppliers.find(s => s.id === supplierGroup.supplierId);
        const supplierName = supplier?.tradeName || supplier?.companyName || `Fornecedor ${supplierGroup.supplierId}`;
        orderIdx++;
        const code = `PED-${baseTs.toUpperCase()}${orderIdx}-${supplierGroup.supplierId}`.slice(0, 20);
        
        // Defensive: ensure totalValue is a valid number string
        const totalValue = isFinite(supplierGroup.total) ? supplierGroup.total.toFixed(2) : '0.00';
        
        const orderId = await db.createPurchaseOrder({
          code,
          quotationId: input.quotationId,
          proposalId: null,
          supplierId: supplierGroup.supplierId,
          unitId: quotation?.unitId || null,
          createdBy: ctx.user.id,
          totalValue,
          notes: `Pedido gerado pela Compra Otimizada Ajustada (Cotação #${input.quotationId})`,
          purchaseGroupId,
          period: extractPeriodFromQuotation(quotation),
        });
        
        if (!orderId) {
          console.error('[adjustments.create] FAILED to create order for supplier', supplierGroup.supplierId, supplierName);
          throw new Error(`Falha ao criar pedido para fornecedor ${supplierName}`);
        }
        
        // Create order items (batch insert) - defensive number handling
        await db.createPurchaseOrderItems(supplierGroup.items.map(item => ({
          orderId,
          productName: item.productName,
          quantity: String(isFinite(item.quantity) ? item.quantity : 0),
          unit: item.unit,
          unitPrice: String(isFinite(item.unitPrice) ? item.unitPrice.toFixed(2) : '0.00'),
          totalPrice: String(isFinite(item.total) ? item.total.toFixed(2) : '0.00'),
          packagingType: item.packagingType || null,
          unitsPerPackage: item.unitsPerPackage || null,
        })));
        
        // Collect price records for batch insert later
        for (const item of supplierGroup.items) {
          allPriceRecords.push({
            productName: item.productName,
            supplierId: supplierGroup.supplierId,
            supplierName,
            brand: (item as any).brand || undefined,
            unitId: quotation?.unitId || undefined,
            unitPrice: String(isFinite(item.unitPrice) ? item.unitPrice.toFixed(2) : '0.00'),
            quantity: String(isFinite(item.quantity) ? item.quantity : 0),
            unit: item.unit,
            quotationId: input.quotationId,
            orderId,
            source: "order_adjusted",
          });
        }
        
        orders.push({ id: orderId, code, supplierName, supplierId: supplierGroup.supplierId });
      }
      console.log('[adjustments.create] Step 4/7: All', orders.length, 'orders created, elapsed:', Date.now() - startTime, 'ms');
      
      // Step 5: Batch operations - approve orders + record prices + audit logs
      console.log('[adjustments.create] Step 5/7: Batch ops - prices:', allPriceRecords.length, 'orders to approve:', orders.length, 'elapsed:', Date.now() - startTime, 'ms');
      await Promise.all([
        // Single batch insert for ALL price records
        allPriceRecords.length > 0 ? db.recordPriceBatch(allPriceRecords) : Promise.resolve(),
        // Approve all orders
        ...orders.map(order => 
          db.updatePurchaseOrder(order.id, { status: "approved", approvedBy: ctx.user.id, approvedAt: new Date() })
        ),
        // Audit logs for order creation
        ...orders.map(order =>
          db.createAuditLog({
            userId: ctx.user.id,
            userName: ctx.user.name || "",
            userEmail: ctx.user.email || "",
            action: "create_order",
            entityType: "purchase_order",
            entityId: order.id,
            details: { code: order.code, source: "optimization_adjusted" },
          })
        ),
      ]);
      console.log('[adjustments.create] Step 5/7: Batch ops DONE, elapsed:', Date.now() - startTime, 'ms');
      
      // Step 6: Save adjustment records (justificativas)
      if (input.adjustments.length > 0) {
        console.log('[adjustments.create] Step 6/7: Saving', input.adjustments.length, 'adjustment records, elapsed:', Date.now() - startTime, 'ms');
        const adjustmentRecords = input.adjustments.map(adj => {
          const order = orders.find(o => o.supplierId === adj.selectedSupplierId);
          // Defensive: ensure toFixed doesn't crash on non-finite numbers
          const safeFixed = (n: number | null | undefined, digits: number) => {
            if (n == null || !isFinite(n)) return '0.' + '0'.repeat(digits);
            return n.toFixed(digits);
          };
          return {
            quotationId: input.quotationId,
            orderId: order?.id || null,
            purchaseGroupId,
            unitId: quotation?.unitId || null,
            quotationItemId: adj.quotationItemId,
            productName: adj.productName,
            quantity: String(adj.quantity),
            unit: adj.unit,
            recommendedSupplierId: adj.recommendedSupplierId,
            recommendedSupplierName: adj.recommendedSupplierName,
            recommendedUnitPrice: safeFixed(adj.recommendedUnitPrice, 4),
            recommendedTotal: safeFixed(adj.recommendedTotal, 2),
            recommendedBrand: adj.recommendedBrand || null,
            recommendedReason: adj.recommendedReason || null,
            cheapestSupplierId: adj.cheapestSupplierId || null,
            cheapestSupplierName: adj.cheapestSupplierName || null,
            cheapestUnitPrice: adj.cheapestUnitPrice ? safeFixed(adj.cheapestUnitPrice, 4) : null,
            selectedSupplierId: adj.selectedSupplierId,
            selectedSupplierName: adj.selectedSupplierName,
            selectedUnitPrice: safeFixed(adj.selectedUnitPrice, 4),
            selectedTotal: safeFixed(adj.selectedTotal, 2),
            selectedBrand: adj.selectedBrand || null,
            impactValue: safeFixed(adj.impactValue, 2),
            impactPct: safeFixed(adj.impactPct, 2),
            justificationCategory: adj.justificationCategory,
            justificationText: adj.justificationText,
            userId: ctx.user.id,
            userName: ctx.user.name || "",
            userEmail: ctx.user.email || null,
            optimizationRule: `tolerancia_prazo_3pct`,
          };
        });
        await db.createPurchaseAdjustments(adjustmentRecords);
        console.log('[adjustments.create] Step 6/7: Adjustment records saved, elapsed:', Date.now() - startTime, 'ms');
        
        // Audit log for adjustments
        await db.createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name || "",
          userEmail: ctx.user.email || "",
          action: "create_adjustment",
          entityType: "purchase_adjustment",
          entityId: input.quotationId,
          details: {
            adjustmentCount: input.adjustments.length,
            totalImpact: input.adjustments.reduce((s, a) => s + (isFinite(a.impactValue) ? a.impactValue : 0), 0).toFixed(2),
            purchaseGroupId,
          },
        });
      } else {
        console.log('[adjustments.create] Step 6/7: No adjustment records to save, elapsed:', Date.now() - startTime, 'ms');
      }
      
      // Step 7: Close the quotation
      console.log('[adjustments.create] Step 7/7: Closing quotation, elapsed:', Date.now() - startTime, 'ms');
      await db.updateQuotation(input.quotationId, { status: "ordered" });
      
      const totalElapsed = Date.now() - startTime;
      console.log('[adjustments.create] SUCCESS - orders:', orders.length, 'prices:', allPriceRecords.length, 'adjustments:', input.adjustments.length, 'totalTime:', totalElapsed, 'ms');
      
      return { orders, adjustmentCount: input.adjustments.length, purchaseGroupId };
      } catch (error: any) {
        const totalElapsed = Date.now() - startTime;
        console.error('[adjustments.create FATAL ERROR]', {
          message: error?.message,
          code: error?.code,
          sqlMessage: error?.sqlMessage,
          sqlState: error?.sqlState,
          errno: error?.errno,
          elapsed: totalElapsed,
          quotationId: input.quotationId,
          suppliersCount: input.suppliers.length,
          adjustmentsCount: input.adjustments.length,
        });
        console.error('[adjustments.create STACK]', error?.stack);
        // Re-throw TRPCErrors as-is, wrap others
        if (error?.code && ['NOT_FOUND', 'BAD_REQUEST', 'UNAUTHORIZED', 'FORBIDDEN'].includes(error.code)) {
          throw error;
        }
        throw new TRPCError({ 
          code: 'INTERNAL_SERVER_ERROR', 
          message: `Erro ao processar ajuste (${totalElapsed}ms): ${error?.message || 'Erro desconhecido'}` 
        });
      }
    }),
    list: protectedProcedure.input(z.object({
      quotationId: z.number().optional(),
      unitId: z.number().optional(),
      category: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }).optional()).query(async ({ input }) => {
      return db.listPurchaseAdjustments(input || {});
    }),
    stats: protectedProcedure.input(z.object({
      unitId: z.number().optional(),
    }).optional()).query(async ({ input }) => {
      return db.getPurchaseAdjustmentStats(input || {});
    }),
  }),
  brands: router({
    list: protectedProcedure.input(z.object({
      status: z.enum(["approved", "unknown", "rejected"]).optional(),
      category: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      return db.listBrands(input || {});
    }),
    getStatus: publicProcedure.input(z.object({
      name: z.string(),
    })).query(async ({ input }) => {
      return db.getBrandByName(input.name);
    }),
    getStatusBatch: publicProcedure.input(z.object({
      names: z.array(z.string()),
      productName: z.string().optional(),
    })).query(async ({ input }) => {
      return db.getBrandStatusBatch(input.names, input.productName);
    }),
    create: writeProcedure.input(z.object({
      name: z.string().min(1),
      status: z.enum(["approved", "unknown", "rejected"]),
      reason: z.string().optional(),
      category: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      // Check if brand+category combo already exists (same brand can have different rules per category)
      const allBrands = await db.listBrands();
      const normalized = input.name.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const duplicate = allBrands.find(b => 
        b.normalizedName === normalized && 
        (b.category || "") === (input.category || "")
      );
      if (duplicate) {
        throw new TRPCError({ code: "CONFLICT", message: `Marca j\u00e1 cadastrada para ${input.category || 'todos os produtos'}` });
      }
      const id = await db.createBrand({ ...input, addedBy: ctx.user.name || ctx.user.email || undefined });
      return { id };
    }),
    updateStatus: writeProcedure.input(z.object({
      id: z.number(),
      status: z.enum(["approved", "unknown", "rejected"]),
      reason: z.string().optional(),
      justification: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      const canClassify = ctx.user?.email === MASTER_EMAIL || ctx.user?.role === "buyer_senior" ;
      if (!canClassify) throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas ADM Master e Diretor de Compras podem classificar marcas.' });
      // Justificativa obrigatória ao rejeitar
      if (input.status === "rejected" && (!input.justification || input.justification.length < 10)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Justificativa obrigatória ao rejeitar marca (mínimo 10 caracteres).' });
      }
      // Get current brand info for audit
      const brands = await db.listBrands();
      const brand = brands.find((b: any) => b.id === input.id);
      const oldStatus = brand?.status || 'unknown';
      await db.updateBrandStatus(input.id, input.status, input.reason || input.justification);
      // Audit log for status changes
      if (oldStatus !== input.status) {
        const severity = input.status === 'rejected' ? 'warning' : 'info';
        await auditSensitiveAction({
          userId: ctx.user.id, userEmail: ctx.user.email || '', userName: ctx.user.name || '',
          action: 'classify_brand', entityType: 'brand', entityId: input.id,
          details: { brandName: brand?.name || '', productName: brand?.category || '', oldStatus, newStatus: input.status, justification: input.justification || '' },
          severity: severity as any,
          notifTitle: input.status === 'rejected' ? `Marca rejeitada: ${brand?.name || ''}` : undefined,
          notifMessage: input.status === 'rejected' ? `${ctx.user.name || ctx.user.email} rejeitou a marca "${brand?.name}" para ${brand?.category || 'produto'}. Motivo: ${input.justification || input.reason || '—'}` : undefined,
        });
      }
      return { success: true };
    }),
    delete: writeProcedure.input(z.object({
      id: z.number(),
    })).mutation(async ({ input }) => {
      await db.deleteBrand(input.id);
      return { success: true };
    }),
    syncFromProposals: writeProcedure.mutation(async () => {
      const result = await db.syncBrandsFromProposals();
      return result;
    }),
    // ==================== BRAND ALIASES ====================
    listAliases: protectedProcedure.query(async () => {
      return db.listBrandAliases();
    }),
    createAlias: writeProcedure.input(z.object({
      aliasName: z.string().min(2),
      canonicalName: z.string().min(2),
      reason: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      const isMaster = ctx.user?.email === MASTER_EMAIL;
      const isBuyerSenior = ctx.user?.role === "buyer_senior";
      if (!isMaster && !isBuyerSenior) throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão.' });
      // Validate similarity — reject if names are too different
      const normalizeForCompare = (s: string) => s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
      const n1 = normalizeForCompare(input.aliasName);
      const n2 = normalizeForCompare(input.canonicalName);
      // Levenshtein distance
      const levenshtein = (a: string, b: string): number => {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        const matrix: number[][] = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
          for (let j = 1; j <= a.length; j++) {
            matrix[i][j] = b[i-1] === a[j-1] ? matrix[i-1][j-1] : Math.min(matrix[i-1][j-1]+1, matrix[i][j-1]+1, matrix[i-1][j]+1);
          }
        }
        return matrix[b.length][a.length];
      };
      const dist = levenshtein(n1, n2);
      const maxLen = Math.max(n1.length, n2.length);
      const similarity = maxLen > 0 ? 1 - (dist / maxLen) : 0;
      // Also check if one contains the other (e.g. "superpro" contains "super pro" after normalization)
      const containsEachOther = n1.includes(n2) || n2.includes(n1);
      if (similarity < 0.5 && !containsEachOther) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Os nomes "${input.aliasName}" e "${input.canonicalName}" são muito diferentes (similaridade: ${(similarity*100).toFixed(0)}%). Alias só pode ser criado para grafias parecidas da mesma marca.` });
      }
      const id = await db.createBrandAlias({
        aliasName: input.aliasName,
        canonicalName: input.canonicalName,
        reason: input.reason,
        createdBy: ctx.user.id,
        createdByName: ctx.user.name || ctx.user.email || "",
      });
      await db.createAuditLog({
        userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "",
        action: "create_brand_alias", entityType: "brand_alias", entityId: id,
        details: { aliasName: input.aliasName, canonicalName: input.canonicalName, reason: input.reason },
      });
      return { id };
    }),
    deleteAlias: writeProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      if (ctx.user?.email !== MASTER_EMAIL) throw new TRPCError({ code: 'FORBIDDEN', message: 'Somente o ADM Master pode excluir aliases.' });
      await db.deleteBrandAlias(input.id);
      await db.createAuditLog({
        userId: ctx.user.id, userName: ctx.user.name || "", userEmail: ctx.user.email || "",
        action: "delete_brand_alias", entityType: "brand_alias", entityId: input.id,
        details: {},
      });
      return { success: true };
    }),
  }),
  brandRejections: router({
    listGlobal: protectedProcedure.query(async () => {
      return db.listBrandRejectionsGlobal();
    }),
    addGlobal: writeProcedure.input(z.object({
      brandName: z.string().min(1),
      productCategory: z.string().optional(),
      reason: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const id = await db.addBrandRejectionGlobal({
        brandName: input.brandName,
        productCategory: input.productCategory,
        reason: input.reason,
        createdBy: ctx.user.id,
        createdByName: ctx.user.name || ctx.user.email || undefined,
      });
      return { id };
    }),
    removeGlobal: writeProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.removeBrandRejectionGlobal(input.id);
      return { success: true };
    }),
    listByUnit: protectedProcedure.input(z.object({ unitId: z.number().optional() }).optional()).query(async ({ input }) => {
      return db.listBrandRejectionsUnit(input?.unitId);
    }),
    addByUnit: writeProcedure.input(z.object({
      brandName: z.string().min(1),
      unitId: z.number(),
      unitName: z.string().optional(),
      productCategory: z.string().optional(),
      reason: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const id = await db.addBrandRejectionUnit({
        brandName: input.brandName,
        unitId: input.unitId,
        unitName: input.unitName,
        productCategory: input.productCategory,
        reason: input.reason,
        createdBy: ctx.user.id,
        createdByName: ctx.user.name || ctx.user.email || undefined,
      });
      return { id };
    }),
    removeByUnit: writeProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.removeBrandRejectionUnit(input.id);
      return { success: true };
    }),
  }),
  brandRegistry: router({
    autocomplete: publicProcedure.input(z.object({
      query: z.string().min(2),
      productName: z.string().optional(),
      supplierId: z.number().optional(),
    })).query(async ({ input }) => {
      return db.searchBrands(input.query, input.productName, input.supplierId);
    }),
    list: protectedProcedure.input(z.object({
      productName: z.string().optional(),
      supplierId: z.number().optional(),
      sector: z.string().optional(),
      unitName: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      return db.listBrandRegistry(input || undefined);
    }),
    register: writeProcedure.input(z.object({
      productName: z.string(),
      brand: z.string(),
      supplierId: z.number().optional(),
      supplierName: z.string().optional(),
      sector: z.string().optional(),
      unitId: z.number().optional(),
      unitName: z.string().optional(),
    })).mutation(async ({ input }) => {
      await db.registerBrand(input);
      return { success: true };
    }),
  }),

  // ==================== HISTÓRICO FINANCEIRO ====================
  historicalPayments: router({
    summary: protectedProcedure
      .input(z.object({
        unitName: z.string().optional(),
        category: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getHistoricalPaymentsSummary(input || undefined);
      }),

    topSuppliers: protectedProcedure
      .input(z.object({
        unitName: z.string().optional(),
        category: z.string().optional(),
        limit: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getHistoricalPaymentsTopSuppliers(input || undefined);
      }),

    list: protectedProcedure
      .input(z.object({
        unitName: z.string().optional(),
        category: z.string().optional(),
        supplierName: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getHistoricalPaymentsList(input || undefined);
      }),

    comparativo: protectedProcedure
      .query(async () => {
        return db.getComparativoFortesVsQC();
      }),
  }),

  // ==================== INTELIGÊNCIA DE COMPRAS ====================
  purchaseIntelligence: router({
    summary: protectedProcedure.query(async () => {
      const { getIntelligenceSummary } = await import('./purchaseIntelligence');
      return getIntelligenceSummary();
    }),

    priceIndex: protectedProcedure.input(z.object({
      productName: z.string().optional(),
      sector: z.string().optional(),
      unitName: z.string().optional(),
      supplierId: z.number().optional(),
    }).optional()).query(async ({ input }) => {
      const { getPriceIndex } = await import('./purchaseIntelligence');
      return getPriceIndex(input || {});
    }),

    seasonality: protectedProcedure.input(z.object({
      sector: z.string().optional(),
      unitName: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      const { getSeasonality } = await import('./purchaseIntelligence');
      return getSeasonality(input || {});
    }),

    unitComparison: protectedProcedure.input(z.object({
      productName: z.string().optional(),
      sector: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      const { getUnitComparison } = await import('./purchaseIntelligence');
      return getUnitComparison(input || {});
    }),

    supplierBySector: protectedProcedure.input(z.object({
      unitName: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      const { getSupplierBySector } = await import('./purchaseIntelligence');
      return getSupplierBySector(input || {});
    }),

    abcCurve: protectedProcedure.input(z.object({
      unitName: z.string().optional(),
      sector: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      const { getAbcCurve } = await import('./purchaseIntelligence');
      return getAbcCurve(input || {});
    }),

    weeklyEvolution: protectedProcedure.input(z.object({
      unitName: z.string().optional(),
      sector: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      const { getWeeklyEvolution } = await import('./purchaseIntelligence');
      return getWeeklyEvolution(input || {});
    }),

    searchProducts: protectedProcedure.input(z.object({
      query: z.string().min(2),
    })).query(async ({ input }) => {
      const { searchProducts } = await import('./purchaseIntelligence');
      return searchProducts(input.query);
    }),
  }),

  // ==================== NOTIFICAÇÕES ====================
  notifications: router({
    list: protectedProcedure.input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      unreadOnly: z.boolean().default(false),
      type: z.string().optional(),
    }).optional()).query(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return { items: [], total: 0 };
      const { eq, and, isNull, desc, count: countFn, sql: sqlFn } = await import("drizzle-orm");
      const opts = input || { limit: 20, offset: 0, unreadOnly: false };
      const conditions = [eq(userNotifications.userId, ctx.user.id)];
      if (opts.unreadOnly) conditions.push(isNull(userNotifications.readAt));
      if (opts.type) conditions.push(eq(userNotifications.type, opts.type as any));
      const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
      const items = await dbInstance.select().from(userNotifications)
        .where(whereClause).orderBy(desc(userNotifications.createdAt))
        .limit(opts.limit).offset(opts.offset);
      const [totalRow] = await dbInstance.select({ count: countFn() }).from(userNotifications).where(whereClause);
      return { items, total: totalRow?.count || 0 };
    }),

    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return 0;
      const { eq, and, isNull, count: countFn } = await import("drizzle-orm");
      const [row] = await dbInstance.select({ count: countFn() }).from(userNotifications)
        .where(and(eq(userNotifications.userId, ctx.user.id), isNull(userNotifications.readAt)));
      return row?.count || 0;
    }),

    markRead: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return false;
      const { eq, and } = await import("drizzle-orm");
      await dbInstance.update(userNotifications)
        .set({ readAt: new Date() })
        .where(and(eq(userNotifications.id, input.id), eq(userNotifications.userId, ctx.user.id)));
      return true;
    }),

    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return false;
      const { eq, and, isNull } = await import("drizzle-orm");
      await dbInstance.update(userNotifications)
        .set({ readAt: new Date() })
        .where(and(eq(userNotifications.userId, ctx.user.id), isNull(userNotifications.readAt)));
      return true;
    }),

    getPreferences: protectedProcedure.query(async ({ ctx }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return [];
      const { eq } = await import("drizzle-orm");
      return dbInstance.select().from(notificationPreferences).where(eq(notificationPreferences.userId, ctx.user.id));
    }),

    savePreferences: protectedProcedure.input(z.array(z.object({
      eventType: z.string(),
      inAppEnabled: z.boolean(),
      pushEnabled: z.boolean(),
    }))).mutation(async ({ ctx, input }) => {
      const MASTER_EMAIL_CHECK = "afonsoqueirogagn@gmail.com";
      if (ctx.user.email !== MASTER_EMAIL_CHECK) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o administrador master pode alterar preferências de notificação" });
      }
      const dbInstance = await db.getDb();
      if (!dbInstance) return false;
      const { eq, and } = await import("drizzle-orm");
      for (const pref of input) {
        const [existing] = await dbInstance.select().from(notificationPreferences)
          .where(and(eq(notificationPreferences.userId, ctx.user.id), eq(notificationPreferences.eventType, pref.eventType)))
          .limit(1);
        if (existing) {
          await dbInstance.update(notificationPreferences)
            .set({ inAppEnabled: pref.inAppEnabled, pushEnabled: pref.pushEnabled })
            .where(eq(notificationPreferences.id, existing.id));
        } else {
          await dbInstance.insert(notificationPreferences).values({
            userId: ctx.user.id, eventType: pref.eventType,
            inAppEnabled: pref.inAppEnabled, pushEnabled: pref.pushEnabled,
          });
        }
      }
      return true;
    }),

    subscribePush: protectedProcedure.input(z.object({
      endpoint: z.string(),
      p256dh: z.string(),
      auth: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return false;
      const { eq, and } = await import("drizzle-orm");
      const { sql: sqlFn } = await import("drizzle-orm");
      // Remove existing subscription with same endpoint for this user
      await dbInstance.delete(pushSubscriptions)
        .where(and(eq(pushSubscriptions.userId, ctx.user.id), eq(pushSubscriptions.endpoint, input.endpoint)));
      await dbInstance.insert(pushSubscriptions).values({
        userId: ctx.user.id,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: null,
      });
      return true;
    }),

    unsubscribePush: protectedProcedure.input(z.object({
      endpoint: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) return false;
      const { eq, and } = await import("drizzle-orm");
      await dbInstance.delete(pushSubscriptions)
        .where(and(eq(pushSubscriptions.userId, ctx.user.id), eq(pushSubscriptions.endpoint, input.endpoint)));
      return true;
    }),

    vapidPublicKey: publicProcedure.query(() => {
      return process.env.VAPID_PUBLIC_KEY || null;
    }),
  }),

  // ==================== CONFERÊNCIA NF COM IA VISUAL ====================
  nfValidation: router({
    analyzeOrderNF: protectedProcedure.input(z.object({
      orderId: z.number(),
      imageUrl: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      const isMaster = ctx.user.email === MASTER_EMAIL;
      const isBuyerSenior = ctx.user.role === "buyer_senior";
      if (!isMaster && !isBuyerSenior) throw new TRPCError({ code: "FORBIDDEN" });

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { eq } = await import("drizzle-orm");

      // Get order items
      const orderItems = await db.listPurchaseOrderItems(input.orderId);
      if (!orderItems.length) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido sem itens" });

      // Get order details for supplier info
      const allOrders = await db.listPurchaseOrders();
      const order = allOrders.find((o: any) => o.id === input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado" });

      // Get existing supplier mappings for smarter matching (Camada 2)
      const existingMappings = order.supplierId ? await dbInstance.select().from(supplierProductMappings).where(eq(supplierProductMappings.supplierId, order.supplierId)) : [];

      // Build order items summary for the AI prompt
      const orderItemsSummary = orderItems.map((item: any) => `- ${item.productName}: ${item.quantity} ${item.unit} × R$${item.unitPrice} = R$${item.totalPrice}`).join("\n");

      // Build known mappings for the AI
      const knownMappings = existingMappings.length > 0
        ? "\n\nMAPEAMENTOS CONHECIDOS deste fornecedor (nome na NF → nome no pedido):\n" + existingMappings.map((m: any) => `- "${m.nfProductName}" = "${m.systemProductName}"`).join("\n")
        : "";

      // Invoke LLM with vision to read the invoice
      const { invokeLLM } = await import("./_core/llm") as any;
      const aiResult = await invokeLLM({
        model: "gpt-4o",
        messages: [{
          role: "user" as const,
          content: [
            { type: "text" as const, text: `Você é um especialista em leitura de notas fiscais brasileiras e conferência de pedidos de compra de alimentos/limpeza/descartáveis para cozinhas industriais.

PEDIDO DE COMPRA (itens esperados):
${orderItemsSummary}
${knownMappings}

TAREFA: Analise a nota fiscal na imagem e faça o matching item por item com o pedido acima.

Retorne EXCLUSIVAMENTE um JSON válido (sem markdown, sem \`\`\`):
{
  "fornecedor": "nome do estabelecimento na NF",
  "cnpj": "CNPJ se visível ou null",
  "dataNF": "data da NF ou null",
  "itensNF": [
    {"descricao": "nome exato na NF", "quantidade": 1.0, "unidade": "UN/KG/CX/PCT/FD", "valorUnitario": 0.00, "valorTotal": 0.00}
  ],
  "valorTotalNF": 0.00,
  "matching": [
    {
      "itemPedido": "nome do item no pedido",
      "itemNF": "nome do item na NF ou null se não encontrado",
      "qtdPedido": 1.0,
      "qtdNF": 1.0,
      "status": "match|partial|missing|extra",
      "confidence": 0.95,
      "observacao": "explicação curta se parcial ou divergente"
    }
  ],
  "resumo": {
    "totalItensNF": 0,
    "matched": 0,
    "partial": 0,
    "missing": 0,
    "extra": 0,
    "valorPedido": 0.00,
    "valorNF": 0.00,
    "diferencaValor": 0.00
  },
  "confiancaGeral": "alta|media|baixa"
}

REGRAS DE MATCHING:
1. Use matching semântico: "DET LIQ 500ML" = "DETERGENTE LÍQUIDO 500ML"
2. Considere abreviações comuns de NF: PCT=pacote, CX=caixa, FD=fardo, UN=unidade, KG=quilo
3. Se a quantidade na NF é em caixas e no pedido em unidades, converta (ex: 2 CX × 12 UN = 24 UN)
4. "match" = item e quantidade batem; "partial" = item bate mas quantidade diverge; "missing" = item do pedido não encontrado na NF; "extra" = item na NF que não está no pedido
5. Confidence: 1.0 = certeza absoluta, 0.5 = provável, < 0.3 = incerto` },
            { type: "image_url" as const, image_url: { url: input.imageUrl, detail: "high" as const } }
          ]
        }],
        maxTokens: 4000,
      });

      let parsedResult: any;
      try {
        const content = typeof aiResult.choices[0]?.message?.content === "string"
          ? aiResult.choices[0].message.content
          : JSON.stringify(aiResult.choices[0]?.message?.content);
        // Strip markdown code fences if present
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsedResult = JSON.parse(cleaned);
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao interpretar a nota fiscal. Tente com uma foto mais nítida." });
      }

      // Determine validation status based on matching
      const summary = parsedResult.resumo || {};
      let validationStatus: "pending" | "validated" | "partial" | "rejected" = "pending";
      if (summary.missing === 0 && summary.partial === 0) {
        validationStatus = "validated";
      } else if (summary.missing > 0 && summary.matched === 0) {
        validationStatus = "rejected";
      } else {
        validationStatus = "partial";
      }

      // Save validation record
      const [validation] = await dbInstance.insert(nfValidations).values({
        orderId: input.orderId,
        imageUrl: input.imageUrl,
        aiExtractedData: parsedResult,
        matchResult: parsedResult.matching,
        status: validationStatus,
        confidence: parsedResult.confiancaGeral || "media",
        validatedBy: ctx.user.id,
        validatedByName: ctx.user.name || ctx.user.email,
      }).$returningId();

      return {
        validationId: validation.id,
        status: validationStatus,
        analysis: parsedResult,
      };
    }),

    confirmNFValidation: protectedProcedure.input(z.object({
      validationId: z.number(),
      orderId: z.number(),
      correctedMatching: z.any().optional(), // Allow manual corrections
    })).mutation(async ({ ctx, input }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      const isMaster = ctx.user.email === MASTER_EMAIL;
      const isBuyerSenior = ctx.user.role === "buyer_senior";
      if (!isMaster && !isBuyerSenior) throw new TRPCError({ code: "FORBIDDEN" });

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { eq } = await import("drizzle-orm");

      // Update validation status
      await dbInstance.update(nfValidations).set({ status: "validated", validatedBy: ctx.user.id, validatedByName: ctx.user.name || ctx.user.email }).where(eq(nfValidations.id, input.validationId));

      // Update order validationStatus
      await dbInstance.update(purchaseOrders).set({ validationStatus: "validated" } as any).where(eq(purchaseOrders.id, input.orderId));

      // Save supplier product mappings (Camada 2 - Base de conhecimento)
      const [validation] = await dbInstance.select().from(nfValidations).where(eq(nfValidations.id, input.validationId));
      if (validation?.aiExtractedData) {
        const data = validation.aiExtractedData as any;
        const allOrders = await db.listPurchaseOrders();
        const order = allOrders.find((o: any) => o.id === input.orderId);
        if (order?.supplierId && data.matching) {
          for (const match of data.matching) {
            if (match.status === "match" && match.itemNF && match.confidence >= 0.7) {
              const normalized = match.itemNF.toLowerCase().trim();
              // Upsert mapping
              const existing = await dbInstance.select().from(supplierProductMappings).where(eq(supplierProductMappings.nfProductNameNormalized, normalized)).limit(1);
              if (existing.length > 0) {
                await dbInstance.update(supplierProductMappings).set({ usageCount: existing[0].usageCount + 1, lastUsedAt: new Date() }).where(eq(supplierProductMappings.id, existing[0].id));
              } else {
                await dbInstance.insert(supplierProductMappings).values({
                  supplierId: order.supplierId,
                  supplierName: order.supplierName || "",
                  nfProductName: match.itemNF,
                  nfProductNameNormalized: normalized,
                  systemProductName: match.itemPedido,
                });
              }
            }
          }
        }
      }

      // Audit log
      await auditSensitiveAction({ userId: ctx.user.id, userEmail: ctx.user.email || "", userName: ctx.user.name || ctx.user.email || "", action: "confirm_nf_validation", entityType: "nf_validation", entityId: input.validationId, details: { orderId: input.orderId }, severity: "info" as AuditSeverity });

      return { success: true };
    }),

    generateEmergencyFromNF: protectedProcedure.input(z.object({
      validationId: z.number(),
      orderId: z.number(),
      deficitItems: z.array(z.object({
        productName: z.string(),
        requestedQty: z.number(),
        receivedQty: z.number(),
        deficit: z.number(),
        unit: z.string(),
      })),
    })).mutation(async ({ ctx, input }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      const isMaster = ctx.user.email === MASTER_EMAIL;
      const isBuyerSenior = ctx.user.role === "buyer_senior";
      if (!isMaster && !isBuyerSenior) throw new TRPCError({ code: "FORBIDDEN" });

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { eq } = await import("drizzle-orm");

      // Update validation status
      await dbInstance.update(nfValidations).set({ status: "emergency_generated" }).where(eq(nfValidations.id, input.validationId));
      await dbInstance.update(purchaseOrders).set({ validationStatus: "emergency_generated" } as any).where(eq(purchaseOrders.id, input.orderId));

      // Audit
      await auditSensitiveAction({ userId: ctx.user.id, userEmail: ctx.user.email || "", userName: ctx.user.name || ctx.user.email || "", action: "nf_emergency_generated", entityType: "nf_validation", entityId: input.validationId, details: { orderId: input.orderId, deficitCount: input.deficitItems.length }, severity: "critical" as AuditSeverity, notifTitle: "Divergência em NF", notifMessage: `NF com divergência no pedido #${input.orderId}: ${input.deficitItems.length} itens com déficit` });

      return { success: true, deficitItems: input.deficitItems };
    }),

    listPendingValidations: protectedProcedure.query(async ({ ctx }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      const isMaster = ctx.user.email === MASTER_EMAIL;
      const isBuyerSenior = ctx.user.role === "buyer_senior";
      if (!isMaster && !isBuyerSenior) throw new TRPCError({ code: "FORBIDDEN" });

      const dbInstance = await db.getDb();
      if (!dbInstance) return [];

      const allOrders = await db.listPurchaseOrders();
      const validations = await dbInstance.select().from(nfValidations);

      // Return orders with their validation status
      return allOrders.map((order: any) => {
        const orderValidations = validations.filter((v: any) => v.orderId === order.id);
        const latestValidation = orderValidations.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        return {
          ...order,
          validationStatus: (order as any).validationStatus || "pending",
          latestValidation: latestValidation || null,
        };
      });
    }),

    getValidation: protectedProcedure.input(z.object({ orderId: z.number() })).query(async ({ ctx, input }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      const isMaster = ctx.user.email === MASTER_EMAIL;
      const isBuyerSenior = ctx.user.role === "buyer_senior";
      if (!isMaster && !isBuyerSenior) throw new TRPCError({ code: "FORBIDDEN" });

      const dbInstance = await db.getDb();
      if (!dbInstance) return null;
      const { eq } = await import("drizzle-orm");

      const validations = await dbInstance.select().from(nfValidations).where(eq(nfValidations.orderId, input.orderId));
      return validations.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
    }),
  }),

  remanejamento: router({
    preview: protectedProcedure.input(z.object({
      orderId: z.number(),
      productName: z.string(),
      availableQuantity: z.number().min(0),
    })).mutation(async ({ ctx, input }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      const isMaster = ctx.user.email === MASTER_EMAIL;
      const isBuyerSenior = ctx.user.role === "buyer_senior";
      if (!isMaster && !isBuyerSenior) throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para remanejar." });

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { eq, and } = await import("drizzle-orm");
      const { purchaseOrders, purchaseOrderItems, quotationItems, proposals, proposalItems } = await import("../drizzle/schema");

      // Get order and item
      const [order] = await dbInstance.select().from(purchaseOrders).where(eq(purchaseOrders.id, input.orderId));
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });

      const orderItems = await dbInstance.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, input.orderId));
      const targetItem = orderItems.find((i: any) => i.productName?.toLowerCase().trim() === input.productName.toLowerCase().trim());
      if (!targetItem) throw new TRPCError({ code: "NOT_FOUND", message: "Item não encontrado no pedido." });

      const originalQty = parseFloat(String(targetItem.quantity));
      if (input.availableQuantity >= originalQty) throw new TRPCError({ code: "BAD_REQUEST", message: "Quantidade disponível deve ser menor que a original." });

      const deficit = originalQty - input.availableQuantity;

      // Find alternative: get all proposals for this quotation + product, ranked by price
      const quotationId = order.quotationId;
      if (!quotationId) throw new TRPCError({ code: "BAD_REQUEST", message: "Pedido sem cotação vinculada." });

      const allProposals = await dbInstance.select().from(proposals).where(eq(proposals.quotationId, quotationId));
      const allProposalItems = await dbInstance.select().from(proposalItems);

      // Find proposal items for this product from OTHER suppliers
      const candidates: Array<{supplierId: number, supplierName: string, unitPrice: number, brand: string, proposalId: number}> = [];
      // Get quotation items to map quotationItemId -> productName
      const { quotationItems: qiTable } = await import("../drizzle/schema");
      const allQItems = await dbInstance.select().from(qiTable).where(eq(qiTable.quotationId, quotationId));
      const targetQItem = allQItems.find((qi: any) => qi.productName?.toLowerCase().trim() === input.productName.toLowerCase().trim());
      if (!targetQItem) throw new TRPCError({ code: "NOT_FOUND", message: "Item não encontrado na cotação." });

      // Get supplier names
      const { suppliers: suppTable } = await import("../drizzle/schema");
      const allSuppliers = await dbInstance.select().from(suppTable);
      const supplierMap: Record<number, string> = {};
      for (const s of allSuppliers) supplierMap[s.id] = s.companyName;

      for (const prop of allProposals) {
        if (prop.supplierId === order.supplierId) continue;
        const pItems = allProposalItems.filter((pi: any) => pi.proposalId === prop.id && pi.quotationItemId === targetQItem.id);
        for (const pi of pItems) {
          if (pi.unitPrice) {
            candidates.push({
              supplierId: prop.supplierId!,
              supplierName: supplierMap[prop.supplierId] || "Desconhecido",
              unitPrice: parseFloat(String(pi.unitPriceNormalized || pi.unitPrice)),
              brand: pi.brand || "N/D",
              proposalId: prop.id,
            });
          }
        }
      }

      // Sort by price ascending
      candidates.sort((a, b) => a.unitPrice - b.unitPrice);

      // Filter by eligibility (brand rejections + aliases)
      const unitId = order.unitId;
      let selectedAlternative: typeof candidates[0] | null = null;
      let rank = 0;

      for (const cand of candidates) {
        rank++;
        const rejection = await db.isBrandRejectedWithAliases(cand.brand, unitId!, input.productName);
        if (!rejection.rejected) {
          selectedAlternative = cand;
          break;
        }
      }

      const costImpact = selectedAlternative 
        ? (selectedAlternative.unitPrice * deficit) - (parseFloat(String(targetItem.unitPrice)) * deficit)
        : 0;

      return {
        originalQuantity: originalQty,
        availableQuantity: input.availableQuantity,
        deficit,
        originalSupplier: { id: order.supplierId, name: supplierMap[order.supplierId] || "Fornecedor #" + order.supplierId, unitPrice: parseFloat(String(targetItem.unitPrice)) },
        alternative: selectedAlternative ? {
          supplierId: selectedAlternative.supplierId,
          supplierName: selectedAlternative.supplierName,
          unitPrice: selectedAlternative.unitPrice,
          brand: selectedAlternative.brand,
          rank,
          totalCost: selectedAlternative.unitPrice * deficit,
        } : null,
        costImpact,
        hasAlternative: !!selectedAlternative,
        totalCandidates: candidates.length,
      };
    }),

    confirm: protectedProcedure.input(z.object({
      orderId: z.number(),
      productName: z.string(),
      availableQuantity: z.number().min(0),
      justification: z.string().min(20, "Justificativa deve ter no mínimo 20 caracteres"),
    })).mutation(async ({ ctx, input }) => {
      const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
      const isMaster = ctx.user.email === MASTER_EMAIL;
      const isBuyerSenior = ctx.user.role === "buyer_senior";
      if (!isMaster && !isBuyerSenior) throw new TRPCError({ code: "FORBIDDEN" });

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { eq, and } = await import("drizzle-orm");
      const { purchaseOrders, purchaseOrderItems, proposals, proposalItems } = await import("../drizzle/schema");

      // Get order and item
      const [order] = await dbInstance.select().from(purchaseOrders).where(eq(purchaseOrders.id, input.orderId));
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });

      const orderItems = await dbInstance.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, input.orderId));
      const targetItem = orderItems.find((i: any) => i.productName?.toLowerCase().trim() === input.productName.toLowerCase().trim());
      if (!targetItem) throw new TRPCError({ code: "NOT_FOUND" });

      const originalQty = parseFloat(String(targetItem.quantity));
      if (input.availableQuantity >= originalQty) throw new TRPCError({ code: "BAD_REQUEST" });
      const deficit = originalQty - input.availableQuantity;

      // Find best alternative (same logic as preview)
      const quotationId = order.quotationId;
      if (!quotationId) throw new TRPCError({ code: "BAD_REQUEST" });

      const allProposals = await dbInstance.select().from(proposals).where(eq(proposals.quotationId, quotationId));
      const allProposalItems = await dbInstance.select().from(proposalItems);
      // Get quotation items to map quotationItemId -> productName
      const { quotationItems: qiTable } = await import("../drizzle/schema");
      const allQItems = await dbInstance.select().from(qiTable).where(eq(qiTable.quotationId, quotationId));
      const targetQItem = allQItems.find((qi: any) => qi.productName?.toLowerCase().trim() === input.productName.toLowerCase().trim());
      if (!targetQItem) throw new TRPCError({ code: "NOT_FOUND", message: "Item não encontrado na cotação." });

      const { suppliers: suppTable } = await import("../drizzle/schema");
      const allSuppliers = await dbInstance.select().from(suppTable);
      const supplierMap: Record<number, string> = {};
      for (const s of allSuppliers) supplierMap[s.id] = s.companyName;

      const candidates: Array<{supplierId: number, supplierName: string, unitPrice: number, brand: string}> = [];
      for (const prop of allProposals) {
        if (prop.supplierId === order.supplierId) continue;
        const pItems = allProposalItems.filter((pi: any) => pi.proposalId === prop.id && pi.quotationItemId === targetQItem.id);
        for (const pi of pItems) {
          if (pi.unitPrice) {
            candidates.push({ supplierId: prop.supplierId!, supplierName: supplierMap[prop.supplierId] || "Desconhecido", unitPrice: parseFloat(String(pi.unitPriceNormalized || pi.unitPrice)), brand: pi.brand || "N/D" });
          }
        }
      }
      candidates.sort((a, b) => a.unitPrice - b.unitPrice);

      let selectedAlternative: typeof candidates[0] | null = null;
      let rank = 0;
      for (const cand of candidates) {
        rank++;
        const rejection = await db.isBrandRejectedWithAliases(cand.brand, order.unitId!, input.productName);
        if (!rejection.rejected) { selectedAlternative = cand; break; }
      }

      if (!selectedAlternative) {
        // No alternative — record failure and alert Master
        await db.createRemanejamento({
          originalOrderId: input.orderId, originalOrderCode: order.code || undefined,
          quotationId, productName: input.productName, unit: targetItem.unit || "UN",
          originalQuantity: String(originalQty), availableQuantity: String(input.availableQuantity), deficit: String(deficit),
          originalSupplierId: order.supplierId!, originalSupplierName: supplierMap[order.supplierId] || "Fornecedor #" + order.supplierId,
          originalUnitPrice: String(targetItem.unitPrice), justification: input.justification,
          status: "failed_no_alternative", userId: ctx.user.id, userName: ctx.user.name || undefined, userEmail: ctx.user.email || undefined,
        });
        await auditSensitiveAction({ userId: ctx.user.id, userEmail: ctx.user.email || "", userName: ctx.user.name || "", action: "remanejamento_sem_alternativa", entityType: "purchase_order", entityId: input.orderId, details: { produto: input.productName, deficit, motivo: "Sem fornecedor alternativo elegível" } as any, severity: "critical", notifTitle: "Remanejamento BLOQUEADO", notifMessage: `Sem alternativa elegível para ${input.productName} (déficit ${deficit})`, actionUrl: `/pedidos` });
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Nenhum fornecedor alternativo elegível para ${input.productName}. O Master foi notificado.` });
      }

      // 1a. If availableQuantity = 0, remove item completely; otherwise reduce quantity
      if (input.availableQuantity === 0) {
        // Remove item completely from original order
        await dbInstance.delete(purchaseOrderItems).where(eq(purchaseOrderItems.id, targetItem.id));
      } else {
        // Reduce quantity and recalculate item total
        const newItemTotal = (input.availableQuantity * parseFloat(String(targetItem.unitPrice))).toFixed(2);
        await dbInstance.update(purchaseOrderItems).set({ quantity: String(input.availableQuantity), totalPrice: newItemTotal }).where(eq(purchaseOrderItems.id, targetItem.id));
      }
      // Recalculate order totalValue (after removal or reduction)
      const remainingItems = await dbInstance.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, input.orderId));
      const recalcTotal = remainingItems.reduce((sum: number, i: any) => sum + parseFloat(String(i.totalPrice) || "0"), 0);
      await dbInstance.update(purchaseOrders).set({ totalValue: recalcTotal.toFixed(2) }).where(eq(purchaseOrders.id, input.orderId));

      // 2. Find existing order for the alternative supplier in the same quotation (same purchaseGroupId or quotationId)
      let targetOrderId: number;
      let targetOrderCode: string;
      const existingOrders = await dbInstance.select().from(purchaseOrders)
        .where(and(
          eq(purchaseOrders.supplierId, selectedAlternative.supplierId),
          eq(purchaseOrders.quotationId, quotationId),
          // Not cancelled
        ));
      const activeOrder = existingOrders.find((o: any) => o.status !== "cancelled");

      if (activeOrder) {
        // Add item to the existing order of this supplier
        targetOrderId = activeOrder.id;
        targetOrderCode = activeOrder.code;
        await db.createPurchaseOrderItems([{
          orderId: targetOrderId, productName: targetItem.productName, quantity: String(deficit),
          unit: targetItem.unit, unitPrice: String(selectedAlternative.unitPrice.toFixed(2)),
          totalPrice: String((selectedAlternative.unitPrice * deficit).toFixed(2)),
        }]);
        // Update totalValue of the existing order
        const currentTotal = parseFloat(String(activeOrder.totalValue)) || 0;
        const newTotal = currentTotal + (selectedAlternative.unitPrice * deficit);
        await dbInstance.update(purchaseOrders).set({ totalValue: String(newTotal.toFixed(2)) }).where(eq(purchaseOrders.id, targetOrderId));
      } else {
        // No existing order for this supplier in this quotation — create a new one (rare case)
        targetOrderCode = `RMJ-${order.code || input.orderId}-${Date.now().toString(36)}`;
        targetOrderId = await db.createPurchaseOrder({
          code: targetOrderCode,
          quotationId,
          proposalId: null,
          supplierId: selectedAlternative.supplierId,
          unitId: order.unitId,
          createdBy: ctx.user.id,
          totalValue: String((selectedAlternative.unitPrice * deficit).toFixed(2)),
          notes: `Remanejamento - ${input.productName}: ${deficit} ${targetItem.unit} de ${selectedAlternative.supplierName}`,
          purchaseGroupId: order.purchaseGroupId,
          period: order.period,
        });
        await db.createPurchaseOrderItems([{
          orderId: targetOrderId, productName: targetItem.productName, quantity: String(deficit),
          unit: targetItem.unit, unitPrice: String(selectedAlternative.unitPrice.toFixed(2)),
          totalPrice: String((selectedAlternative.unitPrice * deficit).toFixed(2)),
        }]);
      }

      // 3. Record remanejamento
      const costImpact = (selectedAlternative.unitPrice * deficit) - (parseFloat(String(targetItem.unitPrice)) * deficit);
      await db.createRemanejamento({
        originalOrderId: input.orderId, originalOrderCode: order.code || undefined,
        complementaryOrderId: targetOrderId, complementaryOrderCode: targetOrderCode,
        quotationId, productName: input.productName, unit: targetItem.unit || "UN",
        originalQuantity: String(originalQty), availableQuantity: String(input.availableQuantity), deficit: String(deficit),
        originalSupplierId: order.supplierId!, originalSupplierName: supplierMap[order.supplierId] || "Fornecedor #" + order.supplierId,
        originalUnitPrice: String(targetItem.unitPrice),
        alternativeSupplierId: selectedAlternative.supplierId, alternativeSupplierName: selectedAlternative.supplierName,
        alternativeUnitPrice: String(selectedAlternative.unitPrice), alternativeBrand: selectedAlternative.brand,
        alternativeRank: rank, justification: input.justification, status: "completed",
        costImpact: String(costImpact), userId: ctx.user.id, userName: ctx.user.name || undefined, userEmail: ctx.user.email || undefined,
      });

      // 4. Audit
      const severity = Math.abs(costImpact) > (parseFloat(String(targetItem.unitPrice)) * deficit * 0.2) ? "critical" as const : "warning" as const;
      await auditSensitiveAction({ userId: ctx.user.id, userEmail: ctx.user.email || "", userName: ctx.user.name || "", action: "remanejamento_pedido", entityType: "purchase_order", entityId: input.orderId, details: { produto: input.productName, qtdOriginal: originalQty, qtdDisponivel: input.availableQuantity, deficit, fornecedorAlternativo: selectedAlternative.supplierName, precoUnit: selectedAlternative.unitPrice, pedidoDestino: targetOrderCode, adicionadoAoPedidoExistente: !!activeOrder } as any, severity, notifTitle: "Remanejamento de Pedido", notifMessage: `${ctx.user.name} remanejou ${deficit} ${targetItem.unit} de ${input.productName} para ${selectedAlternative.supplierName} (pedido ${targetOrderCode})`, actionUrl: `/pedidos`, justification: input.justification });

      return {
        success: true,
        originalOrder: { id: input.orderId, code: order.code, newQuantity: input.availableQuantity },
        complementaryOrder: { id: targetOrderId, code: targetOrderCode, supplier: selectedAlternative.supplierName, quantity: deficit, unitPrice: selectedAlternative.unitPrice, brand: selectedAlternative.brand, addedToExisting: !!activeOrder },
        costImpact,
      };
    }),
  }),
});
export type AppRouter = typeof appRouter;

// --- Notification helpers (used by routers above and by event triggers) ---
import { userNotifications, notificationPreferences, pushSubscriptions, users as usersTable, nfValidations, supplierProductMappings, purchaseOrders } from "../drizzle/schema";

const MASTER_EMAILS_NOTIF = ['afonsoqueirogagn@gmail.com'];
const JUNIOR_EMAILS_NOTIF = ['frotas.patrimonio@qualities.com.br'];
const PAULA_EMAILS_NOTIF = ['paularibeiro@qualities.com.br'];

type NotifEventType = 'supplier_response' | 'quotation_ready' | 'order_generated' | 'order_cancelled' | 'quotation_reopened' | 'price_alert' | 'delivery_adjusted' | 'no_response_48h' | 'doc_expired' | 'item_edited' | 'system';

// ═══════════════════════════════════════════════════════════════
// MOTOR DE AUDITORIA CORPORATIVA — Controle de Integridade
// ═══════════════════════════════════════════════════════════════
type AuditSeverity = 'info' | 'warning' | 'critical';

async function auditSensitiveAction(opts: {
  userId: number;
  userEmail: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: number;
  details: Record<string, any>;
  severity: AuditSeverity;
  justification?: string;
  notifTitle?: string;
  notifMessage?: string;
  actionUrl?: string;
}) {
  const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";
  // 1. Always log to audit_logs
  await db.createAuditLog({
    userId: opts.userId,
    userName: opts.userName,
    userEmail: opts.userEmail,
    action: opts.action,
    entityType: opts.entityType,
    entityId: opts.entityId,
    details: { ...opts.details, severity: opts.severity, justification: opts.justification },
  });

  // Skip notifications if the actor IS the Master
  if (opts.userEmail === MASTER_EMAIL) return;

  // 2. For warning and critical: notify Master via sino
  if (opts.severity === 'warning' || opts.severity === 'critical') {
    try {
      const masterUser = await db.getUserByEmail(MASTER_EMAIL);
      if (masterUser) {
        await createUserNotification({
          userId: masterUser.id,
          type: 'system' as any,
          title: opts.notifTitle || `[Auditoria] ${opts.action}`,
          message: opts.notifMessage || `${opts.userName} executou: ${opts.action}`,
          priority: opts.severity === 'critical' ? 'critical' : 'high',
          relatedEntityType: opts.entityType,
          relatedEntityId: opts.entityId,
          actionUrl: opts.actionUrl,
          dedupeKey: `audit_${opts.action}_${opts.entityId}_${Date.now()}`,
        });
      }
    } catch { /* best-effort */ }
  }

  // 3. For critical: also send email to Master
  if (opts.severity === 'critical') {
    try {
      const { execSync } = await import('child_process');
      const subject = `[QualiCompras ALERTA] ${opts.notifTitle || opts.action}`;
      const body = [
        `ALERTA DE AUDITORIA — QualiCompras`,
        ``,
        `Ação: ${opts.action}`,
        `Executada por: ${opts.userName} (${opts.userEmail})`,
        `Severidade: ${opts.severity.toUpperCase()}`,
        `Data: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })}`,
        ``,
        opts.justification ? `Justificativa: ${opts.justification}` : '',
        ``,
        `Detalhes: ${JSON.stringify(opts.details, null, 2)}`,
        ``,
        opts.actionUrl ? `Acessar: https://qualicompra.manus.space${opts.actionUrl}` : '',
        ``,
        `— Sistema de Auditoria QualiCompras`,
      ].filter(Boolean).join('\n');
      const emailInput = JSON.stringify({ to: [MASTER_EMAIL], subject, body });
      trySendEmail(emailInput);
    } catch { /* best-effort email */ }
  }
}

export async function createUserNotification(opts: {
  userId: number;
  type: NotifEventType;
  title: string;
  message?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  relatedEntityType?: string;
  relatedEntityId?: number;
  actionUrl?: string;
  dedupeKey?: string;
}) {
  const dbInstance = await db.getDb();
  if (!dbInstance) return null;
  const { eq, and } = await import("drizzle-orm");
  // Dedupe check
  if (opts.dedupeKey) {
    const [existing] = await dbInstance.select({ id: userNotifications.id })
      .from(userNotifications)
      .where(and(
        eq(userNotifications.userId, opts.userId),
        eq(userNotifications.dedupeKey, opts.dedupeKey)
      ))
      .limit(1);
    if (existing) return null;
  }
  // Check user preferences
  const [pref] = await dbInstance.select()
    .from(notificationPreferences)
    .where(and(
      eq(notificationPreferences.userId, opts.userId),
      eq(notificationPreferences.eventType, opts.type)
    ))
    .limit(1);
  if (pref && !pref.inAppEnabled) return null; // user disabled this type

  const [inserted] = await dbInstance.insert(userNotifications).values({
    userId: opts.userId,
    type: opts.type,
    title: opts.title,
    message: opts.message || null,
    priority: opts.priority || 'medium',
    relatedEntityType: opts.relatedEntityType || null,
    relatedEntityId: opts.relatedEntityId || null,
    actionUrl: opts.actionUrl || null,
    dedupeKey: opts.dedupeKey || null,
  }).$returningId();
  
  // Send push if enabled
  if (!pref || pref.pushEnabled) {
    sendPushToUser(opts.userId, opts.title, opts.message || '', opts.actionUrl).catch(() => {});
  }
  return inserted;
}

async function sendPushToUser(userId: number, title: string, body: string, url?: string | null) {
  try {
    const webpush = await import('web-push');
    const dbInstance = await db.getDb();
    if (!dbInstance) return;
    const { eq } = await import("drizzle-orm");
    const subs = await dbInstance.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    if (!subs.length) return;
    
    const vapidPublic = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    if (!vapidPublic || !vapidPrivate) return;
    
    webpush.default.setVapidDetails('mailto:qualicompras@qualities.com.br', vapidPublic, vapidPrivate);
    const payload = JSON.stringify({ title, body: body.substring(0, 200), url: url || '/' });
    
    for (const sub of subs) {
      try {
        await webpush.default.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        }, payload);
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await dbInstance.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        }
      }
    }
  } catch { /* push is best-effort */ }
}

export async function notifyUsersByEmail(emails: string[], opts: Omit<Parameters<typeof createUserNotification>[0], 'userId'>) {
  const dbInstance = await db.getDb();
  if (!dbInstance) return;
  const { eq } = await import("drizzle-orm");
  for (const email of emails) {
    const [user] = await dbInstance.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (user) {
      await createUserNotification({ ...opts, userId: user.id });
    }
  }
}
