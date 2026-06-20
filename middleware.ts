import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_USER_ID_COOKIE = "srs_uid";
const AUTH_ROLE_COOKIE = "srs_role";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const userId = request.cookies.get(AUTH_USER_ID_COOKIE)?.value;
  const role = request.cookies.get(AUTH_ROLE_COOKIE)?.value;
  const isAuthenticated = Boolean(userId && role);

  const isAdmin = role === "ADMIN";
  const isManager = role === "MANAGER";
  const isEmployee = role === "EMPLOYEE";

  if ((pathname.startsWith("/dashboard") || pathname.startsWith("/form") || pathname.startsWith("/admin")) && !isAuthenticated) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/form") && !isAdmin) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  if (pathname.startsWith("/admin") && !isAdmin) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  if (pathname.startsWith("/dashboard") && !(isAdmin || isManager || isEmployee)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/" && isAuthenticated) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/form/:path*", "/admin/:path*"],
};
