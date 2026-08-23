export const fmtKES = (n: number) => "KES " + Math.round(n).toLocaleString("en-US");

export const todayStr = () => new Date().toISOString().slice(0, 10);

export function currentMonthKey() {
  return todayStr().slice(0, 7);
}

export function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

// ---------- Generic month calendar (Mon-first), used by Delivery Calendar ----------
export function buildMonthGrid(year: number, monthIdx: number): number[][] {
  const first = new Date(year, monthIdx, 1);
  const startOffset = (first.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const cells: number[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(0);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(0);
  const weeks: number[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export const WEEKDAY_NAME = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function deliveryWeekday(year: number, monthIdx: number) {
  return WEEKDAY_NAME[(new Date(year, monthIdx, 23).getDay() + 6) % 7];
}

/** Fixed monthly delivery run: the 23rd of every month, everywhere. */
export function nextDeliveryDate() {
  const now = new Date();
  let d = new Date(now.getFullYear(), now.getMonth(), 23);
  if (now.getDate() > 23) d = new Date(now.getFullYear(), now.getMonth() + 1, 23);
  return d;
}

export function daysUntil(date: Date) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - now.getTime()) / 86400000);
}

export function isLastDayOfMonth(date = new Date()) {
  const test = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return test.getMonth() !== date.getMonth();
}

export function timeAgo(iso: string | Date) {
  const then = new Date(iso);
  const diff = Date.now() - then.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ---------- Head Office messages ----------
export type MessageLike = {
  audience: "ALL" | "COUNTY" | "TYPE" | "STORE";
  county?: string | null;
  storeType?: string | null;
  storeId?: number | null;
};

export type StoreLike = { id: number; county: string; type: string; name: string };

export function messageAppliesToStore(msg: MessageLike, store: StoreLike): boolean {
  if (msg.audience === "ALL") return true;
  if (msg.audience === "COUNTY") return msg.county === store.county;
  if (msg.audience === "TYPE") return msg.storeType === store.type;
  if (msg.audience === "STORE") return msg.storeId === store.id;
  return false;
}

export function audienceLabel(msg: MessageLike, stores: StoreLike[]): string {
  if (msg.audience === "ALL") return "All branches";
  if (msg.audience === "COUNTY") return `${msg.county} branches`;
  if (msg.audience === "TYPE") return `All ${msg.storeType} branches`;
  if (msg.audience === "STORE") {
    const s = stores.find((x) => x.id === msg.storeId);
    return s ? s.name.trim() : "1 branch";
  }
  return "";
}
