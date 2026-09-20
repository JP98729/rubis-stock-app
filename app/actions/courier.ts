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

/**
 * These three upload actions only save the file to the dispatch — no Odoo sync, no
 * email, no expense. That all happens together in submitCourierDocuments() once the
 * courier taps Submit. Saving immediately (rather than staging in the browser) still
 * means nothing is lost if the courier closes the app between documents.
 */
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

  revalidatePath(`/courier/${id}`);
  return { ok: true };
}

/** The courier's own KRA eTIMS invoice for the delivery fee — same pattern as the waybill. */
export async function uploadCourierEtimsInvoice(id: string, url: string): Promise<SimpleResult> {
  const dispatch = await loadDispatch(id);
  if (!dispatch) return { ok: false, error: "This dispatch link is invalid." };
  if (dispatch.status === "pending") return { ok: false, error: "Accept the dispatch before uploading the eTIMS invoice." };
  if (!url) return { ok: false, error: "Upload a photo or PDF of the eTIMS invoice first." };

  await prisma.courierDispatch.update({
    where: { id },
    data: { etimsInvoiceUrl: url, etimsInvoiceUploadedAt: new Date() },
  });

  revalidatePath(`/courier/${id}`);
  return { ok: true };
}

/**
 * The courier's final "send it all back" step: requires the delivery note, waybill,
 * and eTIMS invoice to already be uploaded, then attaches all three to the Sales
 * Order and to the courier's Odoo expense, and emails Pure Nutrition — all in one
 * go, once, so it's unmistakable to the courier that they're actually done.
 */
export async function submitCourierDocuments(id: string): Promise<SimpleResult> {
  const dispatch = await loadDispatch(id);
  if (!dispatch) return { ok: false, error: "This dispatch link is invalid." };
  if (dispatch.submittedAt) return { ok: true }; // already submitted — no-op, not an error
  if (!dispatch.deliveryNoteUrl) return { ok: false, error: "Upload the signed delivery note first." };
  if (!dispatch.waybillUrl) return { ok: false, error: "Upload the waybill first." };
  if (!dispatch.etimsInvoiceUrl) return { ok: false, error: "Upload your KRA eTIMS invoice first." };

  const docs: Array<{ label: string; url: string; filenamePrefix: string; event: "delivered" | "waybill" | "etims" }> = [
    { label: "Delivery note", url: dispatch.deliveryNoteUrl, filenamePrefix: "Delivery note", event: "delivered" },
    { label: "Waybill", url: dispatch.waybillUrl, filenamePrefix: "Waybill", event: "waybill" },
    { label: "eTIMS invoice", url: dispatch.etimsInvoiceUrl, filenamePrefix: "Courier eTIMS invoice", event: "etims" },
  ];

  const expenseId = await ensureCourierExpense(dispatch);

  for (const doc of docs) {
    const ext = doc.url.toLowerCase().endsWith(".pdf") ? "pdf" : "jpg";
    const filename = `${doc.filenamePrefix} ${dispatch.store.name.trim()} ${dispatch.orderRef}.${ext}`;
    if (dispatch.odooSaleOrderId) {
      await attachFileToSaleOrder(dispatch.odooSaleOrderId, doc.url, filename);
    }
    if (expenseId) {
      await attachFileToExpense(expenseId, doc.url, filename);
    }
    await sendCourierStatusEmail(
      dispatch.store,
      dispatch.orderRef,
      doc.event,
      dispatch.store.contactEmail || dispatch.store.seedEmail || null,
      doc.url
    );
  }

  await prisma.courierDispatch.update({ where: { id }, data: { submittedAt: new Date() } });

  revalidatePath(`/courier/${id}`);
  return { ok: true };
}
