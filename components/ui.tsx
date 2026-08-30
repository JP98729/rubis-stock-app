"use client";

import { MessageCircle } from "lucide-react";
import { GREEN, GREEN_DARK, RANGE_COLORS, PURE_PHONE_DISPLAY, PURE_PHONE_WA } from "@/lib/brand";

export function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: color + "20", color }}
    >
      {children}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-1 min-w-[140px]">
      <div className="text-xs text-gray-500 font-medium">{label}</div>
      <div className="text-2xl font-bold" style={{ color: color || "#1f2937" }}>
        {value}
      </div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

export function NumField({
  label,
  value,
  onChange,
  danger,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 flex-1 min-w-[70px]">
      <span className="text-[11px] text-gray-500 font-medium">{label}</span>
      <input
        type="number"
        min="0"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value) || 0))}
        disabled={disabled}
        className={`border rounded-lg px-2 py-2 text-sm w-full text-center ${
          disabled
            ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
            : danger
              ? "border-red-300 bg-red-50"
              : "border-gray-300"
        }`}
      />
    </label>
  );
}

export function YesNoQuestion({
  label,
  value,
  onChange,
  invertColor,
  neutral,
}: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
  invertColor?: boolean;
  neutral?: boolean;
}) {
  // Normally "No" is the concerning answer (e.g. "well placed?" -> No is bad).
  // invertColor flips that for questions where "Yes" is the concerning answer (e.g. "missing items?" -> Yes is bad).
  // neutral is for questions with no good/bad answer (e.g. "on promotion?") — both selections show as blue, not red/green.
  const badAnswer = invertColor ? "Yes" : "No";
  return (
    <div>
      <div className="text-sm mb-1.5" dangerouslySetInnerHTML={{ __html: label }} />
      <div className="flex gap-2">
        {["Yes", "No"].map((opt) => {
          const selected = value === opt;
          const isBad = opt === badAnswer;
          const bg = neutral ? "#1D4ED8" : isBad ? "#C0392B" : GREEN;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${
                selected ? "text-white border-transparent" : "border-gray-200 text-gray-500 bg-white"
              }`}
              style={selected ? { background: bg } : {}}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Small colored initial "photo" placeholder per product, since no real product photography is loaded yet. */
export function ProductThumb({
  product,
  size = 36,
}: {
  product: { range: string; flavour: string };
  size?: number;
}) {
  const c = RANGE_COLORS[product.range];
  return (
    <div
      className="rounded-lg flex items-center justify-center font-bold text-white shrink-0"
      style={{ width: size, height: size, background: c, fontSize: size * 0.4 }}
      title={`${product.flavour} — no product photo loaded yet`}
    >
      {product.flavour.trim().charAt(0)}
    </div>
  );
}

export function WhatsAppContact({ message }: { message?: string }) {
  const href = `https://wa.me/${PURE_PHONE_WA}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 font-semibold"
      style={{ color: GREEN_DARK }}
    >
      <MessageCircle size={13} /> WhatsApp {PURE_PHONE_DISPLAY}
    </a>
  );
}
