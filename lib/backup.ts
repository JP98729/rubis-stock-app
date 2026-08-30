import "server-only";
import { prisma } from "./prisma";
import { todayStr } from "./utils";

export const BACKUP_VERSION = 2;

/**
 * Full operational export. Deliberately excludes every secret: no role-code hashes,
 * no branch code hashes, no merchandiser codes. Unlike the original prototype's
 * backup, branches added after seeding DO round-trip.
 */
export type Backup = {
  version: number;
  exportedAt: string;
  stores: Array<{
    id: number;
    name: string;
    type: string;
    county: string;
    seedPhone: string;
    seedEmail: string;
    contactPhone: string | null;
    contactEmail: string | null;
    managerPhotoUrl: string | null;
    managerName: string | null;
    approvalStatus: string;
    approvalAt: string | null;
  }>;
  products: Array<{
    sku: string;
    barcode: string;
    range: string;
    flavour: string;
    price: number;
    target: number;
    unavailable: boolean;
  }>;
  merchandisers: Array<{ name: string; active: boolean }>;
  stocktakes: Array<{
    id: string;
    storeId: number;
    date: string;
    visitTime: string;
    merchandiser: string;
    idNumber: string;
    merchandiserPhone: string;
    kraPin: string;
    signatureUrl: string;
    notes: string;
    checksPlacement: string | null;
    checksPrices: string | null;
    checksMissing: string | null;
    checksPromotion: string | null;
    checksNotes: string;
    placementPhotoUrl: string | null;
    pricesPhotoUrl: string | null;
    promotionType: string;
    promotionPhotoUrl: string | null;
    competitorBrands: string;
    competitorPhotoUrl: string | null;
    competitorBrand1: string | null;
    competitorGram1: string | null;
    competitorDescription1: string | null;
    competitorPrice1: number | null;
    competitorPhotoUrl1: string | null;
    competitorBrand2: string | null;
    competitorGram2: string | null;
    competitorDescription2: string | null;
    competitorPrice2: number | null;
    competitorPhotoUrl2: string | null;
    competitorBrand3: string | null;
    competitorGram3: string | null;
    competitorDescription3: string | null;
    competitorPrice3: number | null;
    competitorPhotoUrl3: string | null;
    photoTaken: boolean;
    embedded: boolean;
    createdAt: string;
    items: Array<{
      sku: string;
      shelfQty: number;
      backStock: number;
      expired: number;
      damaged: number;
      batchCode: string;
      photoUrl: string | null;
    }>;
  }>;
  movements: Array<{
    id: string;
    storeId: number;
    sku: string;
    type: string;
    qty: number;
    date: string;
    batchCode: string;
    notes: string;
    createdAt: string;
  }>;
  messages: Array<{
    id: string;
    subject: string;
    body: string;
    audience: string;
    county: string | null;
    storeType: string | null;
    storeId: number | null;
    from: string;
    autoReminder: boolean;
    reminderMonth: string | null;
    createdAt: string;
  }>;
  monthlyRewards: Array<{ monthKey: string; note: string; sent: boolean }>;
};

export function backupFilename() {
  return `rubis-stock-backup-${todayStr()}.json`;
}

