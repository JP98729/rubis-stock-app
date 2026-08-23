import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { buildBackup, backupFilename } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Manager-only JSON export of all operational data. Contains no codes or hashes. */
export async function GET() {
  const session = await requireRole("manager");
  if (!session) return new NextResponse("Not authorised", { status: 403 });

  const backup = await buildBackup();
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${backupFilename()}"`,
      "Cache-Control": "no-store",
    },
  });
}
