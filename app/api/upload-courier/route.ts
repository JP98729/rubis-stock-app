import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";

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
  const buffer = Buffer.from(m[2], "base64");
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "That file is too large (8MB max)." }, { status: 413 });
  }

  const ext =
    contentType === "application/pdf" ? "pdf" : contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  try {
    const url = await uploadFile(buffer, `delivery-note.${ext}`, contentType);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: "Upload failed: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }
}
