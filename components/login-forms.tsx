"use client";

import { useActionState } from "react";
import { ArrowRight, ClipboardList, KeyRound, LayoutDashboard, MessageCircle, Store, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GREEN, GREEN_DARK, PURE_LOGO, RUBIS_LOGO } from "@/lib/brand";
import { WhatsAppContact } from "./ui";
import { loginBranch, loginCourier, loginHq, loginManager, loginMerchandiser, type LoginState } from "@/app/actions/auth";

const initial: LoginState = {};

function Logos({ rubisOnly }: { rubisOnly?: boolean }) {
  return (
    <div className="lg-logos">
      {/* eslint-disable @next/next/no-img-element */}
      {!rubisOnly && (
        <span className="lg-logo">
          <img src={PURE_LOGO} alt="Pure Nutrition" />
        </span>
      )}
      <span className="lg-logo">
        <img src={RUBIS_LOGO} alt="Rubis" />
      </span>
      {/* eslint-enable @next/next/no-img-element */}
    </div>
  );
}

/** Shared sign-in card: coloured header with an icon, what-you-can-do chips, a big code field and a shiny button. */
function LoginShell({
  color,
  colorDark,
  icon: Icon,
  role,
  title,
  desc,
  chips,
  rubisOnly,
  children,
  footer,
}: {
  color: string;
  colorDark: string;
  icon: LucideIcon;
  role: string;
  title: string;
  desc: string;
  chips: string[];
  rubisOnly?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="lg-page" style={{ ["--lc" as string]: color, ["--lcd" as string]: colorDark }}>
      <div className="lg-card">
        <div className="lg-head">
          <Logos rubisOnly={rubisOnly} />
          <div className="lg-badge">
            <span className="lg-badge__ring" />
            <span className="lg-badge__icon">
              <Icon size={30} className="text-white" />
            </span>
          </div>
          <div className="lg-role">{role}</div>
        </div>
        <div className="lg-body">
          <h1 className="lg-title">{title}</h1>
          <p className="lg-desc">{desc}</p>
          <div className="lg-chips">
            {chips.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          {children}
          {footer && <div className="lg-foot">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

function CodeField({
  placeholder,
  password,
  upper = true,
}: {
  placeholder: string;
  password?: boolean;
  upper?: boolean;
}) {
  return (
    <label className="lg-field">
      <KeyRound size={18} />
      <input
        type={password ? "password" : "text"}
        name="code"
        placeholder={placeholder}
        autoCapitalize={upper ? "characters" : "off"}
        autoComplete="off"
        className={upper ? "uppercase" : ""}
      />
    </label>
  );
}

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button type="submit" disabled={pending} className="lg-btn">
      <span>{pending ? "Checking…" : label}</span>
      {!pending && <ArrowRight size={18} />}
    </button>
  );
}

export function MerchandiserLogin() {
  const [state, formAction, pending] = useActionState(loginMerchandiser, initial);
  return (
    <LoginShell
      color={GREEN}
      colorDark={GREEN_DARK}
      icon={ClipboardList}
      role="Merchandiser"
      title="Merchandiser Access"
      desc="Enter your personal access code to submit stocktakes and log deliveries across all branches."
      chips={["Stocktakes", "Deliveries & returns", "All branches"]}
      footer={
        <>
          Don&apos;t have a code? Message your Pure Nutrition contact and ask for your personal access code.
          <div className="mt-1.5">
            <WhatsAppContact message="Hi, I need my personal Rubis Enjoy merchandiser access code." />
          </div>
        </>
      }
    >
      <form action={formAction} className="lg-form">
        <CodeField placeholder="e.g. MC-4K7Q" />
        {state.error && <div className="lg-error">{state.error}</div>}
        <SubmitButton pending={pending} label="Unlock" />
      </form>
    </LoginShell>
  );
}

export function BranchLogin() {
  const [state, formAction, pending] = useActionState(loginBranch, initial);
  return (
    <LoginShell
      color="#2563EB"
      colorDark="#1E40AF"
      icon={Store}
      role="Branch Manager"
      title="Branch Manager Access"
      desc="Enter your branch's access code to view your shop's stock, log deliveries, and see your order status."
      chips={["Your shop's stock", "Deliveries", "Order status"]}
      footer={
        <>
          Don&apos;t have a code? Message your Pure Nutrition contact and ask for your personal access code. Text your
          branch&apos;s name.
          <div className="mt-1.5">
            <WhatsAppContact message="Hi, I need my branch's Rubis Enjoy access code. My branch's name is: " />
          </div>
        </>
      }
    >
      <form action={formAction} className="lg-form">
        <CodeField placeholder="e.g. RB004" />
        {state.error && <div className="lg-error">{state.error}</div>}
        <SubmitButton pending={pending} label="Log In" />
      </form>
    </LoginShell>
  );
}

export function ManagerLogin() {
  const [state, formAction, pending] = useActionState(loginManager, initial);
  return (
    <LoginShell
      color="#1F2937"
      colorDark="#111827"
      icon={LayoutDashboard}
      role="Pure Nutrition Manager"
      title="Pure Nutrition Manager Access"
      desc="This dashboard shows every branch's stock, orders, and all merchandiser/branch access codes. Restricted to Pure Nutrition management only."
      chips={["Orders", "Production plan", "Access codes"]}
    >
      <form action={formAction} className="lg-form">
        <CodeField placeholder="Manager access code" password upper={false} />
        {state.error && <div className="lg-error">{state.error}</div>}
        <SubmitButton pending={pending} label="Unlock" />
      </form>
    </LoginShell>
  );
}

export function CourierLogin() {
  const [state, formAction, pending] = useActionState(loginCourier, initial);
  return (
    <LoginShell
      color="#EA580C"
      colorDark="#9A3412"
      icon={Truck}
      role="Courier"
      title="Courier Access"
      desc="Enter your courier access code to see your deliveries — accept, upload documents, and check your fee."
      chips={["Your deliveries", "Upload documents", "Your fee"]}
      rubisOnly
      footer={
        <>
          Don&apos;t have a code? Message your Pure Nutrition contact.
          <div className="mt-1.5">
            <WhatsAppContact message="Hi, I need my courier access code for the Rubis Enjoy app." />
          </div>
        </>
      }
    >
      <form action={formAction} className="lg-form">
        <CodeField placeholder="Courier access code" />
        {state.error && <div className="lg-error">{state.error}</div>}
        <SubmitButton pending={pending} label="Unlock" />
      </form>
    </LoginShell>
  );
}

export function HqLogin() {
  const [state, formAction, pending] = useActionState(loginHq, initial);
  return (
    <LoginShell
      color="#C0392B"
      colorDark="#992D22"
      icon={MessageCircle}
      role="Rubis Head Office"
      title="Rubis Head Office Access"
      desc="Send announcements and updates to your branch managers — all branches, a specific county, or a single branch."
      chips={["All branches", "A county", "One branch"]}
      rubisOnly
      footer={
        <>
          Don&apos;t have the code?{" "}
          <WhatsAppContact message="Hi, I need the Rubis HQ access code for the Stock & Reorder app." />
        </>
      }
    >
      <form action={formAction} className="lg-form">
        <CodeField placeholder="Rubis HQ access code" />
        {state.error && <div className="lg-error">{state.error}</div>}
        <SubmitButton pending={pending} label="Unlock" />
      </form>
    </LoginShell>
  );
}
