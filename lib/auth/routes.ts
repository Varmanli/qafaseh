/**
 * Routes that represent private account workspaces. Public catalog, profile,
 * and library pages are deliberately excluded from this list.
 */
const PROTECTED_PREFIXES = [
  "/account",
  "/admin",
  "/dashboard",
  "/feed",
  "/loans",
  "/reading",
  "/settings",
  "/wishlist",
] as const;

const PROTECTED_BOOK_WORKSPACE_PREFIXES = ["/books/add"] as const;

export function isProtectedPagePath(pathname: string) {
  return (
    PROTECTED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    ) ||
    PROTECTED_BOOK_WORKSPACE_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  );
}

/** Returns an internal path only, preventing login redirects from leaving the app. */
export function getSafeRedirectPath(
  value: string | null | undefined,
  fallback = "/dashboard",
) {
  const path = value?.trim();
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return fallback;
  }

  return path;
}

export function getLoginPath(returnTo: string) {
  return `/auth/login?redirect=${encodeURIComponent(returnTo)}`;
}
