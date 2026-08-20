/**
 * External Fallbacks — substitui serviços Manus no deploy externo
 */
import path from "path";
import fs from "fs";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export async function storagePutExternal(
  fileName: string, data: string | Buffer, contentType?: string
): Promise<{ key: string; url: string }> {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.join(UPLOAD_DIR, safeName);
  if (typeof data === "string") fs.writeFileSync(filePath, data, "utf-8");
  else fs.writeFileSync(filePath, data);
  return { key: safeName, url: `/uploads/${safeName}` };
}

export async function storageGetExternal(key: string): Promise<{ key: string; url: string }> {
  return { key, url: `/uploads/${key}` };
}

export function isExternalMode(): boolean {
  return process.env.EXTERNAL_MODE === "true";
}
