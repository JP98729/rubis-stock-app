import { TopBar } from "@/components/top-bar";
import { HqLogin } from "@/components/login-forms";
import { HqView } from "@/components/hq-view";
import { requireRole } from "@/lib/session";
import { ensureMonthEndReminder, getAllMessages, getStores } from "@/lib/queries";
import { audienceLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HqPage() {
  const session = await requireRole("hq");
  if (!session) {
    return (
      <>
        <TopBar role={null} />
        <HqLogin />
      </>
    );
  }

  await ensureMonthEndReminder();

  const [stores, messages] = await Promise.all([getStores(), getAllMessages()]);
  const counties = [...new Set(stores.map((s) => s.county))].sort();
  const audienceLabels = Object.fromEntries(messages.map((m) => [m.id, audienceLabel(m, stores)]));

  return (
    <>
      <TopBar role="hq" />
      <HqView messages={messages} stores={stores} counties={counties} audienceLabels={audienceLabels} />
    </>
  );
}
