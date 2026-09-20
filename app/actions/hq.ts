"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getProducts } from "@/lib/queries";
import { sendManualOrderEmail, newOrderRef } from "@/lib/email";
import type { Audience } from "@prisma/client";

export type SimpleResult = { ok: true } | { ok: false; error: string };
export type PlaceHqOrderResult = { ok: true; itemCount: number } | { ok: false; error: string };

/** Rubis HQ isn't a branch in the Store table — it orders for itself, not on behalf of any store. */
const HQ_INFO = { name: "Rubis Head Quarters", county: "Nairobi", type: "HQ" };

/**
 * Lets Rubis HQ place an order for the head office itself — same email/PDF
 * Pure Nutrition already gets from a branch order (name, function, and signature
 * included), minus what's branch-specific (no courier dispatch, no Odoo sales
 * order) since this isn't a delivery to a branch.
 */
export async function placeHqOrder(
  quantities: Record<string, number>,
  placedByName: string,
  placedByFunction: string,
  signatureUrl: string | null,
  deliveryAddress: string,
  note: string
): Promise<PlaceHqOrderResult> {
  const session = await requireRole("hq");
  if (!session) return { ok: false, error: "Your session expired — sign in again." };
  if (!placedByName.trim()) return { ok: false, error: "Please enter your name before placing the order." };
  if (!placedByFunction.trim()) return { ok: false, error: "Please select your function before placing the order." };
  if (!signatureUrl) return { ok: false, error: "Please sign before placing the order." };
  if (!deliveryAddress.trim()) return { ok: false, error: "Please enter a delivery address before placing the order." };

  const products = await getProducts();
  const bySku = new Map(products.map((p) => [p.sku, p]));

  const items = Object.entries(quantities)
    .map(([sku, qty]) => ({ sku, qty: Math.trunc(Number(qty) || 0), product: bySku.get(sku) }))
    .filter((i): i is typeof i & { product: NonNullable<typeof i.product> } => i.qty > 0 && !!i.product && !i.product.unavailable)
    .map((i) => ({ sku: i.sku, flavour: i.product.flavour, reorder: i.qty }));

  if (items.length === 0) {
    return { ok: false, error: "Enter a quantity for at least one product before placing the order." };
  }

  const orderRef = newOrderRef();
  try {
    await sendManualOrderEmail(
      HQ_INFO,
      items,
      null,
      null,
      placedByName.trim(),
      placedByFunction.trim(),
      signatureUrl,
      orderRef,
      null,
      deliveryAddress.trim(),
      note.trim() || null
    );
  } catch (e) {
    return {
      ok: false,
      error: "Couldn't send the order — try again. (" + (e instanceof Error ? e.message : String(e)) + ")",
    };
  }

  return { ok: true, itemCount: items.length };
}

export type AnnouncementInput = {
  subject: string;
  body: string;
  audience: Audience;
  county?: string;
  storeType?: string;
  storeId?: number;
};

export async function sendAnnouncement(input: AnnouncementInput): Promise<SimpleResult> {
  const session = await requireRole("hq");
  if (!session) return { ok: false, error: "Your session expired — sign in again." };

  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject || !body) return { ok: false, error: "Add a subject and a message before sending." };

  await prisma.message.create({
    data: {
      subject,
      body,
      audience: input.audience,
      county: input.audience === "COUNTY" ? (input.county ?? null) : null,
      storeType: input.audience === "TYPE" ? (input.storeType ?? null) : null,
      storeId: input.audience === "STORE" ? (input.storeId ?? null) : null,
      from: "Rubis Head Office",
    },
  });

  revalidatePath("/hq");
  revalidatePath("/branch");
  return { ok: true };
}

export async function deleteAnnouncement(id: string): Promise<SimpleResult> {
  const session = await requireRole("hq");
  if (!session) return { ok: false, error: "Your session expired — sign in again." };
  await prisma.message.delete({ where: { id } }).catch(() => undefined);
  revalidatePath("/hq");
  revalidatePath("/branch");
  return { ok: true };
}
