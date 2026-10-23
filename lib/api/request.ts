import { getPublicAppOrigin } from "@/lib/auth/redirects";

export class RequestError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "RequestError";
  }
}

/** Production trusts the configured public origin, never forwarded Host headers. */
export function isAllowedMutationOrigin(request: Request): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") return false;
  const expected = process.env.NODE_ENV === "production"
    ? getPublicAppOrigin()
    : new URL(request.url).origin;
  const matchesOrigin = (candidate: string) => {
    if (candidate === expected) return true;
    if (process.env.NODE_ENV === "production") return false;
    try {
      const actual = new URL(candidate);
      const server = new URL(expected);
      const loopback = ["localhost", "127.0.0.1", "[::1]"];
      // Next dev can canonicalize the request host to localhost.
      return actual.origin === candidate && loopback.includes(actual.hostname) && loopback.includes(server.hostname)
        && actual.protocol === server.protocol && actual.port === server.port;
    } catch { return false; }
  };
  if (origin) return matchesOrigin(origin);
  const referer = request.headers.get("referer");
  if (referer) {
    try { return matchesOrigin(new URL(referer).origin); }
    catch { return false; }
  }
  // Browsers must supply origin/referrer or same-origin Fetch Metadata.
  // Non-browser clients can omit these headers; they still need API authorization.
  return !site || site === "same-origin";
}

/** Counts actual streamed bytes, including requests without Content-Length. */
export async function readJsonBody(request: Request, maxBytes = 65_536): Promise<unknown> {
  if (!isAllowedMutationOrigin(request)) throw new RequestError("درخواست مجاز نیست", 403);
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new RequestError("درخواست باید JSON باشد", 415);
  if (Number(request.headers.get("content-length")) > maxBytes) {
    throw new RequestError("حجم درخواست بیش از حد مجاز است", 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError("درخواست نامعتبر است", 400);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new RequestError("حجم درخواست بیش از حد مجاز است", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new RequestError("درخواست نامعتبر است", 400); }
}

export async function readFormDataBody(request: Request, maxBytes = 12 * 1024 * 1024): Promise<FormData> {
  if (!isAllowedMutationOrigin(request)) throw new RequestError("درخواست مجاز نیست", 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;")) {
    throw new RequestError("درخواست باید multipart باشد", 415);
  }
  if (Number(request.headers.get("content-length")) > maxBytes) {
    throw new RequestError("حجم درخواست بیش از حد مجاز است", 413);
  }
  if (!request.body) throw new RequestError("درخواست نامعتبر است", 400);
  let bytes = 0;
  const body = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > maxBytes) throw new RequestError("حجم درخواست بیش از حد مجاز است", 413);
      controller.enqueue(chunk);
    },
  }));
  try {
    return await new Request(request.url, {
      method: request.method, headers: request.headers, body, duplex: "half",
    } as RequestInit).formData();
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError("درخواست نامعتبر است", 400);
  }
}
