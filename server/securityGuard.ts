/**
 * SECURITY GUARD - Proteção Enterprise contra IA, Bots, Scrapers e Insider Threats
 * 
 * Camadas de proteção:
 * 1. Audit Trail - registra TODA ação de TODOS os usuários
 * 2. Anti-Bot/IA - detecta headless browsers, scripts automatizados, scrapers
 * 3. Anomaly Detection - detecta padrões suspeitos (bulk operations, price manipulation)
 * 4. Rate Limiting por Usuário - limita ações por usuário autenticado (não só IP)
 * 5. Session Integrity - detecta session hijacking e fingerprint mismatch
 */

import { createAuditLog, createSecurityEvent } from "./db";
import { notifyOwner } from "./_core/notification";

// ==================== WHATSAPP ALERTS ====================
const OWNER_WHATSAPP = "5583993149365"; // Afonso - (83) 99314-9365

export interface WhatsAppAlert {
  phone: string;
  title: string;
  message: string;
  timestamp: string;
  whatsappUrl: string;
}

// In-memory queue of pending WhatsApp alerts (last 100)
export const pendingWhatsAppAlerts: WhatsAppAlert[] = [];

/** Queue a WhatsApp alert for the owner */
function sendWhatsAppAlert(title: string, message: string): void {
  const fullMessage = `${title}\n\n${message}`;
  const encoded = encodeURIComponent(fullMessage);
  const whatsappUrl = `https://wa.me/${OWNER_WHATSAPP}?text=${encoded}`;
  const alert: WhatsAppAlert = {
    phone: OWNER_WHATSAPP,
    title,
    message,
    timestamp: new Date().toISOString(),
    whatsappUrl,
  };
  pendingWhatsAppAlerts.push(alert);
  if (pendingWhatsAppAlerts.length > 100) pendingWhatsAppAlerts.shift();
  console.log(`[SecurityGuard:WhatsApp] Alert queued: ${title}`);
}

// ==================== TYPES ====================
interface UserContext {
  id: number;
  name?: string | null;
  email?: string | null;
  role?: string;
}

interface RequestMeta {
  ip?: string;
  userAgent?: string;
  path?: string;
  method?: string;
  fingerprint?: string;
}

// ==================== IN-MEMORY TRACKING ====================
// Track user actions per minute for anomaly detection
const userActionCounts = new Map<number, { count: number; resetAt: number; actions: string[] }>();
// Track IP request patterns
const ipPatterns = new Map<string, { count: number; resetAt: number; paths: string[]; blocked: boolean; blockedUntil?: number }>();
// Track failed auth attempts
const failedAuths = new Map<string, { count: number; resetAt: number }>();
// Track suspicious fingerprints
const suspiciousFingerprints = new Set<string>();

// ==================== CONSTANTS ====================
const MAX_USER_ACTIONS_PER_MINUTE = 60; // Normal user won't do 60 actions/min
const MAX_IP_REQUESTS_PER_MINUTE = 120;
const BLOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const CRITICAL_ACTIONS = [
  "order.approve", "order.delete", "supplier.delete", "quotation.delete",
  "settings.update", "user.role_change", "price.override", "order.cancel",
  "supplier.create", "supplier.update", "quotation.approve",
];
const SCRAPING_PATTERNS = [
  /\.(php|asp|aspx|jsp|cgi|env|git|svn|htaccess|htpasswd|wp-|xmlrpc)/i,
  /\/admin|\/login|\/wp-admin|\/phpmyadmin|\/\.env/i,
  /union\s+select|drop\s+table|insert\s+into|delete\s+from/i,
  /<script|javascript:|on(error|load|click)=/i,
  /\.\.\//g,
];

// ==================== ANTI-BOT DETECTION ====================
const BOT_USER_AGENTS = [
  /headless/i, /phantom/i, /selenium/i, /webdriver/i,
  /puppeteer/i, /playwright/i, /crawl/i, /spider/i,
  /scrape/i, /wget/i, /curl/i, /python-requests/i,
  /httpie/i, /postman/i, /insomnia/i, /axios/i,
  /node-fetch/i, /got\//i, /undici/i,
];

export function isBot(userAgent: string | undefined): boolean {
  if (!userAgent) return true; // No user-agent = suspicious
  if (userAgent.length < 20) return true; // Too short = suspicious
  return BOT_USER_AGENTS.some(pattern => pattern.test(userAgent));
}

export function isSuspiciousPath(path: string): boolean {
  return SCRAPING_PATTERNS.some(pattern => pattern.test(path));
}

// ==================== AUDIT TRAIL MIDDLEWARE ====================
export async function auditAction(
  action: string,
  resource: string,
  user: UserContext | null,
  meta: RequestMeta,
  details?: Record<string, unknown>,
  severity?: "info" | "warning" | "critical"
) {
  try {
    await createAuditLog({
      userId: user?.id ?? null,
      userName: user?.name || "anonymous",
      userRole: user?.role || "unknown",
      action,
      resource,
      resourceId: details?.resourceId ? String(details.resourceId) : undefined,
      details: details || {},
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      sessionFingerprint: meta.fingerprint,
      severity: severity || (CRITICAL_ACTIONS.includes(action) ? "warning" : "info"),
    });
  } catch (e) {
    console.error("[SecurityGuard] Audit log failed:", e);
  }
}

