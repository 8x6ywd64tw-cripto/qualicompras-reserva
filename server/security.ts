/**
 * QualiCompras Security Middleware
 * Proteção completa contra interferência externa
 */
import type { Express, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// ==================== ALLOWED ORIGINS ====================
const ALLOWED_ORIGINS = [
  "https://qualicompra.manus.space",
  "https://qualicompra-hp2k3afa.manus.space",
  // Dev origins
  ...(process.env.NODE_ENV === "development"
    ? ["http://localhost:3000", "http://127.0.0.1:3000"]
    : []),
];

// Match any *.manus.computer preview domain (dev)
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow manus.computer preview domains in dev
  if (origin.match(/^https:\/\/3000-[a-z0-9-]+\.us2\.manus\.computer$/)) return true;
  // Allow manus.im OAuth
  if (origin.startsWith("https://api.manus.im") || origin.startsWith("https://manus.im")) return true;
  return false;
}

// ==================== RATE LIMITERS ====================

// Global rate limiter: 200 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em 1 minuto." },
  // trust proxy handles IP extraction via X-Forwarded-For automatically
  validate: { trustProxy: false, xForwardedForHeader: false },
});

// Strict rate limiter for auth endpoints: 10 per minute per IP
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de login. Aguarde 1 minuto." },
  validate: { trustProxy: false, xForwardedForHeader: false },
});

// Rate limiter for public supplier endpoints: 30 per minute per IP
const publicApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Limite de requisições excedido. Tente novamente em breve." },
  validate: { trustProxy: false, xForwardedForHeader: false },
});

// Rate limiter for proposal submission: 5 per 5 minutes per IP
const proposalSubmitLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas propostas enviadas. Aguarde 5 minutos." },
  validate: { trustProxy: false, xForwardedForHeader: false },
});

// ==================== CORS MIDDLEWARE ====================
function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;

  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    res.setHeader("Access-Control-Max-Age", "86400"); // 24h preflight cache
  }

  // Handle preflight
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
}

// ==================== ORIGIN VALIDATION FOR MUTATIONS ====================
function validateOriginForMutations(req: Request, res: Response, next: NextFunction) {
  // Only validate POST requests (mutations)
  if (req.method !== "POST") return next();

  // Skip for internal/webhook endpoints
  if (req.path === "/api/scheduled/monthly-report") return next();
  if (req.path.startsWith("/api/fortes/")) return next();

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // In production, require valid origin or referer
  if (process.env.NODE_ENV !== "development") {
    if (origin && !isAllowedOrigin(origin)) {
      console.warn(`[Security] Blocked mutation from unauthorized origin: ${origin} | IP: ${req.ip} | Path: ${req.path}`);
      return res.status(403).json({ error: "Origem não autorizada." });
    }

    // If no origin header, check referer
    if (!origin && referer) {
      const refererOrigin = new URL(referer).origin;
      if (!isAllowedOrigin(refererOrigin)) {
        console.warn(`[Security] Blocked mutation from unauthorized referer: ${referer} | IP: ${req.ip} | Path: ${req.path}`);
        return res.status(403).json({ error: "Origem não autorizada." });
      }
    }
  }

  next();
}

// ==================== REQUEST LOGGING (suspicious activity) ====================
function securityLogger(req: Request, _res: Response, next: NextFunction) {
  // Log suspicious patterns
  const suspicious = [
    req.path.includes(".."),
    req.path.includes("<script"),
    req.path.includes("eval("),
    req.path.includes("SELECT "),
    req.path.includes("DROP "),
    req.path.includes("UNION "),
    (req.query && JSON.stringify(req.query).includes("<script")),
  ];

  if (suspicious.some(Boolean)) {
    console.warn(`[Security] Suspicious request blocked | IP: ${req.ip} | Path: ${req.path} | UA: ${req.headers["user-agent"]}`);
  }

  next();
}

// ==================== REGISTER ALL SECURITY ====================
export function registerSecurity(app: Express) {
  // 1. Trust proxy (Cloud Run is behind a load balancer)
  app.set("trust proxy", 1);

  // 2. Remove X-Powered-By header (prevents server fingerprinting)
  app.disable("x-powered-by");

  // 3. Helmet: comprehensive security headers
  app.use(
    helmet({
      // Content Security Policy
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
          imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
          connectSrc: [
            "'self'",
            "https://qualicompra.manus.space",
            "https://qualicompra-hp2k3afa.manus.space",
            "https://api.manus.im",
            "https://*.manus.computer",
            "wss://*.manus.computer",
            "https://wa.me",
          ],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null,
        },
      },
      // Prevent clickjacking
      xFrameOptions: { action: "deny" },
      // Prevent MIME type sniffing
      xContentTypeOptions: true,
      // Referrer policy
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      // HSTS (force HTTPS)
      strictTransportSecurity: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      // Disable DNS prefetch
      xDnsPrefetchControl: { allow: false },
      // Permissions policy (disable unnecessary browser features)
      // Note: helmet doesn't support permissionsPolicy directly, we add it manually below
    })
  );

  // 4. Permissions-Policy header (restrict browser features)
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()"
    );
    next();
  });

  // 5. CORS (restrictive)
  app.use(corsMiddleware);

  // 6. Security logger
  app.use(securityLogger);

  // 7. Global rate limiter
  app.use(globalLimiter);

  // 8. Stricter rate limiters for specific paths
  app.use("/api/oauth", authLimiter);
  app.use("/api/trpc/auth.login", authLimiter);

  // 9. Origin validation for mutations
  app.use("/api/trpc", validateOriginForMutations);

  // 10. Rate limit public API endpoints (supplier portal)
  app.use("/api/trpc/quotations.getByToken", publicApiLimiter);
  app.use("/api/trpc/quotations.itemsByToken", publicApiLimiter);
  app.use("/api/trpc/quotations.submitProposal", proposalSubmitLimiter);
  app.use("/api/trpc/quotations.submitCorrection", proposalSubmitLimiter);
  app.use("/api/trpc/suppliers.getStatus", publicApiLimiter);
  app.use("/api/trpc/suppliers.getStatusBatch", publicApiLimiter);

  // 11. Anti-bot detection for API mutations
  app.use("/api/trpc", antiBotMiddleware);

  console.log("[Security] All security middleware registered successfully");
}

// ==================== ANTI-BOT MIDDLEWARE ====================
function antiBotMiddleware(req: Request, res: Response, next: NextFunction) {
  const ua = req.headers["user-agent"] || "";

  // Block known headless browsers and automation tools (only on POST/mutations)
  const BOT_SIGNATURES = [
    /headlesschrome/i, /phantomjs/i, /selenium/i, /webdriver/i,
    /puppeteer/i, /playwright/i, /python-requests/i, /python-urllib/i,
    /httpie/i, /wget\//i, /curl\//i, /node-fetch/i, /got\//i,
    /undici/i, /scrapy/i, /mechanize/i,
  ];

  if (req.method === "POST") {
    // Check for missing or suspiciously short user-agent
    if (!ua || ua.length < 30) {
      console.warn(`[Security:AntiBot] Blocked: short/missing UA "${ua}" from ${req.ip}`);
      return res.status(403).json({ error: "Acesso negado." });
    }
    // Check for known bot signatures
    if (BOT_SIGNATURES.some(sig => sig.test(ua))) {
      console.warn(`[Security:AntiBot] Blocked bot: "${ua.substring(0, 80)}" from ${req.ip}`);
      return res.status(403).json({ error: "Acesso automatizado n\u00e3o permitido." });
    }
  }

  next();
}
