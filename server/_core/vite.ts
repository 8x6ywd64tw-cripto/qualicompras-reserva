import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

    // Static assets (JS/CSS with hashes) can be cached long-term
  app.use(express.static(distPath, {
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, filePath) => {
      // HTML and SW files must never be cached
      if (filePath.endsWith('.html') || filePath.endsWith('sw.js')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    },
  }));
  // fall through to index.html if the file doesn't exist
  // Inject session token into HTML so PWA clients (which may have old cached JS)
  // can bootstrap auth from the token embedded in the page.
  app.use("*", (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Check if the request has a session cookie
    const cookieHeader = req.headers.cookie || '';
    const cookieMatch = cookieHeader.match(/app_session_id=([^;]+)/);
    const sessionToken = cookieMatch ? cookieMatch[1] : null;
    
    if (sessionToken) {
      // Read index.html and inject token bootstrap script
      const indexPath = path.resolve(distPath, "index.html");
      let html = fs.readFileSync(indexPath, 'utf-8');
      const injectScript = `<script>try{localStorage.setItem('manus-auth-token','${sessionToken}');sessionStorage.setItem('manus-cookie','app_session_id=${sessionToken}')}catch(e){}</script>`;
      html = html.replace('</head>', `${injectScript}\n</head>`);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } else {
      res.sendFile(path.resolve(distPath, "index.html"));
    }
  });
}
