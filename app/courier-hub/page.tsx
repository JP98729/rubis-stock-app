import { TopBar } from "@/components/top-bar";
import { CourierLogin } from "@/components/login-forms";
import { CourierHubView } from "@/components/courier/courier-hub-view";
import { requireRole } from "@/lib/session";
import { getCourierDispatchesForScope } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function CourierHubPage() {
  const session = await requireRole("courier");
  if (!session) {
    return (
      <>
        <TopBar role={null} />
        <CourierLogin />
      </>
    );
  }

  const isNairobi = session.courierScope === "nairobi";
  const { needsAction, completed } = await getCourierDispatchesForScope(isNairobi);

  return (
    <>
      <TopBar role="courier" />
      <CourierHubView isNairobi={isNairobi} needsAction={needsAction} completed={completed} />
    </>
  );
}
