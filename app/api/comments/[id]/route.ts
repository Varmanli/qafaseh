import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { commentContentSchema } from "@/lib/social/comment-contract";
import { CommentError, deleteSocialComment, updateSocialComment } from "@/lib/social/comments";
import { assertCommentMutationOrigin, COMMENT_RESPONSE_HEADERS, commentErrorResponse, readCommentBody } from "@/lib/social/comment-http";

type Context = { params: Promise<{ id: string }> };
const editSchema = z.object({ content: commentContentSchema });

async function mutate(request: NextRequest, context: Context, action: "edit" | "delete") {
  try {
    assertCommentMutationOrigin(request);
    const user = await getCurrentUser();
    if (!user) return apiError("برای مدیریت دیدگاه وارد شو", 401, "UNAUTHENTICATED");
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) throw new CommentError("دیدگاه معتبر نیست", 400);
    const limit = rateLimit(`comments-manage:${user.id}`, { limit: 30, windowMs: 60_000 });
    if (!limit.allowed) throw new CommentError("کمی صبر کن و دوباره تلاش کن", 429, limit.retryAfterSeconds);
    if (action === "delete") return apiSuccess(await deleteSocialComment(id, user), { headers: COMMENT_RESPONSE_HEADERS });
    const body = editSchema.safeParse(await readCommentBody(request));
    if (!body.success) throw new CommentError(body.error.issues[0]?.message ?? "دیدگاه معتبر نیست", 422);
    return apiSuccess(await updateSocialComment(id, body.data.content, user), { headers: COMMENT_RESPONSE_HEADERS });
  } catch (error) { return commentErrorResponse(error); }
}

export async function PATCH(request: NextRequest, context: Context) { return mutate(request, context, "edit"); }
export async function DELETE(request: NextRequest, context: Context) { return mutate(request, context, "delete"); }
