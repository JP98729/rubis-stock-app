"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { attachFileToSaleOrder, attachFileToExpense, createCourierExpense } from "@/lib/odoo";
import { sendCourierStatusEmail } from "@/lib/email";
import { courierFeeKES } from "@/lib/brand";

export type SimpleResult = { ok: true } | { ok: false; error: string };

/**
 * No role/session check on either action here — the dispatch id itself (an
 * unguessable cuid, never listed anywhere public) is the courier's authorization,
 * the same way a package-tracking link works. They have no account in this app.
 */
async function loadDispatch(id: string) {
  return prisma.courierDispatch.findUnique({
    where: { id },
    include: { store: { select: { name: true, county: true, type: true, contactEmail: true, seedEmail: true } } },
  });
}

async function markAccepted(dispatch: NonNullable<Awaited<ReturnType<typeof loadDispatch>>>): Promise<void> {
  await prisma.courierDispatch.update({
    where: { id: dispatch.id },
    data: { status: "accepted", acceptedAt: new Date() },
  });
  await sendCourierStatusEmail(
    dispatch.store,
    dispatch.orderRef,
    "accepted",
    dispatch.store.contactEmail || dispatch.store.seedEmail || null
  );
}

/**
 * Creates the Odoo expense for this dispatch's delivery fee on first use, then
 * reuses the same expense id for every later document upload — so the fee and
 * every supporting doc (delivery note, waybill, eTIMS invoice) end up on one
 * expense's paperclip instead of three separate ones. Returns null (no throw)
 * whenever Odoo sync isn't configured, or the shipping weight isn't known yet.
 */
async function ensureCourierExpense(
  dispatch: NonNullable<Awaited<ReturnType<typeof loadDispatch>>>
): Promise<number | null> {
  if (dispatch.courierExpenseId) return dispatch.courierExpenseId;
  if (dispatch.shippingWeightKg == null) return null;

  const expense = await createCourierExpense({
    storeName: dispatch.store.name,
    orderRef: dispatch.orderRef,
    feeKES: courierFeeKES(dispatch.shippingWeightKg),
    date: dispatch.createdAt.toISOString().slice(0, 10),
    isNairobi: dispatch.store.county.trim().toLowerCase() === "nairobi",
  });
  if (!expense) return null;

  await prisma.courierDispatch.update({ where: { id: dispatch.id }, data: { courierExpenseId: expense.id } });
  return expense.id;
}

export async function acceptCourierDispatch(id: string): Promise<SimpleResult> {
  const dispatch = await loadDispatch(id);
  if (!dispatch) return { ok: false, error: "This dispatch link is invalid." };

  if (dispatch.status === "pending") {
    await markAccepted(dispatch);
  }

  revalidatePath(`/courier/${id}`);
  return { ok: true };
}

/**
 * Same accept logic as acceptCourierDispatch, used when the courier page itself
 * auto-accepts from the email's ?accept=1 link. Skips revalidatePath — calling that
 * mid-render is unsupported in Next.js, and it's unnecessary here anyway since the
 * page re-reads fresh state within the same request.
 */
export async function acceptCourierDispatchDuringRender(id: string): Promise<void> {
  const dispatch = await loadDispatch(id);
  if (dispatch && dispatch.status === "pending") {
    await markAccepted(dispatch);
  }
}