export async function buildBackup(): Promise<Backup> {
  const [stores, products, merchandisers, stocktakes, movements, messages, monthlyRewards] = await Promise.all([
    prisma.store.findMany({ orderBy: { id: "asc" } }),
    prisma.product.findMany({ orderBy: { sku: "asc" } }),
    prisma.merchandiser.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.stocktake.findMany({ orderBy: { createdAt: "asc" }, include: { items: true } }),
    prisma.movement.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.message.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.monthlyReward.findMany({ orderBy: { monthKey: "asc" } }),
  ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    stores: stores.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      county: s.county,
      seedPhone: s.seedPhone,
      seedEmail: s.seedEmail,
      contactPhone: s.contactPhone,
      contactEmail: s.contactEmail,
      managerPhotoUrl: s.managerPhotoUrl,
      managerName: s.managerName,
      approvalStatus: s.approvalStatus,
      approvalAt: s.approvalAt ? s.approvalAt.toISOString() : null,
    })),
    products: products.map((p) => ({
      sku: p.sku,
      barcode: p.barcode,
      range: p.range,
      flavour: p.flavour,
      price: p.price,
      target: p.target,
      unavailable: p.unavailable,
    })),
    merchandisers: merchandisers.map((m) => ({ name: m.name, active: m.active })),
    stocktakes: stocktakes.map((st) => ({
      id: st.id,
      storeId: st.storeId,
      date: st.date,
      visitTime: st.visitTime,
      merchandiser: st.merchandiser,
      idNumber: st.idNumber,
      merchandiserPhone: st.merchandiserPhone,
      kraPin: st.kraPin,
      signatureUrl: st.signatureUrl,
      notes: st.notes,
      checksPlacement: st.checksPlacement,
      checksPrices: st.checksPrices,
      checksMissing: st.checksMissing,
      checksPromotion: st.checksPromotion,
      checksNotes: st.checksNotes,
      placementPhotoUrl: st.placementPhotoUrl,
      pricesPhotoUrl: st.pricesPhotoUrl,
      promotionType: st.promotionType,
      promotionPhotoUrl: st.promotionPhotoUrl,
      competitorBrands: st.competitorBrands,
      competitorPhotoUrl: st.competitorPhotoUrl,
      competitorBrand1: st.competitorBrand1,
      competitorGram1: st.competitorGram1,
      competitorDescription1: st.competitorDescription1,
      competitorPrice1: st.competitorPrice1,
      competitorPhotoUrl1: st.competitorPhotoUrl1,
      competitorBrand2: st.competitorBrand2,
      competitorGram2: st.competitorGram2,
      competitorDescription2: st.competitorDescription2,
      competitorPrice2: st.competitorPrice2,
      competitorPhotoUrl2: st.competitorPhotoUrl2,
      competitorBrand3: st.competitorBrand3,
      competitorGram3: st.competitorGram3,
      competitorDescription3: st.competitorDescription3,
      competitorPrice3: st.competitorPrice3,
      competitorPhotoUrl3: st.competitorPhotoUrl3,
      photoTaken: st.photoTaken,
      embedded: st.embedded,
      createdAt: st.createdAt.toISOString(),
      items: st.items.map((i) => ({
        sku: i.sku,
        shelfQty: i.shelfQty,
        backStock: i.backStock,
        expired: i.expired,
        damaged: i.damaged,
        batchCode: i.batchCode,
        photoUrl: i.photoUrl,
      })),
    })),
    movements: movements.map((m) => ({
      id: m.id,
      storeId: m.storeId,
      sku: m.sku,
      type: m.type,
      qty: m.qty,
      date: m.date,
      batchCode: m.batchCode,
      notes: m.notes,
      createdAt: m.createdAt.toISOString(),
    })),
    messages: messages.map((m) => ({
      id: m.id,
      subject: m.subject,
      body: m.body,
      audience: m.audience,
      county: m.county,
      storeType: m.storeType,
      storeId: m.storeId,
      from: m.from,
      autoReminder: m.autoReminder,
      reminderMonth: m.reminderMonth,
      createdAt: m.createdAt.toISOString(),
    })),
    monthlyRewards: monthlyRewards.map((r) => ({ monthKey: r.monthKey, note: r.note, sent: r.sent })),
  };
}

/** Shape validation before anything touches the database. */
export function validateBackup(data: unknown): { ok: true; backup: Backup } | { ok: false; error: string } {
  if (typeof data !== "object" || data === null) return { ok: false, error: "That file isn't a backup." };
  const b = data as Partial<Backup>;
  if (typeof b.version !== "number") return { ok: false, error: "That file isn't a Rubis backup (no version field)." };
  if (b.version > BACKUP_VERSION)
    return { ok: false, error: `That backup was made by a newer version of the app (v${b.version}).` };

  const arrays: Array<[string, unknown]> = [
    ["stores", b.stores],
    ["products", b.products],
    ["merchandisers", b.merchandisers],
    ["stocktakes", b.stocktakes],
    ["movements", b.movements],
    ["messages", b.messages],
    ["monthlyRewards", b.monthlyRewards],
  ];
  for (const [name, value] of arrays) {
    if (value !== undefined && !Array.isArray(value)) return { ok: false, error: `Backup field "${name}" is malformed.` };
  }

  for (const s of b.stores ?? []) {
    if (typeof s?.id !== "number" || typeof s?.name !== "string")
      return { ok: false, error: "Backup contains a malformed branch record." };
  }
  for (const p of b.products ?? []) {
    if (typeof p?.sku !== "string" || typeof p?.price !== "number")
      return { ok: false, error: "Backup contains a malformed product record." };
  }
  for (const st of b.stocktakes ?? []) {
    if (typeof st?.storeId !== "number" || typeof st?.date !== "string" || !Array.isArray(st?.items))
      return { ok: false, error: "Backup contains a malformed stocktake record." };
  }
  for (const m of b.movements ?? []) {
    if (typeof m?.storeId !== "number" || typeof m?.sku !== "string" || typeof m?.qty !== "number")
      return { ok: false, error: "Backup contains a malformed movement record." };
  }

  return { ok: true, backup: { ...(b as Backup) } };
}
