"use client";

import { useState } from "react";
import { AlertTriangle, ArrowLeft, RotateCcw, ShoppingCart, Truck } from "lucide-react";
import type { MovementType } from "@prisma/client";
import { GREEN, RANGES } from "@/lib/brand";
import { ProductThumb } from "./ui";
import { submitMovement } from "@/app/actions/movement";
import type { ProductDTO } from "@/lib/queries";

const TYPES: Array<{ key: MovementType; label: string; icon: typeof Truck; desc: string }> = [
  { key: "DELIVERY", label: "Delivery", icon: Truck, desc: "Stock delivered to branch" },
  { key: "SALE", label: "Sale", icon: ShoppingCart, desc: "Units sold" },
  { key: "RETURN", label: "Return", icon: RotateCcw, desc: "Customer return, back on shelf" },
  { key: "EXPIRED_DAMAGED", label: "Expired/Damaged", icon: AlertTriangle, desc: "Removed from shelf, sent back" },
];

export function MovementForm({
  store,
  products,
  today,
  embedded,
  onBack,
  onSaved,
}: {
  store: { id: number; name: string; county: string; type: string };
  products: ProductDTO[];
  today: string;
  embedded?: boolean;
  onBack: () => void;
  onSaved: (msg: string) => void;
}) {
  const availableProducts = products.filter((p) => !p.unavailable);
  const [type, setType] = useState<MovementType>("DELIVERY");
  const [sku, setSku] = useState(availableProducts[0]?.sku ?? "");
  const [qty, setQty] = useState("1");
  const [date, setDate] = useState(today);
  const [batchCode, setBatchCode] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedProduct = availableProducts.find((p) => p.sku === sku);
  const typeLabel = TYPES.find((t) => t.key === type)?.label ?? "";

  async function handleSubmit() {
    setError("");
    setSubmitting(true);
    const res = await submitMovement({
      storeId: store.id,
      sku,
      type,
      qty: Number(qty),
      date,
      batchCode,
      notes,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onSaved(`${typeLabel} logged`);
    onBack();
  }

  return (
    <div className={embedded ? "" : "px-4 pt-4"}>
      {!embedded && (
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 mb-3">
          <ArrowLeft size={15} /> Back to branches
        </button>
      )}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
        <div className="font-bold text-sm">{store.name.trim()}</div>
        <div className="text-xs text-gray-400 mt-0.5">
          {store.county} · {store.type}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          {TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-semibold text-center px-1 ${
                type === t.key ? "text-white border-transparent" : "border-gray-200 text-gray-500"
              }`}
              style={type === t.key ? { background: t.key === "EXPIRED_DAMAGED" ? "#C0392B" : GREEN } : {}}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-gray-400 -mt-1">{TYPES.find((t) => t.key === type)?.desc}</div>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-gray-500 font-medium">Product</span>
          <select
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {RANGES.map((r) => (
              <optgroup key={r} label={r}>
                {availableProducts
                  .filter((p) => p.range === r)
                  .map((p) => (
                    <option key={p.sku} value={p.sku}>
                      {p.flavour}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          {selectedProduct && (
            <div className="flex items-center gap-2 mt-1">
              <ProductThumb product={selectedProduct} size={24} />
              <span className="text-[11px] text-gray-400">
                SKU {selectedProduct.sku}
                {selectedProduct.barcode ? ` · Barcode ${selectedProduct.barcode}` : ""}
              </span>
            </div>
          )}
        </label>
        <div className="flex gap-2">
          <label className="flex flex-col gap-1 flex-1">
            <span className="text-[11px] text-gray-500 font-medium">Quantity</span>
            <input
              type="number"
              min="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 flex-1">
            <span className="text-[11px] text-gray-500 font-medium">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </label>
        </div>
        {type === "EXPIRED_DAMAGED" && (
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-red-500 font-medium">Batch code</span>
            <input
              value={batchCode}
              onChange={(e) => setBatchCode(e.target.value)}
              placeholder="e.g. L-240813-C"
              className="border border-red-200 bg-red-50 rounded-lg px-3 py-2 text-sm"
            />
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-gray-500 font-medium">Notes (optional)</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </label>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2.5 text-sm mb-3" style={{ background: "#FEF6F5", color: "#C0392B" }}>
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full py-3 rounded-xl text-white font-bold text-sm mb-6 disabled:opacity-60"
        style={{ background: GREEN }}
      >
        {submitting ? "Saving…" : `Log ${typeLabel}`}
      </button>
    </div>
  );
}
