"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { genMerchCode, normalizeCode, storeCodeFor } from "@/lib/codes";
import type { RoleCodeType } from "@prisma/client";

export type SimpleResult = { ok: true } | { ok: false; error: string };
export type CodeResult = { ok: true; code: string } | { ok: false; error: string };

async function guard() {
  const session = await requireRole("manager");
  return !!session;
}

// ---------- Order approval ----------

export async function setApproval(storeId: number, status: "approved" | "pending"): Promise<SimpleResult> {
  if (!(await guard())) return { ok: false, error: "Your session expired — sign in again." };
  await prisma.store.update({
    where: { id: storeId },
    data: { approvalStatus: status, approvalAt: new Date() },
  });
  revalidatePath("/manager");
  revalidatePath("/branch");
  return { ok: true };
}

// ---------- Product targets ----------

export async function setTarget(sku: string, target: number): Promise<SimpleResult> {
  if (!(await guard())) return { ok: false, error: "Your session expired — sign in again." };
  const value = Math.max(0, Math.trunc(Number(target) || 0));
  await prisma.product.update({ where: { sku }, data: { target: value } });
  revalidatePath("/manager");
  revalidatePath("/branch");
  return { ok: true };
}

// ---------- Role codes ----------

export async function updateRoleCode(type: RoleCodeType, code: string): Promise<SimpleResult> {
  if (!(await guard())) return { ok: false, error: "Your session expired — sign in again." };
  const value = normalizeCode(code);
  if (!value) return { ok: false, error: "Enter a code first." };
  const codeHash = await bcrypt.hash(value, 10);
  await prisma.roleCode.upsert({ where: { type }, update: { codeHash }, create: { type, codeHash } });
  revalidatePath("/manager");
  return { ok: true };
}

// ---------- Merchandisers ----------

async function merchCodeTaken(code: string): Promise<boolean> {
  const all = await prisma.merchandiser.findMany({ select: { codeHash: true } });
  for (const m of all) if (await bcrypt.compare(code, m.codeHash)) return true;
  return false;
}

export async function addMerchandiser(name: string, customCode?: string): Promise<CodeResult> {
  if (!(await guard())) return { ok: false, error: "Your session expired — sign in again." };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Type a name first." };

  let code: string;
  if (customCode && customCode.trim()) {
    code = normalizeCode(customCode);
    if (await merchCodeTaken(code)) return { ok: false, error: "That code is already in use — pick a different one." };
  } else {
    code = await genMerchCode(merchCodeTaken);
  }

  await prisma.merchandiser.create({ data: { name: trimmed, codeHash: await bcrypt.hash(code, 10) } });
  revalidatePath("/manager");
  return { ok: true, code };
}

export async function regenerateMerchandiserCode(id: string): Promise<CodeResult> {
  if (!(await guard())) return { ok: false, error: "Your session expired — sign in again." };
  const code = await genMerchCode(merchCodeTaken);
  await prisma.merchandiser.update({ where: { id }, data: { codeHash: await bcrypt.hash(code, 10) } });
  revalidatePath("/manager");
  return { ok: true, code };
}

export async function removeMerchandiser(id: string): Promise<SimpleResult> {
  if (!(await guard())) return { ok: false, error: "Your session expired — sign in again." };
  await prisma.merchandiser.delete({ where: { id } }).catch(() => undefined);
  revalidatePath("/manager");
  return { ok: true };
}

/**
 * The original carried a half-built soft-delete: `active` existed and login filtered
 * on it, but nothing could toggle it. A working toggle is trivial and strictly better,
 * so it's wired up here.
 */
export async function setMerchandiserActive(id: string, active: boolean): Promise<SimpleResult> {
  if (!(await guard())) return { ok: false, error: "Your session expired — sign in again." };
  await prisma.merchandiser.update({ where: { id }, data: { active } });
  revalidatePath("/manager");
  return { ok: true };
}

// ---------- Monthly reward ----------

export async function setMonthlyReward(
  monthKey: string,
  info: { note?: string; sent?: boolean }
): Promise<SimpleResult> {
  if (!(await guard())) return { ok: false, error: "Your session expired — sign in again." };
  await prisma.monthlyReward.upsert({
    where: { monthKey },
    update: { ...(info.note !== undefined ? { note: info.note } : {}), ...(info.sent !== undefined ? { sent: info.sent } : {}) },
    create: { monthKey, note: info.note ?? "", sent: info.sent ?? false },
  });
  revalidatePath("/manager");
  revalidatePath("/branch");
  revalidatePath("/merchandiser");
  return { ok: true };
}

// ---------- Branches ----------

export async function addBranch(input: {
  name: string;
  type: string;
  county: string;
  phone: string;
  email: string;
}): Promise<CodeResult> {
  if (!(await guard())) return { ok: false, error: "Your session expired — sign in again." };
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Enter a branch name first." };
  const type = input.type === "CODO" ? "CODO" : "COCO";

  // Plain DB insert — the id (and therefore the RBxxx code) comes from the sequence.
  const created = await prisma.store.create({
    data: {
      name,
      type,
      county: input.county.trim() || "Unknown",
      seedPhone: input.phone.trim(),
      seedEmail: input.email.trim(),
      codeHash: "", // filled in below, once the id is known
    },
  });
  const code = storeCodeFor(created.id);
  await prisma.store.update({ where: { id: created.id }, data: { codeHash: await bcrypt.hash(code, 10) } });

  revalidatePath("/manager");
  return { ok: true, code };
}

// ---------- Diagnostics ----------

export type DbStatus = { ok: boolean; detail: string };

/**
 * Replaces the original's client-side window.storage probe: a live round-trip to the
 * database, reported as OK / error in Team Access.
 */
export async function checkDatabase(): Promise<DbStatus> {
  if (!(await guard())) return { ok: false, detail: "Your session expired — sign in again." };
  try {
    const started = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const [stores, products, stocktakes, movements] = await Promise.all([
      prisma.store.count(),
      prisma.product.count(),
      prisma.stocktake.count(),
      prisma.movement.count(),
    ]);
    return {
      ok: true,
      detail: `Database connection: OK (${Date.now() - started}ms)\n${stores} branches · ${products} products · ${stocktakes} stocktakes · ${movements} movements`,
    };
  } catch (e) {
    return { ok: false, detail: "Database connection: ERROR\n" + (e instanceof Error ? e.message : String(e)) };
  }
}