export async function uploadCourierDeliveryNote(id: string, url: string): Promise<SimpleResult> {
  const dispatch = await loadDispatch(id);
  if (!dispatch) return { ok: false, error: "This dispatch link is invalid." };
  if (dispatch.status === "pending") return { ok: false, error: "Accept the dispatch before uploading the delivery note." };
  if (!url) return { ok: false, error: "Upload a photo or PDF of the signed delivery note first." };

  await prisma.courierDispatch.update({
    where: { id },
    data: {
      status: "delivered",
      deliveryNoteUrl: url,
      deliveredAt: new Date(),
      acceptedAt: dispatch.acceptedAt ?? new Date(),
    },
  });

  // Best-effort: put the delivery note on the Sales Order's paperclip icon in Odoo too.
  const deliveryNoteExt = url.toLowerCase().endsWith(".pdf") ? "pdf" : "jpg";
  const deliveryNoteFilename = `Delivery note ${dispatch.store.name.trim()} ${dispatch.orderRef}.${deliveryNoteExt}`;
  if (dispatch.odooSaleOrderId) {
    await attachFileToSaleOrder(dispatch.odooSaleOrderId, url, deliveryNoteFilename);
  }
  const deliveryNoteExpenseId = await ensureCourierExpense(dispatch);
  if (deliveryNoteExpenseId) {
    await attachFileToExpense(deliveryNoteExpenseId, url, deliveryNoteFilename);
  }

  await sendCourierStatusEmail(
    dispatch.store,
    dispatch.orderRef,
    "delivered",
    dispatch.store.contactEmail || dispatch.store.seedEmail || null,
    url
  );

  revalidatePath(`/courier/${id}`);
  return { ok: true };
}

export async function uploadCourierWaybill(id: string, url: string): Promise<SimpleResult> {
  const dispatch = await loadDispatch(id);
  if (!dispatch) return { ok: false, error: "This dispatch link is invalid." };
  if (dispatch.status === "pending") return { ok: false, error: "Accept the dispatch before uploading the waybill." };
  if (!url) return { ok: false, error: "Upload a photo or PDF of the waybill first." };

  await prisma.courierDispatch.update({
    where: { id },
    data: { waybillUrl: url, waybillUploadedAt: new Date() },
  });

  // Best-effort: put the waybill on the Sales Order's paperclip icon in Odoo too.
  const waybillExt = url.toLowerCase().endsWith(".pdf") ? "pdf" : "jpg";
  const waybillFilename = `Waybill ${dispatch.store.name.trim()} ${dispatch.orderRef}.${waybillExt}`;
  if (dispatch.odooSaleOrderId) {
    await attachFileToSaleOrder(dispatch.odooSaleOrderId, url, waybillFilename);
  }
  const waybillExpenseId = await ensureCourierExpense(dispatch);
  if (waybillExpenseId) {
    await attachFileToExpense(waybillExpenseId, url, waybillFilename);
  }

  await sendCourierStatusEmail(
    dispatch.store,
    dispatch.orderRef,
    "waybill",
    dispatch.store.contactEmail || dispatch.store.seedEmail || null,
    url
  );

  revalidatePath(`/courier/${id}`);
  return { ok: true };
}

/** The courier's own KRA eTIMS invoice for the delivery fee — same paperclip pattern as the waybill. */
export async function uploadCourierEtimsInvoice(id: string, url: string): Promise<SimpleResult> {
  const dispatch = await loadDispatch(id);
  if (!dispatch) return { ok: false, error: "This dispatch link is invalid." };
  if (dispatch.status === "pending") return { ok: false, error: "Accept the dispatch before uploading the eTIMS invoice." };
  if (!url) return { ok: false, error: "Upload a photo or PDF of the eTIMS invoice first." };

  await prisma.courierDispatch.update({
    where: { id },
    data: { etimsInvoiceUrl: url, etimsInvoiceUploadedAt: new Date() },
  });

  // Best-effort: put the eTIMS invoice on the Sales Order's paperclip icon in Odoo too.
  const etimsExt = url.toLowerCase().endsWith(".pdf") ? "pdf" : "jpg";
  const etimsFilename = `Courier eTIMS invoice ${dispatch.store.name.trim()} ${dispatch.orderRef}.${etimsExt}`;
  if (dispatch.odooSaleOrderId) {
    await attachFileToSaleOrder(dispatch.odooSaleOrderId, url, etimsFilename);
  }
  const etimsExpenseId = await ensureCourierExpense(dispatch);
  if (etimsExpenseId) {
    await attachFileToExpense(etimsExpenseId, url, etimsFilename);
  }

  await sendCourierStatusEmail(
    dispatch.store,
    dispatch.orderRef,
    "etims",
    dispatch.store.contactEmail || dispatch.store.seedEmail || null,
    url
  );

  revalidatePath(`/courier/${id}`);
  return { ok: true };
}
