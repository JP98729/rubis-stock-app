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
