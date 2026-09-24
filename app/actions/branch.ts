"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getProducts, getStoreStock } from "@/lib/queries";
import {
  createDraftSalesOrder,
  attachFileToSaleOrder,
  attachPdfToSaleOrder,
  getSaleOrderShippingWeight,
  postSaleOrderMessage,
} from "@/lib/odoo";
import { sendManualOrderEmail, sendLpoUploadEmail, sendCourierDispatchEmail, newOrderRef } from "@/lib/email";
import { NAIROBI_COURIER_NAME, NAIROBI_COURIER_PHONE_WA, KENYA_COUNTIES } from "@/lib/brand";

export type SimpleResult = { ok: true } | { ok: false; error: string };
export type PlaceOrderResult =
  | { ok: true; itemCount: number; courierLink: string | null }
  | { ok: false; error: string };

const APP_BASE_URL = process.env.APP_BASE_URL || "https://rubis-stock-app.vercel.app";

/** Item names only, no quantities — the courier's own dispatch email/page shows weight instead. */
function summarizeItems(items: Array<{ sku: string; flavour: string }>): string {
  return items.map((i) => `${i.flavour} (${i.sku})`).join(", ");
}

/**
 * Creates the courier dispatch record for an order and returns its public link.
 * Best-effort: if this fails for any reason, the order email still goes out —
 * it just won't have a courier link in it.
 */
async function createCourierDispatch(
  storeId: number,
  orderRef: string,
  items: Array<{ sku: string; flavour: string; reorder: number }>,
  odooSaleOrderId: number | null,
  odooSaleOrderName: string | null,
  shippingWeightKg: number | null
): Promise<string | null> {
  try {
    const dispatch = await prisma.courierDispatch.create({
      data: {
        storeId,
        orderRef,
        itemsSummary: summarizeItems(items),
        odooSaleOrderId,
        odooSaleOrderName,
        shippingWeightKg,
      },
    });
    return `${APP_BASE_URL}/courier/${dispatch.id}`;
  } catch {
    return null;
  }
}

/**
 * Best-effort: for a Nairobi order, drops a clickable "Notify [courier] via
 * WhatsApp" link right onto the Sales Order's own chatter in Odoo — so it can be
 * tapped straight from the order there, without needing the app open. No-ops
 * silently when there's no linked Odoo order or the branch isn't in Nairobi.
 */
async function notifyNairobiCourierInOdoo(
  odooSaleOrderId: number | null,
  storeName: string,
  county: string,
  courierLink: string | null
): Promise<void> {
  if (!odooSaleOrderId || !courierLink || county.trim().toLowerCase() !== "nairobi") return;
  const message = `New order from ${storeName.trim()} — please accept & collect: ${courierLink}?accept=1`;
  const waUrl = `https://wa.me/${NAIROBI_COURIER_PHONE_WA}?text=${encodeURIComponent(message)}`;
  const buttonHtml =
    `<a href="${waUrl}" target="_blank" ` +
    `style="display:inline-block;padding:10px 18px;background-color:#25D366;color:#ffffff;` +
    `font-weight:bold;font-size:14px;text-decoration:none;border-radius:6px;">` +
    `📱 Notify ${NAIROBI_COURIER_NAME} via WhatsApp</a>`;
  await postSaleOrderMessage(odooSaleOrderId, buttonHtml);
}

/** Branch-manager self-service contact override (shown with a green * in the admin table). */
export async function saveBranchContact(
  phone: string,
  email: string,
  address: string,
  county: string,
  zipCode: string
): Promise<SimpleResult> {
  const session = await requireRole("branch");
  if (!session?.storeId) return { ok: false, error: "Your session expired — log in again." };
  if (!KENYA_COUNTIES.includes(county)) return { ok: false, error: "Please choose a county from the list." };
  if (!zipCode.trim()) return { ok: false, error: "Please enter your zip code." };
  await prisma.store.update({
    where: { id: session.storeId },
    data: {
      contactPhone: phone.trim() || null,
      contactEmail: email.trim() || null,
      address: address.trim(),
      county,
      zipCode: zipCode.trim(),
    },
  });
  revalidatePath("/branch");
  revalidatePath("/manager");
  revalidatePath("/merchandiser");
  return { ok: true };
}

