const NOTIFY_EMAIL = "info@pure-nutritions.com";

/**
 * Opens the person's own email app with a pre-filled draft summarizing a just-submitted
 * stocktake. This is a client-only convenience (no backend email sending) — it just gets
 * the merchandiser to "tap Send" on something already drafted for them.
 */
export function emailStocktakeSummary(
  store: { name: string; county: string; type: string },
  entry: {
    date: string;
    merchandiser: string;
    idNumber: string;
    notes: string;
    checksPlacement: string | null;
    checksPrices: string | null;
    checksMissing: string | null;
    items: Array<{ shelfQty: number; backStock: number }>;
  },
  minStock: number
) {
  const flagged = entry.checksPlacement === "No" || entry.checksPrices === "No" || entry.checksMissing === "Yes";
  const lowStockCount = entry.items.filter((it) => it.shelfQty + it.backStock < minStock).length;
  const subject = `Stocktake submitted — ${store.name.trim()} — ${entry.date}`;
  const bodyLines = [
    `Branch: ${store.name.trim()} (${store.county} · ${store.type})`,
    `Date: ${entry.date}`,
    `Submitted by: ${entry.merchandiser}${entry.idNumber ? ` (ID ${entry.idNumber})` : ""}`,
    "",
    `Products below minimum stock (${minStock} units): ${lowStockCount}`,
    entry.checksPlacement !== null ? `Store display check flagged an issue: ${flagged ? "Yes — see app for details" : "No"}` : "",
    entry.notes ? `Notes: ${entry.notes}` : "",
    "",
    "Full details, photos, and signature are in the Rubis Enjoy Stock & Reorder app.",
  ].filter(Boolean);
  const href = `mailto:${NOTIFY_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
  try {
    window.open(href, "_blank");
  } catch {
    /* if popup is blocked, the person can still submit fine — email is a bonus, not required */
  }
}
