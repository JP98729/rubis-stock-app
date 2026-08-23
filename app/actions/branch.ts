"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export type SimpleResult = { ok: true } | { ok: false; error: string };

/** Branch-manager self-service contact override (shown with a green * in the admin table). */
export async function saveBranchContact(phone: string, email: string): Promise<SimpleResult> {
  const session = await requireRole("branch");
  if (!session?.storeId) return { ok: false, error: "Your session expired — log in again." };
  await prisma.store.update({
    where: { id: session.storeId },
    data: { contactPhone: phone.trim() || null, contactEmail: email.trim() || null },
  });
  revalidatePath("/branch");
  revalidatePath("/manager");
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