export async function saveManagerPhoto(photoUrl: string | null): Promise<SimpleResult> {
  const session = await requireRole("branch");
  if (!session?.storeId) return { ok: false, error: "Your session expired — log in again." };
  await prisma.store.update({ where: { id: session.storeId }, data: { managerPhotoUrl: photoUrl } });
  revalidatePath("/branch");
  revalidatePath("/merchandiser");
  revalidatePath("/manager");
  return { ok: true };
}

export async function saveManagerName(name: string): Promise<SimpleResult> {
  const session = await requireRole("branch");
  if (!session?.storeId) return { ok: false, error: "Your session expired — log in again." };
  await prisma.store.update({ where: { id: session.storeId }, data: { managerName: name.trim() || null } });
  revalidatePath("/branch");
  revalidatePath("/merchandiser");
  revalidatePath("/manager");
  return { ok: true };
}

export async function addLpoDocument(url: string, filename: string): Promise<SimpleResult> {
  const session = await requireRole("branch");
  if (!session?.storeId) return { ok: false, error: "Your session expired — log in again." };
  const storeId = session.storeId;

  const trimmedFilename = filename.trim() || "LPO document";
  const doc = await prisma.lpoDocument.create({
    data: { storeId, url, filename: trimmedFilename },
  });

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { name: true, county: true, type: true, address: true, odooPartnerId: true, contactEmail: true, seedEmail: true },
  });

  const products = await getProducts();
  const stock = await getStoreStock(storeId, products);
  const items = stock.rows.filter((r) => r.reorder > 0 && r.range !== "Classic Range");

  // Best-effort: mirror the branch's current reorder as a draft Sales Order in Odoo.
  // No-ops silently if Odoo sync isn't configured or this branch has no mapped customer.
  let odooOrderId: number | null = null;
  let odooOrderName: string | null = null;
  let shippingWeightKg: number | null = null;
  if (store?.odooPartnerId) {
    const order = await createDraftSalesOrder(
      store.odooPartnerId,
      items.map((r) => ({ sku: r.sku, reorder: r.reorder }))
    );
    if (order) {
      odooOrderId = order.id;
      odooOrderName = order.name;
      await prisma.lpoDocument.update({
        where: { id: doc.id },
        data: { odooSaleOrderId: order.id, odooSaleOrderName: order.name },
      });
      // Best-effort: put the LPO file itself on the order's paperclip icon in Odoo.
      await attachFileToSaleOrder(order.id, url, trimmedFilename);
      shippingWeightKg = await getSaleOrderShippingWeight(order.id);
    }
  }

  // Best-effort: let Pure Nutrition know an LPO came in, same as a manual order does.
  // CC'd to the branch's own email too, so the manager has proof they submitted it.
  if (store) {
    const orderItems = items.map((r) => ({ sku: r.sku, flavour: r.flavour, reorder: r.reorder }));
    const orderRef = newOrderRef();
    const courierLink = await createCourierDispatch(
      storeId,
      orderRef,
      orderItems,
      odooOrderId,
      odooOrderName,
      shippingWeightKg
    );
    await sendLpoUploadEmail(
      store,
      trimmedFilename,
      url,
      orderItems,
      odooOrderName,
      store.contactEmail || store.seedEmail || null,
      orderRef,
      courierLink
    );
    if (courierLink) {
      await sendCourierDispatchEmail(store, orderRef, shippingWeightKg, courierLink);
    }
    await notifyNairobiCourierInOdoo(odooOrderId, store.name, store.county, courierLink);
  }

  revalidatePath("/branch");
  revalidatePath("/manager");
  return { ok: true };
}

/**
 * Lets a branch manager place their order directly, without needing a physical LPO
 * to photograph/upload. `quantities` is a sku -> qty map the manager typed in
 * themselves (starting from the app's suggested reorder numbers, but freely
 * editable — e.g. 3 of one product, 6 of another). Quantities are trusted only for
 * the number; product names/availability are always looked up server-side. Emails
 * Pure Nutrition the order (the actual delivery mechanism — a send failure is
 * reported, not swallowed) and best-effort mirrors it as a draft Sales Order in
 * Odoo when the branch has one mapped.
 */
