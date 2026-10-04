import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/session";
import { getClientKey, rateLimit } from "@/lib/rate-limit";
import { commentQuerySchema, createCommentSchema } from "@/lib/social/comment-contract";
import { CommentError, createSocialComment, getSocialComments } from "@/lib/social/comments";
import { assertCommentMutationOrigin, COMMENT_RESPONSE_HEADERS, commentErrorResponse, readCommentBody } from "@/lib/social/comment-http";

export async function GET(request: NextRequest) {
  try {
    const limit = rateLimit(getClientKey(request, "comments-read"), { limit: 120, windowMs: 60_000 });
    if (!limit.allowed) throw new CommentError("کمی صبر کن و دوباره تلاش کن", 429, limit.retryAfterSeconds);
    const query = commentQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!query.success) throw new CommentError("درخواست نامعتبر است", 400);
    const viewer = await getCurrentUser();
    const { targetType, targetId, parentId, cursor } = query.data;
    const result = await getSocialComments(targetType, targetId, viewer ?? undefined, { parentId, cursor });
    return apiSuccess({ ...result }, { headers: COMMENT_RESPONSE_HEADERS });
  } catch (error) { return commentErrorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    assertCommentMutationOrigin(request);
    const user = await getCurrentUser();
    if (!user) return apiError("برای ثبت دیدگاه وارد شو", 401, "UNAUTHENTICATED");
    const parsed = createCommentSchema.safeParse(await readCommentBody(request));
    if (!parsed.success) throw new CommentError(parsed.error.issues[0]?.message ?? "دیدگاه معتبر نیست", 422);
    const result = await createSocialComment(parsed.data, user);
    return apiSuccess(result, { status: result.created ? 201 : 200, headers: COMMENT_RESPONSE_HEADERS });
  } catch (error) { return commentErrorResponse(error); }
}
