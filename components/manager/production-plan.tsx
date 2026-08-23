"use client";

import { GREEN_DARK, RANGES, RANGE_COLORS, RANGE_TINT } from "@/lib/brand";
import { fmtKES } from "@/lib/utils";
import { KpiCard } from "../ui";
import type { ProductionRow } from "./types";

export function ProductionPlan({ rows }: { rows: ProductionRow[] }) {
  const grandTotalUnits = rows.reduce((s, p) => s + p.totalQty, 0);
  const grandTotalValue = rows.reduce((s, p) => s + p.totalQty * p.price, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Total units to produce" value={grandTotalUnits.toLocaleString()} color={GREEN_DARK} />
        <KpiCard label="Total order value" value={fmtKES(grandTotalValue)} />
      </div>
      {RANGES.map((range) => {
        const rangeItems = rows.filter((p) => p.range === range && p.totalQty > 0);
        if (rangeItems.length === 0) return null;
        const rc = RANGE_COLORS[range];
        return (
          <div
            key={range}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            style={{ borderLeft: `4px solid ${rc}` }}
          >
            <div
              className="px-4 py-3 border-b border-gray-100 font-semibold text-sm"
              style={{ background: RANGE_TINT[range], color: rc }}
            >
              {range}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-left text-xs">
                    <th className="font-medium py-2 px-4">Flavour</th>
                    <th className="font-medium py-2 px-4">SKU</th>
                    <th className="font-medium py-2 px-4">Branches needing</th>
                    <th className="font-medium py-2 px-4">Units to produce</th>
                    <th className="font-medium py-2 px-4 text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {rangeItems.map((p) => (
                    <tr key={p.sku} className="border-t border-gray-50">
                      <td className="py-2 px-4 font-medium">{p.flavour}</td>
                      <td className="py-2 px-4 text-gray-400 text-xs">{p.sku}</td>
                      <td className="py-2 px-4">{p.storesNeeding}</td>
                      <td className="py-2 px-4 font-semibold" style={{ color: GREEN_DARK }}>
                        {p.totalQty}
                      </td>
                      <td className="py-2 px-4 text-right">{fmtKES(p.totalQty * p.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      {grandTotalUnits === 0 && (
        <div className="text-sm text-gray-400 py-10 text-center bg-white rounded-xl border border-gray-200">
          No production needs yet — submit stocktakes to populate this plan.
        </div>
      )}
    </div>
  );
}
