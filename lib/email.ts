import "server-only";

const NOTIFY_EMAIL = "info@pure-nutritions.com";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Rubis Enjoy <onboarding@resend.dev>";

const GREEN = "#6DBE00";
const GREEN_DARK = "#4E8A00";
const RED = "#C0392B";
const INK = "#1F2937";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const BG = "#F3F4F6";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Sends a stocktake summary email from the server the moment a stocktake is saved —
 * no dependence on the submitter's own device/mail app. Silently no-ops when
 * RESEND_API_KEY isn't set (e.g. local dev) so it never blocks a submission.
 */
export async function sendStocktakeSummaryEmail(
  store: { name: string; county: string; type: string },
  entry: {
    date: string;
    visitTime: string;
    merchandiser: string;
    idNumber: string;
    notes: string;
    checksPlacement: string | null;
    checksPrices: string | null;
    checksMissing: string | null;
    items: Array<{ name: string; shelfQty: number; backStock: number; expired: number; damaged: number }>;
    competitors: Array<{ brand: string; gram: string; description: string; price: number }>;
  },
  minStock: number
) {
  if (!process.env.RESEND_API_KEY) return;

  const flagged = entry.checksPlacement === "No" || entry.checksPrices === "No" || entry.checksMissing === "Yes";
  const lowStockCount = entry.items.filter((it) => it.shelfQty + it.backStock < minStock).length;
  const subject = `Stocktake submitted — ${store.name.trim()} — ${entry.date}`;

  // Plain-text fallback for clients that don't render HTML.
  const itemLines = entry.items.map((it) => {
    const onHand = it.shelfQty + it.backStock;
    const extras = [
      it.expired ? `expired ${it.expired}` : "",
      it.damaged ? `damaged ${it.damaged}` : "",
    ].filter(Boolean);
    const flag = onHand < minStock ? " — LOW" : "";
    return `  ${it.name}: shelf ${it.shelfQty}, back ${it.backStock}, total ${onHand}${extras.length ? ` (${extras.join(", ")})` : ""}${flag}`;
  });
  const competitorLines = entry.competitors.map(
    (c, i) => `  ${i + 1}. ${c.brand} (${c.gram}) — ${c.description} — KES ${c.price}`
  );
  const text = [
    `Branch: ${store.name.trim()} (${store.county} · ${store.type})`,
    `Date: ${entry.date}${entry.visitTime ? ` at ${entry.visitTime}` : ""}`,
    `Submitted by: ${entry.merchandiser}${entry.idNumber ? ` (ID ${entry.idNumber})` : ""}`,
    "",
    `Products below minimum stock (${minStock} units): ${lowStockCount}`,
    entry.checksPlacement !== null ? `Store display check flagged an issue: ${flagged ? "Yes — see app for details" : "No"}` : "",
    entry.notes ? `Notes: ${entry.notes}` : "",
    "",
    "Stock counts:",
    ...itemLines,
    ...(competitorLines.length > 0 ? ["", "Competitor check:", ...competitorLines] : []),
    "",
    "Full details, photos, and signature are in the Rubis Enjoy Stock & Reorder app.",
  ]
    .filter(Boolean)
    .join("\n");

  // HTML version — table-based layout for email-client compatibility.
  const stockRows = entry.items
    .map((it) => {
      const onHand = it.shelfQty + it.backStock;
      const low = onHand < minStock;
      const extras = [
        it.expired ? `${it.expired} expired` : "",
        it.damaged ? `${it.damaged} damaged` : "",
      ]
        .filter(Boolean)
        .join(", ");
      return `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid ${BORDER};font-size:13px;color:${INK};">${esc(it.name)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid ${BORDER};font-size:13px;color:${INK};text-align:center;">${it.shelfQty}</td>
          <td style="padding:8px 10px;border-bottom:1px solid ${BORDER};font-size:13px;color:${INK};text-align:center;">${it.backStock}</td>
          <td style="padding:8px 10px;border-bottom:1px solid ${BORDER};font-size:13px;text-align:center;font-weight:600;color:${low ? RED : INK};">${onHand}${low ? " ⚠" : ""}</td>
          <td style="padding:8px 10px;border-bottom:1px solid ${BORDER};font-size:12px;color:${RED};">${extras ? esc(extras) : ""}</td>
        </tr>`;
    })
    .join("");

  const competitorRows = entry.competitors
    .map(
      (c, i) => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid ${BORDER};font-size:13px;color:${INK};">${i + 1}. ${esc(c.brand)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid ${BORDER};font-size:13px;color:${MUTED};text-align:center;">${esc(c.gram)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid ${BORDER};font-size:13px;color:${MUTED};">${esc(c.description)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid ${BORDER};font-size:13px;color:${INK};text-align:right;font-weight:600;">KES ${c.price}</td>
        </tr>`
    )
    .join("");

  const html = `
<div style="background:${BG};padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${BORDER};">
    <div style="background:${GREEN};padding:20px 24px;">
      <div style="color:#ffffff;font-size:18px;font-weight:700;">${esc(store.name.trim())}</div>
      <div style="color:#EFFBDD;font-size:13px;margin-top:2px;">${esc(store.county)} · ${esc(store.type)}</div>
    </div>

    <div style="padding:20px 24px;">
      <table role="presentation" width="100%" style="font-size:13px;color:${INK};margin-bottom:16px;">
        <tr>
          <td style="padding:3px 0;color:${MUTED};width:120px;">Date</td>
          <td style="padding:3px 0;font-weight:600;">${esc(entry.date)}${entry.visitTime ? ` at ${esc(entry.visitTime)}` : ""}</td>
        </tr>
        <tr>
          <td style="padding:3px 0;color:${MUTED};">Submitted by</td>
          <td style="padding:3px 0;font-weight:600;">${esc(entry.merchandiser)}${entry.idNumber ? ` (ID ${esc(entry.idNumber)})` : ""}</td>
        </tr>
      </table>

      ${
        lowStockCount > 0 || flagged
          ? `<div style="background:#FEF6F5;border:1px solid #FBD9D4;border-radius:8px;padding:10px 14px;margin-bottom:16px;">
              ${lowStockCount > 0 ? `<div style="color:${RED};font-size:13px;font-weight:600;">⚠ ${lowStockCount} product${lowStockCount === 1 ? "" : "s"} below minimum stock (${minStock} units)</div>` : ""}
              ${
                entry.checksPlacement !== null && flagged
                  ? `<div style="color:${RED};font-size:13px;margin-top:${lowStockCount > 0 ? "4px" : "0"};">⚠ Store display check flagged an issue — see app for details</div>`
                  : ""
              }
            </div>`
          : `<div style="background:#EEF7DE;border:1px solid #D9EEBB;border-radius:8px;padding:10px 14px;margin-bottom:16px;color:${GREEN_DARK};font-size:13px;font-weight:600;">✓ No stock or display issues flagged</div>`
      }

      ${entry.notes ? `<div style="font-size:13px;color:${INK};margin-bottom:16px;"><span style="color:${MUTED};">Notes:</span> ${esc(entry.notes)}</div>` : ""}

      <div style="font-size:13px;font-weight:700;color:${INK};margin-bottom:8px;">Stock counts</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px;">
        <tr style="background:${BG};">
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:${MUTED};text-transform:uppercase;">Product</th>
          <th style="padding:8px 10px;text-align:center;font-size:11px;color:${MUTED};text-transform:uppercase;">Shelf</th>
          <th style="padding:8px 10px;text-align:center;font-size:11px;color:${MUTED};text-transform:uppercase;">Back</th>
          <th style="padding:8px 10px;text-align:center;font-size:11px;color:${MUTED};text-transform:uppercase;">Total</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:${MUTED};text-transform:uppercase;"></th>
        </tr>
        ${stockRows}
      </table>

      ${
        competitorRows
          ? `<div style="font-size:13px;font-weight:700;color:${INK};margin-bottom:8px;">Competitor check</div>
             <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px;">
               <tr style="background:${BG};">
                 <th style="padding:8px 10px;text-align:left;font-size:11px;color:${MUTED};text-transform:uppercase;">Brand</th>
                 <th style="padding:8px 10px;text-align:center;font-size:11px;color:${MUTED};text-transform:uppercase;">Weight</th>
                 <th style="padding:8px 10px;text-align:left;font-size:11px;color:${MUTED};text-transform:uppercase;">Description</th>
                 <th style="padding:8px 10px;text-align:right;font-size:11px;color:${MUTED};text-transform:uppercase;">Price</th>
               </tr>
               ${competitorRows}
             </table>`
          : ""
      }

      <div style="font-size:12px;color:${MUTED};border-top:1px solid ${BORDER};padding-top:14px;">
        Full details, photos, and signature are in the Rubis Enjoy Stock &amp; Reorder app.
      </div>
    </div>
  </div>
</div>`;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: NOTIFY_EMAIL,
      subject,
      html,
      text,
    });
  } catch {
    // Email is a bonus notification, not part of the submission contract — never throw.
  }
}
