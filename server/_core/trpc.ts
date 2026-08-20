import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { securityCheck, auditAction, pendingWhatsAppAlerts } from "../securityGuard";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

// Security audit middleware - logs ALL mutations from authenticated users
const securityAudit = t.middleware(async opts => {
  const { ctx, next, type, path } = opts;
  const meta: { ip?: string; userAgent?: string; path?: string; method?: string } = {
    ip: ctx.req?.ip || ctx.req?.socket?.remoteAddress || "unknown",
    userAgent: ctx.req?.headers?.["user-agent"] || "unknown",
    path: path,
    method: type,
  };

  // For mutations, run full security check
  if (type === "mutation" && ctx.user) {
    const user = { id: (ctx.user as any).id, name: (ctx.user as any).name || undefined, email: (ctx.user as any).email || undefined, role: (ctx.user as any).role };
    const check = await securityCheck(path, path.split(".")[0] || "unknown", user, meta);
    if (!check.allowed) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: check.reason || "Bloqueado por seguran\u00e7a." });
    }
  }

  return next({ ctx });
});

// protectedProcedure: requireUser narrows ctx.user to non-null
// Security audit runs as a side-effect inside requireUser
const requireUserWithAudit = t.middleware(async opts => {
  const { ctx, next, type, path } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  // Run security check for mutations
  if (type === "mutation") {
    const meta = {
      ip: ctx.req?.ip || ctx.req?.socket?.remoteAddress || "unknown",
      userAgent: ctx.req?.headers?.["user-agent"] || "unknown",
      path,
      method: type,
    };
    const check = await securityCheck(path, path.split(".")[0] || "unknown", { id: ctx.user.id, name: ctx.user.name || undefined, email: ctx.user.email || undefined, role: ctx.user.role }, meta);
    if (!check.allowed) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: check.reason || "Bloqueado por seguran\u00e7a." });
    }
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUserWithAudit);

// writeProcedure: only Master (afonsoqueirogagn@gmail.com) and buyer_senior can perform write operations
// All other users (compradores) are READ-ONLY
const MASTER_EMAIL_GLOBAL = "afonsoqueirogagn@gmail.com";
const OWNER_WHATSAPP_TRPC = "5583993149365";

function queueBlockedAttemptAlert(userName: string, userEmail: string, path: string, ip: string): void {
  const title = `\u26a0\ufe0f TENTATIVA BLOQUEADA`;
  const message = `Usu\u00e1rio: ${userName} (${userEmail})\nA\u00e7\u00e3o: ${path}\nIP: ${ip}\nHora: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}`;
  const fullMessage = `${title}\n\n${message}`;
  const encoded = encodeURIComponent(fullMessage);
  const whatsappUrl = `https://wa.me/${OWNER_WHATSAPP_TRPC}?text=${encoded}`;
  pendingWhatsAppAlerts.push({
    phone: OWNER_WHATSAPP_TRPC,
    title,
    message,
    timestamp: new Date().toISOString(),
    whatsappUrl,
  });
  if (pendingWhatsAppAlerts.length > 100) pendingWhatsAppAlerts.shift();
  console.log(`[Security:BLOCKED] ${userEmail} tried: ${path}`);
}

const requireWriteAccess = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  const email = ctx.user.email || "";
  const role = ctx.user.role;
  // Master has ultra total access
  if (email === MASTER_EMAIL_GLOBAL) {
    return next({ ctx: { ...ctx, user: ctx.user } });
  }
  // buyer_senior (Junior) keeps existing permissions
  if (role === "buyer_senior") {
    return next({ ctx: { ...ctx, user: ctx.user } });
  }
  // admin role has full write access (same as Master)
  if (role === "admin") {
    return next({ ctx: { ...ctx, user: ctx.user } });
  }
  // cotador (Paula) - only allowed to create quotations, upload PDFs, and send to suppliers
  if (role === "cotador") {
    const attemptPathCotador = (opts as any).path || "unknown";
    const allowedCotadorPaths = [
      "quotations.create",
      "quotations.open",
      "quotations.sendToSuppliers",
      "quotations.updateTitle",
      "quotations.addSupplier",
      "quotations.removeSupplier",
      "quotations.replaceItems",
      "quotations.updateStatus",
      "quotations.sendWhatsApp",
      "fortesItems.create",
      "fortesItems.update",
      "fortesItems.delete",
      "fortesItems.importFromPdf",
    ];
    if (allowedCotadorPaths.some(p => attemptPathCotador.startsWith(p) || attemptPathCotador === p)) {
      return next({ ctx: { ...ctx, user: ctx.user } });
    }
    // Not allowed - fall through to block
  }
  // BLOCKED: log the attempt, create security event, and send WhatsApp alert
  const attemptPath = (opts as any).path || "unknown";
  const ip = ctx.req?.headers?.["x-forwarded-for"] as string || ctx.req?.socket?.remoteAddress || "unknown";
  const userName = ctx.user.name || "Desconhecido";
  
  // Queue WhatsApp alert
  queueBlockedAttemptAlert(userName, email, attemptPath, ip);
  
  // Log to security_events table
  try {
    const { createSecurityEvent } = await import("../db");
    await createSecurityEvent({
      eventType: "blocked_mutation",
      userId: ctx.user.id,
      userName,
      description: `Tentativa bloqueada: ${userName} (${email}) tentou executar ${attemptPath}`,
      ipAddress: ip,
      userAgent: ctx.req?.headers?.["user-agent"] || "",
      details: { action: attemptPath, role, email, reason: "User lacks write permission" },
    });
  } catch (e) {
    console.error("[Security] Failed to log blocked attempt:", e);
  }
  
  throw new TRPCError({ code: "FORBIDDEN", message: "Acesso somente leitura. Apenas usu\u00e1rios autorizados podem realizar altera\u00e7\u00f5es." });
});
export const writeProcedure = t.procedure.use(requireUserWithAudit).use(requireWriteAccess);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
