"use client";

import { AlertTriangle, Bell, Gift, Search } from "lucide-react";
import { AMBER, MIN_STOCK, RED } from "@/lib/brand";
import { Badge } from "../ui";
import type { AlertItem, AlertsData, CheckItem } from "./types";

function Section({
  title,
  icon: Icon,
  color,
  items,
}: {
  title: string;
  icon: typeof AlertTriangle;
  color: string;
  items: AlertItem[];
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm flex items-center gap-2">
        <Icon size={15} style={{ color }} /> {title} <Badge color={color}>{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-gray-400 py-6 text-center">None right now.</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {items.map((it) => (
            <div key={it.storeId} className="px-4 py-2.5 text-sm flex items-center justify-between">
              <div>
                <span className="font-medium">{it.storeName.trim()}</span>
                <span className="text-gray-400 text-xs"> · {it.county}</span>
              </div>
              <span className="text-xs text-gray-500">{it.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoRow({ urls }: { urls: Array<string | null> }) {
  const present = urls.filter(Boolean) as string[];
  if (!present.length) return null;
  return (
    <div className="flex gap-2 mt-2">
      {present.map((u) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={u} src={u} alt="Stocktake evidence" className="w-20 h-20 rounded-lg object-cover border border-gray-200" />
      ))}
    </div>
  );
}

function CheckHeader({ item }: { item: CheckItem }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-medium">{item.storeName.trim()}</span>
      <span className="text-xs text-gray-400">{item.date}</span>
    </div>
  );
}

export function Alerts({ data }: { data: AlertsData }) {
  return (
    <div className="flex flex-col gap-4">
      <Section title="Out of stock" icon={AlertTriangle} color={RED} items={data.outOfStock} />
      <Section title={`Below minimum (${MIN_STOCK} units)`} icon={AlertTriangle} color={AMBER} items={data.belowMinimum} />
      <Section title="Expired stock reported" icon={AlertTriangle} color={AMBER} items={data.expiry} />
      <Section title="Damaged stock reported" icon={AlertTriangle} color={AMBER} items={data.damaged} />
      <Section title="Never stocktaken (seed data)" icon={Bell} color="#6b7280" items={data.noStocktake} />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm flex items-center gap-2">
          <AlertTriangle size={15} style={{ color: AMBER }} /> Store display check issues{" "}
          <Badge color={AMBER}>{data.displayIssues.length}</Badge>
        </div>
        {data.displayIssues.length === 0 ? (
          <div className="text-sm text-gray-400 py-6 text-center">No display issues reported in the latest stocktakes.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.displayIssues.map((it) => (
              <div key={it.storeId} className="px-4 py-2.5 text-sm">
                <CheckHeader item={it} />
                <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  {it.checksPlacement === "No" && <span>⚠ Not well placed / visible</span>}
                  {it.checksPrices === "No" && <span>⚠ Price tags/prices incorrect</span>}
                  {it.checksMissing === "Yes" && <span>⚠ Missing items reported</span>}
                </div>
                {it.checksNotes && <div className="text-xs text-gray-400 mt-1 italic">&quot;{it.checksNotes}&quot;</div>}
                <PhotoRow urls={[it.placementPhotoUrl, it.pricesPhotoUrl]} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm flex items-center gap-2">
          <Search size={15} style={{ color: "#1D4ED8" }} /> Competitor brands observed{" "}
          <Badge color="#1D4ED8">{data.competitorReports.length}</Badge>
        </div>
        {data.competitorReports.length === 0 ? (
          <div className="text-sm text-gray-400 py-6 text-center">
            No competitor brands reported in the latest stocktakes.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.competitorReports.map((it) => (
              <div key={it.storeId} className="px-4 py-2.5 text-sm">
                <CheckHeader item={it} />
                {it.competitors.length > 0 ? (
                  <div className="flex flex-col gap-1.5 mt-1.5">
                    {it.competitors.map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">
                          {c.brand}
                          {c.gram ? ` (${c.gram})` : ""} — KES {c.price}
                          {c.description ? ` · ${c.description}` : ""}
                        </span>
                        <PhotoRow urls={[c.photoUrl]} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="text-xs text-gray-600 mt-1">{it.competitorBrands}</div>
                    <PhotoRow urls={[it.competitorPhotoUrl]} />
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm flex items-center gap-2">
          <Gift size={15} style={{ color: "#1D4ED8" }} /> Active promotions{" "}
          <Badge color="#1D4ED8">{data.activePromotions.length}</Badge>
        </div>
        {data.activePromotions.length === 0 ? (
          <div className="text-sm text-gray-400 py-6 text-center">No promotions reported in the latest stocktakes.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.activePromotions.map((it) => (
              <div key={it.storeId} className="px-4 py-2.5 text-sm">
                <CheckHeader item={it} />
                <div className="text-xs text-gray-600 mt-1">{it.promotionType || "Type not specified"}</div>
                <PhotoRow urls={[it.promotionPhotoUrl]} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
