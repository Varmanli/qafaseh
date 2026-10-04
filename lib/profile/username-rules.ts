const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 30;
// Allow `_` alongside `-` as an interior separator: legacy/seed usernames such
// as `user_fnxsne` use underscores, and they must remain routable and editable.
// Still must start with a letter and end alphanumeric (no trailing separator).
const USERNAME_BASE_RE = /^[a-z](?:[a-z0-9_-]{1,28}[a-z0-9])?$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_32_RE = /^[0-9a-f]{32}$/i;
const CUID_RE = /^c[a-z0-9]{24,}$/i;
const NANOID_LIKE_RE = /^[A-Za-z0-9_-]{16,}$/;

// Reserved segments can never be usernames: they are (or could become) real
// top-level app routes, and a root `/[username]` profile must never shadow them.
export const RESERVED_USERNAMES = new Set([
  "add",
  "edit",
  "admin",
  "api",
  "settings",
  "profile",
  "search",
  "feed",
  "quote",
  "note",
  "activity",
  "comments",
  "catalog",
  "new",
  "detail",
  "book",
  "books",
  "dashboard",
  "auth",
  "login",
  "signup",
  "explore",
  "blog",
  "about",
  "rules",
  "privacy",
  "contact",
  "u",
  "account",
  "wishlist",
]);

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

/**
 * Usernames reserve path-critical segments so `/books/add` can never collide
 * with profile libraries.
 */
export function isReservedUsername(value: string) {
  return RESERVED_USERNAMES.has(normalizeUsername(value));
}

/**
 * Opaque book identifiers should win over library resolution. The app currently
 * uses UUIDs, but this helper also guards common CUID/nanoid-style shapes so the
 * route split remains safe if identifier formats change later.
 */
export function isBookIdLikeIdentifier(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;

  return (
    UUID_RE.test(trimmed) ||
    HEX_32_RE.test(trimmed) ||
    CUID_RE.test(trimmed) ||
    (NANOID_LIKE_RE.test(trimmed) && /[A-Z_]/.test(trimmed))
  );
}

/**
 * `isValidUsername` is the single source of truth for routable usernames:
 * lower-case, URL-safe, non-reserved, and never shaped like an opaque book id.
 */
export function isValidUsername(value: string) {
  const normalized = normalizeUsername(value);

  return (
    normalized.length >= USERNAME_MIN_LENGTH &&
    normalized.length <= USERNAME_MAX_LENGTH &&
    USERNAME_BASE_RE.test(normalized) &&
    !isReservedUsername(normalized) &&
    !isBookIdLikeIdentifier(normalized)
  );
}
