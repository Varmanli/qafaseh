import { lookup as dnsLookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { throttleExternalRequest } from "./external-request-throttle";

export type SecureFetchErrorCode =
  | "INVALID_URL" | "UNSUPPORTED_HOST" | "UNSUPPORTED_PATH" | "UNSAFE_DESTINATION"
  | "DNS_FAILED" | "REDIRECT_REJECTED" | "TOO_MANY_REDIRECTS" | "FETCH_TIMEOUT"
  | "FETCH_FAILED" | "HTTP_ERROR" | "INVALID_CONTENT_TYPE" | "RESPONSE_TOO_LARGE"
  | "INVALID_HTML";

export class SecureIranKetabFetchError extends Error {
  constructor(public readonly code: SecureFetchErrorCode, message: string, public readonly retryable = false, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SecureIranKetabFetchError";
  }
}

export const IRANKETAB_HOSTS = new Set(["iranketab.ir", "www.iranketab.ir"]);
export const MAX_REDIRECTS = 3;
export const MAX_HTML_BYTES = 3 * 1024 * 1024;
export const FETCH_TIMEOUT_MS = 12_000;

function isBookPath(pathname: string): boolean {
  let decoded: string;
  try { decoded = decodeURIComponent(pathname); } catch { return false; }
  const normalized = decoded.replace(/\/+$/, "");
  return /^\/book\/\d+(?:-[^/]+)?$/u.test(normalized);
}

const ipv4Deny = new BlockList();
for (const [network, prefix] of [["0.0.0.0",8],["10.0.0.0",8],["100.64.0.0",10],["127.0.0.0",8],["169.254.0.0",16],["172.16.0.0",12],["192.0.0.0",24],["192.0.2.0",24],["192.168.0.0",16],["198.18.0.0",15],["198.51.100.0",24],["203.0.113.0",24],["224.0.0.0",4],["240.0.0.0",4]] as const) ipv4Deny.addSubnet(network, prefix, "ipv4");
const ipv6Deny = new BlockList();
for (const [network, prefix] of [["::",128],["::1",128],["::ffff:0.0.0.0",96],["fc00::",7],["fe80::",10],["ff00::",8],["2001:db8::",32],["2001:10::",28],["2001:2::",48]] as const) ipv6Deny.addSubnet(network, prefix, "ipv6");

export function validateIranKetabBookUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new SecureIranKetabFetchError("INVALID_URL", "لینک واردشده معتبر نیست."); }
  if (url.protocol !== "https:" || url.username || url.password || url.port) throw new SecureIranKetabFetchError("INVALID_URL", "لینک ایران‌کتاب باید HTTPS و بدون اطلاعات ورود یا پورت باشد.");
  const host = url.hostname.toLowerCase();
  if (isIP(host)) throw new SecureIranKetabFetchError("UNSAFE_DESTINATION", "آدرس IP به‌عنوان مقصد قابل پذیرش نیست.");
  if (!IRANKETAB_HOSTS.has(host)) throw new SecureIranKetabFetchError("UNSUPPORTED_HOST", "فقط لینک صفحات کتاب سایت ایران‌کتاب قابل پذیرش است.");
  if (!isBookPath(url.pathname)) throw new SecureIranKetabFetchError("UNSUPPORTED_PATH", "این مسیر، صفحه شناخته‌شده کتاب در ایران‌کتاب نیست.");
  // The book ID lives in the path; query values are neither required for
  // extraction nor safe to preserve as distinct import identities.
  url.search = "";
  url.hash = "";
  return url;
}

export function isUnsafeIpAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return ipv4Deny.check(address, "ipv4");
  if (family === 6) return ipv6Deny.check(address, "ipv6");
  return true;
}

export type SecureFetchDependencies = {
  lookup?: (hostname: string) => Promise<Array<{ address: string; family: number }>>;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
};