// ==================== ANOMALY DETECTION ====================
export async function checkAnomaly(
  action: string,
  user: UserContext | null,
  meta: RequestMeta,
  details?: Record<string, unknown>
): Promise<{ blocked: boolean; reason?: string }> {
  if (!user) return { blocked: false };

  const now = Date.now();
  const userId = user.id;

  // 1. Check user action rate
  let userTrack = userActionCounts.get(userId);
  if (!userTrack || now > userTrack.resetAt) {
    userTrack = { count: 0, resetAt: now + 60000, actions: [] };
    userActionCounts.set(userId, userTrack);
  }
  userTrack.count++;
  userTrack.actions.push(action);

  if (userTrack.count > MAX_USER_ACTIONS_PER_MINUTE) {
    await raiseSecurityEvent(
      "excessive_actions",
      user,
      meta,
      `Usuário ${user.name} (ID: ${userId}) executou ${userTrack.count} ações em 1 minuto. Possível automação ou ataque.`,
      { actions: userTrack.actions.slice(-20), count: userTrack.count }
    );
    return { blocked: true, reason: "Muitas ações em pouco tempo. Aguarde 1 minuto." };
  }

  // 2. Check for bulk data access (scraping)
  if (action.includes(".list") || action.includes(".getAll")) {
    const listActions = userTrack.actions.filter(a => a.includes(".list") || a.includes(".getAll"));
    if (listActions.length > 20) {
      await raiseSecurityEvent(
        "bulk_scraping",
        user,
        meta,
        `Possível scraping: ${user.name} fez ${listActions.length} consultas em massa em 1 minuto.`,
        { actions: listActions }
      );
      return { blocked: true, reason: "Padrão de acesso suspeito detectado." };
    }
  }

  // 3. Check for price manipulation attempts
  if (action === "price.override" || action === "order.price_change") {
    await raiseSecurityEvent(
      "price_manipulation",
      user,
      meta,
      `Tentativa de alteração de preço por ${user.name} (${user.role}).`,
      details
    );
  }

  return { blocked: false };
}

// ==================== IP TRACKING ====================
export function trackIP(ip: string, path: string): { blocked: boolean; reason?: string } {
  const now = Date.now();
  let track = ipPatterns.get(ip);

  if (!track || now > track.resetAt) {
    track = { count: 0, resetAt: now + 60000, paths: [], blocked: false };
    ipPatterns.set(ip, track);
  }

  // Check if IP is currently blocked
  if (track.blocked && track.blockedUntil && now < track.blockedUntil) {
    return { blocked: true, reason: "IP temporariamente bloqueado por atividade suspeita." };
  }

  track.count++;
  track.paths.push(path);

  // Block if exceeds rate
  if (track.count > MAX_IP_REQUESTS_PER_MINUTE) {
    track.blocked = true;
    track.blockedUntil = now + BLOCK_DURATION_MS;
    return { blocked: true, reason: "Muitas requisições. IP bloqueado por 30 minutos." };
  }

  // Check for scanning patterns
  if (isSuspiciousPath(path)) {
    track.blocked = true;
    track.blockedUntil = now + BLOCK_DURATION_MS;
    return { blocked: true, reason: "Atividade maliciosa detectada." };
  }

  return { blocked: false };
}

