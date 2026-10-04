import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { Activity, ActivityLike, Book, BookEdition, CatalogBook, Follow, PublishedBookNote, PublishedBookNoteLike, Quote, QuoteLike, SocialComment, User } from "@/db/schema";
import { normalizeQuoteBackground } from "@/lib/quotes/backgrounds";

export type ReadingStatus = "UNREAD" | "READING" | "PAUSED" | "STOPPED" | "FINISHED";
export type ReadingActivityType = "STARTED_READING" | "FINISHED_READING" | "WANT_TO_READ" | "ADDED_FINISHED" | "PAUSED_READING" | "STOPPED_READING";

export function readingActivityType(before: ReadingStatus | null, after: ReadingStatus): ReadingActivityType | null {
  if (before === after) return null;
  if (after === "READING") return "STARTED_READING";
  if (after === "FINISHED") return before === null ? "ADDED_FINISHED" : "FINISHED_READING";
  if (after === "UNREAD") return "WANT_TO_READ";
  if (after === "PAUSED") return "PAUSED_READING";
  if (after === "STOPPED") return "STOPPED_READING";
  return null;
}

type ActivityWriter = Pick<typeof db, "insert" | "select">;
const ContentOwner = alias(User, "activity_content_owner");

async function actorIsPublic(tx: ActivityWriter, actorUserId: string) {
  const [actor] = await tx.select({ visibility: User.profileVisibility }).from(User).where(eq(User.id, actorUserId)).limit(1).for("share");
  return actor?.visibility === "PUBLIC";
}

export async function recordReadingActivity(tx: ActivityWriter, actorUserId: string, bookId: string, before: ReadingStatus | null, after: ReadingStatus) {
  const type = readingActivityType(before, after);
  if (type && await actorIsPublic(tx, actorUserId)) await tx.insert(Activity).values({ actorUserId, type, bookId });
}

export async function recordPublishedActivity(tx: ActivityWriter, actorUserId: string, bookId: string, object: { noteId: string } | { quoteId: string }) {
  if (!await actorIsPublic(tx, actorUserId)) return;
  await tx.insert(Activity).values({
    actorUserId,
    bookId,
    type: "noteId" in object ? "PUBLISHED_NOTE" : "PUBLISHED_QUOTE",
    ...object,
  });
}

export async function recordLikedActivity(tx: ActivityWriter & Pick<typeof db, "delete">, actorUserId: string, bookId: string | null, object: { noteId: string } | { quoteId: string }, liked: boolean) {
  const type = "noteId" in object ? "LIKED_NOTE" : "LIKED_QUOTE";
  if (!liked) {
    await tx.delete(Activity).where(and(eq(Activity.actorUserId, actorUserId), eq(Activity.type, type), "noteId" in object ? eq(Activity.noteId, object.noteId) : eq(Activity.quoteId, object.quoteId)));
  } else if (await actorIsPublic(tx, actorUserId)) {
    await tx.insert(Activity).values({ actorUserId, bookId, type, ...object }).onConflictDoNothing();
  }
}

export async function recordFavoriteActivity(tx: ActivityWriter & Pick<typeof db, "delete">, actorUserId: string, bookId: string, before: boolean, after: boolean) {
  if (before === after) return;
  if (!after) await tx.delete(Activity).where(and(eq(Activity.actorUserId, actorUserId), eq(Activity.bookId, bookId), eq(Activity.type, "FAVORITED_BOOK")));
  else if (await actorIsPublic(tx, actorUserId)) await tx.insert(Activity).values({ actorUserId, bookId, type: "FAVORITED_BOOK" });
}

export function encodeFeedCursor(createdAt: Date, id: string) {
  return Buffer.from(JSON.stringify([createdAt.toISOString(), id])).toString("base64url");
}

export function decodeFeedCursor(value: string | null) {
  if (!value || value.length > 200) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== 2 || typeof parsed[0] !== "string" || typeof parsed[1] !== "string") return null;
    const date = new Date(parsed[0]);
    if (!Number.isFinite(date.getTime()) || !/^[0-9a-f-]{36}$/i.test(parsed[1])) return null;
    return { createdAt: date, id: parsed[1] };
  } catch {
    return null;
  }
}

