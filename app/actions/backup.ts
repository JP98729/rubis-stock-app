"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { validateBackup } from "@/lib/backup";
import { genMerchCode, storeCodeFor } from "@/lib/codes";
import type { Audience, MovementType } from "@prisma/client";

export type RestoreResult =
  | { ok: true; summary: string; newMerchandiserCodes: Array<{ name: string; code: string }> }
  | { ok: false; error: string };

/**
 * Restores an exported backup. Everything runs inside one transaction, so a bad file
 * can never leave the database half-written.
 *
 * Additive-safe by design:
 *  - branches and products are upserted (existing rows are updated, never deleted)
 *  - stocktakes / movements / messages / rewards are inserted with skipDuplicates on id,
 *    so re-importing the same file twice does not double-count anything
 *  - rows referencing a branch or SKU that doesn't exist after the upserts are dropped
 *    rather than allowed to break referential integrity
 *  - merchandisers are matched by name; genuinely new ones get a fresh code, which is
 *    returned so the manager can pass it on (backups never contain codes)
 */
export async function restoreBackup(json: string): Promise<RestoreResult> {
  const session = await requireRole("manager");
  if (!session) return { ok: false, error: "Your session expired — sign in again." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "Couldn't read that backup file." };
  }

  const checked = validateBackup(parsed);
  if (!checked.ok) return { ok: false, error: checked.error };
  const backup = checked.backup;

  // Codes have to be hashed outside the transaction — bcrypt is slow and would hold it open.
  const storeCodeHashes = new Map<number, string>();
  for (const s of backup.stores ?? []) {
    storeCodeHashes.set(s.id, await bcrypt.hash(storeCodeFor(s.id), 10));
  }

  const existingMerch = await prisma.merchandiser.findMany({ select: { name: true } });
  const existingNames = new Set(existingMerch.map((m) => m.name));
  const newMerchandisers: Array<{ name: string; active: boolean; code: string; codeHash: string }> = [];
  const takenCodes = new Set<string>();
  for (const m of backup.merchandisers ?? []) {
    if (!m?.name || existingNames.has(m.name)) continue;
    existingNames.add(m.name);
    const code = await genMerchCode(async (c) => takenCodes.has(c));
    takenCodes.add(code);
    newMerchandisers.push({ name: m.name, active: m.active !== false, code, codeHash: await bcrypt.hash(code, 10) });
  }

  try {
    const summary = await prisma.$transaction(
      async (tx) => {
        for (const s of backup.stores ?? []) {
          await tx.store.upsert({
            where: { id: s.id },
            update: {
              name: s.name,
              type: s.type,
              county: s.county,
              seedPhone: s.seedPhone ?? "",
              seedEmail: s.seedEmail ?? "",
              contactPhone: s.contactPhone ?? null,
              contactEmail: s.contactEmail ?? null,
              managerPhotoUrl: s.managerPhotoUrl ?? null,
              managerName: s.managerName ?? null,
              approvalStatus: s.approvalStatus ?? "pending",
              approvalAt: s.approvalAt ? new Date(s.approvalAt) : null,
            },
            create: {
              id: s.id,
              name: s.name,
              type: s.type,
              county: s.county,
              seedPhone: s.seedPhone ?? "",
              seedEmail: s.seedEmail ?? "",
              codeHash: storeCodeHashes.get(s.id)!,
              contactPhone: s.contactPhone ?? null,
              contactEmail: s.contactEmail ?? null,
              managerPhotoUrl: s.managerPhotoUrl ?? null,
              managerName: s.managerName ?? null,
              approvalStatus: s.approvalStatus ?? "pending",
              approvalAt: s.approvalAt ? new Date(s.approvalAt) : null,
            },
          });
        }

        for (const p of backup.products ?? []) {
          await tx.product.upsert({
            where: { sku: p.sku },
            update: {
              barcode: p.barcode ?? "",
              range: p.range,
              flavour: p.flavour,
              price: p.price,
              target: p.target,
              unavailable: !!p.unavailable,
            },
            create: {
              sku: p.sku,
              barcode: p.barcode ?? "",
              range: p.range,
              flavour: p.flavour,
              price: p.price,
              target: p.target,
              unavailable: !!p.unavailable,
            },
          });
        }

        // Keep the id sequence ahead of any explicitly restored branch ids.
        const maxStore = await tx.store.aggregate({ _max: { id: true } });
        if (maxStore._max.id) {
          await tx.$executeRawUnsafe(
            `SELECT setval(pg_get_serial_sequence('"Store"', 'id'), ${maxStore._max.id}, true)`
          );
        }

        for (const m of newMerchandisers) {
          await tx.merchandiser.create({ data: { name: m.name, active: m.active, codeHash: m.codeHash } });
        }

        const storeIds = new Set((await tx.store.findMany({ select: { id: true } })).map((s) => s.id));
        const skus = new Set((await tx.product.findMany({ select: { sku: true } })).map((p) => p.sku));

        let stocktakesAdded = 0;
        for (const st of backup.stocktakes ?? []) {
          if (!storeIds.has(st.storeId)) continue;
          const exists = await tx.stocktake.findUnique({ where: { id: st.id }, select: { id: true } });
          if (exists) continue;
          await tx.stocktake.create({
            data: {
              id: st.id,
              storeId: st.storeId,
              date: st.date,
              visitTime: st.visitTime ?? "",
              merchandiser: st.merchandiser ?? "",
              idNumber: st.idNumber ?? "",
              signatureUrl: st.signatureUrl ?? "",
              notes: st.notes ?? "",
              checksPlacement: st.checksPlacement ?? null,
              checksPrices: st.checksPrices ?? null,
              checksMissing: st.checksMissing ?? null,
              checksPromotion: st.checksPromotion ?? null,
              checksNotes: st.checksNotes ?? "",
              placementPhotoUrl: st.placementPhotoUrl ?? null,
              pricesPhotoUrl: st.pricesPhotoUrl ?? null,
              promotionType: st.promotionType ?? "",
              promotionPhotoUrl: st.promotionPhotoUrl ?? null,
              competitorBrands: st.competitorBrands ?? "",
              competitorPhotoUrl: st.competitorPhotoUrl ?? null,
              competitorBrand1: st.competitorBrand1 ?? null,
              competitorGram1: st.competitorGram1 ?? null,
              competitorDescription1: st.competitorDescription1 ?? null,
              competitorPrice1: st.competitorPrice1 ?? null,
              competitorPhotoUrl1: st.competitorPhotoUrl1 ?? null,
              competitorBrand2: st.competitorBrand2 ?? null,
              competitorGram2: st.competitorGram2 ?? null,
              competitorDescription2: st.competitorDescription2 ?? null,
              competitorPrice2: st.competitorPrice2 ?? null,
              competitorPhotoUrl2: st.competitorPhotoUrl2 ?? null,
              competitorBrand3: st.competitorBrand3 ?? null,
              competitorGram3: st.competitorGram3 ?? null,
              competitorDescription3: st.competitorDescription3 ?? null,
              competitorPrice3: st.competitorPrice3 ?? null,
              competitorPhotoUrl3: st.competitorPhotoUrl3 ?? null,
              photoTaken: !!st.photoTaken,
              embedded: !!st.embedded,
              createdAt: st.createdAt ? new Date(st.createdAt) : undefined,
              items: {
                create: (st.items ?? [])
                  .filter((i) => skus.has(i.sku))
                  .map((i) => ({
                    sku: i.sku,
                    shelfQty: i.shelfQty ?? 0,
                    backStock: i.backStock ?? 0,
                    expired: i.expired ?? 0,
                    damaged: i.damaged ?? 0,
                    batchCode: i.batchCode ?? "",
                    photoUrl: i.photoUrl ?? null,
                  })),
              },
            },
          });
          stocktakesAdded++;
        }

        const movementRows = (backup.movements ?? [])
          .filter((m) => storeIds.has(m.storeId) && skus.has(m.sku))
          .map((m) => ({
            id: m.id,
            storeId: m.storeId,
            sku: m.sku,
            type: m.type as MovementType,
            qty: m.qty,
            date: m.date,
            batchCode: m.batchCode ?? "",
            notes: m.notes ?? "",
            createdAt: m.createdAt ? new Date(m.createdAt) : undefined,
          }));
        const movementsAdded = movementRows.length
          ? (await tx.movement.createMany({ data: movementRows, skipDuplicates: true })).count
          : 0;

        const messageRows = (backup.messages ?? [])
          .filter((m) => m.storeId === null || m.storeId === undefined || storeIds.has(m.storeId))
          .map((m) => ({
            id: m.id,
            subject: m.subject,
            body: m.body,
            audience: m.audience as Audience,
            county: m.county ?? null,
            storeType: m.storeType ?? null,
            storeId: m.storeId ?? null,
            from: m.from ?? "Rubis Head Office",
            autoReminder: !!m.autoReminder,
            reminderMonth: m.reminderMonth ?? null,
            createdAt: m.createdAt ? new Date(m.createdAt) : undefined,
          }));
        const messagesAdded = messageRows.length
          ? (await tx.message.createMany({ data: messageRows, skipDuplicates: true })).count
          : 0;

        for (const r of backup.monthlyRewards ?? []) {
          await tx.monthlyReward.upsert({
            where: { monthKey: r.monthKey },
            update: { note: r.note ?? "", sent: !!r.sent },
            create: { monthKey: r.monthKey, note: r.note ?? "", sent: !!r.sent },
          });
        }

        return (
          `Restored ${(backup.stores ?? []).length} branches, ${(backup.products ?? []).length} products, ` +
          `${stocktakesAdded} new stocktakes, ${movementsAdded} new movements, ${messagesAdded} new messages.`
        );
      },
      { timeout: 120_000, maxWait: 20_000 }
    );

    revalidatePath("/manager");
    revalidatePath("/branch");
    revalidatePath("/merchandiser");
    revalidatePath("/hq");
    return {
      ok: true,
      summary,
      newMerchandiserCodes: newMerchandisers.map((m) => ({ name: m.name, code: m.code })),
    };
  } catch (e) {
    return {
      ok: false,
      error: "Restore failed and nothing was changed: " + (e instanceof Error ? e.message : String(e)),
    };
  }
}
