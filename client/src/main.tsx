import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, httpLink, splitLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  // Redirect to local login page instead of Manus OAuth
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});
// Shared headers function for auth - ALWAYS uses Bearer token from localStorage.
// No cookies. No complexity. Works everywhere including iOS PWA.
function getAuthHeaders() {
  try {
    const token = localStorage.getItem("manus-auth-token");
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  } catch {
    // storage unavailable
  }
  return {};
}

// Custom fetch with timeout and error handling
function createFetchWithTimeout(timeoutMs: number) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    return globalThis.fetch(input, {
      ...(init ?? {}),
      credentials: "include",
      signal: controller.signal,
    }).then(async (res) => {
      clearTimeout(timeout);
      // If server returns HTML instead of JSON (e.g. Cloud Run error page),
      // convert it to a proper error response that tRPC can parse
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok && !contentType.includes('application/json')) {
        const body = await res.text();
        console.error(`[API] Non-JSON error response (${res.status}):`, body.substring(0, 200));
        const errorBody = JSON.stringify({
          error: {
            message: res.status === 401 || res.status === 403
              ? 'Sessão expirada. Faça login novamente.'
              : `Erro de servidor (${res.status}). Tente novamente.`,
            code: res.status === 401 || res.status === 403 ? -32001 : -32603,
            data: { code: res.status === 401 ? 'UNAUTHORIZED' : 'INTERNAL_SERVER_ERROR', httpStatus: res.status },
          },
        });
        return new Response(errorBody, {
          status: res.status,
          headers: { 'content-type': 'application/json' },
        });
      }
      return res;
    }).catch((err) => {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        console.error('[API] Request timed out after', timeoutMs, 'ms');
        const errorBody = JSON.stringify({
          error: {
            message: 'Tempo limite excedido. Verifique sua conexão e tente novamente.',
            code: -32603,
            data: { code: 'TIMEOUT', httpStatus: 408 },
          },
        });
        return new Response(errorBody, {
          status: 408,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw err;
    });
  };
}

const trpcClient = trpc.createClient({
  links: [
    // Split mutations from queries to avoid batching issues
    // Mutations use httpLink (single request, no batching) with longer timeout
    // Queries use httpBatchLink (batched, efficient) with standard timeout
    splitLink({
      condition: (op) => op.type === 'mutation',
      true: httpLink({
        url: "/api/trpc",
        transformer: superjson,
        headers: getAuthHeaders,
        fetch: createFetchWithTimeout(180_000), // 3 min for mutations
      }),
      false: httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
        headers: getAuthHeaders,
        fetch: createFetchWithTimeout(60_000), // 1 min for queries
      }),
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);

// Unregister all service workers to prevent caching issues on iOS PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((reg) => {
      reg.unregister().catch(() => {});
    });
  }).catch(() => {});
}
