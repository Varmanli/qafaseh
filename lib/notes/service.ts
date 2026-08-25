import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  Book,
  BookEdition,
  CatalogBook,
  PublishedBookNote,
  PublishedBookNoteLike,
  User,
} from "@/db/schema";
import { sanitizeRichTextHtml } from "@/lib/content/rich-text";

export class NoteError extends Error {
  constructor(message: string, public status = 400, public code?: string) {
    super(message);
    this.name = "NoteError";
  }
}

export interface PublicNote {
  id: string;
  content: string;
  bookId: string;
  catalogBookId: string | null;
  bookEditionId: string | null;
  scope: "book" | "edition";
  bookSlug?: string | null;
  bookTitle: string;
  bookAuthor: string;
  bookCover: string | null;
  createdAt: Date;
  likeCount: number;
  likedByViewer: boolean;
  authorUserId: string;
  authorUsername: string | null;
  authorName: string | null;
  authorImage: string | null;
}

export type PublicNotesResult =
  | { found: false }
  | { found: true; isPrivate: true }
  | { found: true; isPrivate: false; isOwner: boolean; notes: PublicNote[]; hasMore: boolean };

const PROFILE_NOTE_PLACEHOLDER = "متن یادداشت در نمای پروفایل در دسترس نیست.";

export function isToastCorruptionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: unknown; message?: unknown };
  return value.code === "XX001" ||
    (typeof value.message === "string" && /toast|missing chunk/i.test(value.message));
}

async function resolveOwnedLibraryRow(
  userId: string,
  catalogBookId: string,
  bookEditionId: string | null,
): Promise<{ id: string; catalogBookId: string | null; editionId: string | null } | null> {
  const filters = [
    and(eq(Book.userId, userId), eq(Book.catalogBookId, catalogBookId)),
  ];

  if (bookEditionId) {
    filters.unshift(
      and(
        eq(Book.userId, userId),
        eq(Book.catalogBookId, catalogBookId),
        eq(Book.editionId, bookEditionId),
      ),
    );
  }

  for (const where of filters) {
    const [book] = await db
      .select({
        id: Book.id,
        catalogBookId: Book.catalogBookId,
        editionId: Book.editionId,
      })
      .from(Book)
      .where(where)
      .limit(1);

    if (book) return book;
  }

  return null;
}

