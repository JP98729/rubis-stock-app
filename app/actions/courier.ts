"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { attachFileToSaleOrder } from "@/lib/odoo";
import { sendCourierStatusEmail } from "@/lib/email";

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

export async function acceptCourierDispatch(id: string): Promise<SimpleResult> {
  const dispatch = await loadDispatch(id);
  if (!dispatch) return { ok: false, error: "This dispatch link is invalid." };

  if (dispatch.status === "pending") {
    await prisma.courierDispatch.update({
      where: { id },
      data: { status: "accepted", acceptedAt: new Date() },
    });
    await sendCourierStatusEmail(
      dispatch.store,
      dispatch.orderRef,
      "accepted",
      dispatch.store.contactEmail || dispatch.store.seedEmail || null
    );
  }

  revalidatePath(`/courier/${id}`);
  return { ok: true };
}

export async function uploadCourierDeliveryNote(id: string, url: string): Promise<SimpleResult> {
  const dispatch = await loadDispatch(id);
  if (!dispatch) return { ok: false, error: "This dispatch link is invalid." };
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
  if (dispatch.odooSaleOrderId) {
    const ext = url.toLowerCase().endsWith(".pdf") ? "pdf" : "jpg";
    await attachFileToSaleOrder(
      dispatch.odooSaleOrderId,
      url,
      `Delivery note ${dispatch.store.name.trim()} ${dispatch.orderRef}.${ext}`
    );
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
