"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Database, Gift, LayoutDashboard, MessageCircle, Search } from "lucide-react";
import { GREEN, GREEN_DARK } from "@/lib/brand";
import {
  addMerchandiser,
  checkDatabase,
  regenerateMerchandiserCode,
  removeMerchandiser,
  setMerchandiserActive,
  updateRoleCode,
  type DbStatus,
} from "@/app/actions/manager";
import { restoreBackup } from "@/app/actions/backup";
import type { StoreDTO } from "@/lib/queries";
import type { MerchandiserRow } from "./types";

export function TeamAccess({
  merchandisers,
  stores,
  onToast,
}: {
  merchandisers: MerchandiserRow[];
  stores: StoreDTO[];
  onToast: (msg: string) => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const filtered = stores.filter(
    (s) => s.name.toLowerCase().includes(q.toLowerCase()) || s.county.toLowerCase().includes(q.toLowerCase())
  );

  // --- diagnostics ---
  const [diag, setDiag] = useState<DbStatus | null>(null);
  const [diagRunning, setDiagRunning] = useState(false);
  async function runDiagnostic() {
    setDiagRunning(true);
    setDiag(null);
    setDiag(await checkDatabase());
    setDiagRunning(false);
  }

  // --- backup ---
  const [restoring, setRestoring] = useState(false);
  const [restoreNote, setRestoreNote] = useState("");
  const [restoredCodes, setRestoredCodes] = useState<Array<{ name: string; code: string }>>([]);
  async function handleRestore(file: File) {
    setRestoring(true);
    setRestoreNote("");
    setRestoredCodes([]);
    const text = await file.text();
    const res = await restoreBackup(text);
    setRestoring(false);
    if (!res.ok) {
      setRestoreNote(res.error);
      onToast("Restore failed");
      return;
    }
    setRestoreNote(res.summary);
    setRestoredCodes(res.newMerchandiserCodes);
    onToast("Backup restored");
    router.refresh();
  }

  // --- role codes ---
  const [mgrDraft, setMgrDraft] = useState("");
  const [mgrSaved, setMgrSaved] = useState(false);
  const [showMgrCode, setShowMgrCode] = useState(false);
  const [hqDraft, setHqDraft] = useState("");
  const [hqSaved, setHqSaved] = useState(false);
  const [merchDraft, setMerchDraft] = useState("");
  const [merchSaved, setMerchSaved] = useState(false);

  async function saveRoleCode(
    type: "MANAGER" | "HQ" | "MERCHANDISER",
    value: string,
    clear: () => void,
    flag: (v: boolean) => void
  ) {
    if (!value.trim()) return;
    const res = await updateRoleCode(type, value);
    if (!res.ok) {
      onToast(res.error);
      return;
    }
    clear();
    flag(true);
    setTimeout(() => flag(false), 2000);
    onToast("Code saved");
  }

  // --- merchandisers ---
  const [newName, setNewName] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [nameError, setNameError] = useState(false);
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState<{ name: string; code: string } | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    setAdding(true);
    const res = await addMerchandiser(newName.trim(), customCode);
    setAdding(false);
    if (!res.ok) {
      onToast(res.error);
      return;
    }
    setJustAdded({ name: newName.trim(), code: res.code });
    setNewName("");
    setCustomCode("");
    router.refresh();
  }

  async function handleRegenerate(id: string, name: string) {
    const res = await regenerateMerchandiserCode(id);
    if (!res.ok) {
      onToast(res.error);
      return;
    }
    setJustAdded({ name, code: res.code });
    router.refresh();
  }

  async function handleRemove(id: string) {
    await removeMerchandiser(id);
    router.refresh();
  }

  async function handleToggleActive(id: string, active: boolean) {
    await setMerchandiserActive(id, active);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border p-4" style={{ borderColor: "#93C5FD", background: "#EFF6FF" }}>
        <div className="font-semibold text-sm mb-1 flex items-center gap-1.5">
          <Database size={15} /> Database Check
        </div>
        <div className="text-xs text-gray-500 mb-3">
          Confirms the app can reach the database right now, and shows how much data it holds.
        </div>
        <button
          onClick={runDiagnostic}
          disabled={diagRunning}
          className="px-3 py-2 rounded-lg text-white text-xs font-semibold disabled:opacity-60"
          style={{ background: "#2563EB" }}
        >
          {diagRunning ? "Testing…" : "Run Database Check"}
        </button>
        {diag && (
          <pre
            className={`mt-3 text-[11px] bg-white border rounded-lg p-2.5 whitespace-pre-wrap ${
              diag.ok ? "border-blue-200 text-gray-700" : "border-red-200 text-red-700"
            }`}
          >
            {diag.detail}
          </pre>
        )}
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: "#FBBF24", background: "#FFFBEB" }}>
        <div className="font-semibold text-sm mb-1 flex items-center gap-1.5">
          <Gift size={15} style={{ color: "#B45309" }} /> Manual Backup
        </div>
        <div className="text-xs text-gray-600 mb-3">
          Download a full JSON export of every branch, product, stocktake, movement and message. Access codes are never
          included in a backup. Restoring is additive — it merges the file back in without deleting anything.
        </div>
        <div className="flex gap-2 flex-wrap">
          <a
            href="/api/backup"
            className="px-3 py-2 rounded-lg text-white text-xs font-semibold inline-flex items-center"
            style={{ background: "#B45309" }}
          >
            Download Backup
          </a>
          <label className="px-3 py-2 rounded-lg border border-amber-400 text-amber-800 text-xs font-semibold cursor-pointer">
            {restoring ? "Restoring…" : "Restore from Backup"}
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleRestore(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {restoreNote && (
          <div className="mt-3 text-[11px] bg-white border border-amber-200 rounded-lg p-2.5 text-gray-700 whitespace-pre-wrap">
            {restoreNote}
          </div>
        )}
        {restoredCodes.length > 0 && (
          <div className="mt-2 text-[11px] bg-white border border-amber-200 rounded-lg p-2.5">
            <div className="font-semibold mb-1">
              New merchandiser codes (backups never contain codes — send these on now, they aren&apos;t shown again):
            </div>
            {restoredCodes.map((c) => (
              <div key={c.name} className="flex justify-between">
                <span>{c.name}</span>
                <span className="font-mono font-bold" style={{ color: GREEN_DARK }}>
                  {c.code}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: "#374151", background: "#F9FAFB" }}>
        <div className="font-semibold text-sm mb-1 flex items-center gap-1.5">
          <LayoutDashboard size={15} /> Manager Access Code{" "}
          <span className="text-[10px] font-normal text-gray-400">(restricted — this screen only)</span>
        </div>
        <div className="text-xs text-gray-500 mb-3">
          This is the master code that unlocks this entire dashboard, including every branch&apos;s data and every code
          below. Keep it to yourself and any other Pure Nutrition manager who needs full access — don&apos;t share it
          with merchandisers or branch managers. Codes are stored hashed, so set a new one here to rotate it.
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <input
            type={showMgrCode ? "text" : "password"}
            value={mgrDraft}
            onChange={(e) => setMgrDraft(e.target.value)}
            placeholder="New manager code"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono tracking-widest w-48"
          />
          <button
            onClick={() => setShowMgrCode((v) => !v)}
            className="text-xs font-semibold text-gray-500 border border-gray-300 rounded-lg px-2.5 py-2"
          >
            {showMgrCode ? "Hide" : "Show"}
          </button>
          <button
            onClick={() => saveRoleCode("MANAGER", mgrDraft, () => setMgrDraft(""), setMgrSaved)}
            className="px-3 py-2 rounded-lg text-white text-xs font-semibold"
            style={{ background: "#1f2937" }}
          >
            {mgrSaved ? "Saved ✓" : "Save Code"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: "#F5C4BE", background: "#FEF6F5" }}>
        <div className="font-semibold text-sm mb-1 flex items-center gap-1.5">
          <MessageCircle size={15} style={{ color: "#C0392B" }} /> Rubis HQ Access Code
        </div>
        <div className="text-xs text-gray-500 mb-3">
          Unlocks the Rubis Head Office view, where Rubis&apos;s own team can send announcements to branch managers. Give
          this to Rubis&apos;s head office contact — it doesn&apos;t give access to branch stock data or Pure
          Nutrition&apos;s dashboard.
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <input
            value={hqDraft}
            onChange={(e) => setHqDraft(e.target.value)}
            placeholder="New Rubis HQ code"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono tracking-widest w-48"
          />
          <button
            onClick={() => saveRoleCode("HQ", hqDraft, () => setHqDraft(""), setHqSaved)}
            className="px-3 py-2 rounded-lg text-white text-xs font-semibold"
            style={{ background: "#C0392B" }}
          >
            {hqSaved ? "Saved ✓" : "Save Code"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="font-semibold text-sm mb-1">Merchandiser Codes</div>
        <div className="text-xs text-gray-400 mb-3">
          Give each merchandiser their own code to open the app with. Add a name below, then send that person their code
          directly — WhatsApp, SMS, or read it out on a call. Their name pre-fills automatically once they sign in. Leave
          the code box empty to auto-generate one, or type your own memorable code. Codes are stored hashed, so a code is
          only ever shown once, right after it&apos;s created — use Regenerate if it gets lost.
        </div>
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2 mb-1">
          <input
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              if (nameError) setNameError(false);
            }}
            placeholder="Merchandiser's name"
            className={`border rounded-lg px-3 py-2 text-sm flex-1 ${
              nameError ? "border-red-400 bg-red-50" : "border-gray-300"
            }`}
          />
          <input
            value={customCode}
            onChange={(e) => setCustomCode(e.target.value)}
            placeholder="Custom code (optional)"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:w-40 font-mono uppercase"
          />
          <button
            type="submit"
            disabled={adding}
            className="px-3 py-2 rounded-lg text-white text-xs font-semibold whitespace-nowrap disabled:opacity-60"
            style={{ background: GREEN }}
          >
            {adding ? "Adding…" : customCode.trim() ? "+ Add with This Code" : "+ Add & Generate Code"}
          </button>
        </form>
        {nameError && <div className="text-xs text-red-600 mb-2">Type a name first, then tap &quot;Add&quot;.</div>}
        {justAdded && (
          <div
            className="text-xs rounded-lg px-3 py-2 mb-3 flex items-center justify-between"
            style={{ background: "#EEF7DE" }}
          >
            <span>
              Code for <span className="font-semibold">{justAdded.name}</span>:
            </span>
            <span className="font-mono font-bold tracking-widest" style={{ color: GREEN_DARK }}>
              {justAdded.code}
            </span>
          </div>
        )}
        {merchandisers.length === 0 ? (
          <div className="text-sm text-gray-400 py-4 text-center border-t border-gray-100">
            No merchandisers added yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-50 border-t border-gray-100">
            {merchandisers.map((m) => (
              <div key={m.id} className="py-2.5 flex items-center justify-between text-sm gap-2 flex-wrap">
                <span className="font-medium">
                  {m.name}
                  {!m.active && <span className="ml-2 text-[11px] text-gray-400">(disabled)</span>}
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs tracking-widest text-gray-300">••••••</span>
                  <button
                    onClick={() => handleToggleActive(m.id, !m.active)}
                    className="text-[11px] text-gray-400 font-semibold"
                  >
                    {m.active ? "Disable" : "Enable"}
                  </button>
                  <button onClick={() => handleRegenerate(m.id, m.name)} className="text-[11px] text-gray-400 font-semibold">
                    Regenerate
                  </button>
                  <button onClick={() => handleRemove(m.id)} className="text-[11px] text-red-500 font-semibold">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="font-semibold text-sm mb-1">Backup Team Code</div>
        <div className="text-xs text-gray-400 mb-3">
          Falls back for anyone without a personal code yet (e.g. a temp or new hire). Entries made with this code
          won&apos;t have a name pre-filled, so they still type their name in manually on the stocktake form.
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <input
            value={merchDraft}
            onChange={(e) => setMerchDraft(e.target.value)}
            placeholder="New backup code"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono tracking-widest w-48"
          />
          <button
            onClick={() => saveRoleCode("MERCHANDISER", merchDraft, () => setMerchDraft(""), setMerchSaved)}
            className="px-3 py-2 rounded-lg text-white text-xs font-semibold"
            style={{ background: GREEN }}
          >
            {merchSaved ? "Saved ✓" : "Save Code"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-sm">Branch Manager Codes</div>
            <div className="text-xs text-gray-400 mt-0.5">
              Each branch has its own code — share only that branch&apos;s code with that branch&apos;s manager.
            </div>
          </div>
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
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-gray-400 text-left text-xs">
                <th className="font-medium py-2 px-4">Branch</th>
                <th className="font-medium py-2 px-4">Code</th>
                <th className="font-medium py-2 px-4">Phone on file</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-gray-50">
                  <td className="py-2 px-4">{s.name.trim()}</td>
                  <td className="py-2 px-4 font-mono font-semibold" style={{ color: GREEN_DARK }}>
                    {s.code}
                  </td>
                  <td className="py-2 px-4 text-gray-400 text-xs">{s.phone || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
