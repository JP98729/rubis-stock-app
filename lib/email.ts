import "server-only";
import { RANGES, RANGE_COLORS, PURE_LOGO, ENJOY_LOGO } from "@/lib/brand";
import { renderStocktakeSummaryPdf, renderMovementSummaryPdf, renderOrderSummaryPdf } from "@/lib/pdf";

const NOTIFY_EMAIL = "info@pure-nutritions.com";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Rubis Enjoy <onboarding@resend.dev>";
const MERCHANDISER_VISIT_FEE_KES = 300;

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
 * A short, human-readable, traceable reference for an order — printed on the email
 * and PDF so a specific order can always be pointed back to (e.g. in a dispute).
 * Not a DB id: orders placed this way have no separate persisted record, so this is
 * generated fresh per send rather than looked up.
 */
function newOrderRef(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${stamp}-${rand}`;
}

/**
 * Sends a stocktake summary email from the server the moment a stocktake is saved —
 * no dependence on the submitter's own device/mail app. Silently no-ops when
 * RESEND_API_KEY isn't set (e.g. local dev) so it never blocks a submission. Returns
 * the generated PDF buffer (or null) so the caller can also push it to Odoo.
 */
export async function sendStocktakeSummaryEmail(
  store: { name: string; county: string; type: string },
  entry: {
    date: string;
    visitTime: string;
    merchandiser: string;
    idNumber: string;
    merchandiserPhone: string;
    kraPin: string;
    embedded: boolean;
    signatureUrl: string;
    notes: string;
    checksPlacement: string | null;
    checksPrices: string | null;
    checksMissing: string | null;
    items: Array<{
      name: string;
      range: string;
      shelfQty: number;
      backStock: number;
      expired: number;
      damaged: number;
      batchCode: string;
    }>;
    competitors: Array<{ brand: string; gram: string; description: string; price: number }>;
  },
  minStock: number
): Promise<Buffer | null> {
  if (!process.env.RESEND_API_KEY) return null;

  const flagged = entry.checksPlacement === "No" || entry.checksPrices === "No" || entry.checksMissing === "Yes";
  const lowStockCount = entry.items.filter((it) => it.shelfQty + it.backStock < minStock).length;
  const subject = `Stocktake submitted — ${store.name.trim()} — ${entry.date}`;

  // Plain-text fallback for clients that don't render HTML.
  const itemLine = (it: (typeof entry.items)[number]) => {
    const onHand = it.shelfQty + it.backStock;
    const extras = [
      it.expired ? `expired ${it.expired}` : "",
      it.damaged ? `damaged ${it.damaged}` : "",
      (it.expired || it.damaged) && it.batchCode ? `batch ${it.batchCode}` : "",
    ].filter(Boolean);
    const flag = onHand < minStock ? " — LOW" : "";
    return `  ${it.name}: shelf ${it.shelfQty}, back ${it.backStock}, total ${onHand}${extras.length ? ` (${extras.join(", ")})` : ""}${flag}`;
  };
  const itemLines = RANGES.flatMap((range) => {
    const rangeItems = entry.items.filter((it) => it.range === range);
    if (rangeItems.length === 0) return [];
    return [`  ${range}:`, ...rangeItems.map(itemLine)];
  });
  const competitorLines = entry.competitors.map(
    (c, i) => `  ${i + 1}. ${c.brand} (${c.gram}) — ${c.description} — KES ${c.price}`
  );
  const text = [
    `Branch: ${store.name.trim()} (${store.county} · ${store.type})`,
    `Date: ${entry.date}${entry.visitTime ? ` at ${entry.visitTime}` : ""}`,
    `Submitted by: ${entry.merchandiser}${entry.idNumber ? ` (ID ${entry.idNumber})` : ""}${entry.merchandiserPhone ? ` — ${entry.merchandiserPhone}` : ""}${entry.kraPin ? ` — KRA PIN ${entry.kraPin}` : ""}`,
    !entry.embedded ? `*** Service fee for this visit: KES ${MERCHANDISER_VISIT_FEE_KES} — logged as a draft expense in Odoo ***` : "",
    "",
    `Products below minimum stock (${minStock} units): ${lowStockCount}`,
    entry.checksPlacement !== null ? `Store display check flagged an issue: ${flagged ? "Yes — see app for details" : "No"}` : "",
    entry.notes ? `Notes: ${entry.notes}` : "",
    "",
    "Stock counts:",
    ...itemLines,
    ...(competitorLines.length > 0 ? ["", "Competitor check:", ...competitorLines] : []),
    "",
    entry.signatureUrl ? `Signature: ${entry.signatureUrl}` : "",
    "Full details and photos are in the Rubis Enjoy Stock & Reorder app.",
  ]
    .filter(Boolean)
    .join("\n");

  // HTML version — table-based layout for email-client compatibility.
  const stockRow = (it: (typeof entry.items)[number]) => {
    const onHand = it.shelfQty + it.backStock;
    const low = onHand < minStock;
    const extras = [
      it.expired ? `${it.expired} expired` : "",
      it.damaged ? `${it.damaged} damaged` : "",
      (it.expired || it.damaged) && it.batchCode ? `batch ${it.batchCode}` : "",
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
  };
  const stockRows = RANGES.map((range) => {
    const rangeItems = entry.items.filter((it) => it.range === range);
    if (rangeItems.length === 0) return "";
    const color = RANGE_COLORS[range] || MUTED;
    return `
        <tr>
          <td colspan="5" style="padding:10px 10px 6px;font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.03em;">${esc(range)}</td>
        </tr>
        ${rangeItems.map(stockRow).join("")}`;
  }).join("");

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
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-bottom:1px solid ${BORDER};">
      <tr>
        <td style="padding:12px 24px;">
          <img src="${PURE_LOGO}" alt="Pure Nutrition" height="48" style="height:48px;width:auto;vertical-align:middle;" />
        </td>
        <td style="padding:12px 24px;text-align:right;">
          <img src="${ENJOY_LOGO}" alt="Rubis Enjoy" height="28" style="height:28px;width:auto;vertical-align:middle;" />
        </td>
      </tr>
    </table>
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
          <td style="padding:3px 0;font-weight:600;">${esc(entry.merchandiser)}${entry.idNumber ? ` (ID ${esc(entry.idNumber)})` : ""}${entry.merchandiserPhone ? ` — ${esc(entry.merchandiserPhone)}` : ""}${entry.kraPin ? ` — KRA ${esc(entry.kraPin)}` : ""}</td>
        </tr>
      </table>

      ${
        !entry.embedded
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
              <tr>
                <td style="background:#FFF8EC;border:1px solid #F5DFAF;border-radius:8px;padding:12px 14px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-size:13px;color:#8A5A00;font-weight:600;">🧾 Merchandiser service fee</td>
                      <td style="font-size:16px;color:#8A5A00;font-weight:700;text-align:right;">KES ${MERCHANDISER_VISIT_FEE_KES}</td>
                    </tr>
                  </table>
                  <div style="font-size:11px;color:#A07A2E;margin-top:2px;">Logged automatically as a draft expense in Odoo</div>
                </td>
              </tr>
            </table>`
          : ""
      }

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

      ${
        entry.signatureUrl
          ? `<div style="font-size:11px;color:${MUTED};margin-bottom:6px;">Signed by ${esc(entry.merchandiser)}</div>
             <img src="${entry.signatureUrl}" alt="Signature" style="max-width:220px;border:1px solid ${BORDER};border-radius:8px;background:#ffffff;margin-bottom:16px;" />`
          : ""
      }

      <div style="font-size:12px;color:${MUTED};border-top:1px solid ${BORDER};padding-top:14px;">
        Full details and photos are in the Rubis Enjoy Stock &amp; Reorder app.
      </div>
    </div>
  </div>
