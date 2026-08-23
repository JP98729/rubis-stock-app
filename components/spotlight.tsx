"use client";

import { useState } from "react";
import { ChevronDown, Gift, Trophy } from "lucide-react";
import { GREEN, GREEN_DARK } from "@/lib/brand";
import { fmtKES } from "@/lib/utils";
import { setMonthlyReward } from "@/app/actions/manager";

export type SpotlightRow = {
  store: { id: number; name: string; county: string; type: string };
  units: number;
  value: number;
};

/**
 * "Best Branch This Month" — shown to merchandisers before they pick a store, to branch
 * managers read-only (with a "That's you!" flag), and editable on the Manager Dashboard.
 */
export function TopBranchSpotlight({
  leaderboard,
  monthKey,
  monthLabelText,
  reward,
  editable,
  highlightStoreId,
}: {
  leaderboard: SpotlightRow[];
  monthKey: string;
  monthLabelText: string;
  reward: { note: string; sent: boolean };
  editable?: boolean;
  highlightStoreId?: number;
}) {
  const top = leaderboard[0];
  const [noteDraft, setNoteDraft] = useState(reward.note);
  const [sent, setSent] = useState(reward.sent);
  const [showBoard, setShowBoard] = useState(false);

  async function saveNote() {
    if (!editable) return;
    await setMonthlyReward(monthKey, { note: noteDraft });
  }
  async function toggleSent() {
    if (!editable) return;
    const next = !sent;
    setSent(next);
    await setMonthlyReward(monthKey, { sent: next });
  }

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: "#F5D98A", background: "linear-gradient(135deg, #FFF9EC 0%, #FFFFFF 60%)" }}
    >
      <div className="p-4 flex items-start gap-3">
        <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: "#F5C242" }}>
          <Trophy size={22} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
            Best Branch This Month — {monthLabelText}
          </div>
          {!top ? (
            <div className="text-sm text-gray-400 mt-1">
              No sales logged yet this month — the leaderboard fills in as merchandisers log sales.
            </div>
          ) : (
            <>
              <div className="font-bold text-base mt-0.5">
                {top.store.name.trim()}
                {highlightStoreId === top.store.id && (
                  <span
                    className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "#F5C242", color: "white" }}
                  >
                    That&apos;s you!
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {top.store.county} · {top.store.type} · {top.units} units sold · {fmtKES(top.value)} this month
              </div>
            </>
          )}
        </div>
      </div>

      {top && (
        <div className="px-4 pb-4">
          <div className="bg-white/70 rounded-lg border border-amber-100 p-3">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-800 mb-2">
              <Gift size={15} /> Surprise reward from Pure Nutrition
            </div>
            {editable ? (
              <div className="flex gap-2">
                <input
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onBlur={saveNote}
                  placeholder="e.g. Extra case of Gourmet Range + branded T-shirts"
                  className="flex-1 border border-amber-200 rounded-lg px-3 py-2 text-sm bg-white"
                />
                <button
                  onClick={toggleSent}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap ${
                    sent ? "text-white" : "border border-amber-300 text-amber-700"
                  }`}
                  style={sent ? { background: GREEN } : {}}
                >
                  {sent ? "Sent ✓" : "Mark as sent"}
                </button>
              </div>
            ) : (
              <div className="text-sm text-amber-900">
                {reward.note ? reward.note : "To be announced"}
                {reward.sent && (
                  <span className="ml-2 text-xs font-semibold" style={{ color: GREEN_DARK }}>
                    · Delivered ✓
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowBoard((v) => !v)}
            className="text-xs font-semibold text-amber-700 mt-2 flex items-center gap-1"
          >
            <ChevronDown size={13} className={`transition ${showBoard ? "rotate-180" : ""}`} />{" "}
            {showBoard ? "Hide" : "Show"} full leaderboard ({leaderboard.length} branches with sales)
          </button>
          {showBoard && (
            <div className="mt-2 divide-y divide-amber-50 bg-white/70 rounded-lg border border-amber-100">
              {leaderboard.slice(0, 10).map((row, i) => (
                <div
                  key={row.store.id}
                  className={`px-3 py-2 flex items-center justify-between text-xs ${
                    highlightStoreId === row.store.id ? "bg-amber-50" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold w-4 text-gray-400">{i + 1}</span>
                    <span className="font-medium">{row.store.name.trim()}</span>
                  </div>
                  <span className="text-gray-500">
                    {row.units} units · {fmtKES(row.value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
