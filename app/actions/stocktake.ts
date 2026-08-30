"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { sendStocktakeSummaryEmail } from "@/lib/email";
import { MIN_STOCK } from "@/lib/brand";

export type StocktakeItemInput = {
  sku: string;
  shelfQty: number;
  backStock: number;
  expired: number;
  damaged: number;
  batchCode: string;
  photoUrl: string | null;
};

export type CompetitorInput = {
  brand: string;
  gram: string;
  description: string;
  price: number;
  photoUrl: string | null;
};

export type StocktakeInput = {
  storeId: number;
  date: string;
  visitTime: string;
  merchandiser: string;
  idNumber: string;
  signatureUrl: string | null;
  notes: string;
  checksPlacement: string | null;
  checksPrices: string | null;
  checksMissing: string | null;
  checksPromotion: string | null;
  checksNotes: string;
  placementPhotoUrl: string | null;
  pricesPhotoUrl: string | null;
  promotionType: string;
  promotionPhotoUrl: string | null;
  competitors: CompetitorInput[];
  embedded: boolean;
  items: StocktakeItemInput[];
};

export type SubmitResult = { ok: true } | { ok: false; error: string };

/**
 * Server-side mirror of the stocktake form validation. The client blocks these first
 * with the original's alert() copy; this is the authoritative check.
 *
 * NOTE: batch code is deliberately NOT required when expired/damaged > 0. The original
 * app flags the field red in that case but never blocks submission — reproduced here
 * on purpose so behaviour matches the tool people already use.
 */
function validate(input: StocktakeInput): string | null {
  if (!input.merchandiser.trim()) return "Enter your name before submitting.";
  if (!input.embedded && !input.idNumber.trim()) return "Enter your ID number before submitting.";
  if (!input.date) return "Select the date before submitting.";
  if (!input.embedded && !input.visitTime.trim()) return "Select the visit time before submitting.";

  if (!input.embedded) {
    if (
      input.checksPlacement === null ||
      input.checksPrices === null ||
      input.checksMissing === null ||
      input.checksPromotion === null
    ) {
      return "Please answer all four store display questions before submitting.";
    }
    if (
      (input.checksPlacement === "No" || input.checksPrices === "No" || input.checksMissing === "Yes") &&
      !input.checksNotes.trim()
    ) {
      return "You flagged an issue above — please explain the reason before submitting.";
    }
    if (input.checksPlacement !== null && !input.placementPhotoUrl) {
      return "Please take a photo of the shelf for question 1 before submitting.";
    }
    if (input.checksPrices === "No" && !input.pricesPhotoUrl) {
      return "Price tags/prices are incorrect — please take a photo before submitting.";
    }
    if (input.checksPromotion === "Yes" && !input.promotionType.trim()) {
      return "Please describe the type of promotion before submitting.";
    }
    if (input.checksPromotion === "Yes" && !input.promotionPhotoUrl) {
      return "Please take a photo of the promotion display before submitting.";
    }
    if (!Array.isArray(input.competitors) || input.competitors.length < 3) {
      return "Please record all 3 competitor brands before submitting.";
    }
    for (let i = 0; i < 3; i++) {
      const c = input.competitors[i];
      if (!c.brand.trim()) return `Enter the brand name for competitor ${i + 1} before submitting.`;
      if (!c.gram.trim()) return `Enter the weight (g) for competitor ${i + 1} before submitting.`;
      if (!c.description.trim()) return `Enter the item description for competitor ${i + 1} before submitting.`;
      if (!(c.price > 0)) return `Enter a valid price for competitor ${i + 1} before submitting.`;
      if (!c.photoUrl) return `Take a photo for competitor ${i + 1} before submitting.`;
    }
  }
  if (!input.signatureUrl) return "Please sign before submitting.";
  return null;
}

