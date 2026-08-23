import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import { localUploadPath } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Serves files written by the local-dev fallback in lib/storage.ts.
 * In production BLOB_READ_WRITE_TOKEN is set, uploads go to Vercel Blob, and nothing
 * ever points at this route.
 */
export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await context.params;
  const name = segments.join("/");
  // localUploadPath basenames the input, so traversal outside the directory is impossible.
  const file = localUploadPath(name);

  try {
    const data = await fs.readFile(file);
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
