"use client";

import { useState } from "react";
import { AMBER, MIN_STOCK, RANGES, RANGE_COLORS, RANGE_TINT } from "@/lib/brand";
import { fmtKES } from "@/lib/utils";
import { Badge, ProductThumb } from "../ui";
import { setTarget } from "@/app/actions/manager";
import type { ProductDTO } from "@/lib/queries";

export function ProductsTable({ products, onToast }: { products: ProductDTO[]; onToast: (msg: string) => void }) {
  const [targets, setTargets] = useState<Record<string, number>>(() =>
    Object.fromEntries(products.map((p) => [p.sku, p.target]))
  );

  async function save(sku: string, value: number) {
    setTargets((prev) => ({ ...prev, [sku]: value }));
    const res = await setTarget(sku, value);
    if (!res.ok) onToast(res.error);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-xs rounded-lg px-3 py-2" style={{ background: "#FEF6F5", color: "#C0392B" }}>
        Every branch is enforced to hold at least <strong>{MIN_STOCK} units</strong> of every product, regardless of the
        target set below — if a target is set lower than {MIN_STOCK}, the reorder calculation still tops up to {MIN_STOCK}.
      </div>
      <div className="text-xs rounded-lg px-3 py-2 flex items-center gap-1 flex-wrap" style={{ background: "#FFFBEB", color: "#B45309" }}>
        <span>Products marked</span> <Badge color={AMBER}>Not currently made</Badge>
        <span>
          stay visible for reference and existing stock can still be counted, sold, or returned — but they&apos;re
          excluded from all reorder recommendations, Order Summary, and the Production Plan, since they can&apos;t
          currently be produced.
        </span>
      </div>
      {RANGES.map((range) => (
        <div
          key={range}
          className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          style={{ borderLeft: `4px solid ${RANGE_COLORS[range]}` }}
        >
          <div
            className="px-4 py-3 border-b border-gray-100 font-semibold text-sm"
            style={{ background: RANGE_TINT[range], color: RANGE_COLORS[range] }}
          >
            {range}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left text-xs">
                  <th className="font-medium py-2 px-4">Flavour</th>
                  <th className="font-medium py-2 px-4">SKU</th>
                  <th className="font-medium py-2 px-4">Barcode</th>
                  <th className="font-medium py-2 px-4">Price</th>
                  <th className="font-medium py-2 px-4">Target stock / branch</th>
                </tr>
              </thead>
              <tbody>
                {products
                  .filter((p) => p.range === range)
                  .map((p) => {
                    const val = targets[p.sku];
                    return (
                      <tr key={p.sku} className={`border-t border-gray-50 ${p.unavailable ? "bg-amber-50/40" : ""}`}>
                        <td className="py-2 px-4 font-medium">
                          <div className="flex items-center gap-2.5">
                            <ProductThumb product={p} size={28} />
                            {p.flavour}
                            {p.unavailable && <Badge color={AMBER}>Not currently made</Badge>}
                          </div>
                        </td>
                        <td className="py-2 px-4 text-gray-400 text-xs">{p.sku}</td>
                        <td className="py-2 px-4 text-gray-400 text-xs">{p.barcode || "—"}</td>
                        <td className="py-2 px-4">{fmtKES(p.price)}</td>
                        <td className="py-2 px-4">
                          <input
                            type="number"
                            min={MIN_STOCK}
                            value={val}
                            onChange={(e) => save(p.sku, Math.max(0, parseInt(e.target.value) || 0))}
                            className={`border rounded-lg px-2 py-1 text-sm w-20 ${
                              val < MIN_STOCK ? "border-red-300 bg-red-50" : "border-gray-300"
                            }`}
                          />
                          {val < MIN_STOCK && (
                            <div className="text-[10px] text-red-500 mt-0.5">Floored to {MIN_STOCK} in reorder calc</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <div className="text-xs text-gray-400 px-1">
        Target stock defaults are a starting estimate per branch — tune per SKU as real sell-through data comes in from
        stocktakes.
      </div>
    </div>
  );
}
