"use client";

import { useState } from "react";
import { Bell, ClipboardList, CreditCard, Factory, LayoutDashboard, Package, Store as StoreIcon, Truck } from "lucide-react";
import { GREEN } from "@/lib/brand";
import { ToastView, useToast } from "../toast";
import { DeliveryCalendar } from "../delivery";
import type { SpotlightRow } from "../spotlight";
import { Dashboard } from "./dashboard";
import { OrderSummary } from "./order-summary";
import { ProductionPlan } from "./production-plan";
import { Alerts } from "./alerts";
import { StoresTable } from "./stores-table";
import { ProductsTable } from "./products-table";
import { TeamAccess } from "./team-access";
import type { AlertsData, DashboardData, MerchandiserRow, ProductionRow, StoreOrder, StoreTableRow } from "./types";
import type { ProductDTO, RecentStocktakeDTO, StoreDTO } from "@/lib/queries";

type Tab = "dashboard" | "orders" | "production" | "alerts" | "delivery" | "stores" | "products" | "access";

const TABS: Array<{ key: Tab; label: string; icon: typeof LayoutDashboard }> = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "orders", label: "Order Summary", icon: ClipboardList },
  { key: "production", label: "Production Plan", icon: Factory },
  { key: "alerts", label: "Alerts", icon: Bell },
  { key: "delivery", label: "Delivery Calendar", icon: Truck },
  { key: "stores", label: "Stores", icon: StoreIcon },
  { key: "products", label: "Products", icon: Package },
  { key: "access", label: "Team Access", icon: CreditCard },
];

export function ManagerView(props: {
  today: string;
  dashboard: DashboardData;
  recentStocktakes: RecentStocktakeDTO[];
  leaderboard: SpotlightRow[];
  monthKey: string;
  monthLabelText: string;
  reward: { note: string; sent: boolean };
  orders: StoreOrder[];
  production: ProductionRow[];
  alerts: AlertsData;
  storeRows: StoreTableRow[];
  products: ProductDTO[];
  stores: StoreDTO[];
  merchandisers: MerchandiserRow[];
}) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const { toast, showToast } = useToast();

  return (
    <div className="max-w-6xl mx-auto px-4 py-5">
      <ToastView toast={toast} />
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 pb-3 mb-4 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex items-center justify-center sm:justify-start gap-1.5 px-3.5 py-2 rounded-lg sm:rounded-t-lg text-xs sm:text-sm font-semibold whitespace-nowrap ${
              tab === t.key ? "text-white" : "text-gray-500 hover:bg-gray-100 border border-gray-200 sm:border-0"
            }`}
            style={tab === t.key ? { background: GREEN } : {}}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <Dashboard
          data={props.dashboard}
          recentStocktakes={props.recentStocktakes}
          leaderboard={props.leaderboard}
          monthKey={props.monthKey}
          monthLabelText={props.monthLabelText}
          reward={props.reward}
        />
      )}
      {tab === "orders" && <OrderSummary orders={props.orders} />}
      {tab === "production" && <ProductionPlan rows={props.production} />}
      {tab === "alerts" && <Alerts data={props.alerts} />}
      {tab === "delivery" && <DeliveryCalendar today={props.today} />}
      {tab === "stores" && <StoresTable rows={props.storeRows} onToast={showToast} />}
      {tab === "products" && <ProductsTable products={props.products} onToast={showToast} />}
      {tab === "access" && <TeamAccess merchandisers={props.merchandisers} stores={props.stores} onToast={showToast} />}
    </div>
  );
}
