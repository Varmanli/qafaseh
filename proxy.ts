import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth/constants";
import { resolveInternalRedirect } from "@/lib/auth/redirects";
import { getLoginPath, isProtectedPagePath } from "@/lib/auth/routes";

/**
 * بررسی سبک در لبه (edge): فقط وجود کوکی توکن را چک می‌کند.
 * اعتبارسنجی واقعی امضای JWT در layout داشبورد (محیط Node) انجام می‌شود،
 * چون kتابخانه‌ی jsonwebtoken در رانتایم edge اجرا نمی‌شود.
 */

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasToken = Boolean(req.cookies.get(AUTH_COOKIE)?.value);

  const isProtected = isProtectedPagePath(pathname);

  // کاربر احرازنشده‌ای که سراغ صفحه‌ی محافظت‌شده می‌رود → ورود
  if (isProtected && !hasToken) {
    const loginUrl = resolveInternalRedirect(getLoginPath(pathname));
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/account/:path*",
    "/admin/:path*",
    "/books/add/:path*",
    "/books/edit/:path*",
    "/dashboard/:path*",
    "/reading/:path*",
    "/settings/:path*",
    "/wishlist/:path*",
  ],
};
