import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { uploadFile } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Max accepted upload — client-side compression keeps real photos far below this; scanned PDFs need more room. */
const MAX_BYTES = 6 * 1024 * 1024;

/**
 * Photos and signatures are compressed in the browser to a small JPEG/PNG data URL,
 * then pushed through here so the DB only ever stores a URL. A scanned document
 * (e.g. a delivery note picked via "Scan / choose file") can also come through
 * as an uncompressed PDF.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let dataUrl: string;
  try {
    const body = (await request.json()) as { dataUrl?: unknown };
    if (typeof body.dataUrl !== "string") throw new Error("bad body");
    dataUrl = body.dataUrl;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body with a dataUrl field." }, { status: 400 });
  }

  const m = /^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,(.+)$/s.exec(dataUrl);
  if (!m) return NextResponse.json({ error: "Only JPEG/PNG/WebP images or PDF files are accepted." }, { status: 400 });

  const contentType = m[1];
  const buffer = Buffer.from(m[2], "base64");
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "That file is too large." }, { status: 413 });
  }

  const ext =
    contentType === "application/pdf" ? "pdf" : contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  try {
    const url = await uploadFile(buffer, `capture.${ext}`, contentType);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: "Upload failed: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }
}
