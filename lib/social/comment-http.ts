import type { NextRequest } from "next/server";

import { apiError } from "@/lib/api/response";
import { getPublicAppOrigin } from "@/lib/auth/redirects";
import { CommentError } from "./comments";

export const COMMENT_RESPONSE_HEADERS = { "Cache-Control": "private, no-store" };

export function assertCommentMutationOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin && origin !== request.nextUrl.origin && origin !== getPublicAppOrigin())) {
    throw new CommentError("درخواست مجاز نیست", 403);
  }
}

export async function readCommentBody(request: NextRequest): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    throw new CommentError("درخواست باید JSON باشد", 415);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new CommentError("درخواست نامعتبر است", 400);
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 16_384) {
        await reader.cancel();
        throw new CommentError("حجم درخواست خیلی زیاد است", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    try { return JSON.parse(text); }
    catch { throw new CommentError("درخواست نامعتبر است", 400); }
  } finally { reader.releaseLock(); }
}

export function commentErrorResponse(error: unknown) {
  const known = error instanceof CommentError;
  if (!known) console.error("[comments] request failed", error instanceof Error ? error.name : "UnknownError");
  const response = apiError(known ? error.message : "دریافت یا ثبت دیدگاه ممکن نشد؛ دوباره تلاش کن", known ? error.status : 500);
  response.headers.set("Cache-Control", "private, no-store");
  if (known && error.retryAfter) response.headers.set("Retry-After", String(error.retryAfter));
  return response;
}