function activityQuery(viewerId?: string, reader: Pick<typeof db, "select"> = db) {
  return reader.select({
    id: Activity.id,
    actorUserId: Activity.actorUserId,
    type: Activity.type,
    createdAt: Activity.createdAt,
    actorUsername: User.username,
    actorName: User.name,
    actorImage: User.image,
    bookId: sql<string>`coalesce(${Book.id}, ${CatalogBook.id})`,
    bookTitle: sql<string>`coalesce(${Book.title}, ${CatalogBook.title})`,
    bookAuthor: sql<string>`coalesce(${Book.author}, ${CatalogBook.author})`,
    bookCover: sql<string | null>`coalesce(${BookEdition.coverImage}, ${Book.coverImage}, ${CatalogBook.coverImage})`,
    bookTranslator: sql<string | null>`coalesce(${BookEdition.translator}, ${Book.translator})`,
    bookPublisher: sql<string | null>`coalesce(${BookEdition.publisher}, ${Book.publisher})`,
    bookPageCount: sql<number | null>`coalesce(${BookEdition.pageCount}, ${Book.pageCount})`,
    bookSlug: sql<string | null>`coalesce(${Book.slug}, ${CatalogBook.slug})`,
    catalogBookId: CatalogBook.id,
    contentOwnerUsername: ContentOwner.username,
    contentOwnerName: ContentOwner.name,
    contentOwnerImage: ContentOwner.image,
    noteId: PublishedBookNote.id,
    noteContent: PublishedBookNote.content,
    noteCreatedAt: PublishedBookNote.createdAt,
    noteScope: PublishedBookNote.scope,
    noteEditionId: PublishedBookNote.bookEditionId,
    noteLikeCount: sql<number>`(select count(*)::int from ${PublishedBookNoteLike} where ${PublishedBookNoteLike.noteId} = ${PublishedBookNote.id})`,
    noteLikedByViewer: sql<boolean>`exists (select 1 from ${PublishedBookNoteLike} where ${PublishedBookNoteLike.noteId} = ${PublishedBookNote.id} and ${PublishedBookNoteLike.userId} = ${viewerId ?? null})`,
    contentOwnerId: ContentOwner.id,
    contentCanEdit: sql<boolean>`coalesce(${ContentOwner.id} = ${viewerId ?? null}, false)`,
    quoteId: Quote.id,
    quoteContent: Quote.content,
    quoteImageKey: Quote.imageKey,
    quoteBackground: Quote.background,
    quotePage: Quote.page,
    quoteLikeCount: sql<number>`(select count(*)::int from ${QuoteLike} where ${QuoteLike.quoteId} = ${Quote.id})`,
    quoteLikedByViewer: sql<boolean>`exists (select 1 from ${QuoteLike} where ${QuoteLike.quoteId} = ${Quote.id} and ${QuoteLike.userId} = ${viewerId ?? null})`,
    quoteCommentCount: sql<number>`(select count(*)::int from ${SocialComment} where ${SocialComment.targetType} = 'QUOTE' and ${SocialComment.targetId} = ${Quote.id})`,
    noteCommentCount: sql<number>`(select count(*)::int from ${SocialComment} where ${SocialComment.targetType} = 'NOTE' and ${SocialComment.targetId} = ${PublishedBookNote.id})`,
    activityCommentCount: sql<number>`(select count(*)::int from ${SocialComment} where ${SocialComment.targetType} = 'ACTIVITY' and ${SocialComment.targetId} = ${Activity.id})`,
    likeCount: sql<number>`(select count(*)::int from ${ActivityLike} where ${ActivityLike.activityId} = ${Activity.id})`,
    likedByViewer: sql<boolean>`exists (select 1 from ${ActivityLike} where ${ActivityLike.activityId} = ${Activity.id} and ${ActivityLike.userId} = ${viewerId ?? null})`,
  }).from(Activity)
    .innerJoin(User, and(eq(User.id, Activity.actorUserId), viewerId ? or(eq(User.profileVisibility, "PUBLIC"), eq(User.id, viewerId)) : eq(User.profileVisibility, "PUBLIC")))
    .leftJoin(Book, eq(Book.id, Activity.bookId))
    .leftJoin(PublishedBookNote, eq(PublishedBookNote.id, Activity.noteId))
    .leftJoin(Quote, eq(Quote.id, Activity.quoteId))
    .leftJoin(CatalogBook, sql`${CatalogBook.id} = coalesce(${Book.catalogBookId}, ${PublishedBookNote.catalogBookId}, ${Quote.catalogBookId})`)
    .leftJoin(BookEdition, sql`${BookEdition.id} = coalesce(${PublishedBookNote.bookEditionId}, ${Quote.bookEditionId}, ${Book.editionId})`)
    .innerJoin(ContentOwner, and(sql`${ContentOwner.id} = coalesce(${Quote.userId}, ${PublishedBookNote.userId}, ${Book.userId})`, viewerId ? or(eq(ContentOwner.profileVisibility, "PUBLIC"), eq(ContentOwner.id, viewerId)) : eq(ContentOwner.profileVisibility, "PUBLIC")))
    .$dynamic();
}