export async function submitStocktake(input: StocktakeInput): Promise<SubmitResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Your session expired — sign in again." };

  // A branch manager can only ever submit an embedded stocktake for their own store.
  if (session.role === "branch") {
    if (!input.embedded || session.storeId !== input.storeId) {
      return { ok: false, error: "You can only submit a stocktake for your own branch." };
    }
  } else if (session.role !== "merchandiser") {
    return { ok: false, error: "Only merchandisers and branch managers can submit a stocktake." };
  } else if (input.embedded) {
    return { ok: false, error: "Merchandiser stocktakes must include the full store display check." };
  }

  const problem = validate(input);
  if (problem) return { ok: false, error: problem };

  const store = await prisma.store.findUnique({
    where: { id: input.storeId },
    select: { id: true, name: true, county: true, type: true },
  });
  if (!store) return { ok: false, error: "That branch no longer exists." };

  const products = await prisma.product.findMany({ select: { sku: true, flavour: true } });
  const known = new Set(products.map((p) => p.sku));
  const productNames = new Map(products.map((p) => [p.sku, p.flavour]));
  const items = input.items.filter((i) => known.has(i.sku));

  // Legacy scalar fields kept in sync for older reporting code that still reads them.
  const competitors = input.embedded ? [] : input.competitors;
  const legacyCompetitorBrands = competitors.map((c) => c.brand.trim()).filter(Boolean).join(", ");
  const legacyCompetitorPhotoUrl = competitors[0]?.photoUrl ?? null;

  await prisma.stocktake.create({
    data: {
      storeId: input.storeId,
      date: input.date,
      visitTime: input.embedded ? "" : input.visitTime.trim(),
      merchandiser: input.merchandiser.trim(),
      idNumber: input.embedded ? "" : input.idNumber.trim(),
      signatureUrl: input.signatureUrl!,
      notes: input.notes.trim(),
      checksPlacement: input.embedded ? null : input.checksPlacement,
      checksPrices: input.embedded ? null : input.checksPrices,
      checksMissing: input.embedded ? null : input.checksMissing,
      checksPromotion: input.embedded ? null : input.checksPromotion,
      checksNotes: input.embedded ? "" : input.checksNotes.trim(),
      placementPhotoUrl: input.embedded ? null : input.placementPhotoUrl,
      pricesPhotoUrl: input.embedded ? null : input.pricesPhotoUrl,
      promotionType: !input.embedded && input.checksPromotion === "Yes" ? input.promotionType.trim() : "",
      promotionPhotoUrl: !input.embedded && input.checksPromotion === "Yes" ? input.promotionPhotoUrl : null,
      competitorBrands: legacyCompetitorBrands,
      competitorPhotoUrl: legacyCompetitorPhotoUrl,
      competitorBrand1: competitors[0]?.brand.trim() || null,
      competitorGram1: competitors[0]?.gram.trim() || null,
      competitorDescription1: competitors[0]?.description.trim() || null,
      competitorPrice1: competitors[0]?.price ?? null,
      competitorPhotoUrl1: competitors[0]?.photoUrl ?? null,
      competitorBrand2: competitors[1]?.brand.trim() || null,
      competitorGram2: competitors[1]?.gram.trim() || null,
      competitorDescription2: competitors[1]?.description.trim() || null,
      competitorPrice2: competitors[1]?.price ?? null,
      competitorPhotoUrl2: competitors[1]?.photoUrl ?? null,
      competitorBrand3: competitors[2]?.brand.trim() || null,
      competitorGram3: competitors[2]?.gram.trim() || null,
      competitorDescription3: competitors[2]?.description.trim() || null,
      competitorPrice3: competitors[2]?.price ?? null,
      competitorPhotoUrl3: competitors[2]?.photoUrl ?? null,
      photoTaken: items.some((i) => !!i.photoUrl),
      embedded: input.embedded,
      items: {
        create: items.map((i) => ({
          sku: i.sku,
          shelfQty: Math.max(0, Math.trunc(Number(i.shelfQty) || 0)),
          backStock: Math.max(0, Math.trunc(Number(i.backStock) || 0)),
          expired: Math.max(0, Math.trunc(Number(i.expired) || 0)),
          damaged: Math.max(0, Math.trunc(Number(i.damaged) || 0)),
          batchCode: (i.batchCode || "").trim(),
          photoUrl: i.photoUrl,
        })),
      },
    },
  });

  revalidatePath("/branch");
  revalidatePath("/manager");
  revalidatePath("/merchandiser");

  await sendStocktakeSummaryEmail(
    store,
    {
      date: input.date,
      visitTime: input.embedded ? "" : input.visitTime.trim(),
      merchandiser: input.merchandiser.trim(),
      idNumber: input.idNumber.trim(),
      notes: input.notes.trim(),
      checksPlacement: input.checksPlacement,
      checksPrices: input.checksPrices,
      checksMissing: input.checksMissing,
      items: items.map((i) => ({
        name: productNames.get(i.sku) || i.sku,
        shelfQty: i.shelfQty,
        backStock: i.backStock,
        expired: i.expired,
        damaged: i.damaged,
      })),
      competitors: competitors.map((c) => ({ brand: c.brand, gram: c.gram, description: c.description, price: c.price })),
    },
    MIN_STOCK
  );

  return { ok: true };
}
