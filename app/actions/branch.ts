"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getProducts, getStoreStock } from "@/lib/queries";
import { createDraftSalesOrder } from "@/lib/odoo";

export type SimpleResult = { ok: true } | { ok: false; error: string };

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