const visibleActivityContent = or(
  and(sql`${Activity.type} IN ('STARTED_READING', 'FINISHED_READING', 'WANT_TO_READ', 'ADDED_FINISHED', 'PAUSED_READING', 'STOPPED_READING', 'FAVORITED_BOOK')`, eq(Book.userId, Activity.actorUserId)),
  and(eq(Activity.type, "PUBLISHED_NOTE"), eq(PublishedBookNote.userId, Activity.actorUserId), eq(Book.userId, Activity.actorUserId), eq(PublishedBookNote.bookId, Book.id)),
  and(eq(Activity.type, "PUBLISHED_QUOTE"), eq(Quote.userId, Activity.actorUserId), eq(Book.userId, Activity.actorUserId), eq(Quote.bookId, Book.id)),
  and(eq(Activity.type, "LIKED_NOTE"), sql`((${PublishedBookNote.bookId} = ${Book.id} AND ${PublishedBookNote.userId} = ${Book.userId}) OR (${PublishedBookNote.bookId} IS NULL AND ${CatalogBook.id} IS NOT NULL))`, sql`exists (select 1 from ${PublishedBookNoteLike} where ${PublishedBookNoteLike.noteId} = ${PublishedBookNote.id} and ${PublishedBookNoteLike.userId} = ${Activity.actorUserId})`),
  and(eq(Activity.type, "LIKED_QUOTE"), eq(Quote.bookId, Book.id), eq(Quote.userId, Book.userId), sql`exists (select 1 from ${QuoteLike} where ${QuoteLike.quoteId} = ${Quote.id} and ${QuoteLike.userId} = ${Activity.actorUserId})`),
);

export async function getFollowingFeed(viewerId: string, cursorValue: string | null, limit = 20) {
  const cursor = decodeFeedCursor(cursorValue);
  if (cursorValue && !cursor) throw new Error("INVALID_CURSOR");
  const pageSize = Math.max(1, Math.min(limit, 20));
  const rows = await activityQuery(viewerId)
    .innerJoin(Follow, and(eq(Follow.followingId, Activity.actorUserId), eq(Follow.followerId, viewerId)))
    .where(and(
      visibleActivityContent,
      cursor ? or(lt(Activity.createdAt, cursor.createdAt), and(eq(Activity.createdAt, cursor.createdAt), lt(Activity.id, cursor.id))) : undefined,
    ))
    .orderBy(desc(Activity.createdAt), desc(Activity.id))
    .limit(pageSize + 1);

  const hasMore = rows.length > pageSize;
  const pageRows = rows.slice(0, pageSize);
  return {
    items: toFeedItems(pageRows),
    nextCursor: hasMore && pageRows.length ? encodeFeedCursor(pageRows[pageRows.length - 1].createdAt, pageRows[pageRows.length - 1].id) : null,
  };
}

export async function getVisibleActivityById(id: string, viewerId?: string, reader: Pick<typeof db, "select"> = db, lock = false) {
  const query = activityQuery(viewerId, reader).where(and(eq(Activity.id, id), visibleActivityContent)).limit(1);
  const rows = await (lock ? query.for("share", { of: [Activity, User, ContentOwner] }) : query);
  return toFeedItems(rows)[0] ?? null;
}

export async function getProfileActivityPage(userId: string, viewerId?: string, cursorValue: string | null = null, limit = 12) {
  const cursor = decodeFeedCursor(cursorValue);
  if (cursorValue && !cursor) throw new Error("INVALID_CURSOR");
  const pageSize = Math.max(1, Math.min(limit, 20));
  const rows = await activityQuery(viewerId)
    .where(and(eq(Activity.actorUserId, userId), visibleActivityContent,
      cursor ? or(lt(Activity.createdAt, cursor.createdAt), and(eq(Activity.createdAt, cursor.createdAt), lt(Activity.id, cursor.id))) : undefined,
    ))
    .orderBy(desc(Activity.createdAt), desc(Activity.id))
    .limit(pageSize + 1);
  const pageRows = rows.slice(0, pageSize);
  const last = pageRows.at(-1);
  return {
    items: toFeedItems(pageRows),
    nextCursor: rows.length > pageSize && last ? encodeFeedCursor(last.createdAt, last.id) : null,
  };
}

export async function getProfileRecentActivity(userId: string, viewerId?: string, limit = 5) {
  return (await getProfileActivityPage(userId, viewerId, null, limit)).items;
}

