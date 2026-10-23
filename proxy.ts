import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth/constants";
import { resolveInternalRedirect } from "@/lib/auth/redirects";
import { getLoginPath, isProtectedPagePath } from "@/lib/auth/routes";
import { isAllowedMutationOrigin } from "@/lib/api/request";

/**
 * بررسی اولیهٔ کوکی صفحات؛ احراز هویت نهایی در سرور انجام می‌شود.
 * APIها نیز در این مرز، مبدأ درخواست و اندازهٔ اعلام‌شده را کنترل می‌کنند.
 */

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/")) {
    if (!isAllowedMutationOrigin(req)) {
      return NextResponse.json({ ok: false, error: "درخواست مجاز نیست", code: "FORBIDDEN_ORIGIN" }, {
        status: 403, headers: { "Cache-Control": "private, no-store" },
      });
    }
    const multipart = req.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;");
    const maxBytes = pathname.startsWith("/api/admin/") ? (multipart ? 128 : 4) * 1024 * 1024
      : pathname === "/api/upload/image" ? 12 * 1024 * 1024 : 1024 * 1024;
    if (Number(req.headers.get("content-length")) > maxBytes) {
      return NextResponse.json({ ok: false, error: "حجم درخواست بیش از حد مجاز است" }, { status: 413 });
    }
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
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
    // Upload handlers check origin and actual bytes themselves. Avoid Next's
    // 10 MiB proxy-body clone truncating legitimate bulk uploads.
    "/api/((?!upload/image(?:/|$)|admin/book-covers/[^/]+/upload(?:/|$)|admin/book-covers/bulk-upload(?:/|$)|admin/books/import(?:/preview)?(?:/|$)|admin/references/media/(?:upload|preview)(?:/|$)).*)",
    "/account/:path*",
    "/admin/:path*",
    "/books/add/:path*",
    "/books/edit/:path*",
    "/dashboard/:path*",
    "/feed/:path*",
    "/reading/:path*",
    "/settings/:path*",
    "/wishlist/:path*",
  ],
};
