import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isUnsafeIpAddress } from "./secure-fetch";
import { throttleExternalRequest } from "./external-request-throttle";

export const MAX_COVER_BYTES = 10 * 1024 * 1024;
const IMAGE_HOSTS = new Set(["iranketab.ir", "www.iranketab.ir", "img.iranketab.ir"]);
const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

export class IranKetabCoverFetchError extends Error {
  constructor(public readonly code: "INVALID_COVER_PROVENANCE" | "UNSUPPORTED_COVER_HOST" | "UNSAFE_COVER_DESTINATION" | "COVER_FETCH_TIMEOUT" | "COVER_FETCH_FAILED" | "COVER_TOO_LARGE" | "INVALID_COVER_CONTENT_TYPE", message: string, public readonly retryable = false) { super(message); this.name = "IranKetabCoverFetchError"; }
}

export function validateIranKetabCoverUrl(value: string): URL {
  let url: URL; try { url = new URL(value); } catch { throw new IranKetabCoverFetchError("INVALID_COVER_PROVENANCE", "آدرس کاور معتبر نیست."); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || isIP(url.hostname)) throw new IranKetabCoverFetchError("UNSAFE_COVER_DESTINATION", "مقصد کاور امن نیست.");
  if (!IMAGE_HOSTS.has(url.hostname.toLowerCase())) throw new IranKetabCoverFetchError("UNSUPPORTED_COVER_HOST", "میزبان کاور مجاز نیست.");
  if (!/^\/(?:Images\/ProductImages|Files\/AttachFiles)\//i.test(url.pathname) || url.search || url.hash) throw new IranKetabCoverFetchError("INVALID_COVER_PROVENANCE", "مسیر کاور مورد تأیید نیست.");
  return url;
}

export async function fetchIranKetabCoverSecurely(value: string, dependencies: { fetch?: typeof fetch; lookup?: (host: string) => Promise<Array<{ address: string }>> } = {}): Promise<{ buffer: Buffer; mime: string }> {
  const fetcher = dependencies.fetch ?? fetch; const lookup = dependencies.lookup ?? (host => dnsLookup(host, { all: true, verbatim: true })); let current = validateIranKetabCoverUrl(value); const visited = new Set<string>(); const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10_000);
  try { for (let redirects = 0; ; redirects += 1) { if (visited.has(current.toString())) throw new IranKetabCoverFetchError("COVER_FETCH_FAILED", "حلقه تغییر مسیر کاور شناسایی شد."); visited.add(current.toString()); let addresses: Array<{ address: string }>; try { addresses = await lookup(current.hostname); } catch { throw new IranKetabCoverFetchError("UNSAFE_COVER_DESTINATION", "مقصد کاور قابل شناسایی نیست.", true); } if (!addresses.length || addresses.some(row => isUnsafeIpAddress(row.address))) throw new IranKetabCoverFetchError("UNSAFE_COVER_DESTINATION", "مقصد شبکه‌ای کاور امن نیست."); let response: Response; try { response = await throttleExternalRequest(() => fetcher(current, { redirect: "manual", signal: controller.signal, headers: { Accept: "image/jpeg,image/png,image/webp", "User-Agent": "Qafaseh-IranKetab-Cover/1.0" } })); } catch { throw new IranKetabCoverFetchError(controller.signal.aborted ? "COVER_FETCH_TIMEOUT" : "COVER_FETCH_FAILED", controller.signal.aborted ? "دریافت تصویر کاور بیش از حد طول کشید." : "دریافت تصویر کاور ناموفق بود.", true); } if ([301,302,303,307,308].includes(response.status)) { if (redirects >= 3) throw new IranKetabCoverFetchError("COVER_FETCH_FAILED", "تعداد تغییر مسیر کاور بیش از حد مجاز بود."); const location = response.headers.get("location"); if (!location) throw new IranKetabCoverFetchError("COVER_FETCH_FAILED", "تغییر مسیر کاور معتبر نیست."); current = validateIranKetabCoverUrl(new URL(location, current).toString()); continue; } if (!response.ok) throw new IranKetabCoverFetchError("COVER_FETCH_FAILED", "دریافت تصویر کاور ناموفق بود.", response.status >= 500); const mime = (response.headers.get("content-type") ?? "").split(";", 1)[0].toLowerCase(); if (!IMAGE_MIMES.has(mime)) throw new IranKetabCoverFetchError("INVALID_COVER_CONTENT_TYPE", "پاسخ دریافت‌شده تصویر معتبر نیست."); if (Number(response.headers.get("content-length") ?? 0) > MAX_COVER_BYTES) throw new IranKetabCoverFetchError("COVER_TOO_LARGE", "حجم تصویر کاور بیش از حد مجاز است."); if (!response.body) throw new IranKetabCoverFetchError("COVER_FETCH_FAILED", "تصویر کاور خالی است."); const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0; while (true) { const { done, value: chunk } = await reader.read(); if (done) break; if (!chunk) continue; size += chunk.byteLength; if (size > MAX_COVER_BYTES) { await reader.cancel(); throw new IranKetabCoverFetchError("COVER_TOO_LARGE", "حجم تصویر کاور بیش از حد مجاز است."); } chunks.push(chunk); } if (!size) throw new IranKetabCoverFetchError("COVER_FETCH_FAILED", "تصویر کاور خالی است."); return { buffer: Buffer.concat(chunks), mime }; } } finally { clearTimeout(timeout); }
}
