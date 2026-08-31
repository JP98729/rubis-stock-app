"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getProducts, getStoreStock } from "@/lib/queries";
import { createDraftSalesOrder } from "@/lib/odoo";
import { sendManualOrderEmail } from "@/lib/email";

export type SimpleResult = { ok: true } | { ok: false; error: string };
export type PlaceOrderResult = { ok: true; itemCount: number } | { ok: false; error: string };

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

  const doc = await prisma.lpoDocument.create({
    data: { storeId, url, filename: filename.trim() || "LPO document" },
  });

  // Best-effort: mirror the branch's current reorder as a draft Sales Order in Odoo.
  // No-ops silently if Odoo sync isn't configured or this branch has no mapped customer.
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { odooPartnerId: true } });
  if (store?.odooPartnerId) {
    const products = await getProducts();
    const stock = await getStoreStock(storeId, products);
    const order = await createDraftSalesOrder(
      store.odooPartnerId,
      stock.rows.map((r) => ({ sku: r.sku, reorder: r.reorder }))
    );
    if (order) {
      await prisma.lpoDocument.update({
        where: { id: doc.id },
        data: { odooSaleOrderId: order.id, odooSaleOrderName: order.name },
      });
    }
  }

  revalidatePath("/branch");
  revalidatePath("/manager");
  return { ok: true };
}

/**
 * Lets a branch manager place their order directly from the reorder list, without
 * needing a physical LPO to photograph/upload. Emails Pure Nutrition the order (the
 * actual delivery mechanism — a send failure is reported, not swallowed) and
 * best-effort mirrors it as a draft Sales Order in Odoo when the branch has one
 * mapped.
 */
export async function placeManualOrder(): Promise<PlaceOrderResult> {
  const session = await requireRole("branch");
  if (!session?.storeId) return { ok: false, error: "Your session expired — log in again." };
  const storeId = session.storeId;

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { name: true, county: true, type: true, odooPartnerId: true },
  });
  if (!store) return { ok: false, error: "Your branch no longer exists." };

  const products = await getProducts();
  const stock = await getStoreStock(storeId, products);
  const items = stock.rows.filter((r) => r.reorder > 0);
  if (items.length === 0) return { ok: false, error: "No reorder needed right now — you're fully stocked." };

  const order = store.odooPartnerId
    ? await createDraftSalesOrder(
        store.odooPartnerId,
        items.map((r) => ({ sku: r.sku, reorder: r.reorder }))
      )
    : null;

  try {
    await sendManualOrderEmail(
      store,
      items.map((r) => ({ sku: r.sku, flavour: r.flavour, reorder: r.reorder })),
      order?.name ?? null
    );
  } catch (e) {
    return {
      ok: false,
      error: "Couldn't send your order — try again, or upload your signed LPO instead. (" +
        (e instanceof Error ? e.message : String(e)) + ")",
    };
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
