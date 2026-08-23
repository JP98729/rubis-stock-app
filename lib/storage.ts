import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const LOCAL_DIR = path.join(process.cwd(), ".local-uploads");

/**
 * Single upload entry point for photos and signatures.
 *
 * - Production (BLOB_READ_WRITE_TOKEN set, injected automatically by Vercel once a
 *   Blob store is attached): uploads via @vercel/blob and returns the public URL.
 * - Local dev (no token): writes into a gitignored ./.local-uploads/ directory and
 *   returns a /local-uploads/<name> URL served by app/local-uploads/[...path]/route.ts.
 */
export async function uploadFile(
  data: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const safeName = sanitize(filename);
  const unique = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}-${safeName}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const result = await put(`rubis/${unique}`, data, {
      access: "public",
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return result.url;
  }

  await fs.mkdir(LOCAL_DIR, { recursive: true });
  await fs.writeFile(path.join(LOCAL_DIR, unique), data);
  return `/local-uploads/${unique}`;
}

/**
 * Accepts either a browser File (from a FormData submission) or a data: URL and
 * pushes it through uploadFile. Returns null for empty input.
 */
export async function uploadFromFormValue(value: FormDataEntryValue | null): Promise<string | null> {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Already an uploaded URL — pass it through untouched.
    if (trimmed.startsWith("/local-uploads/") || trimmed.startsWith("http")) return trimmed;
    const m = /^data:([^;,]+);base64,(.+)$/s.exec(trimmed);
    if (!m) return null;
    const contentType = m[1];
    const buffer = Buffer.from(m[2], "base64");
    const ext = contentType === "image/png" ? "png" : "jpg";
    return uploadFile(buffer, `upload.${ext}`, contentType);
  }

  const file = value as File;
  if (!file.size) return null;
  const buffer = Buffer.from(await file.arrayBuffer());
  return uploadFile(buffer, file.name || "upload.jpg", file.type || "image/jpeg");
}

export function localUploadPath(name: string): string {
  return path.join(LOCAL_DIR, sanitize(name));
}

function sanitize(name: string): string {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "upload";
}
