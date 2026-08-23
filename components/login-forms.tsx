"use client";

import { useActionState } from "react";
import { GREEN, PURE_LOGO, RUBIS_LOGO } from "@/lib/brand";
import { WhatsAppContact } from "./ui";
import { loginBranch, loginHq, loginManager, loginMerchandiser, type LoginState } from "@/app/actions/auth";

const initial: LoginState = {};

function Logos({ rubisOnly }: { rubisOnly?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-3">
      {/* eslint-disable @next/next/no-img-element */}
      {!rubisOnly && <img src={PURE_LOGO} alt="Pure Nutrition" className="h-9 w-auto" />}
      <img src={RUBIS_LOGO} alt="Rubis" className={rubisOnly ? "h-10 w-auto" : "h-9 w-auto"} />
      {/* eslint-enable @next/next/no-img-element */}
    </div>
  );
}

export function MerchandiserLogin() {
  const [state, formAction, pending] = useActionState(loginMerchandiser, initial);
  return (
    <div className="max-w-sm mx-auto px-4 pt-10">
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <Logos />
        <div className="font-bold text-lg mb-1">Merchandiser Access</div>
        <div className="text-sm text-gray-500 mb-5">
          Enter your personal access code to submit stocktakes and log deliveries across all branches.
        </div>
        <form action={formAction} className="flex flex-col gap-3">
          <input
            name="code"
            placeholder="e.g. MC-4K7Q"
            autoCapitalize="characters"
            className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-center tracking-widest font-semibold uppercase"
          />
          {state.error && <div className="text-xs text-red-600">{state.error}</div>}
          <button
            type="submit"
            disabled={pending}
            className="py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-60"
            style={{ background: GREEN }}
          >
            {pending ? "Checking…" : "Unlock"}
          </button>
        </form>
        <div className="text-[11px] text-gray-400 mt-4">
          Don&apos;t have a code? Message your Pure Nutrition contact and ask for your personal access code.
          <div className="mt-1.5">
            <WhatsAppContact message="Hi, I need my personal Rubis Enjoy merchandiser access code." />
          </div>
        </div>
      </div>
    </div>
  );
}

export function BranchLogin() {
  const [state, formAction, pending] = useActionState(loginBranch, initial);
  return (
    <div className="max-w-sm mx-auto px-4 pt-10">
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <Logos />
        <div className="font-bold text-lg mb-1">Branch Manager Access</div>
        <div className="text-sm text-gray-500 mb-5">
          Enter your branch&apos;s access code to view your shop&apos;s stock, log deliveries, and see your order status.
        </div>
        <form action={formAction} className="flex flex-col gap-3">
          <input
            name="code"
            placeholder="e.g. RB004"
            autoCapitalize="characters"
            className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-center tracking-widest font-semibold uppercase"
          />
          {state.error && <div className="text-xs text-red-600">{state.error}</div>}
          <button
            type="submit"
            disabled={pending}
            className="py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-60"
            style={{ background: GREEN }}
          >
            {pending ? "Checking…" : "Log In"}
          </button>
        </form>
        <div className="text-[11px] text-gray-400 mt-4">
          Don&apos;t have a code? Message your Pure Nutrition contact and ask for your personal access code. Text your
          branch&apos;s name.
          <div className="mt-1.5">
            <WhatsAppContact message="Hi, I need my branch's Rubis Enjoy access code. My branch's name is: " />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ManagerLogin() {
  const [state, formAction, pending] = useActionState(loginManager, initial);
  return (
    <div className="max-w-sm mx-auto px-4 pt-10">
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <Logos />
        <div className="font-bold text-lg mb-1">Pure Nutrition Manager Access</div>
        <div className="text-sm text-gray-500 mb-5">
          This dashboard shows every branch&apos;s stock, orders, and all merchandiser/branch access codes. Restricted to
          Pure Nutrition management only.
        </div>
        <form action={formAction} className="flex flex-col gap-3">
          <input
            type="password"
            name="code"
            placeholder="Manager access code"
            className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-center tracking-widest font-semibold"
          />
          {state.error && <div className="text-xs text-red-600">{state.error}</div>}
          <button
            type="submit"
            disabled={pending}
            className="py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-60"
            style={{ background: "#1f2937" }}
          >
            {pending ? "Checking…" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function HqLogin() {
  const [state, formAction, pending] = useActionState(loginHq, initial);
  return (
    <div className="max-w-sm mx-auto px-4 pt-10">
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <Logos rubisOnly />
        <div className="font-bold text-lg mb-1">Rubis Head Office Access</div>
        <div className="text-sm text-gray-500 mb-5">
          Send announcements and updates to your branch managers — all branches, a specific county, or a single branch.
        </div>
        <form action={formAction} className="flex flex-col gap-3">
          <input
            name="code"
            placeholder="Rubis HQ access code"
            autoCapitalize="characters"
            className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-center tracking-widest font-semibold uppercase"
          />
          {state.error && <div className="text-xs text-red-600">{state.error}</div>}
          <button
            type="submit"
            disabled={pending}
            className="py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-60"
            style={{ background: "#C0392B" }}
          >
            {pending ? "Checking…" : "Unlock"}
          </button>
        </form>
        <div className="text-[11px] text-gray-400 mt-4">
          Don&apos;t have the code?{" "}
          <WhatsAppContact message="Hi, I need the Rubis HQ access code for the Stock & Reorder app." />
        </div>
      </div>
    </div>
  );
}