</div>`;

  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = await renderStocktakeSummaryPdf(store, entry, minStock);
  } catch {
    // The PDF is a bonus attachment — never let a rendering failure block the email.
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: NOTIFY_EMAIL,
      subject,
      html,
      text,
      attachments: pdfBuffer
        ? [
            {
              filename: `Stocktake ${store.name.trim()} ${entry.date}.pdf`,
              content: pdfBuffer,
              contentType: "application/pdf",
            },
          ]
        : undefined,
    });
  } catch {
    // Email is a bonus notification, not part of the submission contract — never throw.
  }

  return pdfBuffer;
}

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  DELIVERY: "Delivery",
  SALE: "Sale",
  RETURN: "Return",
  EXPIRED_DAMAGED: "Expired/Damaged",
};

/**
 * Sends a movement-log summary email the moment a Delivery/Sale/Return/Expired-
 * Damaged is saved. Same silent no-op behavior as the stocktake email when
 * RESEND_API_KEY isn't set.
 */
export async function sendMovementSummaryEmail(
  store: { name: string; county: string; type: string },
  entry: {
    type: string;
    date: string;
    time: string;
    merchandiser: string;
    productName: string | null;
    qty: number;
    batchCode: string;
    deliveryNote: string;
    deliveryNotePhotoUrl: string | null;
    invoiceNumber: string;
    receivedBy: string;
    notes: string;
    signatureUrl: string;
  }
) {
  if (!process.env.RESEND_API_KEY) return;

  const typeLabel = MOVEMENT_TYPE_LABELS[entry.type] || entry.type;
  const typeColor = entry.type === "EXPIRED_DAMAGED" ? RED : GREEN_DARK;
  const typeTint = entry.type === "EXPIRED_DAMAGED" ? "#FEF6F5" : "#EEF7DE";
  const typeTintBorder = entry.type === "EXPIRED_DAMAGED" ? "#F5C4BE" : "#D9EEBB";
  const isDelivery = entry.type === "DELIVERY";
  const subject = `${typeLabel} logged — ${store.name.trim()} — ${entry.date}`;

  const text = [
    `Branch: ${store.name.trim()} (${store.county} · ${store.type})`,
    `Type: ${typeLabel}`,
    `Date: ${entry.date}${entry.time ? ` at ${entry.time}` : ""}`,
    entry.merchandiser ? `Logged by: ${entry.merchandiser}` : "",
    !isDelivery ? `Product: ${entry.productName || "Unknown"}` : "",
    !isDelivery ? `Quantity: ${entry.qty}` : "",
    !isDelivery && entry.batchCode ? `Batch code: ${entry.batchCode}` : "",
    isDelivery ? `Delivery note nr: ${entry.deliveryNote}` : "",
    isDelivery ? `Invoice nr: ${entry.invoiceNumber}` : "",
    isDelivery && entry.receivedBy ? `Received by: ${entry.receivedBy}` : "",
    entry.notes ? `Notes: ${entry.notes}` : "",
    "",
    entry.signatureUrl ? `Signature: ${entry.signatureUrl}` : "",
    "Full details are in the Rubis Enjoy Stock & Reorder app.",
  ]
    .filter(Boolean)
    .join("\n");

  // Headline summary card — the one fact the reader actually cares about.
  const summaryCard = isDelivery
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
         <tr>
           <td style="width:50%;">
             <div style="font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:0.03em;">Delivery note nr</div>
             <div style="font-size:16px;font-weight:700;color:${INK};margin-top:2px;">${esc(entry.deliveryNote)}</div>
           </td>
           <td style="width:50%;">
             <div style="font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:0.03em;">Invoice nr</div>
             <div style="font-size:16px;font-weight:700;color:${INK};margin-top:2px;">${esc(entry.invoiceNumber)}</div>
           </td>
         </tr>
       </table>`
    : `<div style="font-size:20px;font-weight:700;color:${INK};">${entry.qty} × ${esc(entry.productName || "Unknown")}</div>`;

  const detailRows = [
    { label: "Date", value: `${esc(entry.date)}${entry.time ? ` at ${esc(entry.time)}` : ""}` },
    entry.merchandiser ? { label: "Logged by", value: esc(entry.merchandiser) } : null,
    !isDelivery && entry.batchCode ? { label: "Batch code", value: esc(entry.batchCode) } : null,
    isDelivery && entry.receivedBy ? { label: "Received by", value: esc(entry.receivedBy) } : null,
  ].filter((r): r is { label: string; value: string } => !!r);

  const html = `
<div style="background:${BG};padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${BORDER};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-bottom:1px solid ${BORDER};">
      <tr>
        <td style="padding:12px 24px;">
          <img src="${PURE_LOGO}" alt="Pure Nutrition" height="48" style="height:48px;width:auto;vertical-align:middle;" />
        </td>
        <td style="padding:12px 24px;text-align:right;">
          <img src="${ENJOY_LOGO}" alt="Rubis Enjoy" height="28" style="height:28px;width:auto;vertical-align:middle;" />
        </td>
      </tr>
    </table>
    <div style="background:${typeColor};padding:20px 24px;">
      <div style="color:#ffffff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;opacity:0.85;">${esc(typeLabel)}</div>
      <div style="color:#ffffff;font-size:18px;font-weight:700;margin-top:2px;">${esc(store.name.trim())}</div>
      <div style="color:#ffffff;font-size:13px;margin-top:2px;opacity:0.9;">${esc(store.county)} · ${esc(store.type)}</div>
    </div>

    <div style="padding:20px 24px;">
      <div style="background:${typeTint};border:1px solid ${typeTintBorder};border-radius:8px;padding:14px 16px;margin-bottom:18px;">
        ${summaryCard}
      </div>

      <table role="presentation" width="100%" style="font-size:13px;color:${INK};margin-bottom:16px;">
        ${detailRows
          .map(
            (r) =>
              `<tr>
                 <td style="padding:3px 0;color:${MUTED};width:120px;">${r.label}</td>
                 <td style="padding:3px 0;font-weight:600;">${r.value}</td>
               </tr>`
          )
          .join("")}
      </table>

      ${entry.notes ? `<div style="font-size:13px;color:${INK};margin-bottom:16px;"><span style="color:${MUTED};">Notes:</span> ${esc(entry.notes)}</div>` : ""}

      ${
        isDelivery && entry.deliveryNotePhotoUrl
          ? entry.deliveryNotePhotoUrl.toLowerCase().endsWith(".pdf")
            ? `<div style="font-size:11px;color:${MUTED};margin-bottom:8px;">Delivery note</div>
               <a href="${entry.deliveryNotePhotoUrl}" style="display:inline-block;font-size:13px;font-weight:600;color:${typeColor};background:${typeTint};border:1px solid ${typeTintBorder};border-radius:8px;padding:10px 14px;text-decoration:none;margin-bottom:16px;">📄 View delivery note (PDF)</a>`
            : `<div style="font-size:11px;color:${MUTED};margin-bottom:8px;">Delivery note photo</div>
               <img src="${entry.deliveryNotePhotoUrl}" alt="Delivery note" style="max-width:100%;border-radius:8px;border:1px solid ${BORDER};margin-bottom:16px;" />`
          : ""
      }

      ${
        entry.signatureUrl
          ? `<div style="font-size:11px;color:${MUTED};margin-bottom:6px;">Signed${entry.merchandiser ? ` by ${esc(entry.merchandiser)}` : ""}</div>
             <img src="${entry.signatureUrl}" alt="Signature" style="max-width:220px;border:1px solid ${BORDER};border-radius:8px;background:#ffffff;margin-bottom:16px;" />`
          : ""
      }

      <div style="font-size:12px;color:${MUTED};border-top:1px solid ${BORDER};padding-top:14px;">
        Full details are in the Rubis Enjoy Stock &amp; Reorder app.
      </div>
    </div>
  </div>
</div>`;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    let pdfBuffer: Buffer | null = null;
    try {
      pdfBuffer = await renderMovementSummaryPdf(store, entry);
    } catch {
      // The PDF is a bonus attachment — never let a rendering failure block the email.
    }
    await resend.emails.send({
      from: FROM_EMAIL,
      to: NOTIFY_EMAIL,
      subject,
      html,
      text,
      attachments: pdfBuffer
        ? [
            {
              filename: `${typeLabel} ${store.name.trim()} ${entry.date}.pdf`,
              content: pdfBuffer,
              contentType: "application/pdf",
            },
          ]
        : undefined,
    });
  } catch {
    // Email is a bonus notification, not part of the submission contract — never throw.
  }
}

