"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Store as StoreIcon } from "lucide-react";
import { AMBER, GREEN, GREEN_DARK, RED } from "@/lib/brand";
import { Badge } from "../ui";
import { addBranch } from "@/app/actions/manager";
import type { StoreTableRow } from "./types";

function AddBranchForm({ onAdded }: { onAdded: (msg: string) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("COCO");
  const [county, setCounty] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [nameError, setNameError] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    setAdding(true);
    const result = await addBranch({ name, type, county, phone, email });
    setAdding(false);
    if (!result.ok) {
      onAdded(result.error);
      return;
    }
    onAdded(`${name.trim()} added — code ${result.code}`);
    setName("");
    setCounty("");
    setPhone("");
    setEmail("");
    setType("COCO");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left px-4 py-3 border-b border-gray-100 text-sm font-semibold flex items-center gap-1.5"
        style={{ color: GREEN_DARK }}
      >
        <StoreIcon size={15} /> + Add a new branch
      </button>
    );
  }

  return (
    <form onSubmit={handleAdd} className="px-4 py-4 border-b border-gray-100 bg-gray-50 flex flex-col gap-2">
      <div className="font-semibold text-sm mb-1">Add a New Branch</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError(false);
          }}
          placeholder="Branch name (required)"
          className={`border rounded-lg px-3 py-2 text-sm ${nameError ? "border-red-400 bg-red-50" : "border-gray-300"}`}
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="COCO">COCO</option>
          <option value="CODO">CODO</option>
        </select>
        <input
          value={county}
          onChange={(e) => setCounty(e.target.value)}
          placeholder="County"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:col-span-2"
        />
      </div>
      {nameError && <div className="text-xs text-red-600">Enter a branch name first.</div>}
      <div className="flex gap-2 mt-1">
        <button
          type="submit"
          disabled={adding}
          className="px-3 py-2 rounded-lg text-white text-xs font-semibold disabled:opacity-60"
          style={{ background: GREEN }}
        >
          {adding ? "Adding…" : "+ Add Branch"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-600"
        >
          Cancel
        </button>
      </div>
      <div className="text-[11px] text-gray-400 mt-1">
        A new access code is generated automatically — find it in Team Access once added.
      </div>
    </form>
  );
}

export function StoresTable({ rows, onToast }: { rows: StoreTableRow[]; onToast: (msg: string) => void }) {
  const [q, setQ] = useState("");
  const filtered = rows.filter(
    ({ store }) =>
      store.name.toLowerCase().includes(q.toLowerCase()) || store.county.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
        <span className="font-semibold text-sm">All Branches ({rows.length})</span>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-xs"
          />
        </div>
      </div>
      <AddBranchForm onAdded={onToast} />
      <div className="px-4 py-2 text-[11px] text-gray-400 border-b border-gray-100">
        Access Code column is each branch manager&apos;s login code for the Branch Manager view. Phone/Email marked *
        were added or updated by the branch manager.
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-left text-xs">
              <th className="font-medium py-2 px-4">Branch</th>
              <th className="font-medium py-2 px-4">Access Code</th>
              <th className="font-medium py-2 px-4">Type</th>
              <th className="font-medium py-2 px-4">County</th>
              <th className="font-medium py-2 px-4">Phone</th>
              <th className="font-medium py-2 px-4">Email</th>
              <th className="font-medium py-2 px-4">Last Stocktake</th>
              <th className="font-medium py-2 px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ store, lastStocktakeDate, hasStocktake, outOfStock, needsReorder }) => (
              <tr key={store.id} className="border-t border-gray-50">
                <td className="py-2 px-4 font-medium">{store.name.trim()}</td>
                <td className="py-2 px-4 text-xs font-mono font-semibold" style={{ color: GREEN_DARK }}>
                  {store.code}
                </td>
                <td className="py-2 px-4">
                  <Badge color={store.type === "COCO" ? GREEN_DARK : RED}>{store.type}</Badge>
                </td>
                <td className="py-2 px-4 text-gray-500">{store.county}</td>
                <td className="py-2 px-4 text-gray-500 text-xs">
                  {store.phone || "—"}
                  {store.phoneOverridden && <span style={{ color: GREEN_DARK }}> *</span>}
                </td>
                <td className="py-2 px-4 text-gray-500 text-xs">
                  {store.email || "—"}
                  {store.emailOverridden && <span style={{ color: GREEN_DARK }}> *</span>}
                </td>
                <td className="py-2 px-4 text-gray-500 text-xs">{lastStocktakeDate || "—"}</td>
                <td className="py-2 px-4">
                  {outOfStock ? (
                    <Badge color={RED}>Out of stock</Badge>
                  ) : needsReorder ? (
                    <Badge color={AMBER}>Reorder needed</Badge>
                  ) : hasStocktake ? (
                    <Badge color={GREEN_DARK}>OK</Badge>
                  ) : (
                    <Badge color="#9ca3af">No data</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