export async function placeManualOrder(
  quantities: Record<string, number>,
  placedByName: string,
  placedByFunction: string,
  signatureUrl: string | null,
  /** Only used (and required) when the branch has no email on file yet — see below. */
  managerEmailInput: string = ""
): Promise<PlaceOrderResult> {
  const session = await requireRole("branch");
  if (!session?.storeId) return { ok: false, error: "Your session expired — log in again." };
  if (!placedByName.trim()) return { ok: false, error: "Please enter your name before placing the order." };
  if (!placedByFunction.trim()) return { ok: false, error: "Please select your function before placing the order." };
  if (!signatureUrl) return { ok: false, error: "Please sign before placing the order." };
  const storeId = session.storeId;

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { name: true, county: true, type: true, address: true, odooPartnerId: true, contactEmail: true, seedEmail: true },
  });
  if (!store) return { ok: false, error: "Your branch no longer exists." };

  // The branch's own copy of the order email goes to whatever's on file already.
  // If nothing's on file, the manager typed one in on the order form instead —
  // require and save it now, so this and every future order reaches them.
  let managerEmail = store.contactEmail || store.seedEmail || null;
  if (!managerEmail) {
    const typed = managerEmailInput.trim();
    if (!typed || !typed.includes("@")) {
      return { ok: false, error: "Please enter your email before placing the order." };
    }
    managerEmail = typed;
    await prisma.store.update({ where: { id: storeId }, data: { contactEmail: typed } });
  }

  const products = await getProducts();
  const bySku = new Map(products.map((p) => [p.sku, p]));

  const items = Object.entries(quantities)
    .map(([sku, qty]) => ({ sku, qty: Math.trunc(Number(qty) || 0), product: bySku.get(sku) }))
    .filter(
      (i): i is typeof i & { product: NonNullable<typeof i.product> } =>
        i.qty > 0 && !!i.product && !i.product.unavailable && i.product.range !== "Classic Range"
    )
    .map((i) => ({ sku: i.sku, flavour: i.product.flavour, reorder: i.qty }));

  if (items.length === 0) {
    return { ok: false, error: "Enter a quantity for at least one product before placing the order." };
  }

  const order = store.odooPartnerId
    ? await createDraftSalesOrder(
        store.odooPartnerId,
        items.map((r) => ({ sku: r.sku, reorder: r.reorder }))
      )
    : null;
  const shippingWeightKg = order ? await getSaleOrderShippingWeight(order.id) : null;

  const orderRef = newOrderRef();
  const courierLink = await createCourierDispatch(
    storeId,
    orderRef,
    items,
    order?.id ?? null,
    order?.name ?? null,
    shippingWeightKg
  );

  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = await sendManualOrderEmail(
      store,
      items,
      order?.name ?? null,
      managerEmail,
      placedByName.trim(),
      placedByFunction.trim(),
      signatureUrl,
      orderRef,
      courierLink
    );
    if (courierLink) {
      await sendCourierDispatchEmail(store, orderRef, shippingWeightKg, courierLink);
    }
    await notifyNairobiCourierInOdoo(order?.id ?? null, store.name, store.county, courierLink);
  } catch (e) {
    return {
      ok: false,
      error: "Couldn't send your order — try again, or upload your signed LPO instead. (" +
        (e instanceof Error ? e.message : String(e)) + ")",
    };
  }

  // Best-effort: put the order PDF on the Sales Order's paperclip icon in Odoo too.
  if (order && pdfBuffer) {
    await attachPdfToSaleOrder(order.id, pdfBuffer, `Order ${store.name.trim()}.pdf`);
  }

  revalidatePath("/branch");
  revalidatePath("/manager");
  return { ok: true, itemCount: items.length, courierLink };
}

export async function removeLpoDocument(id: string): Promise<SimpleResult> {
  const session = await requireRole("branch");
  if (!session?.storeId) return { ok: false, error: "Your session expired — log in again." };
  const doc = await prisma.lpoDocument.findUnique({ where: { id }, select: { storeId: true } });
  if (!doc || doc.storeId !== session.storeId) return { ok: false, error: "That document isn't on your branch." };
  await prisma.lpoDocument.delete({ where: { id } });
  revalidatePath("/branch");
  revalidatePath("/manager");
  return { ok: true };
}
