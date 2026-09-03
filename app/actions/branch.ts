"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getProducts, getStoreStock } from "@/lib/queries";
import { createDraftSalesOrder, attachFileToSaleOrder, attachPdfToSaleOrder } from "@/lib/odoo";
import { sendManualOrderEmail, sendLpoUploadEmail, newOrderRef } from "@/lib/email";

export type SimpleResult = { ok: true } | { ok: false; error: string };
export type PlaceOrderResult = { ok: true; itemCount: number } | { ok: false; error: string };

const APP_BASE_URL = process.env.APP_BASE_URL || "https://rubis-stock-app.vercel.app";

function summarizeItems(items: Array<{ sku: string; flavour: string; reorder: number }>): string {
  return items.map((i) => `${i.flavour} (${i.sku}): ${i.reorder}`).join(", ");
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
  odooSaleOrderName: string | null
): Promise<string | null> {
  try {
    const dispatch = await prisma.courierDispatch.create({
      data: {
        storeId,
        orderRef,
        itemsSummary: summarizeItems(items),
        odooSaleOrderId,
        odooSaleOrderName,
      },
    });
    return `${APP_BASE_URL}/courier/${dispatch.id}`;
  } catch {
    return null;
  }
}

/** Branch-manager self-service contact override (shown with a green * in the admin table). */
export async function saveBranchContact(phone: string, email: string, address: string): Promise<SimpleResult> {
  const session = await requireRole("branch");
  if (!session?.storeId) return { ok: false, error: "Your session expired — log in again." };
  await prisma.store.update({
    where: { id: session.storeId },
    data: { contactPhone: phone.trim() || null, contactEmail: email.trim() || null, address: address.trim() },
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
    select: { name: true, county: true, type: true, odooPartnerId: true, contactEmail: true, seedEmail: true },
  });

  const products = await getProducts();
  const stock = await getStoreStock(storeId, products);
  const items = stock.rows.filter((r) => r.reorder > 0);

  // Best-effort: mirror the branch's current reorder as a draft Sales Order in Odoo.
  // No-ops silently if Odoo sync isn't configured or this branch has no mapped customer.
  let odooOrderId: number | null = null;
  let odooOrderName: string | null = null;
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
    }
  }

  // Best-effort: let Pure Nutrition know an LPO came in, same as a manual order does.
  // CC'd to the branch's own email too, so the manager has proof they submitted it.
  if (store) {
    const orderItems = items.map((r) => ({ sku: r.sku, flavour: r.flavour, reorder: r.reorder }));
    const orderRef = newOrderRef();
    const courierLink = await createCourierDispatch(storeId, orderRef, orderItems, odooOrderId, odooOrderName);
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
  signatureUrl: string | null
): Promise<PlaceOrderResult> {
  const session = await requireRole("branch");
  if (!session?.storeId) return { ok: false, error: "Your session expired — log in again." };
  if (!placedByName.trim()) return { ok: false, error: "Please enter your name before placing the order." };
  if (!signatureUrl) return { ok: false, error: "Please sign before placing the order." };
  const storeId = session.storeId;

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { name: true, county: true, type: true, odooPartnerId: true, contactEmail: true, seedEmail: true },
  });
  if (!store) return { ok: false, error: "Your branch no longer exists." };

  const products = await getProducts();
  const bySku = new Map(products.map((p) => [p.sku, p]));

  const items = Object.entries(quantities)
    .map(([sku, qty]) => ({ sku, qty: Math.trunc(Number(qty) || 0), product: bySku.get(sku) }))
    .filter((i): i is typeof i & { product: NonNullable<typeof i.product> } => i.qty > 0 && !!i.product && !i.product.unavailable)
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

  const orderRef = newOrderRef();
  const courierLink = await createCourierDispatch(storeId, orderRef, items, order?.id ?? null, order?.name ?? null);

  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = await sendManualOrderEmail(
      store,
      items,
      order?.name ?? null,
      store.contactEmail || store.seedEmail || null,
      placedByName.trim(),
      signatureUrl,
      orderRef,
      courierLink
    );
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
  return { ok: true, itemCount: items.length };
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
