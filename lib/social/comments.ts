import { and, asc, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { PublishedBookNote, Quote, SocialComment, User } from "@/db/schema";
import { getVisibleActivityById } from "./activity";
import { COMMENT_PAGE_SIZE, commentContentSchema, createCommentSchema, type CommentItem, type CommentPage, type SocialCommentTarget } from "./comment-contract";

type Viewer = { id: string; role?: "USER" | "ADMIN" };
type Reader = Pick<typeof db, "select">;
type Target = { type: SocialCommentTarget; id: string; ownerId: string };

export class CommentError extends Error {
  constructor(message: string, public status = 400, public retryAfter?: number) {
    super(message);
    this.name = "CommentError";
  }
}

// Every event about a quote or note uses the content's own conversation.
async function resolveTarget(reader: Reader, type: SocialCommentTarget, id: string, viewer?: Viewer, lock = false): Promise<Target> {
  const visibility = viewer ? or(eq(User.profileVisibility, "PUBLIC"), eq(User.id, viewer.id)) : eq(User.profileVisibility, "PUBLIC");
  if (type === "ACTIVITY") {
    const row = await getVisibleActivityById(id, viewer?.id, reader, lock);
    if (!row) throw new CommentError("محتوا پیدا نشد", 404);
    if (row.commentTarget.type !== "ACTIVITY") return resolveTarget(reader, row.commentTarget.type, row.commentTarget.id, viewer, lock);
    return { type, id: row.id, ownerId: row.actorUserId };
  }
  const source = type === "QUOTE" ? Quote : PublishedBookNote;
  const query = reader.select({ id: source.id, ownerId: User.id }).from(source)
    .innerJoin(User, eq(User.id, source.userId)).where(and(eq(source.id, id), visibility)).limit(1);
  const [row] = await (lock ? query.for("share", { of: [source, User] }) : query);
  if (!row) throw new CommentError("محتوا پیدا نشد", 404);
  return { type, id: row.id, ownerId: row.ownerId };
}

const selection = {
  id: SocialComment.id,
  parentId: SocialComment.parentId,
  content: SocialComment.content,
  createdAt: SocialComment.createdAt,
  updatedAt: sql<string>`${SocialComment.updatedAt}::text`,
  // Preserve PostgreSQL microseconds in the cursor; JS Date only retains milliseconds.
  cursorTime: sql<string>`${SocialComment.createdAt}::text`,
  authorId: User.id,
  authorUsername: User.username,
  authorName: User.name,
  authorImage: User.image,
  replyCount: sql<number>`case when ${SocialComment.parentId} is null then
    (select count(*)::int from "SocialComment" replies where replies.parent_id = ${SocialComment.id}) else 0 end`,
};
type CommentRow = {
  id: string; parentId: string | null; content: string; createdAt: Date; updatedAt: string; cursorTime: string;
  authorId: string; authorUsername: string | null; authorName: string | null; authorImage: string | null; replyCount: number;
};
function timestampToIso(value: string) {
  const [base, fraction = ""] = value.split(".");
  return `${base.replace(" ", "T")}.${fraction.padEnd(6, "0")}Z`;
}
function serializeComment(row: CommentRow, target: Target, viewer?: Viewer): CommentItem {
  return {
    id: row.id, parentId: row.parentId, content: row.content,
    createdAt: timestampToIso(row.cursorTime), updatedAt: timestampToIso(row.updatedAt),
    authorId: row.authorId, authorUsername: row.authorUsername, authorName: row.authorName, authorImage: row.authorImage,
    replyCount: row.replyCount,
    canEdit: viewer?.id === row.authorId,
    canDelete: !!viewer && (viewer.id === row.authorId || viewer.id === target.ownerId || viewer.role === "ADMIN"),
  };
}
const cursorSchema = z.tuple([
  z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?$/)
    .refine((value) => Number.isFinite(Date.parse(value.replace(" ", "T") + "Z"))),
  z.uuid(),
]);
function decodeCursor(value: string) {
  try {
    if (value.length > 240 || !/^[\w-]+$/.test(value)) throw new Error();
    return cursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
  } catch { throw new CommentError("صفحهٔ دیدگاه‌ها معتبر نیست", 400); }
}
function targetCondition(target: Target) {
  return and(eq(SocialComment.targetType, target.type), eq(SocialComment.targetId, target.id));
}

