import "server-only";
import { prisma } from "./prisma";
import { RANGES } from "./brand";
import { storeCodeFor } from "./codes";
import {
  computeStoreStock,
  computeMonthlySalesLeaderboard,
  type StockProduct,
  type StoreStock,
  type MovementTypeName,
} from "./stock";
import { currentMonthKey, isLastDayOfMonth, timeAgo, todayStr, messageAppliesToStore } from "./utils";

export type ProductDTO = StockProduct;

export type StoreDTO = {
  id: number;
  name: string;
  type: string;
  county: string;
  /** Effective contact details — branch-manager override wins over the seed value. */
  phone: string;
  email: string;
  phoneOverridden: boolean;
  emailOverridden: boolean;
  managerPhotoUrl: string | null;
  managerName: string | null;
  approvalStatus: string;
  code: string;
  lastActive: string;
};

/** Catalogue order matching the original PRODUCTS array: range order, then SKU. */
export async function getProducts(): Promise<ProductDTO[]> {
  const rows = await prisma.product.findMany();
  return rows
    .map((p) => ({
      sku: p.sku,
      barcode: p.barcode,
      range: p.range,
      flavour: p.flavour,
      price: p.price,
      target: p.target,
      unavailable: p.unavailable,
    }))
    .sort((a, b) => {
      const ra = RANGES.indexOf(a.range);
      const rb = RANGES.indexOf(b.range);
      if (ra !== rb) return ra - rb;
      return a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0;
    });
}

export async function getStores(): Promise<StoreDTO[]> {
  const rows = await prisma.store.findMany({ orderBy: { id: "asc" } });
  return rows.map(toStoreDTO);
}

export async function getStore(id: number): Promise<StoreDTO | null> {
  const row = await prisma.store.findUnique({ where: { id } });
  return row ? toStoreDTO(row) : null;
}

export type LpoDocumentDTO = {
  id: string;
  url: string;
  filename: string;
  uploadedAt: string;
  odooSaleOrderName: string | null;
};

function toLpoDocumentDTO(r: {
  id: string;
  url: string;
  filename: string;
  uploadedAt: Date;
  odooSaleOrderName: string | null;
}): LpoDocumentDTO {
  return {
    id: r.id,
    url: r.url,
    filename: r.filename,
    uploadedAt: timeAgo(r.uploadedAt),
    odooSaleOrderName: r.odooSaleOrderName,
  };
}

/** A branch's own uploaded LPOs, newest first. */
export async function getLpoDocuments(storeId: number): Promise<LpoDocumentDTO[]> {
  const rows = await prisma.lpoDocument.findMany({ where: { storeId }, orderBy: { uploadedAt: "desc" } });
  return rows.map(toLpoDocumentDTO);
}

/** LPOs for every store in one query, grouped by storeId — used by the manager's Order Summary. */
export async function getLpoDocumentsByStore(): Promise<Record<number, LpoDocumentDTO[]>> {
  const rows = await prisma.lpoDocument.findMany({ orderBy: { uploadedAt: "desc" } });
  const byStore: Record<number, LpoDocumentDTO[]> = {};
  for (const r of rows) {
    (byStore[r.storeId] ??= []).push(toLpoDocumentDTO(r));
  }
  return byStore;
}

type StoreRow = {
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
  lastActiveAt: Date | null;
};

function toStoreDTO(s: StoreRow): StoreDTO {
  return {
    id: s.id,
    name: s.name,
    type: s.type,
    county: s.county,
    phone: s.contactPhone || s.seedPhone || "",
    email: s.contactEmail || s.seedEmail || "",
    phoneOverridden: !!s.contactPhone,
    emailOverridden: !!s.contactEmail,
    managerPhotoUrl: s.managerPhotoUrl,
    managerName: s.managerName,
    approvalStatus: s.approvalStatus,
    code: storeCodeFor(s.id),
    lastActive: s.lastActiveAt ? timeAgo(s.lastActiveAt) : "Never",
  };
}

/**
 * Computes the derived stock position for every branch in one pass:
 * latest stocktake per store (+ its items) replayed forward with movements.
 */