// ==================== SECURITY EVENT RAISER ====================
async function raiseSecurityEvent(
  eventType: string,
  user: UserContext | null,
  meta: RequestMeta,
  description: string,
  details?: Record<string, unknown>
) {
  try {
    await createSecurityEvent({
      eventType,
      userId: user?.id ?? null,
      userName: user?.name || "anonymous",
      description,
      details: details || {},
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    // Notify owner for critical events (push + WhatsApp)
    try {
      await notifyOwner({
        title: `🚨 ALERTA DE SEGURANÇA: ${eventType}`,
        content: `${description}\n\nIP: ${meta.ip}\nUser-Agent: ${meta.userAgent?.substring(0, 100)}\nHorário: ${new Date().toISOString()}`
      });
    } catch (e) {
      console.error("[SecurityGuard] Failed to notify owner:", e);
    }
    // Also send WhatsApp alert
    sendWhatsAppAlert(
      `🚨 SEGURANÇA: ${eventType}`,
      `${description}\nIP: ${meta.ip}\nHorário: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}`
    );
  } catch (e) {
    console.error("[SecurityGuard] Failed to create security event:", e);
  }
}

// ==================== SESSION INTEGRITY ====================
const userFingerprints = new Map<number, string>();

export async function validateSessionIntegrity(
  user: UserContext,
  fingerprint: string,
  meta: RequestMeta
): Promise<boolean> {
  const storedFingerprint = userFingerprints.get(user.id);

  if (!storedFingerprint) {
    // First time - store fingerprint
    userFingerprints.set(user.id, fingerprint);
    return true;
  }

  if (storedFingerprint !== fingerprint) {
    // Fingerprint changed - possible session hijacking
    await raiseSecurityEvent(
      "session_hijacking",
      user,
      meta,
      `Possível hijacking de sessão: fingerprint mudou para usuário ${user.name} (ID: ${user.id}). Fingerprint anterior: ${storedFingerprint.substring(0, 8)}... Novo: ${fingerprint.substring(0, 8)}...`,
      { oldFingerprint: storedFingerprint, newFingerprint: fingerprint }
    );
    // Update fingerprint but flag it
    userFingerprints.set(user.id, fingerprint);
    return false; // Don't block but alert
  }

  return true;
}

// ==================== HONEYPOT FIELDS ====================
export function checkHoneypot(body: Record<string, unknown>): boolean {
  // These fields should NEVER be filled by real users (hidden in the form)
  const honeypotFields = ["website", "url", "fax", "company_url", "homepage"];
  for (const field of honeypotFields) {
    if (body[field] && String(body[field]).trim().length > 0) {
      return true; // Bot detected
    }
  }
  return false;
}

// ==================== INPUT SANITIZATION (Anti-Prompt Injection) ====================
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above)\s+(instructions|prompts|rules)/i,
  /you\s+are\s+now\s+/i,
  /pretend\s+(you|to\s+be)/i,
  /act\s+as\s+(if|a|an)/i,
  /system\s*:\s*/i,
  /\[INST\]/i,
  /\<\|im_start\|\>/i,
  /\<\|system\|\>/i,
  /jailbreak/i,
  /DAN\s*mode/i,
  /bypass\s+(filter|safety|restriction)/i,
];

export function containsPromptInjection(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  return PROMPT_INJECTION_PATTERNS.some(pattern => pattern.test(text));
}

export function sanitizeInput(text: string): string {
  if (!text || typeof text !== "string") return text;
  // Remove null bytes
  let sanitized = text.replace(/\0/g, "");
  // Remove control characters (except newline, tab)
  sanitized = sanitized.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // Limit length to prevent DoS
  if (sanitized.length > 10000) sanitized = sanitized.substring(0, 10000);
  return sanitized;
}

// ==================== EXPORT COMPREHENSIVE CHECK ====================
export async function securityCheck(
  action: string,
  resource: string,
  user: UserContext | null,
  meta: RequestMeta,
  body?: Record<string, unknown>
): Promise<{ allowed: boolean; reason?: string }> {
  // 1. Check IP blocking
  if (meta.ip) {
    const ipCheck = trackIP(meta.ip, meta.path || "/");
    if (ipCheck.blocked) return { allowed: false, reason: ipCheck.reason };
  }

  // 2. Check bot detection for non-authenticated requests
  if (!user && meta.userAgent && isBot(meta.userAgent)) {
    await raiseSecurityEvent("bot_detected", null, meta, `Bot detectado: ${meta.userAgent?.substring(0, 100)}`);
    return { allowed: false, reason: "Acesso automatizado não permitido." };
  }

  // 3. Check honeypot
  if (body && checkHoneypot(body)) {
    await raiseSecurityEvent("honeypot_triggered", user, meta, `Honeypot ativado por ${user?.name || meta.ip}`);
    return { allowed: false, reason: "Requisição inválida." };
  }

  // 4. Check prompt injection in text fields
  if (body) {
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string" && containsPromptInjection(value)) {
        await raiseSecurityEvent(
          "prompt_injection",
          user,
          meta,
          `Tentativa de prompt injection detectada no campo "${key}" por ${user?.name || meta.ip}`,
          { field: key, value: value.substring(0, 200) }
        );
        // Don't block but log - could be false positive
      }
    }
  }

  // 5. Check anomaly for authenticated users
  if (user) {
    const anomalyCheck = await checkAnomaly(action, user, meta, body as Record<string, unknown>);
    if (anomalyCheck.blocked) return { allowed: false, reason: anomalyCheck.reason };
  }

  // 6. Log the action
  await auditAction(action, resource, user, meta, body as Record<string, unknown>);

  return { allowed: true };
}

// ==================== CLEANUP (runs every 5 minutes) ====================
setInterval(() => {
  const now = Date.now();
  // Clean expired user action counts
  const userKeys = Array.from(userActionCounts.keys());
  for (const key of userKeys) {
    const val = userActionCounts.get(key)!;
    if (now > val.resetAt) userActionCounts.delete(key);
  }
  // Clean expired IP patterns
  const ipKeys = Array.from(ipPatterns.keys());
  for (const key of ipKeys) {
    const val = ipPatterns.get(key)!;
    if (now > val.resetAt && !val.blocked) ipPatterns.delete(key);
    if (val.blocked && val.blockedUntil && now > val.blockedUntil) ipPatterns.delete(key);
  }
  // Clean expired failed auths
  const authKeys = Array.from(failedAuths.keys());
  for (const key of authKeys) {
    const val = failedAuths.get(key)!;
    if (now > val.resetAt) failedAuths.delete(key);
  }
}, 5 * 60 * 1000);
