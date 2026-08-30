"use client";

import { useState } from "react";
import { AlertTriangle, ArrowLeft, ChevronRight, ClipboardList, Search, Store as StoreIcon, Truck } from "lucide-react";
import { GREEN, GREEN_DARK, RED } from "@/lib/brand";
import { Badge } from "./ui";
import { ToastView, useToast } from "./toast";
import { TopBranchSpotlight, type SpotlightRow } from "./spotlight";
import { StocktakeForm } from "./stocktake-form";
import { MovementForm } from "./movement-form";
import type { ProductDTO, StoreDTO } from "@/lib/queries";

export type StorePickerRow = {
  store: StoreDTO;
  hasStocktake: boolean;
  outOfStock: boolean;
};

export function MerchandiserView({
  rows,
  products,
  today,
  merchName,
  leaderboard,
  monthKey,
  monthLabelText,
  reward,
}: {
  rows: StorePickerRow[];
  products: ProductDTO[];
  today: string;
  merchName: string;
  leaderboard: SpotlightRow[];
  monthKey: string;
  monthLabelText: string;
  reward: { note: string; sent: boolean };
}) {
  const [tab, setTab] = useState<"stocktake" | "movement">("stocktake");
  const [selected, setSelected] = useState<StoreDTO | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [q, setQ] = useState("");
  const { toast, showToast } = useToast();

  const filtered = rows.filter(
    ({ store }) =>
      store.name.toLowerCase().includes(q.toLowerCase()) || store.county.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="max-w-md mx-auto pb-24">
      <ToastView toast={toast} />
      {merchName && (
        <div className="px-4 pt-4">
          <div className="text-xs rounded-lg px-3 py-2" style={{ background: "#EEF7DE", color: GREEN_DARK }}>
            Signed in as <span className="font-semibold">{merchName}</span>
          </div>
        </div>
      )}
      {!selected && (
        <div className="px-4 pt-4">
          <TopBranchSpotlight
            leaderboard={leaderboard}
            monthKey={monthKey}
            monthLabelText={monthLabelText}
            reward={reward}
          />
        </div>
      )}
      <div className="flex gap-2 px-4 pt-4">
        <button
          onClick={() => setTab("stocktake")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 ${
            tab === "stocktake" ? "text-white" : "bg-white text-gray-500 border border-gray-200"
          }`}
          style={tab === "stocktake" ? { background: GREEN } : {}}
        >
          <ClipboardList size={16} /> Stocktake
        </button>
        <button
          onClick={() => setTab("movement")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 ${
            tab === "movement" ? "text-white" : "bg-white text-gray-500 border border-gray-200"
          }`}
          style={tab === "movement" ? { background: GREEN } : {}}
        >
          <Truck size={16} /> Log Movement
        </button>
      </div>

      {!selected ? (
        <div className="px-4 pt-4">
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search branch or county…"
              className="w-full border border-gray-300 rounded-xl pl-9 pr-3 py-2.5 text-sm"
            />
          </div>
          <div className="text-xs text-gray-400 mb-2 px-1">{filtered.length} branches</div>
          <div className="flex flex-col gap-2">
            {filtered.map(({ store, hasStocktake, outOfStock }) => (
              <button
                key={store.id}
                onClick={() => {
                  setSelected(store);
                  setConfirmed(false);
                }}
                className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-left flex items-center justify-between active:scale-[0.99] transition"
              >
                <div className="flex items-center gap-3">
                  {store.managerPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={store.managerPhotoUrl}
                      alt="Branch manager"
                      className="w-9 h-9 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <StoreIcon size={14} className="text-gray-300" />
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-sm">{store.name.replace(/\s+/g, " ").trim()}</div>
                    <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                      <Badge color={store.type === "COCO" ? GREEN_DARK : RED}>{store.type}</Badge>
                      {store.county}
                      {!hasStocktake && <span className="text-amber-600">· no stocktake yet</span>}
                    </div>
                    {store.managerName && (
                      <div className="text-[11px] mt-0.5" style={{ color: GREEN_DARK }}>
                        Manager: {store.managerName}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {outOfStock && <AlertTriangle size={16} style={{ color: RED }} />}
                  <ChevronRight size={18} className="text-gray-300" />
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : !confirmed ? (
        <div className="px-4 pt-4">
          <button
            onClick={() => setSelected(null)}
            className="flex items-center gap-1 text-sm text-gray-500 mb-3"
          >
            <ArrowLeft size={15} /> Back to branches
          </button>
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
            <div className="font-bold text-sm">{selected.name.trim()}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {selected.county} · {selected.type}
            </div>
            {(selected.managerPhotoUrl || selected.managerName || selected.phone) && (
              <div className="flex items-center gap-3 mt-3 p-2.5 rounded-lg" style={{ background: "#EEF7DE" }}>
                {selected.managerPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selected.managerPhotoUrl}
                    alt="Branch manager"
                    className="w-24 h-24 rounded-full object-cover border-2 border-white shadow-sm shrink-0"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center shrink-0 border-2 border-white shadow-sm">
                    <StoreIcon size={32} style={{ color: GREEN_DARK }} />
                  </div>
                )}
                <div className="text-sm" style={{ color: GREEN_DARK }}>
                  <div className="font-semibold">{selected.managerName || "Branch manager on file"}</div>
                  {selected.phone && (
                    <a href={`tel:${selected.phone}`} className="underline">
                      {selected.phone}
                    </a>
                  )}
                  <div className="text-xs">
                    {selected.managerPhotoUrl
                      ? "Confirm you're speaking with this person before starting."
                      : "No photo on file yet — confirm their name in person."}
                  </div>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setConfirmed(true)}
            className="w-full py-3 rounded-xl text-white font-bold text-sm"
            style={{ background: GREEN }}
          >
            Continue to {tab === "stocktake" ? "Stocktake" : "Log Movement"}
          </button>
        </div>
      ) : tab === "stocktake" ? (
        <StocktakeForm
          store={selected}
          products={products}
          today={today}
          defaultName={merchName}
          managerPhotoUrl={selected.managerPhotoUrl}
          managerName={selected.managerName}
          managerPhone={selected.phone}
          onBack={() => setConfirmed(false)}
          onSaved={showToast}
        />
      ) : (
        <MovementForm
          store={selected}
          products={products}
          today={today}
          defaultName={merchName}
          onBack={() => setConfirmed(false)}
          onSaved={showToast}
        />
      )}
    </div>
  );
}
