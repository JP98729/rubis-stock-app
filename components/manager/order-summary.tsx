"use client";

import { useState, useTransition } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { AMBER, GREEN, GREEN_DARK } from "@/lib/brand";
import { fmtKES } from "@/lib/utils";
import { Badge } from "../ui";
import { setApproval } from "@/app/actions/manager";
import type { StoreOrder } from "./types";

export function OrderSummary({ orders }: { orders: StoreOrder[] }) {
  const [openStore, setOpenStore] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [statuses, setStatuses] = useState<Record<number, string>>(() =>
    Object.fromEntries(orders.map((o) => [o.store.id, o.store.approvalStatus]))
  );

  function approve(storeId: number, status: "approved" | "pending") {
    setStatuses((prev) => ({ ...prev, [storeId]: status }));
    startTransition(async () => {
      await setApproval(storeId, status);
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm flex items-center justify-between">
        <span>Order Summary — {orders.length} branches need stock</span>
        {pending && <span className="text-xs font-normal text-gray-400">Saving…</span>}
      </div>
      {orders.length === 0 ? (
        <div className="text-sm text-gray-400 py-10 text-center">No open reorders right now.</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {orders.map(({ store, rows, totalUnits, totalValue, lpoDocuments }) => {
            const isOpen = openStore === store.id;
            const status = statuses[store.id] ?? "pending";
            return (
              <div key={store.id}>
                <button
                  onClick={() => setOpenStore(isOpen ? null : store.id)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <ChevronDown size={15} className={`text-gray-400 transition ${isOpen ? "rotate-180" : ""}`} />
                    <div>
                      <div className="font-medium text-sm">{store.name.trim()}</div>
                      <div className="text-xs text-gray-400">
                        {store.county} · {store.type}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {lpoDocuments.length > 0 && (
                      <span className="flex items-center gap-1 text-[11px] text-gray-400">
                        <FileText size={12} /> {lpoDocuments.length}
                      </span>
                    )}
                    <Badge color={status === "approved" ? GREEN_DARK : AMBER}>
                      {status === "approved" ? "Approved" : "Pending"}
                    </Badge>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{totalUnits} units</div>
                      <div className="text-xs text-gray-400">{fmtKES(totalValue)}</div>
                    </div>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400 text-left">
                            <th className="font-medium py-1.5">SKU</th>
                            <th className="font-medium py-1.5">Current</th>
                            <th className="font-medium py-1.5">Target</th>
                            <th className="font-medium py-1.5">Reorder Qty</th>
                            <th className="font-medium py-1.5 text-right">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => (
                            <tr key={r.sku} className="border-t border-gray-50">
                              <td className="py-1.5">{r.flavour}</td>
                              <td className="py-1.5">{r.current}</td>
                              <td className="py-1.5">{r.target}</td>
                              <td className="py-1.5 font-semibold" style={{ color: AMBER }}>
                                {r.reorder}
                              </td>
                              <td className="py-1.5 text-right">{fmtKES(r.reorder * r.price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {lpoDocuments.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-semibold text-gray-500 mb-1.5">LPO documents</div>
                        <div className="flex flex-col gap-1.5">
                          {lpoDocuments.map((d) => (
                            <a
                              key={d.id}
                              href={d.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-xs"
                              style={{ color: GREEN_DARK }}
                            >
                              <span className="flex items-center gap-1.5 min-w-0">
                                <FileText size={13} className="shrink-0" />
                                <span className="truncate">{d.filename}</span>
                              </span>
                              <span className="text-gray-400 shrink-0">{d.uploadedAt}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => approve(store.id, "approved")}
                        className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold"
                        style={{ background: GREEN }}
                      >
                        Approve Order
                      </button>
                      <button
                        onClick={() => approve(store.id, "pending")}
                        className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-600"
                      >
                        Reset to Pending
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
