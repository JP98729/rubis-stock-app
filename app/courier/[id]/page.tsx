import { prisma } from "@/lib/prisma";
import { CourierActions } from "@/components/courier/courier-actions";
import { RUBIS_LOGO, PURE_LOGO } from "@/lib/brand";
import { timeAgo } from "@/lib/utils";
import { PICKUP_ADDRESS } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Public page — no login. The dispatch id in the URL (an unguessable cuid from the
 * order email) is the courier's only credential, same trust model as a package
 * tracking link.
 */
export default async function CourierDispatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dispatch = await prisma.courierDispatch.findUnique({
    where: { id },
    include: { store: { select: { name: true, county: true, type: true, address: true, contactPhone: true, seedPhone: true } } },
  });

  if (!dispatch) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="font-bold text-lg mb-1">Link not found</div>
          <div className="text-sm text-gray-500">This dispatch link doesn&apos;t exist or has been removed.</div>
        </div>
      </div>
    );
  }

  const phone = dispatch.store.contactPhone || dispatch.store.seedPhone || "";
  // Rounds to 2 decimals and strips trailing zeros (avoids Odoo's raw floats like 47.67000000000001).
  const weightKg =
    dispatch.shippingWeightKg != null ? Math.round(dispatch.shippingWeightKg * 100) / 100 : null;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={RUBIS_LOGO} alt="Rubis" className="h-9 w-9 rounded-lg object-cover" />
        <div>
          <div className="font-bold text-sm">Rubis Enjoy — Courier</div>
          <div className="text-[11px] text-gray-400">CMB Bridge Logistics · Order ref {dispatch.orderRef}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PURE_LOGO} alt="Pure Nutrition" className="h-10 w-10 rounded-lg object-cover shrink-0" />
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400">📍 Collect from</div>
          <div className="text-sm text-gray-800 mt-0.5">{PICKUP_ADDRESS}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1">🏁 Deliver to</div>
        <div className="font-bold text-base">{dispatch.store.name.trim()}</div>
        <div className="text-xs text-gray-500 mt-0.5">
          {dispatch.store.county} · {dispatch.store.type}
        </div>
        {dispatch.store.address && <div className="text-xs text-gray-500 mt-1">{dispatch.store.address}</div>}
        {phone && <div className="text-xs text-gray-500 mt-1">{phone}</div>}
        {dispatch.odooSaleOrderName && (
          <div className="text-xs text-gray-500 mt-1">Odoo order: {dispatch.odooSaleOrderName}</div>
        )}
        <div className="text-[11px] text-gray-400 mt-2">Placed {timeAgo(dispatch.createdAt)}</div>
      </div>

      {weightKg != null && (
        <div className="rounded-xl p-4 mb-4 text-center" style={{ background: "#EEF7DE" }}>
          <div className="text-3xl">📦</div>
          <div className="text-[11px] font-bold uppercase tracking-wide mt-1" style={{ color: "#4E8A00" }}>
            Shipping weight
          </div>
          <div className="text-2xl font-bold mt-0.5" style={{ color: "#4E8A00" }}>
            {weightKg} kg
          </div>
        </div>
      )}

      <CourierActions
        dispatchId={dispatch.id}
        initialStatus={dispatch.status}
        initialDeliveryNoteUrl={dispatch.deliveryNoteUrl}
        initialWaybillUrl={dispatch.waybillUrl}
      />
    </div>
  );
}
