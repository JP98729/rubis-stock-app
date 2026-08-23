import { MIN_STOCK } from "./brand";

export type MovementTypeName = "DELIVERY" | "SALE" | "RETURN" | "EXPIRED_DAMAGED";

export type StockProduct = {
  sku: string;
  barcode: string;
  range: string;
  flavour: string;
  price: number;
  target: number;
  unavailable: boolean;
};

export type StockStocktakeItem = {
  sku: string;
  shelfQty: number;
  backStock: number;
  expired: number;
  damaged: number;
};

export type StockStocktake = {
  /** "YYYY-MM-DD" visit date. */
  date: string;
  /** Used only to break ties between two stocktakes carrying the same visit date. */
  createdAt: Date | string;
  items: StockStocktakeItem[];
};

export type StockMovement = {
  sku: string;
  type: MovementTypeName;
  qty: number;
  date: string;
};

export type StockRow = StockProduct & {
  current: number;
  shelf: number;
  back: number;
  expired: number;
  damaged: number;
  reorder: number;
  belowMinimum: boolean;
  stocktakeDate: string | null;
};

export type StoreStock = {
  rows: StockRow[];
  lastStocktakeDate: string | null;
  hasStocktake: boolean;
};

const EARLIEST = "0000-00-00";

/**
 * Derives a branch's current stock position.
 *
 * Seeds each SKU from the branch's latest stocktake (visit date desc, ties broken by
 * createdAt desc — a small correctness improvement over the original's string-only
 * sort), then replays every movement dated on or after that stocktake's date.
 *
 * `stocktakes` and `movements` must already be filtered to a single store.
 */
export function computeStoreStock(
  products: StockProduct[],
  stocktakes: StockStocktake[],
  movements: StockMovement[]
): StoreStock {
  const sorted = [...stocktakes].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    const at = new Date(a.createdAt).getTime();
    const bt = new Date(b.createdAt).getTime();
    return bt - at;
  });
  const latest = sorted[0];

  const stock: Record<
    string,
    { shelf: number; back: number; expired: number; damaged: number; stocktakeDate: string | null }
  > = {};
  products.forEach((p) => {
    stock[p.sku] = { shelf: 0, back: 0, expired: 0, damaged: 0, stocktakeDate: null };
  });

  if (latest) {
    latest.items.forEach((it) => {
      if (!stock[it.sku]) return; // SKU no longer in the catalogue — ignore, same as the original
      stock[it.sku] = {
        shelf: it.shelfQty || 0,
        back: it.backStock || 0,
        expired: it.expired || 0,
        damaged: it.damaged || 0,
        stocktakeDate: latest.date,
      };
    });
  }

  // Apply every movement on/after the latest stocktake date.
  const cutoff = latest ? latest.date : EARLIEST;
  movements
    .filter((m) => m.date >= cutoff)
    .forEach((m) => {
      const s = stock[m.sku];
      if (!s) return;
      const qty = Number(m.qty) || 0;
      if (m.type === "DELIVERY") s.shelf += qty;
      if (m.type === "SALE") s.shelf -= qty;
      if (m.type === "RETURN") s.shelf += qty;
      if (m.type === "EXPIRED_DAMAGED") s.shelf -= qty;
    });

  const rows: StockRow[] = products.map((p) => {
    const s = stock[p.sku];
    const current = Math.max(0, s.shelf || 0) + Math.max(0, s.back || 0);
    const target = p.target;
    const effectiveTarget = Math.max(target, MIN_STOCK);
    const reorder = p.unavailable ? 0 : Math.max(0, effectiveTarget - current);
    const belowMinimum = current < MIN_STOCK;
    return {
      ...p,
      current,
      shelf: s.shelf,
      back: s.back,
      expired: s.expired,
      damaged: s.damaged,
      target,
      reorder,
      belowMinimum,
      stocktakeDate: s.stocktakeDate,
    };
  });

  return {
    rows,
    lastStocktakeDate: latest ? latest.date : null,
    hasStocktake: !!latest,
  };
}

// ---------- Monthly sales leaderboard ----------

export type LeaderboardRow = {
  storeId: number;
  units: number;
  value: number;
};

/** "YYYY-MM" from an ISO date string. */
export function monthKeyOf(dateStr: string): string {
  return (dateStr || "").slice(0, 7);
}

/**
 * Sums Sale movements per store for one month, sorted by value desc.
 * `movements` may span every store.
 */
export function computeMonthlySalesLeaderboard(
  movements: Array<StockMovement & { storeId: number }>,
  priceBySku: Record<string, number>,
  monthKey: string
): LeaderboardRow[] {
  const byStore: Record<number, { units: number; value: number }> = {};
  movements
    .filter((m) => m.type === "SALE" && monthKeyOf(m.date) === monthKey)
    .forEach((m) => {
      const bucket = (byStore[m.storeId] ||= { units: 0, value: 0 });
      const qty = Number(m.qty) || 0;
      bucket.units += qty;
      bucket.value += qty * (priceBySku[m.sku] || 0);
    });
  return Object.entries(byStore)
    .map(([storeId, v]) => ({ storeId: Number(storeId), ...v }))
    .sort((a, b) => b.value - a.value);
}
