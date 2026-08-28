import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { uploadFile } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** LPOs are real documents, not compressed capture photos — allow a bit more room. */
const MAX_BYTES = 8 * 1024 * 1024;

/** Branch managers upload their own LPO as a PDF or a photo of the paper document. */
export async function POST(request: Request) {
  const session = await requireRole("branch");
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let dataUrl: string;
  try {
    const body = (await request.json()) as { dataUrl?: unknown };
    if (typeof body.dataUrl !== "string") throw new Error("bad body");
    dataUrl = body.dataUrl;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body with a dataUrl field." }, { status: 400 });
  }

  const m = /^data:(application\/pdf|image\/(?:jpeg|png|webp));base64,(.+)$/s.exec(dataUrl);
  if (!m) return NextResponse.json({ error: "Only PDF, JPEG, PNG, or WebP files are accepted." }, { status: 400 });

  const contentType = m[1];
  const buffer = Buffer.from(m[2], "base64");
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "That file is too large (8MB max)." }, { status: 413 });
  }

  const ext = contentType === "application/pdf" ? "pdf" : contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  try {
    const url = await uploadFile(buffer, `lpo.${ext}`, contentType);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: "Upload failed: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }
}
