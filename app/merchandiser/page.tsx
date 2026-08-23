import { TopBar } from "@/components/top-bar";
import { MerchandiserLogin } from "@/components/login-forms";
import { MerchandiserView, type StorePickerRow } from "@/components/merchandiser-view";
import { requireRole } from "@/lib/session";
import {
  ensureMonthEndReminder,
  getAllStoreStock,
  getLeaderboard,
  getMonthlyReward,
  getProducts,
  getStores,
} from "@/lib/queries";
import { currentMonthKey, monthLabel, todayStr } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MerchandiserPage() {
  const session = await requireRole("merchandiser");
  if (!session) {
    return (
      <>
        <TopBar role={null} />
        <MerchandiserLogin />
      </>
    );
  }

  await ensureMonthEndReminder();

  const [products, stores] = await Promise.all([getProducts(), getStores()]);
  const stock = await getAllStoreStock(products);
  const monthKey = currentMonthKey();
  const [leaderboard, reward] = await Promise.all([
    getLeaderboard(monthKey, stores, products),
    getMonthlyReward(monthKey),
  ]);

  const rows: StorePickerRow[] = stores.map((store) => {
    const s = stock[store.id];
    return {
      store,
      hasStocktake: s.hasStocktake,
      outOfStock: s.hasStocktake && s.rows.some((r) => r.current === 0),
    };
  });

  return (
    <>
      <TopBar role="merchandiser" />
      <MerchandiserView
        rows={rows}
        products={products}
        today={todayStr()}
        merchName={session.merchName ?? ""}
        leaderboard={leaderboard}
        monthKey={monthKey}
        monthLabelText={monthLabel(monthKey)}
        reward={reward}
      />
    </>
  );
}
