"use client";

import { AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { AMBER, GREEN, GREEN_DARK, RED } from "@/lib/brand";
import { fmtKES } from "@/lib/utils";
import { KpiCard } from "../ui";
import { TopBranchSpotlight, type SpotlightRow } from "../spotlight";
import type { DashboardData } from "./types";
import type { RecentStocktakeDTO } from "@/lib/queries";

export function Dashboard({
  data,
  recentStocktakes,
  leaderboard,
  monthKey,
  monthLabelText,
  reward,
}: {
  data: DashboardData;
  recentStocktakes: RecentStocktakeDTO[];
  leaderboard: SpotlightRow[];
  monthKey: string;
  monthLabelText: string;
  reward: { note: string; sent: boolean };
}) {
  return (
    <div className="flex flex-col gap-5">
      <TopBranchSpotlight
        leaderboard={leaderboard}
        monthKey={monthKey}
        monthLabelText={monthLabelText}
        reward={reward}
        editable
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total branches" value={data.totalBranches} />
        <KpiCard label="Out of stock" value={data.outOfStock} color={RED} sub="at least 1 SKU at zero" />
        <KpiCard label="Need reorder" value={data.needReorder} color={AMBER} sub="below target stock" />
        <KpiCard label="No stocktake yet" value={data.noStocktake} color="#6b7280" sub="seed data — awaiting first count" />
        <KpiCard label="Reorder units (total)" value={data.totalReorderUnits.toLocaleString()} />
        <KpiCard label="Reorder value" value={fmtKES(data.totalReorderValue)} color={GREEN_DARK} />
        <KpiCard label="Expiry flags" value={data.expiryFlags} color={data.expiryFlags ? RED : "#1f2937"} />
        <KpiCard
          label="Stocktakes logged"
          value={data.stocktakeCount}
          sub={`${data.movementCount} movements logged`}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="font-semibold text-sm mb-3">Reorder value by county (top 10)</div>
        {data.countyData.length === 0 || data.countyData.every((d) => d.value === 0) ? (
          <div className="text-sm text-gray-400 py-8 text-center">
            No reorder needs yet — submit stocktakes to populate this chart.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.countyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
              <XAxis dataKey="county" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmtKES(v)} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.countyData.map((_, i) => (
                  <Cell key={i} fill={GREEN} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="font-semibold text-sm mb-3">Recent stocktakes</div>
        {recentStocktakes.length === 0 ? (
          <div className="text-sm text-gray-400 py-6 text-center">
            No stocktakes submitted yet. Switch to Merchandiser mode to log one.
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100">
            {recentStocktakes.map((st) => (
              <div key={st.id} className="py-2.5 flex items-center justify-between text-sm gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate flex items-center gap-1.5">
                    {st.storeName.trim()}
                    {st.hasIssue && <AlertTriangle size={13} style={{ color: "#C0392B" }} className="shrink-0" />}
                  </div>
                  <div className="text-gray-400 text-xs truncate">
                    {st.merchandiser}
                    {st.idNumber ? ` · ID ${st.idNumber}` : ""} · {st.date}
                    {st.visitTime ? ` ${st.visitTime}` : ""}
                  </div>
                </div>
                {st.signatureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={st.signatureUrl}
                    alt="signature"
                    className="h-7 w-16 object-contain border border-gray-100 rounded bg-white shrink-0"
                  />
                ) : (
                  <span className="text-[10px] text-gray-300 shrink-0">no signature</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
