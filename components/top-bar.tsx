import { Store } from "lucide-react";
import Link from "next/link";
import { GREEN, ENJOY_LOGO, RUBIS_LOGO, PURE_LOGO } from "@/lib/brand";
import { logout } from "@/app/actions/auth";
import type { Role } from "@/lib/session";

const ROLE_LABELS: Record<Role, string> = {
  merchandiser: "Merchandiser",
  branch: "Branch Manager",
  hq: "Rubis HQ",
  manager: "Pure Nutrition Manager",
};

export function TopBar({ role }: { role: Role | null }) {
  return (
    <div className="sticky top-0 z-40 border-b border-black/10" style={{ background: GREEN }}>
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 text-left">
          {/* eslint-disable @next/next/no-img-element */}
          <img src={ENJOY_LOGO} alt="Rubis Enjoy" className="w-9 h-9 rounded-lg object-cover shadow-sm" />
          <img src={RUBIS_LOGO} alt="Rubis" className="h-8 w-auto rounded bg-white/95 px-1 py-0.5 shadow-sm" />
          <img src={PURE_LOGO} alt="Pure Nutrition" className="h-8 w-auto rounded bg-white/95 px-1 py-0.5 shadow-sm" />
          {/* eslint-enable @next/next/no-img-element */}
          <div className="hidden sm:block ml-1">
            <div className="font-bold text-sm leading-none text-white">Rubis Enjoy</div>
            <div className="text-[11px] text-white/80 leading-none mt-0.5">
              {role ? ROLE_LABELS[role] : "Stock & Reorder · Supplied by Pure Nutrition"}
            </div>
          </div>
        </Link>
        {role !== null && (
          <form action={logout}>
            <button
              type="submit"
              className="flex items-center gap-1.5 bg-black/15 hover:bg-black/25 transition rounded-full px-3.5 py-1.5 text-xs font-semibold text-white whitespace-nowrap"
            >
              <Store size={13} /> Switch role
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
