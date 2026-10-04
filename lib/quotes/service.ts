import { and, desc, eq, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { Book, CatalogBook, Quote, QuoteLike, SocialComment, User } from "@/db/schema";
import { coalesceCoverImage } from "@/lib/book/cover";
import {
  ensureBookSlug,
  ensureCatalogBookSlug,
} from "@/lib/book/public-slug";
import { normalizeQuoteBackground, type QuoteBackground } from "@/lib/quotes/backgrounds";
import { normalizeQuoteLikeState } from "@/lib/quotes/like-state";
import { recordLikedActivity } from "@/lib/social/activity";

export interface PublicQuote {
  id: string;
  content: string;
  imageKey: string | null;
  background: QuoteBackground;
  page: number | null;
  bookId: string;
  bookSlug?: string | null;
  bookTitle: string;
  bookAuthor: string;
  bookCover: string | null;
  likeCount: number;
  commentCount: number;
  likedByViewer: boolean;
  canEdit?: boolean;
  authorUsername: string | null;
  authorName: string | null;
  authorImage: string | null;
}

export type PublicQuotesResult =
  | { found: false }
  | { found: true; isPrivate: true }
  | { found: true; isPrivate: false; isOwner: boolean; quotes: PublicQuote[]; hasMore: boolean };

/**
 * Public excerpts for a profile. Quotes have no per-row visibility flag, so they
 * inherit the *profile's* privacy: a private profile exposes nothing to a
 * non-owner. Only the quote text + related book info is returned — never private
 * book notes/reviews.
 */
export async function getPublicQuotesByUsername(
  username: string,
  viewerId?: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<PublicQuotesResult> {
  const [user] = await db
    .select({
      id: User.id,
      username: User.username,
      name: User.name,
      image: User.image,
      profileVisibility: User.profileVisibility,
    })
    .from(User)
    .where(sql`lower(${User.username}) = lower(${username})`)
    .limit(1);

  if (!user) return { found: false };

  const isOwner = !!viewerId && viewerId === user.id;
  if (user.profileVisibility === "PRIVATE" && !isOwner) {
    return { found: true, isPrivate: true };
  }

  const rows = await db
    .select({
      id: Quote.id,
      content: Quote.content,
      imageKey: Quote.imageKey,
      background: Quote.background,
      page: Quote.page,
      bookId: Quote.bookId,
      bookSlug: sql<string | null>`coalesce(${CatalogBook.slug}, ${Book.slug})`,
      bookTitle: Book.title,
      bookAuthor: Book.author,
      bookCover: Book.coverImage,
      likeCount: sql<number>`count(${QuoteLike.id})::int`,
      commentCount: sql<number>`(select count(*)::int from ${SocialComment}
        where ${SocialComment.targetType} = 'QUOTE' and ${SocialComment.targetId} = ${Quote.id})`,
      // NULL-safe: with no viewer (or no matching like) bool_or yields NULL → false.
      likedByViewer: sql<boolean>`coalesce(bool_or(${QuoteLike.userId} = ${
        viewerId ?? null
      }), false)`,
    })
    .from(Quote)
    .innerJoin(Book, eq(Quote.bookId, Book.id))
    .leftJoin(CatalogBook, eq(Book.catalogBookId, CatalogBook.id))
    .leftJoin(QuoteLike, eq(QuoteLike.quoteId, Quote.id))
    .where(eq(Quote.userId, user.id))
    .groupBy(Quote.id, Book.id, CatalogBook.id)
    .orderBy(desc(sql`count(${QuoteLike.id})`), desc(Quote.id))
    .limit(Math.min(opts.limit ?? 10, 50) + 1)
    .offset(Math.max(opts.offset ?? 0, 0));

  const hasMore = rows.length > Math.min(opts.limit ?? 10, 50);
  const visibleRows = hasMore ? rows.slice(0, -1) : rows;

  return {
    found: true,
    isPrivate: false,
    isOwner,
    hasMore,
    quotes: visibleRows.map((r) => ({
      ...r,
      background: normalizeQuoteBackground(r.background),
      likedByViewer: Boolean(r.likedByViewer),
      canEdit: isOwner,
      authorUsername: user.username,
      authorName: user.name,
      authorImage: user.image,
    })),
  };
}

/**
 * Latest public quotes/snippets for homepage usage. The homepage reuses the
 * same card contract as the book detail page (`PublicQuote`) so the exact same
 * UI can be rendered without a parallel card/view model. Visibility is aligned
 * with the public book page: only
 * quotes attached to publicly reachable books are included.
 */
export async function getLatestPublicQuotes(
  limit = 6,
  viewerId?: string,
): Promise<PublicQuote[]> {
  const rows = await db
    .select({
      id: Quote.id,
      content: Quote.content,
      imageKey: Quote.imageKey,
      background: Quote.background,
      page: Quote.page,
      bookId: Book.id,
      bookSlug: sql<string | null>`coalesce(${CatalogBook.slug}, ${Book.slug})`,
      bookTitle: sql<string>`coalesce(${CatalogBook.title}, ${Book.title})`,
      bookAuthor: sql<string>`coalesce(${CatalogBook.author}, ${Book.author})`,
      bookCover: sql<string | null>`coalesce(${CatalogBook.coverImage}, ${Book.coverImage})`,
      catalogBookId: Book.catalogBookId,
      catalogBookSlug: CatalogBook.slug,
      canEdit: sql<boolean>`coalesce(${Quote.userId} = ${viewerId ?? null}, false)`,
      authorUsername: User.username,
      authorName: User.name,
      authorImage: User.image,
      likeCount: sql<number>`count(${QuoteLike.id})::int`,
      commentCount: sql<number>`(select count(*)::int from ${SocialComment}
        where ${SocialComment.targetType} = 'QUOTE' and ${SocialComment.targetId} = ${Quote.id})`,
      // The viewer's liked state is aggregated with the same query as the
      // persisted total, avoiding a per-card follow-up request in feeds.
      likedByViewer: sql<boolean>`coalesce(bool_or(${QuoteLike.userId} = ${
        viewerId ?? null
      }), false)`,
    })
    .from(Quote)
    .innerJoin(Book, eq(Quote.bookId, Book.id))
    .innerJoin(User, eq(Quote.userId, User.id))
    .leftJoin(CatalogBook, eq(Book.catalogBookId, CatalogBook.id))
    .leftJoin(QuoteLike, eq(QuoteLike.quoteId, Quote.id))
    .where(
      and(
        eq(User.profileVisibility, "PUBLIC"),
        or(
          sql`${Book.catalogBookId} is null`,
          eq(CatalogBook.status, "APPROVED")
        )
      )
    )
    .groupBy(Quote.id, Book.id, CatalogBook.id, User.id)
    .orderBy(desc(Quote.createdAt), desc(Quote.id))
    .limit(limit);

  if (process.env.NODE_ENV !== "production") {
    console.info("[home:getLatestPublicQuotes] rows=", rows.length);
  }

  return Promise.all(
    rows.map(async (row) => {
      const bookSlug = row.catalogBookId
        ? await ensureCatalogBookSlug({
            id: row.catalogBookId,
            title: row.bookTitle,
            slug: row.catalogBookSlug,
          })
        : await ensureBookSlug({
            id: row.bookId,
            title: row.bookTitle,
            slug: row.bookSlug,
          });

      return {
        id: row.id,
        content: row.content,
        imageKey: row.imageKey,
        background: normalizeQuoteBackground(row.background),
        page: row.page,
        bookId: row.bookId,
        bookTitle: row.bookTitle,
        bookAuthor: row.bookAuthor,
        bookSlug,
        bookCover: coalesceCoverImage(row.bookCover),
        ...normalizeQuoteLikeState(row.likeCount, row.likedByViewer),
        commentCount: row.commentCount,
        canEdit: Boolean(row.canEdit),
        authorUsername: row.authorUsername,
        authorName: row.authorName,
        authorImage: row.authorImage,
      } satisfies PublicQuote;
    })
  );
}

export async function getVisibleQuoteById(
  quoteId: string,
  viewerId?: string,
): Promise<PublicQuote | null> {
  const visibility = viewerId
    ? or(eq(User.profileVisibility, "PUBLIC"), eq(User.id, viewerId))
    : eq(User.profileVisibility, "PUBLIC");
  const [row] = await db
    .select({
      id: Quote.id,
      content: Quote.content,
      imageKey: Quote.imageKey,
      background: Quote.background,
      page: Quote.page,
      bookId: Book.id,
      bookSlug: sql<string | null>`coalesce(${CatalogBook.slug}, ${Book.slug})`,
      bookTitle: sql<string>`coalesce(${CatalogBook.title}, ${Book.title})`,
      bookAuthor: sql<string>`coalesce(${CatalogBook.author}, ${Book.author})`,
      bookCover: sql<string | null>`coalesce(${CatalogBook.coverImage}, ${Book.coverImage})`,
      canEdit: sql<boolean>`coalesce(${Quote.userId} = ${viewerId ?? null}, false)`,
      authorUsername: User.username,
      authorName: User.name,
      authorImage: User.image,
      likeCount: sql<number>`count(${QuoteLike.id})::int`,
      commentCount: sql<number>`(select count(*)::int from ${SocialComment}
        where ${SocialComment.targetType} = 'QUOTE' and ${SocialComment.targetId} = ${Quote.id})`,
      likedByViewer: sql<boolean>`coalesce(bool_or(${QuoteLike.userId} = ${viewerId ?? null}), false)`,
    })
    .from(Quote)
    .innerJoin(Book, eq(Quote.bookId, Book.id))
    .innerJoin(User, eq(Quote.userId, User.id))
    .leftJoin(CatalogBook, eq(Book.catalogBookId, CatalogBook.id))
    .leftJoin(QuoteLike, eq(QuoteLike.quoteId, Quote.id))
    .where(and(
      eq(Quote.id, quoteId),
      visibility,
    ))
    .groupBy(Quote.id, Book.id, CatalogBook.id, User.id)
    .limit(1);

  if (!row) return null;
  return {
    ...row,
    background: normalizeQuoteBackground(row.background),
    bookCover: coalesceCoverImage(row.bookCover),
    ...normalizeQuoteLikeState(row.likeCount, row.likedByViewer),
  } satisfies PublicQuote;
}

/**
 * Toggles the current user's like on a quote. Returns the new state + total, or
 * null when the quote doesn't exist.
 */
export async function toggleQuoteLike(
  quoteId: string,
  userId: string
): Promise<{ liked: boolean; likeCount: number } | null> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'quote-like:' + quoteId + ':' + userId}, 0))`);
    const [quote] = await tx
      .select({ id: Quote.id, bookId: Quote.bookId })
      .from(Quote)
      .innerJoin(User, eq(User.id, Quote.userId))
      .where(and(eq(Quote.id, quoteId), or(eq(User.profileVisibility, "PUBLIC"), eq(User.id, userId))))
      .limit(1).for("share", { of: [Quote, User] });

    if (!quote) return null;

    const removed = await tx
      .delete(QuoteLike)
      .where(and(eq(QuoteLike.quoteId, quoteId), eq(QuoteLike.userId, userId)))
      .returning({ id: QuoteLike.id });

    let liked: boolean;
    if (removed.length > 0) {
      liked = false;
    } else {
      await tx
        .insert(QuoteLike)
        .values({ quoteId, userId })
        .onConflictDoNothing();
      liked = true;
    }

    await recordLikedActivity(tx, userId, quote.bookId, { quoteId }, liked);
    const [row] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(QuoteLike)
      .where(eq(QuoteLike.quoteId, quoteId));

    return { liked, likeCount: row?.count ?? 0 };
  });
}
