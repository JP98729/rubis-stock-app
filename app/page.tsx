import Link from "next/link";
import { ArrowUpRight, ClipboardList, Lock, LayoutDashboard, MessageCircle, Store, Truck } from "lucide-react";
import { GREEN, GREEN_DARK, PURE_LOGO, RUBIS_LOGO, ENJOY_LOGO } from "@/lib/brand";

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
  {
    href: "/courier-hub",
    icon: Truck,
    color: "#EA580C",
    colorDark: "#9A3412",
    title: "Courier",
    desc: "See your deliveries — accept, upload documents, and check your fee.",
  },
];

export default function HomePage() {
  return (
    <main className="home">
      <section className="home-hero">
        <div className="home-hero__inner">
          <div className="home-logos">
            {/* eslint-disable @next/next/no-img-element */}
            <span className="home-logo"><img src={PURE_LOGO} alt="Pure Nutrition" /></span>
            <i aria-hidden>×</i>
            <span className="home-logo"><img src={RUBIS_LOGO} alt="Rubis" /></span>
            <i aria-hidden>×</i>
            <span className="home-logo home-logo--enjoy"><img src={ENJOY_LOGO} alt="Rubis Enjoy" /></span>
            {/* eslint-enable @next/next/no-img-element */}
          </div>
          <div className="home-eyebrow">Rubis Enjoy · Supplied by Pure Nutrition</div>
          <h1 className="home-title">
            Stock &amp; Reorder
            <span>Count it. Reorder it. Deliver it.</span>
          </h1>
          <p className="home-lead">
            One shared place for every branch to count stock, see exactly what to reorder and log every delivery.
          </p>
          <div className="home-chips">
            <span>Delivery run on the 23rd of every month</span>
            <span>Works on your phone</span>
          </div>
        </div>
      </section>

      <section className="home-roles">
        <div className="home-roles__head">Choose how you&apos;re using the app today</div>
        <div className="home-roles__grid">
          {cards.map((c, i) => (
            <Link
              key={c.href}
              href={c.href}
              className="role-card"
              style={{ ["--rc" as string]: c.color, ["--rcd" as string]: c.colorDark, animationDelay: `${0.12 * i}s` }}
            >
              <span className="role-card__num">0{i + 1}</span>
              <span className="role-card__icon">
                <c.icon size={24} className="text-white" />
              </span>
              <span className="role-card__body">
                <span className="role-card__title">{c.title}</span>
                <span className="role-card__desc">{c.desc}</span>
              </span>
              <span className="role-card__go">
                <ArrowUpRight size={18} />
              </span>
            </Link>
          ))}
        </div>
        <div className="home-lock">
          <Lock size={14} />
          Each role needs its own access code to sign in — ask your Pure Nutrition contact if you don&apos;t have yours.
        </div>
      </section>
    </main>
  );
}
