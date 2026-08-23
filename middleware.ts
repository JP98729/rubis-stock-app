import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Edge-level guard, layered under the per-page `requireRole()` checks in each role's
 * page component and the per-action checks in the server actions.
 *
 * Role pages deliberately are NOT redirected when the session is missing or has the
 * wrong role: the page itself renders that role's own login screen, which is the UX
 * the original app had ("there is no route to fail into, just role screens"). What the
 * middleware does here is:
 *   - reject API calls that carry no valid session before they reach a route handler,
 *   - enforce manager-only access to the data export at the edge,
 *   - clear a cookie that no longer verifies, so a stale/expired token doesn't linger.
 */

const COOKIE_NAME = "rubis_session";
const ROLE_ROUTES: Record<string, string> = {
  "/merchandiser": "merchandiser",
  "/branch": "branch",
  "/manager": "manager",
  "/hq": "hq",
};

type Claims = { role?: string };

async function readSession(request: NextRequest): Promise<{ present: boolean; valid: boolean; role?: string }> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return { present: false, valid: false };
  const raw = process.env.SESSION_SECRET;
  if (!raw || raw.length < 16) return { present: true, valid: false };
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(raw));
    const role = (payload as Claims).role;
    if (!role || !["merchandiser", "branch", "manager", "hq"].includes(role)) {
      return { present: true, valid: false };
    }
    return { present: true, valid: true, role };
  } catch {
    return { present: true, valid: false };
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await readSession(request);

  if (pathname.startsWith("/api/backup")) {
    if (session.role !== "manager") {
      return new NextResponse("Not authorised", { status: 403 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/upload")) {
    if (!session.valid) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }
    return NextResponse.next();
  }

  const requiredRole = Object.entries(ROLE_ROUTES).find(([prefix]) => pathname.startsWith(prefix))?.[1];
  if (requiredRole) {
    const response = NextResponse.next();
    // A cookie that no longer verifies (expired, or signed with a rotated secret) is
    // dropped so the visitor gets a clean login screen instead of a silently dead session.
    if (session.present && !session.valid) response.cookies.delete(COOKIE_NAME);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/merchandiser/:path*", "/branch/:path*", "/manager/:path*", "/hq/:path*", "/api/backup", "/api/upload"],
};
