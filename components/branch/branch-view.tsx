"use client";

import { useState } from "react";
import { AlertTriangle, Bell, ClipboardList, MessageCircle, Package, Trophy, Truck } from "lucide-react";
import { AMBER, GREEN, GREEN_DARK, RUBIS_LOGO } from "@/lib/brand";
import { fmtKES } from "@/lib/utils";
import { Badge, ProductThumb } from "../ui";
import { ToastView, useToast } from "../toast";
import { DeliveryBanner, DeliveryCalendar } from "../delivery";
import { TopBranchSpotlight, type SpotlightRow } from "../spotlight";
import { StocktakeForm } from "../stocktake-form";
import { MovementForm } from "../movement-form";
import { BranchContactEditor, ManagerPhotoUploader } from "./contact-editor";
import { LpoUploader } from "./lpo-uploader";
import { logout } from "@/app/actions/auth";
import type { LpoDocumentDTO, MessageDTO, ProductDTO, StoreDTO } from "@/lib/queries";
import type { StockRow } from "@/lib/stock";

type Tab = "overview" | "stocktake" | "movement" | "messages" | "delivery";

export function BranchManagerView({
  store,
  products,
  today,
  orderItems,
  hasStocktake,
  needsMonthEndCount,
  approvalStatus,
  leaderboard,
  myRank,
  monthKey,
  monthLabelText,
  reward,
  messages,
  recentCount,
  audienceLabels,
  lpoDocuments,
}: {
  store: StoreDTO;
  products: ProductDTO[];
  today: string;
  orderItems: StockRow[];
  hasStocktake: boolean;
  needsMonthEndCount: boolean;
  approvalStatus: string;
  leaderboard: SpotlightRow[];
  myRank: number;
  monthKey: string;
  monthLabelText: string;
  reward: { note: string; sent: boolean };
  messages: MessageDTO[];
  recentCount: number;
  audienceLabels: Record<string, string>;
  lpoDocuments: LpoDocumentDTO[];
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const { toast, showToast } = useToast();
  const isLeading = myRank === 0;

  const tabs: Array<{ key: Tab; label: string; icon: typeof ClipboardList; badge?: number }> = [
    { key: "overview", label: "Orders", icon: ClipboardList },
    { key: "stocktake", label: "Stocktake", icon: Package },
    { key: "movement", label: "Movement", icon: Truck },
    { key: "messages", label: "Messages", icon: MessageCircle, badge: recentCount },
    { key: "delivery", label: "Delivery", icon: Bell },
  ];

  return (
    <div className="max-w-md mx-auto pb-24">
      <ToastView toast={toast} />
      <div className="px-4 pt-4">
        <div className="flex items-center gap-2 mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={RUBIS_LOGO} alt="Rubis" className="h-8 w-auto" />
          <div>
            <div className="font-bold text-sm leading-none">Rubis Enjoy</div>
            <div className="text-[11px] text-gray-400 leading-none mt-0.5">Branch Manager</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm">{store.name.trim()}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {store.county} · {store.type} · code {store.code}
            </div>
            <BranchContactEditor phone={store.phone} email={store.email} onSaved={showToast} />
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="text-xs font-semibold text-gray-400 border border-gray-200 rounded-lg px-2.5 py-1.5 shrink-0"
            >
              Log out
            </button>
          </form>
        </div>
        <div className="mb-3">
          <ManagerPhotoUploader photoUrl={store.managerPhotoUrl} name={store.managerName} onSaved={showToast} />
        </div>
        <DeliveryBanner today={today} />
        {myRank >= 0 && (
          <div
            className="rounded-xl px-4 py-2.5 flex items-center justify-between text-sm mt-3"
            style={isLeading ? { background: "#FFF9EC", border: "1px solid #F5D98A" } : { background: "#F3F4F6" }}
          >
            <span className="font-semibold flex items-center gap-1.5" style={{ color: isLeading ? "#B8860B" : "#4b5563" }}>
              {isLeading && <Trophy size={14} />}{" "}
              {isLeading ? "You're #1 in sales this month!" : `#${myRank + 1} in sales this month`}
            </span>
            <span className="text-xs text-gray-500">
              {leaderboard[myRank].units} units · {fmtKES(leaderboard[myRank].value)}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5 px-4 pt-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`relative flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap ${
              tab === t.key ? "text-white" : "bg-white text-gray-500 border border-gray-200"
            }`}
            style={tab === t.key ? { background: GREEN } : {}}
          >
            <t.icon size={14} /> {t.label}
            {!!t.badge && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="px-4 pt-3">
        {tab === "overview" && (
          <div className="flex flex-col gap-4">
            {needsMonthEndCount && (
              <button
                onClick={() => setTab("stocktake")}
                className="rounded-xl px-4 py-3 flex items-center gap-3 text-left"
                style={{ background: "#FEF6F5", border: "1px solid #F5C4BE" }}
              >
                <AlertTriangle size={20} style={{ color: "#C0392B" }} className="shrink-0" />
                <div>
                  <div className="text-sm font-semibold" style={{ color: "#C0392B" }}>
                    Today is the last day of the month
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    Submit your stock count today — tap here to start your stocktake.
                  </div>
                </div>
              </button>
            )}
            <TopBranchSpotlight
              leaderboard={leaderboard}
              monthKey={monthKey}
              monthLabelText={monthLabelText}
              reward={reward}
              highlightStoreId={store.id}
            />
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="font-semibold text-sm">Reorder needed</span>
                <Badge color={approvalStatus === "approved" ? GREEN_DARK : AMBER}>
                  {approvalStatus === "approved" ? "Approved" : "Pending approval"}
                </Badge>
              </div>
              {orderItems.length === 0 ? (
                <div className="text-sm text-gray-400 py-8 text-center">
                  No reorder needed right now — you&apos;re fully stocked.
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {orderItems.map((r) => (
                    <div key={r.sku} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                      <ProductThumb product={r} size={28} />
                      <div className="flex-1">
                        <div className="font-medium">{r.flavour}</div>
                        <div className="text-[11px] text-gray-400">
                          {r.sku} · on hand {r.current}
                        </div>
                      </div>
                      <div className="font-semibold" style={{ color: AMBER }}>
                        +{r.reorder}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!hasStocktake && (
                <div className="px-4 py-3 text-xs text-amber-700 bg-amber-50 border-t border-amber-100">
                  No stocktake submitted yet for your branch — do one under the Stocktake tab so your order summary
                  reflects real numbers.
                </div>
              )}
            </div>
            <LpoUploader documents={lpoDocuments} onSaved={showToast} />
          </div>
        )}
        {tab === "stocktake" && (
          <StocktakeForm
            store={store}
            products={products}
            today={today}
            embedded
            onBack={() => setTab("overview")}
            onSaved={showToast}
          />
        )}
        {tab === "movement" && (
          <MovementForm
            store={store}
            products={products}
            today={today}
            embedded
            onBack={() => setTab("overview")}
            onSaved={showToast}
          />
        )}
        {tab === "messages" && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm flex items-center gap-1.5">
              <MessageCircle size={15} /> Messages from Rubis Head Office
            </div>
            {messages.length === 0 ? (
              <div className="text-sm text-gray-400 py-8 text-center">No messages yet.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {messages.map((m) => (
                  <div key={m.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm">{m.subject}</div>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">{m.createdAtLabel}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{audienceLabels[m.id]}</div>
                    <div className="text-sm text-gray-600 mt-1.5 whitespace-pre-wrap">{m.body}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {tab === "delivery" && <DeliveryCalendar today={today} />}
      </div>
    </div>
  );
}
