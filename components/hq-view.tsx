"use client";

import { useState } from "react";
import type { Audience } from "@prisma/client";
import { RUBIS_LOGO } from "@/lib/brand";
import { ToastView, useToast } from "./toast";
import { deleteAnnouncement, sendAnnouncement } from "@/app/actions/hq";
import type { MessageDTO, StoreDTO } from "@/lib/queries";

export function HqView({
  messages,
  stores,
  counties,
  audienceLabels,
}: {
  messages: MessageDTO[];
  stores: StoreDTO[];
  counties: string[];
  audienceLabels: Record<string, string>;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("ALL");
  const [county, setCounty] = useState(counties[0] ?? "");
  const [storeType, setStoreType] = useState("COCO");
  const [storeId, setStoreId] = useState(String(stores[0]?.id ?? ""));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const { toast, showToast } = useToast();

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    const res = await sendAnnouncement({
      subject,
      body,
      audience,
      county: audience === "COUNTY" ? county : undefined,
      storeType: audience === "TYPE" ? storeType : undefined,
      storeId: audience === "STORE" ? Number(storeId) : undefined,
    });
    setSending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSubject("");
    setBody("");
    showToast("Message sent");
  }

  async function handleDelete(id: string) {
    const res = await deleteAnnouncement(id);
    if (!res.ok) showToast(res.error);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 flex flex-col gap-4">
      <ToastView toast={toast} />
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={RUBIS_LOGO} alt="Rubis" className="h-8 w-auto" />
        <div>
          <div className="font-bold text-sm leading-none">Rubis Head Office</div>
          <div className="text-[11px] text-gray-400 leading-none mt-0.5">Message your branch managers</div>
        </div>
      </div>

      <form onSubmit={handleSend} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
        <div className="font-semibold text-sm">New Announcement</div>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-gray-500 font-medium">Send to</span>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as Audience)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="ALL">All branches</option>
            <option value="COUNTY">A specific county</option>
            <option value="TYPE">All COCO or all CODO branches</option>
            <option value="STORE">A single branch</option>
          </select>
        </label>
        {audience === "COUNTY" && (
          <select
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {counties.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        {audience === "TYPE" && (
          <select
            value={storeType}
            onChange={(e) => setStoreType(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="COCO">COCO branches</option>
            <option value="CODO">CODO branches</option>
          </select>
        )}
        {audience === "STORE" && (
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name.trim()}
              </option>
            ))}
          </select>
        )}
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message to branch managers…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          rows={4}
        />
        {error && <div className="text-xs text-red-600">{error}</div>}
        <button
          type="submit"
          disabled={sending}
          className="py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-60"
          style={{ background: "#C0392B" }}
        >
          {sending ? "Sending…" : "Send Announcement"}
        </button>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm">
          Sent Announcements ({messages.length})
        </div>
        {messages.length === 0 ? (
          <div className="text-sm text-gray-400 py-8 text-center">No announcements sent yet.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {messages.map((m) => (
              <div key={m.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-sm">{m.subject}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {audienceLabels[m.id]} · {m.createdAtLabel}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="text-[11px] text-red-500 font-semibold whitespace-nowrap"
                  >
                    Delete
                  </button>
                </div>
                <div className="text-sm text-gray-600 mt-1.5 whitespace-pre-wrap">{m.body}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
