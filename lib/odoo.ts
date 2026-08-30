import "server-only";

/**
 * Minimal Odoo JSON-RPC client — no npm dependency needed, Odoo's external API is
 * plain JSON-RPC 2.0 over HTTP. No-ops everywhere when env vars aren't set, so this
 * never blocks an LPO upload if Odoo sync isn't configured yet.
 *
 * One-time product mapping: every SKU in this app matches an Odoo product.product
 * by `default_code` exactly (confirmed by hand against je-jo-nutbar.odoo.com), so
 * this is a static lookup rather than a live search on every sync.
 */
const SKU_TO_ODOO_PRODUCT_ID: Record<string, number> = {
  "C/ROA/60/01/RU": 524,
  "C/ROA/60/02/RU": 525,
  "M/ROA/60/01/RU": 523,
  "P/ROA/60/01/RU": 520,
  "P/ROA/60/02/RU": 521,
  "P/ROA/60/03/RU": 522,
  "RUB/C/MC/60/01": 536,
  "RUB/M/MC/60/02": 537,
  "RUB/P/CAR/60/01": 508,
  "RUB/P/CAR/60/02": 509,
  "RUB/P/CAR/60/03": 510,
  "RUB/P/CAR/60/04": 511,
  "RUB/P/CAR/60/05": 512,
  "RUB/P/CAR/60/06": 513,
  "RUB/P/DC/60/03": 533,
  "RUB/P/MC/60/04": 532,
  "RUB/P/MIXC/60/01": 535,
  "RUB/P/WC/60/01": 534,
};

function odooConfig() {
  const url = process.env.ODOO_URL;
  const db = process.env.ODOO_DB;
  const username = process.env.ODOO_USERNAME;
  const apiKey = process.env.ODOO_API_KEY;
  if (!url || !db || !username || !apiKey) return null;
  return { url, db, username, apiKey };
}

let cachedUid: number | null = null;

async function jsonRpc<T>(url: string, service: string, method: string, args: unknown[]): Promise<T> {
  const res = await fetch(`${url}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: { service, method, args }, id: Date.now() }),
  });
  const json = (await res.json()) as { result?: T; error?: { message?: string; data?: { message?: string } } };
  if (json.error) throw new Error(json.error.data?.message || json.error.message || "Odoo RPC error");
  return json.result as T;
}

async function authenticate(): Promise<{ url: string; db: string; uid: number; apiKey: string } | null> {
  const cfg = odooConfig();
  if (!cfg) return null;
  if (cachedUid === null) {
    cachedUid = await jsonRpc<number>(cfg.url, "common", "authenticate", [cfg.db, cfg.username, cfg.apiKey, {}]);
  }
  return { url: cfg.url, db: cfg.db, uid: cachedUid, apiKey: cfg.apiKey };
}

const MERCHANDISER_VISIT_FEE_KES = 300;

/**
 * Fixed values copied from a real hr.expense record the user created by hand in
 * Odoo as a template (id 738, "Visiting Rubis Stores Merchandiser") — same
 * employee/account/vendor/payment method on every visit; only name/date change.
 */
const MERCHANDISER_EXPENSE_TEMPLATE = {
  employeeId: 1, // Joan Gracious Omondi
  productId: 77, // [EXP_GEN] EXPENSES
  accountId: 112, // 510100 Marketing
  vendorId: 288, // Innocent Morara
  journalId: 27, // MPESA SAFARICOM  4116561
  paymentMethodLineId: 55, // Manual Payment (MPESA SAFARICOM  4116561)
};

/**
 * Creates a draft expense in Odoo for a merchandiser's visit (fixed KES 300 fee),
 * mirroring the hand-made template expense. Returns null (never throws) whenever
 * Odoo sync isn't configured — a stocktake submission must never fail because of
 * this, it's a bonus record for accounting.
 */
export async function createMerchandiserVisitExpense(input: {
  branchName: string;
  merchandiser: string;
  date: string;
}): Promise<{ id: number; name: string } | null> {
  try {
    const auth = await authenticate();
    if (!auth) return null;

    const name = `Visiting ${input.branchName.trim()} — ${input.merchandiser}`;

    const id = await jsonRpc<number>(auth.url, "object", "execute_kw", [
      auth.db,
      auth.uid,
      auth.apiKey,
      "hr.expense",
      "create",
      [
        {
          name,
          date: input.date,
          employee_id: MERCHANDISER_EXPENSE_TEMPLATE.employeeId,
          product_id: MERCHANDISER_EXPENSE_TEMPLATE.productId,
          quantity: 1,
          price_unit: MERCHANDISER_VISIT_FEE_KES,
          // price_unit alone is silently recomputed back to 0 by Odoo (it derives
          // from the product's cost); total_amount_currency is the field that
          // actually has to be set for the amount to stick — confirmed by hand
          // against the live instance before shipping this.
          total_amount_currency: MERCHANDISER_VISIT_FEE_KES,
          payment_mode: "company_account",
          journal_id: MERCHANDISER_EXPENSE_TEMPLATE.journalId,
          payment_method_line_id: MERCHANDISER_EXPENSE_TEMPLATE.paymentMethodLineId,
          vendor_id: MERCHANDISER_EXPENSE_TEMPLATE.vendorId,
          account_id: MERCHANDISER_EXPENSE_TEMPLATE.accountId,
        },
      ],
    ]);

    const [expense] = await jsonRpc<Array<{ name: string }>>(auth.url, "object", "execute_kw", [
      auth.db,
      auth.uid,
      auth.apiKey,
      "hr.expense",
      "read",
      [[id], ["name"]],
    ]);

    return { id, name: expense?.name || name };
  } catch {
    return null;
  }
}

/**
 * Creates a draft Sales Order in Odoo for a branch's current reorder — one line per
 * product with an actual reorder quantity. Returns null (never throws) whenever
 * Odoo sync isn't configured, the branch has no mapped Odoo customer, or there's
 * nothing to order; the LPO upload itself must never fail because of this.
 */
export async function createDraftSalesOrder(
  odooPartnerId: number,
  items: Array<{ sku: string; reorder: number }>
): Promise<{ id: number; name: string } | null> {
  try {
    const auth = await authenticate();
    if (!auth) return null;

    const orderLines = items
      .filter((i) => i.reorder > 0 && SKU_TO_ODOO_PRODUCT_ID[i.sku])
      .map((i) => [0, 0, { product_id: SKU_TO_ODOO_PRODUCT_ID[i.sku], product_uom_qty: i.reorder }]);
    if (orderLines.length === 0) return null;

    const id = await jsonRpc<number>(auth.url, "object", "execute_kw", [
      auth.db,
      auth.uid,
      auth.apiKey,
      "sale.order",
      "create",
      [{ partner_id: odooPartnerId, order_line: orderLines }],
    ]);

    const [order] = await jsonRpc<Array<{ name: string }>>(auth.url, "object", "execute_kw", [
      auth.db,
      auth.uid,
      auth.apiKey,
      "sale.order",
      "read",
      [[id], ["name"]],
    ]);

    return { id, name: order?.name || `#${id}` };
  } catch {
    // Odoo sync is a bonus, not part of the upload contract — never throw.
    return null;
  }
}

