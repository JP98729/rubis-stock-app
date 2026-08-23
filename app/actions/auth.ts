"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/session";
import { normalizeCode, storeCodeFor, storeIdFromCode } from "@/lib/codes";

export type LoginState = { error?: string };

async function roleCodeMatches(type: "MERCHANDISER" | "MANAGER" | "HQ", code: string) {
  const row = await prisma.roleCode.findUnique({ where: { type } });
  if (!row) return false;
  return bcrypt.compare(code, row.codeHash);
}

/**
 * Merchandiser login, reproducing the original order of precedence:
 *   1. an *active* merchandiser's individual code  -> unlock with their name attached
 *   2. the shared merchandiser backup code         -> unlock with no name
 *   3. otherwise, the "not recognized" error
 *
 * Individual codes are bcrypt-hashed, so step 1 has to compare against each active
 * merchandiser's hash in turn. Fine at this scale (a handful of merchandisers).
 */
export async function loginMerchandiser(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const code = normalizeCode(String(formData.get("code") ?? ""));
  if (!code) return { error: "Code not recognized. Check with your Pure Nutrition contact for your code." };

  const people = await prisma.merchandiser.findMany({ where: { active: true } });
  for (const person of people) {
    if (await bcrypt.compare(code, person.codeHash)) {
      await createSession({ role: "merchandiser", merchandiserId: person.id, merchName: person.name });
      revalidatePath("/merchandiser");
      redirect("/merchandiser");
    }
  }

  if (await roleCodeMatches("MERCHANDISER", code)) {
    await createSession({ role: "merchandiser" });
    revalidatePath("/merchandiser");
    redirect("/merchandiser");
  }

  return { error: "Code not recognized. Check with your Pure Nutrition contact for your code." };
}

export async function loginBranch(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const code = normalizeCode(String(formData.get("code") ?? ""));
  const fail = { error: "Code not recognized. Check the code we sent your branch and try again." };
  const storeId = storeIdFromCode(code);
  if (storeId === null) return fail;

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return fail;
  // Compare the canonical form of the code ("RB004"), not the raw input, so that the
  // original app's tolerance for missing leading zeros ("RB4") is preserved while the
  // verification itself still happens server-side against the stored bcrypt hash.
  if (!(await bcrypt.compare(storeCodeFor(storeId), store.codeHash))) return fail;

  await createSession({ role: "branch", storeId: store.id });
  revalidatePath("/branch");
  redirect("/branch");
}

export async function loginManager(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const code = normalizeCode(String(formData.get("code") ?? ""));
  if (!code || !(await roleCodeMatches("MANAGER", code))) return { error: "Incorrect code." };
  await createSession({ role: "manager" });
  revalidatePath("/manager");
  redirect("/manager");
}

export async function loginHq(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const code = normalizeCode(String(formData.get("code") ?? ""));
  if (!code || !(await roleCodeMatches("HQ", code)))
    return { error: "Code not recognized. Check with Pure Nutrition for the current Rubis HQ code." };
  await createSession({ role: "hq" });
  revalidatePath("/hq");
  redirect("/hq");
}

/** Used by both "Switch role" in the top bar and the branch manager's "Log out". */
export async function logout() {
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/");
}