/**
 * Sends the manual-order notification to Pure Nutrition when a branch manager
 * places an order directly from their reorder list (no LPO document). Unlike the
 * emails above, this one IS the delivery mechanism for the order itself, not a
 * bonus — so a send failure is thrown back to the caller instead of swallowed.
 */
export async function sendManualOrderEmail(
  store: { name: string; county: string; type: string },
  items: Array<{ sku: string; flavour: string; reorder: number }>,
  odooOrderName: string | null,
  managerEmail: string | null
): Promise<Buffer | null> {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Email isn't set up on the server — ask Pure Nutrition to check RESEND_API_KEY.");
  }

  const orderRef = newOrderRef();
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 16).replace("T", " at ") + " UTC";
  const subject = `Order placed — ${store.name.trim()} — ${orderRef}`;
  const text = [
    `Order reference: ${orderRef}`,
    `Branch: ${store.name.trim()} (${store.county} · ${store.type})`,
    `Placed: ${timestamp}`,
    odooOrderName ? `Odoo Sales Order: ${odooOrderName}` : "",
    "",
    "Items ordered:",
    ...items.map((i) => `  ${i.flavour} (${i.sku}): ${i.reorder}`),
  ]
    .filter(Boolean)
    .join("\n");

  const rows = items
    .map(
      (i) =>
        `<tr>
           <td style="padding:6px 10px;border-bottom:1px solid ${BORDER};">${esc(i.flavour)}<div style="font-size:11px;color:${MUTED};">${esc(i.sku)}</div></td>
           <td style="padding:6px 10px;border-bottom:1px solid ${BORDER};text-align:right;font-weight:700;">${i.reorder}</td>
         </tr>`
    )
    .join("");

  const html = `
<div style="background:${BG};padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${BORDER};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-bottom:1px solid ${BORDER};">
      <tr>
        <td style="padding:12px 24px;">
          <img src="${PURE_LOGO}" alt="Pure Nutrition" height="48" style="height:48px;width:auto;vertical-align:middle;" />
        </td>
        <td style="padding:12px 24px;text-align:right;">
          <img src="${ENJOY_LOGO}" alt="Rubis Enjoy" height="28" style="height:28px;width:auto;vertical-align:middle;" />
        </td>
      </tr>
    </table>
    <div style="background:${GREEN_DARK};padding:20px 24px;">
      <div style="color:#ffffff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;opacity:0.85;">Order placed</div>
      <div style="color:#ffffff;font-size:18px;font-weight:700;margin-top:2px;">${esc(store.name.trim())}</div>
      <div style="color:#ffffff;font-size:13px;margin-top:2px;opacity:0.9;">${esc(store.county)} · ${esc(store.type)}</div>
    </div>
    <div style="padding:20px 24px;">
      <div style="background:${BG};border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;justify-content:space-between;font-size:12px;">
        <span style="color:${MUTED};">Order ref <strong style="color:${INK};font-family:monospace;">${esc(orderRef)}</strong></span>
        <span style="color:${MUTED};">${esc(timestamp)}</span>
      </div>
      ${
        odooOrderName
          ? `<div style="font-size:13px;color:${INK};margin-bottom:14px;"><span style="color:${MUTED};">Odoo Sales Order:</span> <strong>${esc(odooOrderName)}</strong></div>`
          : ""
      }
      <table role="presentation" width="100%" style="border-collapse:collapse;font-size:13px;color:${INK};">
        <tr style="background:${BG};">
          <th style="padding:6px 10px;text-align:left;font-size:11px;color:${MUTED};text-transform:uppercase;">Product</th>
          <th style="padding:6px 10px;text-align:right;font-size:11px;color:${MUTED};text-transform:uppercase;">Qty</th>
        </tr>
        ${rows}
      </table>
      <div style="font-size:12px;color:${MUTED};border-top:1px solid ${BORDER};padding-top:14px;margin-top:16px;">
        Placed directly from the branch's own reorder list in the Rubis Enjoy Stock &amp; Reorder app.
      </div>
    </div>
  </div>
</div>`;

  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = await renderOrderSummaryPdf(store, items, odooOrderName, orderRef);
  } catch {
    // The PDF is a bonus attachment — never let a rendering failure block the email.
  }

  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: NOTIFY_EMAIL,
    cc: managerEmail || undefined,
    subject,
    html,
    text,
    attachments: pdfBuffer
      ? [{ filename: `Order ${store.name.trim()} ${orderRef}.pdf`, content: pdfBuffer, contentType: "application/pdf" }]
      : undefined,
  });
  if (error) throw new Error(error.message || "Failed to send the order email.");

  return pdfBuffer;
}