export async function getAllStoreStock(products: ProductDTO[]): Promise<Record<number, StoreStock>> {
  const [stores, stocktakes, movements] = await Promise.all([
    prisma.store.findMany({ select: { id: true }, orderBy: { id: "asc" } }),
    prisma.stocktake.findMany({
      select: { id: true, storeId: true, date: true, createdAt: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.movement.findMany({ select: { storeId: true, sku: true, type: true, qty: true, date: true } }),
  ]);

  const latestByStore = new Map<number, { id: string; date: string; createdAt: Date }>();
  for (const st of stocktakes) if (!latestByStore.has(st.storeId)) latestByStore.set(st.storeId, st);

  const latestIds = [...latestByStore.values()].map((s) => s.id);
  const items = latestIds.length
    ? await prisma.stocktakeItem.findMany({
        where: { stocktakeId: { in: latestIds } },
        select: { stocktakeId: true, sku: true, shelfQty: true, backStock: true, expired: true, damaged: true },
      })
    : [];
  const itemsByStocktake = new Map<string, typeof items>();
  for (const it of items) {
    const arr = itemsByStocktake.get(it.stocktakeId) ?? [];
    arr.push(it);
    itemsByStocktake.set(it.stocktakeId, arr);
  }

  const movementsByStore = new Map<number, Array<{ sku: string; type: MovementTypeName; qty: number; date: string }>>();
  for (const m of movements) {
    const arr = movementsByStore.get(m.storeId) ?? [];
    arr.push({ sku: m.sku, type: m.type as MovementTypeName, qty: m.qty, date: m.date });
    movementsByStore.set(m.storeId, arr);
  }

  const out: Record<number, StoreStock> = {};
  for (const s of stores) {
    const latest = latestByStore.get(s.id);
    out[s.id] = computeStoreStock(
      products,
      latest ? [{ date: latest.date, createdAt: latest.createdAt, items: itemsByStocktake.get(latest.id) ?? [] }] : [],
      movementsByStore.get(s.id) ?? []
    );
  }
  return out;
}

export async function getStoreStock(storeId: number, products: ProductDTO[]): Promise<StoreStock> {
  const latest = await prisma.stocktake.findFirst({
    where: { storeId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: {
      date: true,
      createdAt: true,
      items: { select: { sku: true, shelfQty: true, backStock: true, expired: true, damaged: true } },
    },
  });
  const movements = await prisma.movement.findMany({
    where: { storeId },
    select: { sku: true, type: true, qty: true, date: true },
  });
  return computeStoreStock(
    products,
    latest ? [{ date: latest.date, createdAt: latest.createdAt, items: latest.items }] : [],
    movements.map((m) => ({ sku: m.sku, type: m.type as MovementTypeName, qty: m.qty, date: m.date }))
  );
}

// ---------- Leaderboard & monthly reward ----------

export type LeaderboardEntry = { store: StoreDTO; units: number; value: number };

export async function getLeaderboard(monthKey: string, stores: StoreDTO[], products: ProductDTO[]) {
  const movements = await prisma.movement.findMany({
    where: { type: "SALE", date: { startsWith: monthKey } },
    select: { storeId: true, sku: true, type: true, qty: true, date: true },
  });
  const priceBySku = Object.fromEntries(products.map((p) => [p.sku, p.price]));
  const rows = computeMonthlySalesLeaderboard(
    movements.map((m) => ({ storeId: m.storeId, sku: m.sku, type: m.type as MovementTypeName, qty: m.qty, date: m.date })),
    priceBySku,
    monthKey
  );
  const byId = new Map(stores.map((s) => [s.id, s]));
  return rows
    .map((r) => ({ store: byId.get(r.storeId)!, units: r.units, value: r.value }))
    .filter((r) => !!r.store) as LeaderboardEntry[];
}

export async function getMonthlyReward(monthKey: string) {
  const row = await prisma.monthlyReward.findUnique({ where: { monthKey } });
  return { monthKey, note: row?.note ?? "", sent: row?.sent ?? false };
}

// ---------- Messages ----------

export type MessageDTO = {
  id: string;
  subject: string;
  body: string;
  audience: "ALL" | "COUNTY" | "TYPE" | "STORE";
  county: string | null;
  storeType: string | null;
  storeId: number | null;
  from: string;
  createdAtLabel: string;
  createdAtIso: string;
};

function toMessageDTO(m: {
  id: string;
  subject: string;
  body: string;
  audience: string;
  county: string | null;
  storeType: string | null;
  storeId: number | null;
  from: string;
  createdAt: Date;
}): MessageDTO {
  return {
    id: m.id,
    subject: m.subject,
    body: m.body,
    audience: m.audience as MessageDTO["audience"],
    county: m.county,
    storeType: m.storeType,
    storeId: m.storeId,
    from: m.from,
    // Rendered server-side so the relative label can't drift between server and client.
    createdAtLabel: timeAgo(m.createdAt),
    createdAtIso: m.createdAt.toISOString(),
  };
}

export async function getAllMessages(): Promise<MessageDTO[]> {
  const rows = await prisma.message.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(toMessageDTO);
}

export async function getMessagesForStore(store: StoreDTO): Promise<{ messages: MessageDTO[]; recentCount: number }> {
  const rows = await prisma.message.findMany({ orderBy: { createdAt: "desc" } });
  const applicable = rows.filter((m) =>
    messageAppliesToStore(
      { audience: m.audience as MessageDTO["audience"], county: m.county, storeType: m.storeType, storeId: m.storeId },
      store
    )
  );
  const recentCount = applicable.filter((m) => Date.now() - m.createdAt.getTime() < 7 * 86400000).length;
  return { messages: applicable.map(toMessageDTO), recentCount };
}

/**
 * Auto-posts the month-end stocktake reminder once per month, triggered by whoever
 * opens the app first on the last calendar day. Deduped by reminderMonth.
 */
export async function ensureMonthEndReminder(): Promise<void> {
  if (!isLastDayOfMonth()) return;
  const mk = currentMonthKey();
  const existing = await prisma.message.findFirst({ where: { autoReminder: true, reminderMonth: mk } });
  if (existing) return;
  try {
    await prisma.message.create({
      data: {
        subject: "Reminder: submit today's month-end stock count",
        body: "Today is the last day of the month. Please complete your stocktake before the day ends, so next month's order and delivery reflect what's actually on your shelf.",
        audience: "ALL",
        from: "Rubis Head Office (automated)",
        autoReminder: true,
        reminderMonth: mk,
      },
    });
  } catch {
    // A concurrent request won the race — harmless.
  }
}

// ---------- Alerts: latest stocktake with display checks, per store ----------

export type LatestCheckDTO = {
  storeId: number;
  date: string;
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
};

/** The single most recent stocktake per store that actually carried display checks. */
export async function getLatestChecksByStore(): Promise<Record<number, LatestCheckDTO>> {
  const rows = await prisma.stocktake.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: {
      storeId: true,
      date: true,
      checksPlacement: true,
      checksPrices: true,
      checksMissing: true,
      checksPromotion: true,
      checksNotes: true,
      placementPhotoUrl: true,
      pricesPhotoUrl: true,
      promotionType: true,
      promotionPhotoUrl: true,
      competitorBrands: true,
      competitorPhotoUrl: true,
    },
  });
  const out: Record<number, LatestCheckDTO> = {};
  const seen = new Set<number>();
  for (const r of rows) {
    // Only the latest stocktake per store counts — matching the original, checks are
    // never aggregated across visits.
    if (seen.has(r.storeId)) continue;
    seen.add(r.storeId);
    if (r.checksPlacement === null && r.checksPrices === null && r.checksMissing === null && r.checksPromotion === null)
      continue;
    out[r.storeId] = r;
  }
  return out;
}

export type RecentStocktakeDTO = {
  id: string;
  storeId: number;
  storeName: string;
  merchandiser: string;
  idNumber: string;
  date: string;
  signatureUrl: string;
  hasIssue: boolean;
};

export async function getRecentStocktakes(limit = 8): Promise<RecentStocktakeDTO[]> {
  const rows = await prisma.stocktake.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      storeId: true,
      merchandiser: true,
      idNumber: true,
      date: true,
      signatureUrl: true,
      checksPlacement: true,
      checksPrices: true,
      checksMissing: true,
      store: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    storeId: r.storeId,
    storeName: r.store.name,
    merchandiser: r.merchandiser,
    idNumber: r.idNumber,
    date: r.date,
    signatureUrl: r.signatureUrl,
    hasIssue: r.checksPlacement === "No" || r.checksPrices === "No" || r.checksMissing === "Yes",
  }));
}

export async function getCounts() {
  const [stocktakes, movements] = await Promise.all([prisma.stocktake.count(), prisma.movement.count()]);
  return { stocktakes, movements };
}

export async function getMerchandisers() {
  return prisma.merchandiser.findMany({ orderBy: { createdAt: "asc" } });
}

export { todayStr, currentMonthKey };
