import { NextResponse, type NextRequest } from "next/server";

/*
 * Optimistic gate for the back office: without the session cookie, /admin/* redirects to the
 * login screen. The real check (session in the database, permissions) happens in
 * src/lib/server/auth/dal.ts for every page, Server Action and Route Handler.
 */

const SESSION_COOKIE = "af_admin";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isLogin = pathname === "/admin/login";
  const hasCookie = request.cookies.has(SESSION_COOKIE);

  if (!hasCookie && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    if (request.method === "GET" && pathname !== "/admin") url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
