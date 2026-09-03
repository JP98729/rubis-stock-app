import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";
import { renderPhotoAsPdf } from "@/lib/pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Delivery notes are real documents, not compressed capture photos — allow a bit more room. */
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Public — the courier has no account in this app. Gated only by needing a real,
 * existing dispatch id (an unguessable cuid from their email link), same trust
 * model as the courier server actions in app/actions/courier.ts.
 */
export async function POST(request: Request) {
  let dispatchId: string;
  let dataUrl: string;
  try {
    const body = (await request.json()) as { dispatchId?: unknown; dataUrl?: unknown };
    if (typeof body.dispatchId !== "string" || typeof body.dataUrl !== "string") throw new Error("bad body");
    dispatchId = body.dispatchId;
    dataUrl = body.dataUrl;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body with dispatchId and dataUrl fields." }, { status: 400 });
  }

  const dispatch = await prisma.courierDispatch.findUnique({ where: { id: dispatchId }, select: { id: true } });
  if (!dispatch) return NextResponse.json({ error: "This dispatch link is invalid." }, { status: 404 });

  const m = /^data:(application\/pdf|image\/(?:jpeg|png|webp));base64,(.+)$/s.exec(dataUrl);
  if (!m) return NextResponse.json({ error: "Only PDF, JPEG, PNG, or WebP files are accepted." }, { status: 400 });

  const contentType = m[1];
  let buffer = Buffer.from(m[2], "base64");
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "That file is too large (8MB max)." }, { status: 413 });
  }

  // Waybills and delivery notes must be received as PDFs — a photo (jpeg/png) gets
  // wrapped into a one-page PDF here. webp isn't supported by the PDF renderer, so
  // it's left as-is rather than failing the upload.
  let finalContentType = contentType;
  if (contentType === "image/jpeg" || contentType === "image/png") {
    try {
      buffer = Buffer.from(await renderPhotoAsPdf(buffer));
      finalContentType = "application/pdf";
    } catch {
      // Fall back to the original photo if PDF conversion fails for any reason.
    }
  }

  const ext =
    finalContentType === "application/pdf" ? "pdf" : finalContentType === "image/png" ? "png" : finalContentType === "image/webp" ? "webp" : "jpg";
  try {
    const url = await uploadFile(buffer, `delivery-note.${ext}`, finalContentType);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: "Upload failed: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }
}
