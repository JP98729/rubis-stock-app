"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import type { Audience } from "@prisma/client";

export type SimpleResult = { ok: true } | { ok: false; error: string };

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
