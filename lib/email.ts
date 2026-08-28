import "server-only";

const NOTIFY_EMAIL = "info@pure-nutritions.com";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Rubis Enjoy <onboarding@resend.dev>";

/**
 * Sends a stocktake summary email from the server the moment a stocktake is saved —
 * no dependence on the submitter's own device/mail app. Silently no-ops when
 * RESEND_API_KEY isn't set (e.g. local dev) so it never blocks a submission.
 */
export async function sendStocktakeSummaryEmail(
  store: { name: string; county: string; type: string },
  entry: {
    date: string;
    merchandiser: string;
    idNumber: string;
    notes: string;
    checksPlacement: string | null;
    checksPrices: string | null;
    checksMissing: string | null;
    items: Array<{ name: string; shelfQty: number; backStock: number; expired: number; damaged: number }>;
  },
  minStock: number
) {
  if (!process.env.RESEND_API_KEY) return;

  const flagged = entry.checksPlacement === "No" || entry.checksPrices === "No" || entry.checksMissing === "Yes";
  const lowStockCount = entry.items.filter((it) => it.shelfQty + it.backStock < minStock).length;
  const subject = `Stocktake submitted — ${store.name.trim()} — ${entry.date}`;
  const itemLines = entry.items.map((it) => {
    const onHand = it.shelfQty + it.backStock;
    const extras = [
      it.expired ? `expired ${it.expired}` : "",
      it.damaged ? `damaged ${it.damaged}` : "",
    ].filter(Boolean);
    const flag = onHand < minStock ? " — LOW" : "";
    return `  ${it.name}: shelf ${it.shelfQty}, back ${it.backStock}, total ${onHand}${extras.length ? ` (${extras.join(", ")})` : ""}${flag}`;
  });
  const bodyLines = [
    `Branch: ${store.name.trim()} (${store.county} · ${store.type})`,
    `Date: ${entry.date}`,
    `Submitted by: ${entry.merchandiser}${entry.idNumber ? ` (ID ${entry.idNumber})` : ""}`,
    "",
    `Products below minimum stock (${minStock} units): ${lowStockCount}`,
    entry.checksPlacement !== null ? `Store display check flagged an issue: ${flagged ? "Yes — see app for details" : "No"}` : "",
    entry.notes ? `Notes: ${entry.notes}` : "",
    "",
    "Stock counts:",
    ...itemLines,
    "",
    "Full details, photos, and signature are in the Rubis Enjoy Stock & Reorder app.",
  ].filter(Boolean);

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: NOTIFY_EMAIL,
      subject,
      text: bodyLines.join("\n"),
    });
  } catch {
    // Email is a bonus notification, not part of the submission contract — never throw.
  }
}
