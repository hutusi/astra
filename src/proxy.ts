import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/token";

// UX-only routing guard: keeps roles in their subtree and the logged-out on
// /login. The authoritative permission gate is assertCan() in the services.
export default async function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const { pathname } = req.nextUrl;

  if (!session) {
    if (pathname.startsWith("/login")) return NextResponse.next();
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const home = session.role === "guardian" ? "/parent" : "/child";
  if (pathname === "/" || pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL(home, req.url));
  }
  if (pathname.startsWith("/parent") && session.role !== "guardian") {
    return NextResponse.redirect(new URL("/child", req.url));
  }
  if (pathname.startsWith("/child") && session.role !== "child") {
    return NextResponse.redirect(new URL("/parent", req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except static assets and files with extensions.
  matcher: ["/((?!_next|.*\\..*).*)"],
};