export async function getSocialComments(type: SocialCommentTarget, id: string, viewer?: Viewer, options: { parentId?: string; cursor?: string } = {}): Promise<CommentPage> {
  const cursor = options.cursor ? decodeCursor(options.cursor) : null;
  const target = await resolveTarget(db, type, id, viewer);
  if (options.parentId) {
    const [parent] = await db.select({ id: SocialComment.id }).from(SocialComment)
      .where(and(targetCondition(target), eq(SocialComment.id, options.parentId), isNull(SocialComment.parentId))).limit(1);
    if (!parent) throw new CommentError("دیدگاه پیدا نشد", 404);
  }
  const isReplyPage = !!options.parentId;
  const countTotal = !isReplyPage && !cursor;
  const [rows, totals] = await Promise.all([
    db.select(selection).from(SocialComment).innerJoin(User, eq(User.id, SocialComment.authorUserId))
      // The validated parent + composite FK already determine a reply's target.
      .where(and(options.parentId ? eq(SocialComment.parentId, options.parentId) : and(targetCondition(target), isNull(SocialComment.parentId)),
        cursor ? (isReplyPage
          ? sql`(${SocialComment.createdAt}, ${SocialComment.id}) > (${cursor[0]}::timestamp, ${cursor[1]})`
          : sql`(${SocialComment.createdAt}, ${SocialComment.id}) < (${cursor[0]}::timestamp, ${cursor[1]})`) : undefined))
      .orderBy(isReplyPage ? asc(SocialComment.createdAt) : desc(SocialComment.createdAt), isReplyPage ? asc(SocialComment.id) : desc(SocialComment.id))
      .limit(COMMENT_PAGE_SIZE + 1),
    countTotal ? db.select({ total: sql<number>`count(*)::int` }).from(SocialComment).where(targetCondition(target)) : Promise.resolve([]),
  ]);
  const page = rows.slice(0, COMMENT_PAGE_SIZE);
  const last = page.at(-1);
  return {
    comments: page.map((row) => serializeComment(row, target, viewer)),
    nextCursor: rows.length > COMMENT_PAGE_SIZE && last ? Buffer.from(JSON.stringify([last.cursorTime, last.id])).toString("base64url") : null,
    ...(countTotal ? { totalCount: totals[0]?.total ?? 0 } : {}),
  };
}
async function readComment(reader: Reader, id: string, target: Target, viewer: Viewer) {
  const [row] = await reader.select(selection).from(SocialComment).innerJoin(User, eq(User.id, SocialComment.authorUserId))
    .where(eq(SocialComment.id, id)).limit(1);
  if (!row) throw new CommentError("دیدگاه پیدا نشد", 404);
  return serializeComment(row, target, viewer);
}

