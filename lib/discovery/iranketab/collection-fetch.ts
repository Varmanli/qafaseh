import { lookup as dnsLookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { throttleExternalRequest } from "@/lib/importers/iranketab/external-request-throttle";

const IRANKETAB_HOSTS = new Set(["iranketab.ir", "www.iranketab.ir"]);
const MAX_REDIRECTS = 3;
const MAX_COLLECTION_HTML_BYTES = 3 * 1024 * 1024;
const COLLECTION_FETCH_TIMEOUT_MS = 12_000;

export type IranKetabDiscoverySourceType =
  | "AWARD"
  | "CURATED_LIST"
  | "EDITORIAL_COLLECTION"
  | "AUTHOR"
  | "PUBLISHER"
  | "TAG"
  | "SEARCH";

export type IranKetabCollectionFetchErrorCode =
  | "INVALID_URL"
  | "UNSUPPORTED_HOST"
  | "UNSUPPORTED_PATH"
  | "UNSAFE_DESTINATION"
  | "DNS_FAILED"
  | "REDIRECT_REJECTED"
  | "TOO_MANY_REDIRECTS"
  | "FETCH_TIMEOUT"
  | "FETCH_FAILED"
  | "HTTP_ERROR"
  | "INVALID_CONTENT_TYPE"
  | "RESPONSE_TOO_LARGE"
  | "INVALID_HTML";

export class IranKetabCollectionFetchError extends Error {
  constructor(
    public readonly code: IranKetabCollectionFetchErrorCode,
    message: string,
    public readonly retryable = false,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "IranKetabCollectionFetchError";
  }
}

const ipv4Deny = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) ipv4Deny.addSubnet(network, prefix, "ipv4");
const ipv6Deny = new BlockList();
for (const [network, prefix] of [
  ["::", 128], ["::1", 128], ["::ffff:0.0.0.0", 96], ["fc00::", 7], ["fe80::", 10],
  ["ff00::", 8], ["2001:db8::", 32], ["2001:10::", 28], ["2001:2::", 48],
] as const) ipv6Deny.addSubnet(network, prefix, "ipv6");

