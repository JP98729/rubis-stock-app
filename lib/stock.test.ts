import { describe, expect, it } from "vitest";
import { computeStoreStock, computeMonthlySalesLeaderboard, type StockProduct } from "./stock";

const products: StockProduct[] = [
  { sku: "A", barcode: "", range: "Classic Range", flavour: "Alpha", price: 100, target: 12, unavailable: false },
  { sku: "B", barcode: "", range: "Classic Range", flavour: "Beta", price: 50, target: 4, unavailable: false },
  { sku: "C", barcode: "", range: "Classic Range", flavour: "Gamma", price: 60, target: 12, unavailable: true },
];

const row = (result: ReturnType<typeof computeStoreStock>, sku: string) => result.rows.find((r) => r.sku === sku)!;

describe("computeStoreStock", () => {
  it("reports no stocktake and full reorder to target when the branch has never been counted", () => {
    const res = computeStoreStock(products, [], []);
    expect(res.hasStocktake).toBe(false);
    expect(res.lastStocktakeDate).toBeNull();
    expect(row(res, "A").current).toBe(0);
    expect(row(res, "A").reorder).toBe(12);
  });

  it("floors the effective target at MIN_STOCK even when the manager set a lower target", () => {
    // B's target is 4, below the 6-unit floor.
    const res = computeStoreStock(products, [], []);
    expect(row(res, "B").target).toBe(4);
    expect(row(res, "B").reorder).toBe(6);
  });

  it("never reorders a product that isn't currently made", () => {
    const res = computeStoreStock(products, [], []);
    expect(row(res, "C").reorder).toBe(0);
  });

  it("seeds from the latest stocktake and adds shelf + back stock", () => {
    const res = computeStoreStock(
      products,
      [
        {
          date: "2026-08-01",
          createdAt: "2026-08-01T10:00:00Z",
          items: [{ sku: "A", shelfQty: 5, backStock: 3, expired: 1, damaged: 0 }],
        },
      ],
      []
    );
    expect(res.hasStocktake).toBe(true);
    expect(res.lastStocktakeDate).toBe("2026-08-01");
    expect(row(res, "A").current).toBe(8);
    expect(row(res, "A").reorder).toBe(4);
    expect(row(res, "A").expired).toBe(1);
    expect(row(res, "A").belowMinimum).toBe(false);
  });

  it("prefers the newest visit date, breaking ties on createdAt", () => {
    const res = computeStoreStock(
      products,
      [
        {
          date: "2026-08-05",
          createdAt: "2026-08-05T08:00:00Z",
          items: [{ sku: "A", shelfQty: 1, backStock: 0, expired: 0, damaged: 0 }],
        },
        {
          // Same visit date, submitted later — this one wins.
          date: "2026-08-05",
          createdAt: "2026-08-05T18:00:00Z",
          items: [{ sku: "A", shelfQty: 9, backStock: 0, expired: 0, damaged: 0 }],
        },
        {
          date: "2026-07-01",
          createdAt: "2026-07-01T08:00:00Z",
          items: [{ sku: "A", shelfQty: 99, backStock: 0, expired: 0, damaged: 0 }],
        },
      ],
      []
    );
    expect(row(res, "A").current).toBe(9);
  });

  it("replays movements dated on or after the stocktake, and ignores earlier ones", () => {
    const res = computeStoreStock(
      products,
      [
        {
          date: "2026-08-10",
          createdAt: "2026-08-10T09:00:00Z",
          items: [{ sku: "A", shelfQty: 10, backStock: 0, expired: 0, damaged: 0 }],
        },
      ],
      [
        { sku: "A", type: "SALE", qty: 4, date: "2026-08-11" },
        { sku: "A", type: "DELIVERY", qty: 6, date: "2026-08-12" },
        { sku: "A", type: "RETURN", qty: 1, date: "2026-08-12" },
        { sku: "A", type: "EXPIRED_DAMAGED", qty: 2, date: "2026-08-13" },
        // Dated before the stocktake — already reflected in the count, so ignored.
        { sku: "A", type: "SALE", qty: 100, date: "2026-08-01" },
      ]
    );
    expect(row(res, "A").current).toBe(11); // 10 - 4 + 6 + 1 - 2
  });

  it("clamps a negative shelf position to zero and flags below-minimum", () => {
    const res = computeStoreStock(
      products,
      [
        {
          date: "2026-08-10",
          createdAt: "2026-08-10T09:00:00Z",
          items: [{ sku: "A", shelfQty: 2, backStock: 0, expired: 0, damaged: 0 }],
        },
      ],
      [{ sku: "A", type: "SALE", qty: 50, date: "2026-08-11" }]
    );
    expect(row(res, "A").current).toBe(0);
    expect(row(res, "A").belowMinimum).toBe(true);
    expect(row(res, "A").reorder).toBe(12);
  });
});

describe("computeMonthlySalesLeaderboard", () => {
  it("sums sales per store for the month and sorts by value", () => {
    const board = computeMonthlySalesLeaderboard(
      [
        { storeId: 1, sku: "A", type: "SALE", qty: 3, date: "2026-08-02" },
        { storeId: 2, sku: "B", type: "SALE", qty: 10, date: "2026-08-04" },
        { storeId: 1, sku: "B", type: "SALE", qty: 2, date: "2026-08-09" },
        // Wrong month and wrong movement type — both excluded.
        { storeId: 1, sku: "A", type: "SALE", qty: 99, date: "2026-07-31" },
        { storeId: 2, sku: "A", type: "DELIVERY", qty: 99, date: "2026-08-05" },
      ],
      { A: 100, B: 50 },
      "2026-08"
    );
    expect(board).toEqual([
      { storeId: 1, units: 5, value: 400 },
      { storeId: 2, units: 10, value: 500 },
    ].sort((a, b) => b.value - a.value));
    expect(board[0].storeId).toBe(2);
  });
});