export async function createSocialComment(input: z.infer<typeof createCommentSchema>, viewer: Viewer) {
  const parsed = createCommentSchema.safeParse(input);
  if (!parsed.success) throw new CommentError(parsed.error.issues[0]?.message ?? "دیدگاه معتبر نیست", 422);
  const data = parsed.data;
  return db.transaction(async (tx) => {
    // A per-author lock makes retries and rate limits safe across server instances.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'social-comment:' + viewer.id}, 0))`);
    const target = await resolveTarget(tx, data.targetType, data.targetId, viewer, true);
    const [existing] = await tx.select().from(SocialComment)
      .where(and(eq(SocialComment.authorUserId, viewer.id), eq(SocialComment.requestId, data.requestId))).limit(1);
    if (existing) {
      if (existing.targetType !== target.type || existing.targetId !== target.id || existing.parentId !== (data.parentId ?? null) || existing.content !== data.content) {
        throw new CommentError("شناسهٔ ارسال قبلاً برای دیدگاه دیگری استفاده شده", 409);
      }
      return { comment: await readComment(tx, existing.id, target, viewer), created: false };
    }
    const now = new Date();
    const recent = await tx.select({ createdAt: SocialComment.createdAt }).from(SocialComment)
      .where(and(eq(SocialComment.authorUserId, viewer.id), gt(SocialComment.createdAt, new Date(now.getTime() - 3_600_000))))
      .orderBy(desc(SocialComment.createdAt)).limit(100);
    const lastMinute = recent.filter((row) => now.getTime() - row.createdAt.getTime() < 60_000);
    if (lastMinute.length >= 10 || recent.length >= 100) {
      const windowMs = lastMinute.length >= 10 ? 60_000 : 3_600_000;
      const first = (lastMinute.length >= 10 ? lastMinute : recent).at(-1)!;
      throw new CommentError("دیدگاه‌ها را کمی با فاصله بفرست", 429, Math.max(1, Math.ceil((first.createdAt.getTime() + windowMs - now.getTime()) / 1000)));
    }
    if (data.parentId) {
      const [parent] = await tx.select({ id: SocialComment.id }).from(SocialComment)
        .where(and(targetCondition(target), eq(SocialComment.id, data.parentId), isNull(SocialComment.parentId))).limit(1).for("share");
      if (!parent) throw new CommentError("دیدگاهی که به آن پاسخ می‌دهی پیدا نشد", 404);
    }
    const [saved] = await tx.insert(SocialComment).values({
      targetType: target.type, targetId: target.id,
      quoteId: target.type === "QUOTE" ? target.id : null,
      noteId: target.type === "NOTE" ? target.id : null,
      activityId: target.type === "ACTIVITY" ? target.id : null,
      authorUserId: viewer.id, parentId: data.parentId ?? null, content: data.content, requestId: data.requestId,
      createdAt: now, updatedAt: now,
    }).returning({ id: SocialComment.id });
    return { comment: await readComment(tx, saved.id, target, viewer), created: true };
  });
}

export async function updateSocialComment(id: string, content: string, viewer: Viewer) {
  const parsed = commentContentSchema.safeParse(content);
  if (!parsed.success) throw new CommentError(parsed.error.issues[0]?.message ?? "دیدگاه معتبر نیست", 422);
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(SocialComment).where(eq(SocialComment.id, id)).limit(1).for("update");
    if (!row) throw new CommentError("دیدگاه پیدا نشد", 404);
    const target = await resolveTarget(tx, row.targetType, row.targetId, viewer, true);
    if (row.authorUserId !== viewer.id) throw new CommentError("فقط دیدگاه خودت را می‌توانی ویرایش کنی", 403);
    await tx.update(SocialComment).set({ content: parsed.data, updatedAt: new Date() }).where(eq(SocialComment.id, id));
    return { comment: await readComment(tx, id, target, viewer) };
  });
}

export async function deleteSocialComment(id: string, viewer: Viewer) {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(SocialComment).where(eq(SocialComment.id, id)).limit(1).for("update");
    if (!row) throw new CommentError("دیدگاه پیدا نشد", 404);
    const target = await resolveTarget(tx, row.targetType, row.targetId, viewer, true);
    if (row.authorUserId !== viewer.id && target.ownerId !== viewer.id && viewer.role !== "ADMIN") {
      throw new CommentError("اجازهٔ حذف این دیدگاه را نداری", 403);
    }
    const [{ deletedCount }] = await tx.select({ deletedCount: sql<number>`count(*)::int` }).from(SocialComment)
      .where(or(eq(SocialComment.id, id), eq(SocialComment.parentId, id)));
    await tx.delete(SocialComment).where(eq(SocialComment.id, id));
    return { id, parentId: row.parentId, deletedCount };
  });
}
