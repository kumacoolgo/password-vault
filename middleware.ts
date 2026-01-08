import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionEdge } from "./lib/auth-edge";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow static + login page + login api
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/login")
  ) {
    return NextResponse.next();
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    // Misconfigured env -> block with clear message
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "AUTH_SECRET not set" }, { status: 500 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const token = req.cookies.get("pv_session")?.value;
  const session = await verifySessionEdge(token, secret);

  // Protect APIs (except login)
  if (pathname.startsWith("/api")) {
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.next();
  }

  // Protect pages
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
