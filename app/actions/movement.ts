"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { sendMovementSummaryEmail } from "@/lib/email";
import type { MovementType } from "@prisma/client";

export type MovementInput = {
  storeId: number;
  sku: string; // ignored for DELIVERY — logged as paperwork only, no product
  type: MovementType;
  qty: number;
  date: string;
  time: string;
  merchandiser: string;
  batchCode: string;
  deliveryNote: string;
  deliveryNotePhotoUrl: string | null;
  invoiceNumber: string;
  receivedBy: string;
  notes: string;
  signatureUrl: string | null;
};

export type SubmitResult = { ok: true } | { ok: false; error: string };

const VALID_TYPES: MovementType[] = ["DELIVERY", "SALE", "RETURN", "EXPIRED_DAMAGED"];

export async function submitMovement(input: MovementInput): Promise<SubmitResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Your session expired — sign in again." };
  if (session.role === "branch") {
    if (session.storeId !== input.storeId) {
      return { ok: false, error: "You can only log movements for your own branch." };
    }
  } else if (session.role !== "merchandiser") {
    return { ok: false, error: "Only merchandisers and branch managers can log movements." };
  }

  if (session.role === "merchandiser" && !input.signatureUrl) {
    return { ok: false, error: "Please sign before submitting." };
  }
  if (session.role === "merchandiser" && !input.merchandiser.trim()) {
    return { ok: false, error: "Enter your name before submitting." };
  }

  if (!VALID_TYPES.includes(input.type)) return { ok: false, error: "Pick a movement type." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { ok: false, error: "Select a valid date." };
  if (input.type === "DELIVERY" && !input.deliveryNote.trim()) {
    return { ok: false, error: "Enter the delivery note nr before submitting." };
  }
  if (input.type === "DELIVERY" && !input.invoiceNumber.trim()) {
    return { ok: false, error: "Enter the invoice nr before submitting." };
  }

  const store = await prisma.store.findUnique({
    where: { id: input.storeId },
    select: { id: true, name: true, county: true, type: true },
  });
  if (!store) return { ok: false, error: "That branch no longer exists." };

  // Delivery is logged as paperwork only — no product/quantity to validate.
  let qty = 0;
  let productName: string | null = null;
  if (input.type !== "DELIVERY") {
    qty = Math.trunc(Number(input.qty) || 0);
    if (qty < 1) return { ok: false, error: "Quantity must be at least 1." };
    const product = await prisma.product.findUnique({
      where: { sku: input.sku },
      select: { sku: true, flavour: true, unavailable: true },
    });
    if (!product) return { ok: false, error: "Unknown product." };
    if (product.unavailable) return { ok: false, error: "This product is not currently made — it can't be logged." };
    productName = product.flavour;
  }

  await prisma.movement.create({
    data: {
      storeId: input.storeId,
      sku: input.type === "DELIVERY" ? null : input.sku,
      type: input.type,
      qty,
      date: input.date,
      time: (input.time || "").trim(),
      merchandiser: (input.merchandiser || "").trim(),
      batchCode: (input.batchCode || "").trim(),
      deliveryNote: input.type === "DELIVERY" ? (input.deliveryNote || "").trim() : "",
      deliveryNotePhotoUrl: input.type === "DELIVERY" ? input.deliveryNotePhotoUrl : null,
      invoiceNumber: input.type === "DELIVERY" ? (input.invoiceNumber || "").trim() : "",
      receivedBy: input.type === "DELIVERY" ? (input.receivedBy || "").trim() : "",
      notes: (input.notes || "").trim(),
      signatureUrl: input.signatureUrl || "",
    },
  });

  await sendMovementSummaryEmail(store, {
    type: input.type,
    date: input.date,
    time: (input.time || "").trim(),
    merchandiser: (input.merchandiser || "").trim(),
    productName,
    qty,
    batchCode: (input.batchCode || "").trim(),
    deliveryNote: (input.deliveryNote || "").trim(),
    deliveryNotePhotoUrl: input.type === "DELIVERY" ? input.deliveryNotePhotoUrl : null,
    invoiceNumber: (input.invoiceNumber || "").trim(),
    receivedBy: (input.receivedBy || "").trim(),
    notes: (input.notes || "").trim(),
  });

  revalidatePath("/branch");
  revalidatePath("/manager");
  revalidatePath("/merchandiser");
  return { ok: true };
}