export async function getPublishedNotesByUsername(
  username: string,
  viewerId?: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<PublicNotesResult> {
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

  // The public profile preview/list only needs note metadata.  Never add
  // the note body column here: production contains corrupted TOAST
  // values, and the profile can render safely without the note body.
  const rows = await db
    .select({
      id: PublishedBookNote.id,
      bookId: sql<string>`coalesce(${PublishedBookNote.bookId}, '')`,
      catalogBookId: PublishedBookNote.catalogBookId,
      bookEditionId: PublishedBookNote.bookEditionId,
      scope: PublishedBookNote.scope,
      bookSlug: sql<string | null>`coalesce(${CatalogBook.slug}, ${Book.slug})`,
      bookTitle: sql<string>`coalesce(${CatalogBook.title}, ${Book.title})`,
      bookAuthor: sql<string>`coalesce(${CatalogBook.author}, ${Book.author})`,
      bookCover: sql<string | null>`coalesce(
        ${BookEdition.coverImage},
        ${CatalogBook.coverImage},
        ${Book.coverImage}
      )`,
      createdAt: PublishedBookNote.createdAt,
      likeCount: sql<number>`count(${PublishedBookNoteLike.id})::int`,
      likedByViewer: sql<boolean>`coalesce(bool_or(${PublishedBookNoteLike.userId} = ${
        viewerId ?? null
      }), false)`,
    })
    .from(PublishedBookNote)
    .leftJoin(Book, eq(PublishedBookNote.bookId, Book.id))
    .leftJoin(CatalogBook, eq(PublishedBookNote.catalogBookId, CatalogBook.id))
    .leftJoin(BookEdition, eq(PublishedBookNote.bookEditionId, BookEdition.id))
    .leftJoin(
      PublishedBookNoteLike,
      eq(PublishedBookNoteLike.noteId, PublishedBookNote.id),
    )
    .where(eq(PublishedBookNote.userId, user.id))
    .groupBy(
      PublishedBookNote.id,
      CatalogBook.id,
      Book.id,
      BookEdition.id,
    )
    .orderBy(desc(PublishedBookNote.createdAt))
    .limit(Math.min(opts.limit ?? 10, 50) + 1)
    .offset(Math.max(opts.offset ?? 0, 0));

  const hasMore = rows.length > Math.min(opts.limit ?? 10, 50);
  const visibleRows = hasMore ? rows.slice(0, -1) : rows;

  const notes: PublicNote[] = visibleRows.map((r) => ({
    ...r,
    content: PROFILE_NOTE_PLACEHOLDER,
    scope: (r.scope ?? "book") as "book" | "edition",
    likedByViewer: Boolean(r.likedByViewer),
    authorUserId: user.id,
    authorUsername: user.username,
    authorName: user.name,
    authorImage: user.image,
  }));

  return { found: true, isPrivate: false, isOwner, notes, hasMore };
}

export async function listPublishedNotesForBook(opts: {
  catalogBookId: string;
  viewerId?: string;
  editionId?: string | null;
}): Promise<{ bookNotes: PublicNote[]; editionNotes: PublicNote[] }> {
  const filters = [
    and(
      eq(PublishedBookNote.catalogBookId, opts.catalogBookId),
      eq(PublishedBookNote.scope, "book"),
    ),
  ];

  if (opts.editionId) {
    filters.push(
      and(
        eq(PublishedBookNote.catalogBookId, opts.catalogBookId),
        eq(PublishedBookNote.scope, "edition"),
        eq(PublishedBookNote.bookEditionId, opts.editionId),
      ),
    );
  }

  const rows = await db
    .select({
      id: PublishedBookNote.id,
      content: PublishedBookNote.content,
      bookId: sql<string>`coalesce(${PublishedBookNote.bookId}, '')`,
      catalogBookId: PublishedBookNote.catalogBookId,
      bookEditionId: PublishedBookNote.bookEditionId,
      scope: PublishedBookNote.scope,
      bookSlug: CatalogBook.slug,
      bookTitle: CatalogBook.title,
      bookAuthor: CatalogBook.author,
      bookCover: sql<string | null>`coalesce(${BookEdition.coverImage}, ${CatalogBook.coverImage})`,
      createdAt: PublishedBookNote.createdAt,
      likeCount: sql<number>`count(${PublishedBookNoteLike.id})::int`,
      likedByViewer: sql<boolean>`coalesce(bool_or(${PublishedBookNoteLike.userId} = ${
        opts.viewerId ?? null
      }), false)`,
      authorUserId: User.id,
      authorUsername: User.username,
      authorName: User.name,
      authorImage: User.image,
    })
    .from(PublishedBookNote)
    .innerJoin(User, eq(PublishedBookNote.userId, User.id))
    .innerJoin(CatalogBook, eq(PublishedBookNote.catalogBookId, CatalogBook.id))
    .leftJoin(BookEdition, eq(PublishedBookNote.bookEditionId, BookEdition.id))
    .leftJoin(
      PublishedBookNoteLike,
      eq(PublishedBookNoteLike.noteId, PublishedBookNote.id),
    )
    .where(
      and(
        or(...filters),
        opts.viewerId
          ? or(
              eq(User.profileVisibility, "PUBLIC"),
              eq(User.id, opts.viewerId),
            )
          : eq(User.profileVisibility, "PUBLIC"),
      ),
    )
    .groupBy(PublishedBookNote.id, User.id, CatalogBook.id, BookEdition.id)
    .orderBy(desc(PublishedBookNote.createdAt))
    .limit(100);

  const notes = rows.map((row) => ({
    ...row,
    scope: (row.scope ?? "book") as "book" | "edition",
    likedByViewer: Boolean(row.likedByViewer),
  }));

  return {
    bookNotes: notes.filter((note) => note.scope === "book"),
    editionNotes: notes.filter((note) => note.scope === "edition"),
  };
}

export async function togglePublishedNoteLike(
  noteId: string,
  userId: string,
): Promise<{ liked: boolean; likeCount: number } | null> {
  const [note] = await db
    .select({ id: PublishedBookNote.id })
    .from(PublishedBookNote)
    .where(eq(PublishedBookNote.id, noteId))
    .limit(1);

  if (!note) return null;

  const removed = await db
    .delete(PublishedBookNoteLike)
    .where(
      and(
        eq(PublishedBookNoteLike.noteId, noteId),
        eq(PublishedBookNoteLike.userId, userId),
      ),
    )
    .returning({ id: PublishedBookNoteLike.id });

  let liked: boolean;
  if (removed.length > 0) {
    liked = false;
  } else {
    await db
      .insert(PublishedBookNoteLike)
      .values({ noteId, userId })
      .onConflictDoNothing();
    liked = true;
  }

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(PublishedBookNoteLike)
    .where(eq(PublishedBookNoteLike.noteId, noteId));

  return { liked, likeCount: row?.count ?? 0 };
}

export async function createPublishedNote(
  userId: string,
  input: {
    catalogBookId: string;
    bookEditionId?: string | null;
    scope: "book" | "edition";
    content: string;
  },
): Promise<{ id: string }> {
  if (input.scope === "edition" && !input.bookEditionId) {
    throw new NoteError("برای این نوع یادداشت باید نسخه انتخاب شود", 422, "EDITION_REQUIRED");
  }

  if (input.scope === "book" && input.bookEditionId) {
    throw new NoteError("یادداشت درباره کتاب نباید نسخه داشته باشد", 422, "BOOK_SCOPE_INVALID");
  }

  if (input.bookEditionId) {
    const [edition] = await db
      .select({ id: BookEdition.id, catalogBookId: BookEdition.catalogBookId })
      .from(BookEdition)
      .where(eq(BookEdition.id, input.bookEditionId))
      .limit(1);

    if (!edition || edition.catalogBookId !== input.catalogBookId) {
      throw new NoteError("نسخه‌ی انتخاب‌شده به این کتاب تعلق ندارد", 422, "EDITION_MISMATCH");
    }
  }

  const ownedBook = await resolveOwnedLibraryRow(
    userId,
    input.catalogBookId,
    input.bookEditionId ?? null,
  );

  if (!ownedBook) {
    throw new NoteError(
      "ابتدا این کتاب یا نسخه را به کتابخانه‌ات اضافه کن",
      403,
      "BOOK_NOT_OWNED",
    );
  }

  const [created] = await db
    .insert(PublishedBookNote)
    .values({
      userId,
      bookId: ownedBook.id,
      catalogBookId: input.catalogBookId,
      bookEditionId: input.scope === "edition" ? input.bookEditionId ?? null : null,
      scope: input.scope,
      content: sanitizeRichTextHtml(input.content),
    })
    .returning({ id: PublishedBookNote.id });

  return created;
}

export async function updatePublishedNote(
  userId: string,
  noteId: string,
  content: string,
): Promise<{ id: string }> {
  const [updated] = await db
    .update(PublishedBookNote)
    .set({ content: sanitizeRichTextHtml(content), updatedAt: new Date() })
    .where(and(eq(PublishedBookNote.id, noteId), eq(PublishedBookNote.userId, userId)))
    .returning({ id: PublishedBookNote.id });

  if (!updated) {
    throw new NoteError("یادداشت یافت نشد", 404, "NOTE_NOT_FOUND");
  }
  return updated;
}

export async function deletePublishedNote(
  userId: string,
  noteId: string,
): Promise<void> {
  const [deleted] = await db
    .delete(PublishedBookNote)
    .where(and(eq(PublishedBookNote.id, noteId), eq(PublishedBookNote.userId, userId)))
    .returning({ id: PublishedBookNote.id });

  if (!deleted) {
    throw new NoteError("یادداشت یافت نشد", 404, "NOTE_NOT_FOUND");
  }
}

export async function getPublishedNotesForBook(opts: {
  catalogBookId: string;
  viewerId?: string;
  editionId?: string | null;
  scope?: "book" | "edition";
  limit?: number;
  offset?: number;
}): Promise<{ notes: PublicNote[]; hasMore: boolean }> {
  const limit = Math.min(opts.limit ?? 10, 50);
  const offset = Math.max(opts.offset ?? 0, 0);

  const filters = [
    eq(PublishedBookNote.catalogBookId, opts.catalogBookId),
  ];

  if (opts.scope) {
    filters.push(eq(PublishedBookNote.scope, opts.scope));
  }
  if (opts.scope === "edition" && opts.editionId) {
    filters.push(eq(PublishedBookNote.bookEditionId, opts.editionId));
  }

  const rows = await db
    .select({
      id: PublishedBookNote.id,
      content: PublishedBookNote.content,
      bookId: sql<string>`coalesce(${PublishedBookNote.bookId}, '')`,
      catalogBookId: PublishedBookNote.catalogBookId,
      bookEditionId: PublishedBookNote.bookEditionId,
      scope: PublishedBookNote.scope,
      bookSlug: CatalogBook.slug,
      bookTitle: CatalogBook.title,
      bookAuthor: CatalogBook.author,
      bookCover: sql<string | null>`coalesce(${BookEdition.coverImage}, ${CatalogBook.coverImage})`,
      createdAt: PublishedBookNote.createdAt,
      likeCount: sql<number>`count(${PublishedBookNoteLike.id})::int`,
      likedByViewer: sql<boolean>`coalesce(bool_or(${PublishedBookNoteLike.userId} = ${
        opts.viewerId ?? null
      }), false)`,
      authorUserId: User.id,
      authorUsername: User.username,
      authorName: User.name,
      authorImage: User.image,
    })
    .from(PublishedBookNote)
    .innerJoin(User, eq(PublishedBookNote.userId, User.id))
    .innerJoin(CatalogBook, eq(PublishedBookNote.catalogBookId, CatalogBook.id))
    .leftJoin(BookEdition, eq(PublishedBookNote.bookEditionId, BookEdition.id))
    .leftJoin(
      PublishedBookNoteLike,
      eq(PublishedBookNoteLike.noteId, PublishedBookNote.id),
    )
    .where(
      and(
        ...filters,
        opts.viewerId
          ? or(
              eq(User.profileVisibility, "PUBLIC"),
              eq(User.id, opts.viewerId),
            )
          : eq(User.profileVisibility, "PUBLIC"),
      ),
    )
    .groupBy(PublishedBookNote.id, User.id, CatalogBook.id, BookEdition.id)
    .orderBy(desc(PublishedBookNote.createdAt))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  const visibleRows = hasMore ? rows.slice(0, -1) : rows;

  const notes = visibleRows.map((row) => ({
    ...row,
    scope: (row.scope ?? "book") as "book" | "edition",
    likedByViewer: Boolean(row.likedByViewer),
  }));

  return { notes, hasMore };
}
