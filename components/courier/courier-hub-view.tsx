import Link from "next/link";
import { CheckCircle2, ChevronRight, PackageOpen } from "lucide-react";
import { GREEN, GREEN_DARK, AMBER, NAIROBI_COURIER_NAME, COURIER_COMPANY } from "@/lib/brand";
import type { CourierDispatchRow } from "@/lib/queries";

function statusLabel(row: CourierDispatchRow): { text: string; color: string; bg: string } {
  if (row.complete) return { text: "Submitted", color: GREEN_DARK, bg: "#EEF7DE" };
  if (row.status === "pending") return { text: "Needs accept", color: AMBER, bg: "#FFF7E6" };
  if (row.status === "delivered" && row.hasWaybill && row.hasEtims) {
    return { text: "Ready to submit", color: "#1D4ED8", bg: "#EFF6FF" };
  }
  if (row.status === "delivered") return { text: "Missing docs", color: AMBER, bg: "#FFF7E6" };
  return { text: "Accepted", color: "#1D4ED8", bg: "#EFF6FF" };
}

function DispatchCard({ row }: { row: CourierDispatchRow }) {
  const s = statusLabel(row);
  return (
    <Link
      href={`/courier/${row.id}`}
      className="flex items-center justify-between gap-3 bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition"
    >
      <div className="min-w-0">
        <div className="font-bold text-sm truncate">{row.storeName}</div>
        <div className="text-xs text-gray-400 mt-0.5">
          {row.county} · Order ref {row.orderRef} · {row.placedAgo}
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>
            {s.text}
          </span>
          {row.weightKg != null && (
            <span className="text-[11px] text-gray-500">
              {row.weightKg} kg · KES {row.feeKES}
            </span>
          )}
        </div>
      </div>
      <ChevronRight size={18} className="text-gray-300 shrink-0" />
    </Link>
  );
}

export function CourierHubView({
  isNairobi,
  needsAction,
  completed,
}: {
  isNairobi: boolean;
  needsAction: CourierDispatchRow[];
  completed: CourierDispatchRow[];
}) {
  const courierName = isNairobi ? NAIROBI_COURIER_NAME : COURIER_COMPANY;

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="mb-5">
        <div className="font-bold text-lg">{courierName}</div>
        <div className="text-sm text-gray-400">Your deliveries — tap one to accept, upload documents, or check the fee.</div>
      </div>

      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">
        Needs action {needsAction.length > 0 && `(${needsAction.length})`}
      </div>
      {needsAction.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400 flex flex-col items-center gap-2 mb-6">
          <PackageOpen size={28} className="text-gray-300" />
          Nothing needs action right now.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 mb-6">
          {needsAction.map((row) => (
            <DispatchCard key={row.id} row={row} />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <>
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
            <CheckCircle2 size={13} style={{ color: GREEN }} /> Recently completed
          </div>
          <div className="flex flex-col gap-2.5">
            {completed.map((row) => (
              <DispatchCard key={row.id} row={row} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
