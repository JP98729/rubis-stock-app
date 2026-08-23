import Link from "next/link";
import { ClipboardList, LayoutDashboard, MessageCircle, Store } from "lucide-react";
import { GREEN, GREEN_DARK, PURE_LOGO, RUBIS_LOGO, ENJOY_LOGO } from "@/lib/brand";
import { TopBar } from "@/components/top-bar";

export const dynamic = "force-dynamic";

const cards = [
  {
    href: "/merchandiser",
    icon: ClipboardList,
    color: GREEN,
    colorDark: GREEN_DARK,
    title: "Merchandiser",
    desc: "Do a stocktake or log a delivery/sale/return at any branch you visit.",
  },
  {
    href: "/branch",
    icon: Store,
    color: "#2563EB",
    colorDark: "#1E40AF",
    title: "Branch Manager",
    desc: "View your own shop's stock, orders, and messages from Rubis HQ.",
  },
  {
    href: "/hq",
    icon: MessageCircle,
    color: "#C0392B",
    colorDark: "#992D22",
    title: "Rubis HQ",
    desc: "Send announcements to branch managers — all branches or a specific one.",
  },
  {
    href: "/manager",
    icon: LayoutDashboard,
    color: "#1F2937",
    colorDark: "#111827",
    title: "Pure Nutrition Manager",
    desc: "Full dashboard — orders, production plan, alerts, and team access codes.",
  },
];

export default function HomePage() {
  return (
    <>
      <TopBar role={null} />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center gap-3 mb-2">
          {/* eslint-disable @next/next/no-img-element */}
          <img src={PURE_LOGO} alt="Pure Nutrition" className="h-12 w-auto" />
          <img src={RUBIS_LOGO} alt="Rubis" className="h-12 w-auto" />
          <img src={ENJOY_LOGO} alt="Rubis Enjoy" className="h-12 w-12 rounded-xl object-cover" />
          {/* eslint-enable @next/next/no-img-element */}
        </div>
        <div className="text-center mb-8">
          <div className="font-bold text-xl">Rubis Enjoy — Stock &amp; Reorder</div>
          <div className="text-sm text-gray-400 mt-1">
            Supplied by Pure Nutrition. Choose how you&apos;re using the app today.
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="text-left bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-3 hover:shadow-md active:scale-[0.98] transition"
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: c.color }}>
                <c.icon size={22} className="text-white" />
              </div>
              <div>
                <div className="font-bold text-base" style={{ color: c.colorDark }}>
                  {c.title}
                </div>
                <div className="text-sm text-gray-500 mt-1">{c.desc}</div>
              </div>
            </Link>
          ))}
        </div>
        <div className="text-center text-xs text-gray-400 mt-8">
          Each role needs its own access code to sign in — ask your Pure Nutrition contact if you don&apos;t have yours.
        </div>
      </div>
    </>
  );
}
