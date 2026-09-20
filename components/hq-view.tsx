"use client";

import { useState } from "react";
import type { Audience } from "@prisma/client";
import { Send, CheckCircle2, Package } from "lucide-react";
import { RUBIS_LOGO, GREEN, GREEN_DARK, RANGES, RANGE_COLORS, RANGE_TINT } from "@/lib/brand";
import { ToastView, useToast } from "./toast";
import { ProductThumb } from "./ui";
import { SignaturePad } from "./signature-pad";
import { deleteAnnouncement, sendAnnouncement, placeHqOrder } from "@/app/actions/hq";
import type { MessageDTO, StoreDTO, ProductDTO } from "@/lib/queries";

export function HqView({
  messages,
  stores,
  counties,
  audienceLabels,
  products,
}: {
  messages: MessageDTO[];
  stores: StoreDTO[];
  counties: string[];
  audienceLabels: Record<string, string>;
  products: ProductDTO[];
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

  // --- HQ's own order ---
  const [orderQty, setOrderQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(products.map((p) => [p.sku, 0]))
  );
  const [orderName, setOrderName] = useState("");
  const [orderFunction, setOrderFunction] = useState("");
  const [orderSignature, setOrderSignature] = useState<string | null>(null);
  const [orderAddress, setOrderAddress] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [orderBusy, setOrderBusy] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [orderConfirmed, setOrderConfirmed] = useState(false);

  async function handlePlaceHqOrder() {
    if (!orderName.trim()) {
      setOrderError("Please enter your name before placing the order.");
      return;
    }
    if (!orderFunction.trim()) {
      setOrderError("Please select your function before placing the order.");
      return;
    }
    if (!orderAddress.trim()) {
      setOrderError("Please enter a delivery address before placing the order.");
      return;
    }
    if (!orderSignature) {
      setOrderError("Please sign before placing the order.");
      return;
    }
    setOrderBusy(true);
    setOrderError("");
    const result = await placeHqOrder(
      orderQty,
      orderName.trim(),
      orderFunction.trim(),
      orderSignature,
      orderAddress.trim(),
      orderNote.trim()
    );
    if (result.ok) {
      setOrderConfirmed(true);
      setOrderQty(Object.fromEntries(products.map((p) => [p.sku, 0])));
      setOrderSignature(null);
      setOrderAddress("");
      setOrderNote("");
      setTimeout(() => setOrderConfirmed(false), 5000);
      showToast(`Order sent to Pure Nutrition — ${result.itemCount} product${result.itemCount === 1 ? "" : "s"}.`);
    } else {
      setOrderError(result.error);
    }
    setOrderBusy(false);
  }

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
          <div className="text-[11px] text-gray-400 leading-none mt-0.5">Message your branch managers, or place an order for head office</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-1.5 font-semibold text-sm">
          <Package size={15} /> Order for Head Quarters
        </div>
        <div className="divide-y divide-gray-50">
          {RANGES.map((range) => {
            const rangeItems = products.filter((p) => p.range === range);
            if (rangeItems.length === 0) return null;
            const rc = RANGE_COLORS[range];
            return (
              <div key={range}>
                <div
                  className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide"
                  style={{ background: RANGE_TINT[range], color: rc }}
                >
                  {range}
                </div>
                <div className="divide-y divide-gray-50">
                  {rangeItems.map((p) => (
                    <div key={p.sku} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                      <ProductThumb product={p} size={28} />
                      <div className="flex-1">
                        <div className="font-medium">{p.flavour}</div>
                        <div className="text-[11px] text-gray-400">{p.sku}</div>
                      </div>
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={orderQty[p.sku] ?? 0}
                        onChange={(e) =>
                          setOrderQty((prev) => ({
                            ...prev,
                            [p.sku]: Math.max(0, Math.trunc(Number(e.target.value) || 0)),
                          }))
                        }
                        className="w-16 text-center font-semibold border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                        style={{ color: "#C0392B" }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-gray-500 font-medium">Your name</span>
            <input
              type="text"
              value={orderName}
              onChange={(e) => setOrderName(e.target.value)}
              placeholder="Type your full name"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-gray-500 font-medium">Your function</span>
            <select
              value={orderFunction}
              onChange={(e) => setOrderFunction(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Select your function</option>
              <option value="Branch manager">Branch manager</option>
              <option value="Sales person">Sales person</option>
              <option value="Supervisor">Supervisor</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-gray-500 font-medium">Delivery address</span>
            <input
              type="text"
              value={orderAddress}
              onChange={(e) => setOrderAddress(e.target.value)}
              placeholder="Where should this order be delivered?"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-gray-500 font-medium">Note (optional)</span>
            <textarea
              value={orderNote}
              onChange={(e) => setOrderNote(e.target.value)}
              placeholder="Anything else Pure Nutrition should know?"
              rows={2}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </label>
          <div>
            <span className="text-[11px] text-gray-500 font-medium">Sign to confirm</span>
            <SignaturePad onChange={setOrderSignature} />
            {!orderSignature && (
              <div className="text-[11px] text-amber-600 mt-1">Signature required before placing the order.</div>
            )}
          </div>
          <button
            onClick={handlePlaceHqOrder}
            disabled={orderBusy || !orderName.trim() || !orderFunction.trim() || !orderAddress.trim() || !orderSignature}
            className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold text-white disabled:opacity-60"
            style={{
              background:
                orderBusy || !orderName.trim() || !orderFunction.trim() || !orderAddress.trim() || !orderSignature
                  ? "#9CA3AF"
                  : GREEN,
            }}
          >
            <Send size={16} /> {orderBusy ? "Sending…" : "Place Order"}
          </button>
          {orderError && <div className="text-xs text-red-600">{orderError}</div>}
          {orderConfirmed && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"
              style={{ background: "#EEF7DE", color: GREEN_DARK }}
            >
              <CheckCircle2 size={16} className="shrink-0" />
              Order sent to Pure Nutrition!
            </div>
          )}
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
