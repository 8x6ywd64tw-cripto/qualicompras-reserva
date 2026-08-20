/**
 * Service Wrapper — roteia para Manus ou fallbacks conforme EXTERNAL_MODE
 */
import { isExternalMode, storagePutExternal } from "./external-fallbacks";

export async function uploadFile(
  fileName: string, data: string | Buffer, contentType?: string
): Promise<{ key: string; url: string }> {
  if (isExternalMode()) return storagePutExternal(fileName, data, contentType);
  const { storagePut } = await import("./storage");
  return storagePut(fileName, data, contentType);
}

export function trySendEmail(emailInput: string): void {
  if (isExternalMode()) {
    console.log("[RESERVA] E-mail suprimido (modo reserva):", emailInput.substring(0, 80));
    return;
  }
  try {
    const { execSync } = require("child_process");
    execSync(`manus-mcp-cli tool call gmail_send_messages --server gmail --input '${emailInput.replace(/'/g, "'\\''")}'`, { timeout: 15000 });
  } catch (e) { console.error("[EMAIL] Falha:", e); }
}
