import { TopBar } from "@/components/top-bar";
import { ManagerLogin } from "@/components/login-forms";
import { ManagerView } from "@/components/manager/manager-view";
import type {
  AlertItem,
  AlertsData,
  CheckItem,
  DashboardData,
  ProductionRow,
  StoreOrder,
  StoreTableRow,
} from "@/components/manager/types";
import { requireRole } from "@/lib/session";
import {
  ensureMonthEndReminder,
  getAllStoreStock,
  getCounts,
  getLatestChecksByStore,
  getLeaderboard,
  getMerchandisers,
  getMonthlyReward,
  getProducts,
  getRecentStocktakes,
  getStores,
} from "@/lib/queries";
import { currentMonthKey, monthLabel, todayStr } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ManagerPage() {
  const session = await requireRole("manager");
  if (!session) {
    return (
      <>
        <TopBar role={null} />
        <ManagerLogin />
      </>
    );
  }

  await ensureMonthEndReminder();

  const [products, stores] = await Promise.all([getProducts(), getStores()]);
  const stock = await getAllStoreStock(products);
  const monthKey = currentMonthKey();
  const [leaderboard, reward, recentStocktakes, counts, latestChecks, merchandisers] = await Promise.all([
    getLeaderboard(monthKey, stores, products),
    getMonthlyReward(monthKey),
    getRecentStocktakes(8),
    getCounts(),
    getLatestChecksByStore(),
    getMerchandisers(),
  ]);

  const withStock = stores.map((store) => ({ store, stock: stock[store.id] }));

  // ---------- Dashboard ----------
  const countyMap: Record<string, number> = {};
  for (const { store, stock: s } of withStock) {
    const val = s.rows.reduce((acc, r) => acc + r.reorder * r.price, 0);
    countyMap[store.county] = (countyMap[store.county] || 0) + val;
  }
  const dashboard: DashboardData = {
    totalBranches: stores.length,
    outOfStock: withStock.filter(({ stock: s }) => s.hasStocktake && s.rows.some((r) => r.current === 0)).length,
    needReorder: withStock.filter(({ stock: s }) => s.rows.some((r) => r.reorder > 0)).length,
    noStocktake: withStock.filter(({ stock: s }) => !s.hasStocktake).length,
    totalReorderUnits: withStock.reduce((sum, { stock: s }) => sum + s.rows.reduce((a, r) => a + r.reorder, 0), 0),
    totalReorderValue: withStock.reduce(
      (sum, { stock: s }) => sum + s.rows.reduce((a, r) => a + r.reorder * r.price, 0),
      0
    ),
    expiryFlags: withStock.filter(({ stock: s }) => s.rows.some((r) => r.expired > 0)).length,
    stocktakeCount: counts.stocktakes,
    movementCount: counts.movements,
    countyData: Object.entries(countyMap)
      .map(([county, value]) => ({ county, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
  };

  // ---------- Order summary ----------
  const orders: StoreOrder[] = withStock
    .filter(({ stock: s }) => s.rows.some((r) => r.reorder > 0))
    .map(({ store, stock: s }) => {
      const rows = s.rows.filter((r) => r.reorder > 0);
      return {
        store,
        rows,
        totalUnits: rows.reduce((a, r) => a + r.reorder, 0),
        totalValue: rows.reduce((a, r) => a + r.reorder * r.price, 0),
      };
    })
    .sort((a, b) => b.totalValue - a.totalValue);

  // ---------- Production plan ----------
  const prodMap = new Map<string, ProductionRow>(
    products.map((p) => [
      p.sku,
      { sku: p.sku, flavour: p.flavour, range: p.range, price: p.price, totalQty: 0, storesNeeding: 0 },
    ])
  );
  for (const { stock: s } of withStock) {
    for (const r of s.rows) {
      if (r.reorder > 0) {
        const row = prodMap.get(r.sku)!;
        row.totalQty += r.reorder;
        row.storesNeeding += 1;
      }
    }
  }
  const production = [...prodMap.values()].sort((a, b) => b.totalQty - a.totalQty);

  // ---------- Alerts ----------
  const item = (store: (typeof stores)[number], detail: string): AlertItem => ({
    storeId: store.id,
    storeName: store.name,
    county: store.county,
    detail,
  });
  const toCheckItem = (store: (typeof stores)[number]): CheckItem | null => {
    const c = latestChecks[store.id];
    if (!c) return null;
    return { ...c, storeId: store.id, storeName: store.name };
  };

  const alerts: AlertsData = {
    outOfStock: withStock
      .filter(({ stock: s }) => s.hasStocktake && s.rows.some((r) => r.current === 0))
      .map(({ store, stock: s }) =>
        item(
          store,
          s.rows
            .filter((r) => r.current === 0)
            .map((r) => r.flavour)
            .slice(0, 2)
            .join(", ")
        )
      ),
    belowMinimum: withStock
      .filter(({ stock: s }) => s.hasStocktake && s.rows.some((r) => r.belowMinimum && r.current > 0))
      .map(({ store, stock: s }) =>
        item(
          store,
          s.rows
            .filter((r) => r.belowMinimum && r.current > 0)
            .map((r) => `${r.flavour} (${r.current})`)
            .slice(0, 2)
            .join(", ")
        )
      ),
    expiry: withStock
      .filter(({ stock: s }) => s.rows.some((r) => r.expired > 0))
      .map(({ store, stock: s }) => item(store, s.rows.reduce((a, r) => a + (r.expired > 0 ? r.expired : 0), 0) + " units")),
    damaged: withStock
      .filter(({ stock: s }) => s.rows.some((r) => r.damaged > 0))
      .map(({ store, stock: s }) => item(store, s.rows.reduce((a, r) => a + (r.damaged > 0 ? r.damaged : 0), 0) + " units")),
    noStocktake: withStock.filter(({ stock: s }) => !s.hasStocktake).map(({ store }) => item(store, "awaiting first count")),
    displayIssues: stores
      .map(toCheckItem)
      .filter((c): c is CheckItem => !!c)
      .filter((c) => c.checksPlacement === "No" || c.checksPrices === "No" || c.checksMissing === "Yes"),
    competitorReports: stores
      .map(toCheckItem)
      .filter((c): c is CheckItem => !!c)
      .filter((c) => !!c.competitorBrands && c.competitorBrands.toLowerCase() !== "none"),
    activePromotions: stores
      .map(toCheckItem)
      .filter((c): c is CheckItem => !!c)
      .filter((c) => latestChecks[c.storeId]?.checksPromotion === "Yes"),
  };

  // ---------- Stores table ----------
  const storeRows: StoreTableRow[] = withStock.map(({ store, stock: s }) => ({
    store,
    lastStocktakeDate: s.lastStocktakeDate,
    hasStocktake: s.hasStocktake,
    outOfStock: s.hasStocktake && s.rows.some((r) => r.current === 0),
    needsReorder: s.rows.some((r) => r.reorder > 0),
  }));

  return (
    <>
      <TopBar role="manager" />
      <ManagerView
        today={todayStr()}
        dashboard={dashboard}
        recentStocktakes={recentStocktakes}
        leaderboard={leaderboard}
        monthKey={monthKey}
        monthLabelText={monthLabel(monthKey)}
        reward={reward}
        orders={orders}
        production={production}
        alerts={alerts}
        storeRows={storeRows}
        products={products}
        stores={stores}
        merchandisers={merchandisers.map((m) => ({ id: m.id, name: m.name, active: m.active }))}
      />
    </>
  );
}
