import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

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
  return session;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
