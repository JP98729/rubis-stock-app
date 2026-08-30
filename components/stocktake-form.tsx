"use client";

import { useState } from "react";
import { ArrowLeft, ChevronDown, CreditCard, MapPin, PenTool, Store as StoreIcon } from "lucide-react";
import { AMBER, GREEN, GREEN_DARK, RANGES, RANGE_COLORS, RANGE_TINT } from "@/lib/brand";
import { Badge, NumField, YesNoQuestion } from "./ui";
import { PlacementPhotoCapture, ProductPhotoPicker } from "./photo";
import { SignaturePad } from "./signature-pad";
import { submitStocktake, type StocktakeItemInput } from "@/app/actions/stocktake";
import type { ProductDTO } from "@/lib/queries";

type ItemState = {
  shelfQty: number;
  backStock: number;
  expired: number;
  damaged: number;
  batchCode: string;
  photoUrl: string | null;
};

export function StocktakeForm({
  store,
  products,
  today,
  embedded,
  defaultName,
  managerPhotoUrl,
  managerName,
  onBack,
  onSaved,
}: {
  store: { id: number; name: string; county: string; type: string };
  products: ProductDTO[];
  today: string;
  embedded?: boolean;
  defaultName?: string;
  managerPhotoUrl?: string | null;
  managerName?: string | null;
  onBack: () => void;
  onSaved: (msg: string) => void;
}) {
  const [merchandiser, setMerchandiser] = useState(defaultName || "");
  const [idNumber, setIdNumber] = useState("");
  const [visitDate, setVisitDate] = useState(today);
  const [signature, setSignature] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [checks, setChecks] = useState<{
    placement: string | null;
    prices: string | null;
    missing: string | null;
    promotion: string | null;
  }>({ placement: null, prices: null, missing: null, promotion: null });
  const [promotionType, setPromotionType] = useState("");
  const [promotionPhoto, setPromotionPhoto] = useState<string | null>(null);
  const [checksNotes, setChecksNotes] = useState("");
  const [placementPhoto, setPlacementPhoto] = useState<string | null>(null);
  const [pricesPhoto, setPricesPhoto] = useState<string | null>(null);
  const [competitorBrands, setCompetitorBrands] = useState("");
  const [competitorPhoto, setCompetitorPhoto] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, ItemState>>(() =>
    products.reduce<Record<string, ItemState>>((acc, p) => {
      acc[p.sku] = { shelfQty: 0, backStock: 0, expired: 0, damaged: 0, batchCode: "", photoUrl: null };
      return acc;
    }, {})
  );
  const [openRange, setOpenRange] = useState<string | null>(RANGES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function upd<K extends keyof ItemState>(sku: string, field: K, val: ItemState[K]) {
    setItems((prev) => ({ ...prev, [sku]: { ...prev[sku], [field]: val } }));
  }
  function setCheck(key: keyof typeof checks, val: string) {
    setChecks((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit() {
    setError("");
    // Client-side gate, reproducing the original's message copy exactly. The server
    // re-runs the same rules in app/actions/stocktake.ts.
    if (!merchandiser.trim()) return setError("Enter your name before submitting.");
    if (!embedded && !idNumber.trim()) return setError("Enter your ID number before submitting.");
    if (!visitDate) return setError("Select the date before submitting.");
    if (!embedded) {
      if (checks.placement === null || checks.prices === null || checks.missing === null || checks.promotion === null)
        return setError("Please answer all four store display questions before submitting.");
      if ((checks.placement === "No" || checks.prices === "No" || checks.missing === "Yes") && !checksNotes.trim())
        return setError("You flagged an issue above — please explain the reason before submitting.");
      if (checks.placement !== null && !placementPhoto)
        return setError("Please take a photo of the shelf for question 1 before submitting.");
      if (checks.prices === "No" && !pricesPhoto)
        return setError("Price tags/prices are incorrect — please take a photo before submitting.");
      if (checks.promotion === "Yes" && !promotionType.trim())
        return setError("Please describe the type of promotion before submitting.");
      if (checks.promotion === "Yes" && !promotionPhoto)
        return setError("Please take a photo of the promotion display before submitting.");
      if (!competitorBrands.trim())
        return setError(
          'Please list the competitor brands carried in this outlet (write "None" if there are none) before submitting.'
        );
      if (!competitorPhoto) return setError("Please take a photo of the competitor section/shelf before submitting.");
    }
    if (!signature) return setError("Please sign before submitting.");

    setSubmitting(true);
    const payload: StocktakeItemInput[] = products.map((p) => ({ sku: p.sku, ...items[p.sku] }));
    const res = await submitStocktake({
      storeId: store.id,
      date: visitDate,
      merchandiser: merchandiser.trim(),
      idNumber: idNumber.trim(),
      signatureUrl: signature,
      notes: notes.trim(),
      checksPlacement: checks.placement,
      checksPrices: checks.prices,
      checksMissing: checks.missing,
      checksPromotion: checks.promotion,
      checksNotes: checksNotes.trim(),
      placementPhotoUrl: placementPhoto,
      pricesPhotoUrl: pricesPhoto,
      promotionType: promotionType.trim(),
      promotionPhotoUrl: promotionPhoto,
      competitorBrands: competitorBrands.trim(),
      competitorPhotoUrl: competitorPhoto,
      embedded: !!embedded,
      items: payload,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onSaved("Stocktake saved");
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
        {(managerPhotoUrl || managerName) && (
          <div className="flex items-center gap-2.5 mt-3 p-2.5 rounded-lg" style={{ background: "#EEF7DE" }}>
            {managerPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={managerPhotoUrl}
                alt="Branch manager"
                className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-sm"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center shrink-0 border-2 border-white shadow-sm">
                <StoreIcon size={16} style={{ color: GREEN_DARK }} />
              </div>
            )}
            <div className="text-xs" style={{ color: GREEN_DARK }}>
              <div className="font-semibold">{managerName || "Branch manager on file"}</div>
              <div>
                {managerPhotoUrl
                  ? "Confirm you're speaking with this person before starting."
                  : "No photo on file yet — confirm their name in person."}
              </div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 gap-2 mt-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-gray-500 font-medium">Your name</span>
            <input
              value={merchandiser}
              onChange={(e) => setMerchandiser(e.target.value)}
              placeholder="e.g. Innocent Morarain"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <div className={embedded ? "grid grid-cols-1 gap-2" : "flex gap-2"}>
            {!embedded && (
              <label className="flex flex-col gap-1 flex-1">
                <span className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                  <CreditCard size={12} /> ID number
                </span>
                <input
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="National ID / Staff ID"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </label>
            )}
            <label className="flex flex-col gap-1 flex-1">
              <span className="text-[11px] text-gray-500 font-medium">Date</span>
              <input
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </label>
          </div>
        </div>
      </div>

      {RANGES.map((range) => {
        const rangeProducts = products.filter((p) => p.range === range);
        const isOpen = openRange === range;
        const rc = RANGE_COLORS[range];
        return (
          <div
            key={range}
            className="bg-white rounded-xl border border-gray-200 mb-3 overflow-hidden"
            style={{ borderLeft: `4px solid ${rc}` }}
          >
            <button
              onClick={() => setOpenRange(isOpen ? null : range)}
              className="w-full flex items-center justify-between px-4 py-3"
              style={{ background: RANGE_TINT[range] }}
            >
              <span className="font-semibold text-sm" style={{ color: rc }}>
                {range}
              </span>
              <ChevronDown size={16} style={{ color: rc }} className={`transition ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
              <div className="px-4 pb-4 flex flex-col gap-3">
                {rangeProducts.map((p) => (
                  <div key={p.sku} className="border-t border-gray-100 pt-3">
                    <div className="flex items-center gap-2.5 mb-2">
                      <ProductPhotoPicker
                        product={p}
                        value={items[p.sku].photoUrl}
                        onChange={(v) => upd(p.sku, "photoUrl", v)}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate flex items-center gap-1.5">
                          {p.flavour}
                          {p.unavailable && <Badge color={AMBER}>Not currently made</Badge>}
                        </div>
                        <div className="text-[10px] text-gray-400 truncate">
                          SKU {p.sku}
                          {p.barcode ? ` · ${p.barcode}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <NumField
                        label="Shelf"
                        value={items[p.sku].shelfQty}
                        onChange={(v) => upd(p.sku, "shelfQty", v)}
                        disabled={p.unavailable}
                      />
                      <NumField
                        label="Back stock"
                        value={items[p.sku].backStock}
                        onChange={(v) => upd(p.sku, "backStock", v)}
                        disabled={p.unavailable}
                      />
                      <NumField
                        label="Expired"
                        value={items[p.sku].expired}
                        onChange={(v) => upd(p.sku, "expired", v)}
                        danger={items[p.sku].expired > 0}
                        disabled={p.unavailable}
                      />
                      <NumField
                        label="Damaged"
                        value={items[p.sku].damaged}
                        onChange={(v) => upd(p.sku, "damaged", v)}
                        danger={items[p.sku].damaged > 0}
                        disabled={p.unavailable}
                      />
                    </div>
                    {(items[p.sku].expired > 0 || items[p.sku].damaged > 0) && (
                      // Flagged red but intentionally NOT required to submit — matching
                      // the original app's behaviour rather than silently tightening it.
                      <label className="flex flex-col gap-1 mt-2">
                        <span className="text-[11px] text-red-500 font-medium">
                          Batch code (for the expired/damaged units)
                        </span>
                        <input
                          value={items[p.sku].batchCode}
                          onChange={(e) => upd(p.sku, "batchCode", e.target.value)}
                          placeholder="e.g. L-240813-C"
                          className="border border-red-200 bg-red-50 rounded-lg px-3 py-2 text-sm"
                        />
                      </label>
                    )}
                    {(items[p.sku].expired > 0 || items[p.sku].damaged > 0) && (
                      <div className="flex items-start gap-1.5 mt-2 text-[11px] text-red-500">
                        <MapPin size={13} className="shrink-0 mt-0.5" />
                        <span>
                          Send expired/damaged returns to: Upper Kabete, Ndumbuini, Kwa Daggy, Kiambu, Nairobi
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {!embedded && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
            <div className="font-semibold text-sm mb-3">Store Display Check</div>
            <div className="flex flex-col gap-3">
              <YesNoQuestion
                label="1. Is product well placed &amp; visible?"
                value={checks.placement}
                onChange={(v) => setCheck("placement", v)}
              />
              <YesNoQuestion
                label="2. Are the price tags &amp; prices correct?"
                value={checks.prices}
                onChange={(v) => setCheck("prices", v)}
              />
              <YesNoQuestion
                label="3. Are there missing items?"
                value={checks.missing}
                onChange={(v) => setCheck("missing", v)}
                invertColor
              />
              <YesNoQuestion
                label="4. Are the products on promotion?"
                value={checks.promotion}
                onChange={(v) => setCheck("promotion", v)}
                neutral
              />
            </div>
            {checks.promotion === "Yes" && (
              <div className="mt-3 p-3 rounded-lg" style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium" style={{ color: "#1D4ED8" }}>
                    Type of promotion — required
                  </span>
                  <input
                    value={promotionType}
                    onChange={(e) => setPromotionType(e.target.value)}
                    placeholder="e.g. Buy 2 get 1 free, 20% off, bundle deal"
                    className="border border-blue-200 bg-white rounded-lg px-3 py-2 text-sm"
                  />
                </label>
                <div className="mt-3">
                  <span className="text-[11px] font-medium" style={{ color: "#1D4ED8" }}>
                    Photo of the promotion display — required
                  </span>
                  <PlacementPhotoCapture photo={promotionPhoto} onChange={setPromotionPhoto} tone="neutral" />
                </div>
              </div>
            )}
            {(checks.placement === "No" || checks.prices === "No" || checks.missing === "Yes") && (
              <label className="flex flex-col gap-1 mt-3">
                <span className="text-[11px] text-red-500 font-medium">Explain the issue(s) above — required</span>
                <textarea
                  value={checksNotes}
                  onChange={(e) => setChecksNotes(e.target.value)}
                  placeholder="What's wrong, and what needs fixing?"
                  className="border border-red-200 bg-red-50 rounded-lg px-3 py-2 text-sm"
                  rows={2}
                />
              </label>
            )}
            {checks.placement !== null && (
              <div className="mt-3">
                <span
                  className="text-[11px] font-medium"
                  style={{ color: checks.placement === "Yes" ? GREEN_DARK : "#C0392B" }}
                >
                  Photo of the shelf — required{checks.placement === "Yes" ? " (proof of good display)" : ""}
                </span>
                <PlacementPhotoCapture
                  photo={placementPhoto}
                  onChange={setPlacementPhoto}
                  tone={checks.placement === "Yes" ? "good" : "bad"}
                />
              </div>
            )}
            {checks.prices === "No" && (
              <div className="mt-3">
                <span className="text-[11px] text-red-500 font-medium">Photo of the price tag(s) — required</span>
                <PlacementPhotoCapture photo={pricesPhoto} onChange={setPricesPhoto} />
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
            <div className="font-semibold text-sm mb-1">Competitor Check</div>
            <div className="text-[11px] text-gray-400 mb-2">Which competitor brands are carried in this outlet?</div>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium" style={{ color: "#1D4ED8" }}>
                List the brands — required (write &quot;None&quot; if there are none)
              </span>
              <input
                value={competitorBrands}
                onChange={(e) => setCompetitorBrands(e.target.value)}
                placeholder="e.g. Kim-Nuts, Tropical Heat, Kenya Nut Company"
                className="border border-blue-200 bg-blue-50 rounded-lg px-3 py-2 text-sm"
              />
            </label>
            <div className="mt-3">
              <span className="text-[11px] font-medium" style={{ color: "#1D4ED8" }}>
                Photo of the competitor section/shelf — required
              </span>
              <PlacementPhotoCapture photo={competitorPhoto} onChange={setCompetitorPhoto} tone="neutral" />
            </div>
          </div>
        </>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
        <div className="text-[11px] text-gray-400 mb-2">
          Tap a product&apos;s photo icon above to attach a shelf photo for that item. General notes for this visit:
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional) — anything the manager should know"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          rows={2}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
        <div className="text-sm font-semibold mb-1 flex items-center gap-1.5">
          <PenTool size={14} /> Sign to confirm
        </div>
        <div className="text-[11px] text-gray-400 mb-2">
          I confirm the counts above are accurate as of today&apos;s visit.
        </div>
        <SignaturePad onChange={setSignature} />
        {!signature && <div className="text-[11px] text-amber-600 mt-1">Signature required before submitting.</div>}
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
        {submitting ? "Saving…" : "Sign & Submit Stocktake"}
      </button>
    </div>
  );
}
