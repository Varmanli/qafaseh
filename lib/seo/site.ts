export function getSiteOrigin() {
  const fallbackOrigin = process.env.NODE_ENV === "production"
    ? "https://qafasehman.ir"
    : "http://localhost:3000";
  const raw =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    fallbackOrigin;

  try {
    const url = new URL(raw);
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return fallbackOrigin;
  }
}

export function getSiteMetadataBase() {
  return new URL(getSiteOrigin());
}

export function toAbsoluteUrl(pathOrUrl: string) {
  if (!pathOrUrl) {
    return getSiteOrigin();
  }

  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  const normalized = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${getSiteOrigin()}${normalized}`;
}
