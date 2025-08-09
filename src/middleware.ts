import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const sessionCookie = req.cookies.get("session_token")?.value || "";
  const hasCookie = Boolean(sessionCookie);
  const session = hasCookie ? await verifySession(sessionCookie) : null;

  // allow public assets (Next internals + common static files)
  const isStaticAsset =
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/icon") ||
    /\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml|css|js|woff2?|ttf|eot|map)$/i.test(pathname);
  if (isStaticAsset) return NextResponse.next();

  // allow only auth APIs publicly; protect the rest
  const isApi = pathname.startsWith("/api");
  const isAuthApi = pathname.startsWith("/api/auth/login") || pathname.startsWith("/api/auth/logout");
  if (isApi && isAuthApi) return NextResponse.next();

  // handle /login explicitly
  if (pathname.startsWith("/login")) {
    if (hasCookie && session) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!hasCookie) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    if (pathname && pathname !== "/") url.searchParams.set("from", pathname + (search || ""));
    return NextResponse.redirect(url);
  }

  // Optional: if cookie exists but token is invalid/expired, also force login
  if (!session) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    if (pathname && pathname !== "/") url.searchParams.set("from", pathname + (search || ""));
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  // Optionally forward user info to the app via headers (client components can't read httpOnly cookie)
  res.headers.set("x-user-email", session.email);
  if (session.name) res.headers.set("x-user-name", session.name);
  return res;
}

export const config = {
  matcher: ["/:path*"],
};
