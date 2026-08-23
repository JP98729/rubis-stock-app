import { TopBar } from "@/components/top-bar";
import { BranchLogin } from "@/components/login-forms";
import { BranchManagerView } from "@/components/branch/branch-view";
import { requireRole } from "@/lib/session";
import {
  ensureMonthEndReminder,
  getLeaderboard,
  getMessagesForStore,
  getMonthlyReward,
  getProducts,
  getStore,
  getStoreStock,
  getStores,
} from "@/lib/queries";
import { audienceLabel, currentMonthKey, isLastDayOfMonth, monthLabel, todayStr } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BranchPage() {
  const session = await requireRole("branch");
  const store = session?.storeId ? await getStore(session.storeId) : null;

  if (!session || !store) {
    return (
      <>
        <TopBar role={null} />
        <BranchLogin />
      </>
    );
  }

  await ensureMonthEndReminder();

  const [products, stores] = await Promise.all([getProducts(), getStores()]);
  const stock = await getStoreStock(store.id, products);
  const monthKey = currentMonthKey();
  const [leaderboard, reward, msgs] = await Promise.all([
    getLeaderboard(monthKey, stores, products),
    getMonthlyReward(monthKey),
    getMessagesForStore(store),
  ]);

  const myRank = leaderboard.findIndex((r) => r.store.id === store.id);
  const today = todayStr();
  const needsMonthEndCount = isLastDayOfMonth() && stock.lastStocktakeDate !== today;

  const audienceLabels = Object.fromEntries(msgs.messages.map((m) => [m.id, audienceLabel(m, stores)]));

  return (
    <>
      <TopBar role="branch" />
      <BranchManagerView
        store={store}
        products={products}
        today={today}
        orderItems={stock.rows.filter((r) => r.reorder > 0)}
        hasStocktake={stock.hasStocktake}
        needsMonthEndCount={needsMonthEndCount}
        approvalStatus={store.approvalStatus}
        leaderboard={leaderboard}
        myRank={myRank}
        monthKey={monthKey}
        monthLabelText={monthLabel(monthKey)}
        reward={reward}
        messages={msgs.messages}
        recentCount={msgs.recentCount}
        audienceLabels={audienceLabels}
      />
    </>
  );
}