export function validateIranKetabCollectionUrl(
  value: string,
  sourceType: IranKetabDiscoverySourceType,
): URL {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new IranKetabCollectionFetchError("INVALID_URL", "نشانی منبع کشف معتبر نیست.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port)
    throw new IranKetabCollectionFetchError("INVALID_URL", "نشانی منبع باید HTTPS و بدون اطلاعات ورود یا پورت باشد.");
  const host = url.hostname.toLowerCase();
  if (isIP(host))
    throw new IranKetabCollectionFetchError("UNSAFE_DESTINATION", "آدرس IP به‌عنوان مقصد قابل پذیرش نیست.");
  if (!IRANKETAB_HOSTS.has(host))
    throw new IranKetabCollectionFetchError("UNSUPPORTED_HOST", "فقط صفحات مجموعه ایران‌کتاب قابل پذیرش هستند.");
  if (!isSupportedCollectionPath(url.pathname, sourceType))
    throw new IranKetabCollectionFetchError("UNSUPPORTED_PATH", "مسیر منبع برای نوع انتخاب‌شده پشتیبانی نمی‌شود.");
  // Treat IranKetab's apex and www host as one page identity for redirects and pagination.
  url.hostname = "www.iranketab.ir";
  url.hash = "";
  return url;
}

export type IranKetabCollectionFetchDependencies = {
  lookup?: (hostname: string) => Promise<Array<{ address: string; family: number }>>;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
};

export async function fetchIranKetabCollectionHtml(
  value: string,
  sourceType: IranKetabDiscoverySourceType,
  dependencies: IranKetabCollectionFetchDependencies = {},
): Promise<{ canonicalUrl: string; html: string }> {
  const lookup = dependencies.lookup ?? ((hostname) => dnsLookup(hostname, { all: true, verbatim: true }));
  const fetcher = dependencies.fetch ?? globalThis.fetch;
  let current = validateIranKetabCollectionUrl(value, sourceType);
  const visited = new Set<string>();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), dependencies.timeoutMs ?? COLLECTION_FETCH_TIMEOUT_MS);
  try {
    for (let redirects = 0; ; redirects += 1) {
      const canonicalUrl = current.toString();
      if (visited.has(canonicalUrl))
        throw new IranKetabCollectionFetchError("REDIRECT_REJECTED", "حلقه تغییر مسیر شناسایی شد.");
      visited.add(canonicalUrl);
      let addresses: Array<{ address: string; family: number }>;
      try {
        addresses = await lookup(current.hostname);
      } catch (cause) {
        throw new IranKetabCollectionFetchError("DNS_FAILED", "نشانی ایران‌کتاب قابل شناسایی نیست.", true, { cause });
      }
      if (!addresses.length || addresses.some(({ address }) => isUnsafeIpAddress(address)))
        throw new IranKetabCollectionFetchError("UNSAFE_DESTINATION", "مقصد شبکه‌ای ناامن رد شد.");
      let response: Response;
      try {
        response = await throttleExternalRequest(() =>
          fetcher(canonicalUrl, {
            redirect: "manual",
            signal: controller.signal,
            headers: {
              "User-Agent": "Qafaseh-IranKetab-Discovery/1.0",
              Accept: "text/html,application/xhtml+xml",
            },
          }),
        );
      } catch (cause) {
        if (controller.signal.aborted)
          throw new IranKetabCollectionFetchError("FETCH_TIMEOUT", "دریافت منبع کشف بیش از حد طول کشید.", true, { cause });
        throw new IranKetabCollectionFetchError("FETCH_FAILED", "منبع کشف ایران‌کتاب در دسترس نیست.", true, { cause });
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirects >= MAX_REDIRECTS)
          throw new IranKetabCollectionFetchError("TOO_MANY_REDIRECTS", "تعداد تغییر مسیرها بیش از حد مجاز است.");
        const location = response.headers.get("location");
        if (!location) throw new IranKetabCollectionFetchError("REDIRECT_REJECTED", "پاسخ تغییر مسیر معتبر نبود.");
        try {
          current = validateIranKetabCollectionUrl(new URL(location, current).toString(), sourceType);
        } catch (cause) {
          throw new IranKetabCollectionFetchError("REDIRECT_REJECTED", "تغییر مسیر به منبع غیرمجاز رد شد.", false, { cause });
        }
        continue;
      }
      if (!response.ok)
        throw new IranKetabCollectionFetchError("HTTP_ERROR", "منبع کشف ایران‌کتاب در دسترس نیست.", response.status >= 500 || response.status === 429);
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml"))
        throw new IranKetabCollectionFetchError("INVALID_CONTENT_TYPE", "پاسخ منبع از نوع HTML نیست.");
      const html = await readLimitedText(response, controller.signal);
      if (!/<(?:!doctype\s+html|html|body|div)\b/i.test(html))
        throw new IranKetabCollectionFetchError("INVALID_HTML", "پاسخ دریافت‌شده ساختار HTML معتبر ندارد.");
      return { canonicalUrl, html };
    }
  } finally {
    clearTimeout(timer);
  }
}

function isSupportedCollectionPath(pathname: string, sourceType: IranKetabDiscoverySourceType) {
  let path: string;
  try {
    path = decodeURIComponent(pathname).replace(/\/+$/, "") || "/";
  } catch {
    return false;
  }
  if (sourceType === "AUTHOR") return /^\/profile\/[^/]+(?:\/page\/\d+)?$/u.test(path);
  if (sourceType === "PUBLISHER") return /^\/publisher\/[^/]+(?:\/page\/\d+)?$/u.test(path);
  if (sourceType === "SEARCH") return path === "/search";
  return /^\/(?:tag|category|collection|list)\/[^/]+(?:\/page\/\d+)?$/u.test(path);
}

function isUnsafeIpAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return ipv4Deny.check(address, "ipv4");
  if (family === 6) return ipv6Deny.check(address, "ipv6");
  return true;
}

async function readLimitedText(response: Response, signal: AbortSignal) {
  if (Number(response.headers.get("content-length") ?? 0) > MAX_COLLECTION_HTML_BYTES)
    throw new IranKetabCollectionFetchError("RESPONSE_TOO_LARGE", "حجم منبع کشف بیش از حد مجاز است.");
  if (!response.body) throw new IranKetabCollectionFetchError("INVALID_HTML", "پاسخ منبع خالی است.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    if (signal.aborted) throw new IranKetabCollectionFetchError("FETCH_TIMEOUT", "دریافت منبع کشف بیش از حد طول کشید.", true);
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    size += value.byteLength;
    if (size > MAX_COLLECTION_HTML_BYTES) {
      await reader.cancel();
      throw new IranKetabCollectionFetchError("RESPONSE_TOO_LARGE", "حجم منبع کشف بیش از حد مجاز است.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}
