import "server-only";
import { cookies } from "next/headers";
import { after } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma";

export type Role = "merchandiser" | "branch" | "manager" | "hq";

export type Session = {
  role: Role;
  storeId?: number;
  merchandiserId?: string;
  merchName?: string;
};

const COOKIE_NAME = "rubis_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret(): Uint8Array {
  const raw = process.env.SESSION_SECRET;
  if (!raw || raw.length < 16) {
    throw new Error(
      "SESSION_SECRET is missing or too short. Set it in .env.local (local) or the Vercel project env (production)."
    );
  }
  return new TextEncoder().encode(raw);
}

export async function createSession(session: Session): Promise<void> {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const role = payload.role as Role | undefined;
    if (!role || !["merchandiser", "branch", "manager", "hq"].includes(role)) return null;
    return {
      role,
      storeId: typeof payload.storeId === "number" ? payload.storeId : undefined,
      merchandiserId: typeof payload.merchandiserId === "string" ? payload.merchandiserId : undefined,
      merchName: typeof payload.merchName === "string" ? payload.merchName : undefined,
    };
  } catch {
    return null;
  }
}

/** Returns the session only if it carries the expected role. */
export async function requireRole(role: Role): Promise<Session | null> {
  const session = await getSession();
  if (!session || session.role !== role) return null;
  touchLastActive(session);
  return session;
}

/**
 * Bumps lastActiveAt for the signed-in branch or merchandiser so the manager
 * can see who's currently using the app. Runs via `after()` so it completes
 * even on serverless (a bare fire-and-forget promise can be frozen mid-flight
 * once the response is sent) without ever blocking or breaking the page render.
 */
function touchLastActive(session: Session): void {
  const now = new Date();
  if (session.role === "branch" && typeof session.storeId === "number") {
    const storeId = session.storeId;
    after(() => prisma.store.update({ where: { id: storeId }, data: { lastActiveAt: now } }).catch(() => {}));
  } else if (session.role === "merchandiser" && session.merchandiserId) {
    const merchandiserId = session.merchandiserId;
    after(() =>
      prisma.merchandiser.update({ where: { id: merchandiserId }, data: { lastActiveAt: now } }).catch(() => {})
    );
  }
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