/**
 * Sends a notification to Pure Nutrition when a branch manager uploads a signed LPO
 * document. A bonus notification like the stocktake/movement emails — the LPO record
 * is already saved either way, so a send failure here is swallowed, not thrown.
 */
export async function sendLpoUploadEmail(
  store: { name: string; county: string; type: string },
  filename: string,
  fileUrl: string,
  items: Array<{ sku: string; flavour: string; reorder: number }>,
  odooOrderName: string | null,
  managerEmail: string | null
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  try {
    const orderRef = newOrderRef();
    const timestamp = new Date().toISOString().slice(0, 16).replace("T", " at ") + " UTC";
    const subject = `LPO uploaded — ${store.name.trim()} — ${orderRef}`;
    const text = [
      `Order reference: ${orderRef}`,
      `Branch: ${store.name.trim()} (${store.county} · ${store.type})`,
      `Uploaded: ${timestamp}`,
      `File: ${filename} — ${fileUrl}`,
      odooOrderName ? `Odoo Sales Order: ${odooOrderName}` : "",
      items.length
        ? ["", "Reorder items:", ...items.map((i) => `  ${i.flavour} (${i.sku}): ${i.reorder}`)].join("\n")
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const rows = items
      .map(
        (i) =>
          `<tr>
             <td style="padding:6px 10px;border-bottom:1px solid ${BORDER};">${esc(i.flavour)}<div style="font-size:11px;color:${MUTED};">${esc(i.sku)}</div></td>
             <td style="padding:6px 10px;border-bottom:1px solid ${BORDER};text-align:right;font-weight:700;">${i.reorder}</td>
           </tr>`
      )
      .join("");

    const html = `
<div style="background:${BG};padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${BORDER};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-bottom:1px solid ${BORDER};">
      <tr>
        <td style="padding:12px 24px;">
          <img src="${PURE_LOGO}" alt="Pure Nutrition" height="48" style="height:48px;width:auto;vertical-align:middle;" />
        </td>
        <td style="padding:12px 24px;text-align:right;">
          <img src="${ENJOY_LOGO}" alt="Rubis Enjoy" height="28" style="height:28px;width:auto;vertical-align:middle;" />
        </td>
      </tr>
    </table>
    <div style="background:${GREEN_DARK};padding:20px 24px;">
      <div style="color:#ffffff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;opacity:0.85;">LPO uploaded</div>
      <div style="color:#ffffff;font-size:18px;font-weight:700;margin-top:2px;">${esc(store.name.trim())}</div>
      <div style="color:#ffffff;font-size:13px;margin-top:2px;opacity:0.9;">${esc(store.county)} · ${esc(store.type)}</div>
    </div>
    <div style="padding:20px 24px;">
      <div style="background:${BG};border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;justify-content:space-between;font-size:12px;">
        <span style="color:${MUTED};">Order ref <strong style="color:${INK};font-family:monospace;">${esc(orderRef)}</strong></span>
        <span style="color:${MUTED};">${esc(timestamp)}</span>
      </div>
      <a href="${fileUrl}" style="display:inline-block;font-size:13px;font-weight:600;color:${GREEN_DARK};background:#EEF7DE;border-radius:8px;padding:10px 14px;text-decoration:none;margin-bottom:16px;">📄 View uploaded LPO (${esc(filename)})</a>
      ${
        odooOrderName
          ? `<div style="font-size:13px;color:${INK};margin-bottom:14px;"><span style="color:${MUTED};">Odoo Sales Order:</span> <strong>${esc(odooOrderName)}</strong></div>`
          : ""
      }
      ${
        items.length
          ? `<table role="presentation" width="100%" style="border-collapse:collapse;font-size:13px;color:${INK};">
               <tr style="background:${BG};">
                 <th style="padding:6px 10px;text-align:left;font-size:11px;color:${MUTED};text-transform:uppercase;">Product</th>
                 <th style="padding:6px 10px;text-align:right;font-size:11px;color:${MUTED};text-transform:uppercase;">Qty</th>
               </tr>
               ${rows}
             </table>`
          : ""
      }
      <div style="font-size:12px;color:${MUTED};border-top:1px solid ${BORDER};padding-top:14px;margin-top:16px;">
        Uploaded from the branch's own account in the Rubis Enjoy Stock &amp; Reorder app.
      </div>
    </div>
  </div>
</div>`;

    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: NOTIFY_EMAIL,
      cc: managerEmail || undefined,
      subject,
      html,
      text,
    });
  } catch {
    // Bonus notification — the LPO document itself is already saved either way.
  }
}