export async function fetchIranKetabHtmlSecurely(value: string, dependencies: SecureFetchDependencies = {}): Promise<{ canonicalUrl: string; html: string }> {
  const lookup = dependencies.lookup ?? (hostname => dnsLookup(hostname, { all: true, verbatim: true }));
  const fetcher = dependencies.fetch ?? globalThis.fetch;
  let current = validateIranKetabBookUrl(value);
  const visited = new Set<string>();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), dependencies.timeoutMs ?? FETCH_TIMEOUT_MS);
  try {
    for (let redirects = 0; ; redirects += 1) {
      const canonical = current.toString();
      if (visited.has(canonical)) throw new SecureIranKetabFetchError("REDIRECT_REJECTED", "حلقه تغییر مسیر در پاسخ ایران‌کتاب شناسایی شد.");
      visited.add(canonical);
      let addresses: Array<{ address: string; family: number }>;
      try { addresses = await lookup(current.hostname); } catch (cause) { throw new SecureIranKetabFetchError("DNS_FAILED", "نشانی ایران‌کتاب قابل شناسایی نیست.", true, { cause }); }
      if (!addresses.length || addresses.some(item => isUnsafeIpAddress(item.address))) throw new SecureIranKetabFetchError("UNSAFE_DESTINATION", "مقصد شبکه‌ای ناامن رد شد.");
      let response: Response;
      try { response = await throttleExternalRequest(() => fetcher(canonical, { redirect: "manual", signal: controller.signal, headers: { "User-Agent": "Qafaseh-IranKetab-Preview/1.0", Accept: "text/html,application/xhtml+xml" } })); }
      catch (cause) { if (controller.signal.aborted) throw new SecureIranKetabFetchError("FETCH_TIMEOUT", "دریافت اطلاعات از ایران‌کتاب بیش از حد طول کشید.", true, { cause }); throw new SecureIranKetabFetchError("FETCH_FAILED", "صفحه ایران‌کتاب در حال حاضر در دسترس نیست.", true, { cause }); }
      if ([301,302,303,307,308].includes(response.status)) {
        if (redirects >= MAX_REDIRECTS) throw new SecureIranKetabFetchError("TOO_MANY_REDIRECTS", "تعداد تغییر مسیرهای پاسخ بیش از حد مجاز بود.");
        const location = response.headers.get("location");
        if (!location) throw new SecureIranKetabFetchError("REDIRECT_REJECTED", "پاسخ تغییر مسیر معتبر نبود.");
        try { current = validateIranKetabBookUrl(new URL(location, current).toString()); } catch (cause) { if (cause instanceof SecureIranKetabFetchError) throw new SecureIranKetabFetchError("REDIRECT_REJECTED", "تغییر مسیر به مقصد غیرمجاز رد شد.", false, { cause }); throw cause; }
        continue;
      }
      if (!response.ok) throw new SecureIranKetabFetchError("HTTP_ERROR", "صفحه ایران‌کتاب در حال حاضر در دسترس نیست.", response.status >= 500 || response.status === 429);
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) throw new SecureIranKetabFetchError("INVALID_CONTENT_TYPE", "پاسخ ایران‌کتاب از نوع HTML نیست.");
      const html = await readLimitedText(response, controller.signal);
      if (!/<(?:!doctype\s+html|html|body|div)\b/i.test(html)) throw new SecureIranKetabFetchError("INVALID_HTML", "پاسخ دریافت‌شده ساختار HTML معتبر ندارد.");
      return { canonicalUrl: canonical, html };
    }
  } finally { clearTimeout(timeout); }
}

async function readLimitedText(response: Response, signal: AbortSignal): Promise<string> {
  if (Number(response.headers.get("content-length") ?? 0) > MAX_HTML_BYTES) throw new SecureIranKetabFetchError("RESPONSE_TOO_LARGE", "حجم صفحه ایران‌کتاب بیش از حد مجاز است.");
  if (!response.body) throw new SecureIranKetabFetchError("INVALID_HTML", "پاسخ ایران‌کتاب خالی است.");
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  while (true) { if (signal.aborted) throw new SecureIranKetabFetchError("FETCH_TIMEOUT", "دریافت اطلاعات از ایران‌کتاب بیش از حد طول کشید.", true); const { done, value } = await reader.read(); if (done) break; if (!value) continue; size += value.byteLength; if (size > MAX_HTML_BYTES) { await reader.cancel(); throw new SecureIranKetabFetchError("RESPONSE_TOO_LARGE", "حجم صفحه ایران‌کتاب بیش از حد مجاز است."); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}