function mimetypeFor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

/**
 * Low-level: uploads a file buffer as an ir.attachment on any Odoo record. Returns
 * false (never throws) whenever Odoo sync isn't configured or anything goes wrong —
 * an attachment is always a bonus, never part of the calling action's contract.
 */
async function attachBufferToOdoo(
  model: string,
  resId: number,
  buffer: Buffer,
  filename: string,
  mimetype: string
): Promise<boolean> {
  try {
    const auth = await authenticate();
    if (!auth) return false;

    await jsonRpc<number>(auth.url, "object", "execute_kw", [
      auth.db,
      auth.uid,
      auth.apiKey,
      "ir.attachment",
      "create",
      [
        {
          name: filename,
          datas: buffer.toString("base64"),
          res_model: model,
          res_id: resId,
          mimetype,
        },
      ],
    ]);

    return true;
  } catch {
    return false;
  }
}

/**
 * Attaches a file (e.g. a delivery note) to an existing Sales Order in Odoo, so proof
 * of delivery lives right on the order it fulfils. Fetches the file from its own
 * public URL (Vercel Blob) and uploads it as an ir.attachment. Returns false whenever
 * the URL isn't publicly fetchable (local dev) or anything else goes wrong.
 */
export async function attachFileToSaleOrder(saleOrderId: number, fileUrl: string, filename: string): Promise<boolean> {
  try {
    if (!/^https?:\/\//i.test(fileUrl)) return false;
    const res = await fetch(fileUrl);
    if (!res.ok) return false;
    const buffer = Buffer.from(await res.arrayBuffer());
    return attachBufferToOdoo("sale.order", saleOrderId, buffer, filename, mimetypeFor(filename));
  } catch {
    return false;
  }
}

/**
 * Attaches the stocktake summary PDF to the merchandiser visit expense created for
 * it, so the receipt for the KES 300 fee sits right alongside the visit record it's
 * for — no manual upload needed.
 */
export async function attachPdfToExpense(expenseId: number, pdfBuffer: Buffer, filename: string): Promise<boolean> {
  return attachBufferToOdoo("hr.expense", expenseId, pdfBuffer, filename, "application/pdf");
}

/**
 * Writes the delivery note nr / invoice nr onto a Sales Order's Customer Reference
 * field, so the order carries the same numbers as the physical paperwork attached to
 * it. Returns false (never throws) whenever Odoo sync isn't configured or fails.
 */
export async function setSaleOrderReference(saleOrderId: number, reference: string): Promise<boolean> {
  try {
    const auth = await authenticate();
    if (!auth) return false;

    await jsonRpc<boolean>(auth.url, "object", "execute_kw", [
      auth.db,
      auth.uid,
      auth.apiKey,
      "sale.order",
      "write",
      [[saleOrderId], { client_order_ref: reference }],
    ]);

    return true;
  } catch {
    return false;
  }
}