export async function toggleActivityLike(id: string, userId: string) {
  // Older clients can still address an event; content owns its reactions.
  const visible = await getVisibleActivityById(id, userId);
  if (!visible) return null;
  if (visible.commentTarget.type === "QUOTE") {
    const { toggleQuoteLike } = await import("@/lib/quotes/service");
    return toggleQuoteLike(visible.commentTarget.id, userId);
  }
  if (visible.commentTarget.type === "NOTE") {
    const { togglePublishedNoteLike } = await import("@/lib/notes/service");
    return togglePublishedNoteLike(visible.commentTarget.id, userId);
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'activity-like:' + id + ':' + userId}, 0))`);
    const [activity] = await activityQuery(userId, tx).where(and(eq(Activity.id, id), visibleActivityContent)).limit(1).for("share", { of: [Activity, User, ContentOwner] });
    if (!activity) return null;
    const removed = await tx.delete(ActivityLike).where(and(eq(ActivityLike.activityId, id), eq(ActivityLike.userId, userId))).returning({ id: ActivityLike.activityId });
    if (!removed.length) await tx.insert(ActivityLike).values({ activityId: id, userId }).onConflictDoNothing();
    const [row] = await tx.select({ count: sql<number>`count(*)::int` }).from(ActivityLike).where(eq(ActivityLike.activityId, id));
    return { liked: !removed.length, likeCount: row?.count ?? 0 };
  });
}

function toFeedItems(rows: Awaited<ReturnType<typeof activityQuery>>) {
  return rows.map((row) => ({
    id: row.id,
    actorUserId: row.actorUserId,
    type: row.type,
    createdAt: row.createdAt.toISOString(),
    actorUsername: row.actorUsername,
    actorName: row.actorName,
    actorImage: row.actorImage,
    commentTarget: {
      type: row.quoteId ? "QUOTE" as const : row.noteId ? "NOTE" as const : "ACTIVITY" as const,
      id: row.quoteId || row.noteId || row.id,
    },
    commentCount: row.quoteId ? row.quoteCommentCount : row.noteId ? row.noteCommentCount : row.activityCommentCount,
    likeCount: row.quoteId ? row.quoteLikeCount : row.noteId ? row.noteLikeCount : row.likeCount,
    likedByViewer: row.quoteId ? row.quoteLikedByViewer : row.noteId ? row.noteLikedByViewer : row.likedByViewer,
    bookId: row.bookId,
    bookTitle: row.bookTitle,
    bookAuthor: row.bookAuthor,
    bookCover: row.bookCover,
    bookTranslator: row.bookTranslator,
    bookPublisher: row.bookPublisher,
    bookPageCount: row.bookPageCount,
    bookHref: `/book/${encodeURIComponent(row.bookSlug || row.catalogBookId || row.bookId)}`,
    noteId: row.noteId,
    note: row.noteId && row.noteContent && row.noteCreatedAt ? {
      id: row.noteId,
      content: row.noteContent,
      bookId: row.bookId,
      catalogBookId: row.catalogBookId,
      bookEditionId: row.noteEditionId,
      scope: row.noteScope ?? "book",
      bookSlug: row.bookSlug || row.catalogBookId,
      bookTitle: row.bookTitle,
      bookAuthor: row.bookAuthor,
      bookCover: row.bookCover,
      createdAt: row.noteCreatedAt.toISOString(),
      likeCount: row.noteLikeCount,
      commentCount: row.noteCommentCount,
      likedByViewer: row.noteLikedByViewer,
      authorUserId: row.contentOwnerId,
      canEdit: Boolean(row.contentCanEdit),
      authorUsername: row.contentOwnerUsername,
      authorName: row.contentOwnerName,
      authorImage: row.contentOwnerImage,
    } : null,
    quote: row.quoteId ? {
      id: row.quoteId,
      content: row.quoteContent ?? "",
      imageKey: row.quoteImageKey,
      background: normalizeQuoteBackground(row.quoteBackground),
      page: row.quotePage,
      bookId: row.bookId,
      bookSlug: row.bookSlug || row.catalogBookId,
      bookTitle: row.bookTitle,
      bookAuthor: row.bookAuthor ?? "",
      bookCover: row.bookCover,
      likeCount: row.quoteLikeCount ?? 0,
      commentCount: row.quoteCommentCount ?? 0,
      likedByViewer: row.quoteLikedByViewer ?? false,
      canEdit: Boolean(row.contentCanEdit),
      authorUsername: row.contentOwnerUsername,
      authorName: row.contentOwnerName,
      authorImage: row.contentOwnerImage,
    } : null,
  }));
}
