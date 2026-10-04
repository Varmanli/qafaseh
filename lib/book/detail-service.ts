import { and, arrayContains, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import {
  Book,
  BookEdition,
  CatalogBook,
  CatalogBookContributor,
  BookEditionContributor,
  BookEditionPublisher,
  Quote,
  QuoteLike,
  ReadingEvent,
  ReferenceItem,
  SocialComment,
  User,
} from "@/db/schema";
import { coalesceCoverImage } from "@/lib/book/cover";
import {
  resolveBookDisplayData,
  sampleLegacyBookFieldSql,
} from "@/lib/book/display-cover";
import {
  ensureCatalogBookSlug,
  ensureBookSlug,
  extractCatalogBookIdFromSlug,
} from "@/lib/book/public-slug";
import { primaryEditionOrderBy } from "@/lib/book/primary-edition";
import {
  resolveBookPresentation,
  type BookPresentationEdition,
} from "@/lib/book/presentation";
import {
  getPublicBookExternalLinks,
  type PublicBookExternalLink,
} from "@/lib/book/external-links";
import { splitStoredGenres } from "@/lib/book/genres";
import { normalizeQuoteBackground } from "@/lib/quotes/backgrounds";
import { recordReadingActivity } from "@/lib/social/activity";
import {
  isToastCorruptionError,
  listPublishedNotesForBook,
  type PublicNote,
} from "@/lib/notes/service";
import type { PublicQuote } from "@/lib/quotes/service";
import type { ReferenceTypeValue } from "@/lib/validations/reference";
import { slugify } from "@/lib/book/slug";

export interface BookReferenceLinks {
  author?: string;
  translator?: string;
  publisher?: string;
  country?: string;
}

export interface ReferenceChipData {
  name: string;
  href: string | null;
  image: string | null;
}

export type BookReferenceImages = {
  [K in keyof BookReferenceLinks]?: string | null;
};

export type BookStatus = "UNREAD" | "READING" | "PAUSED" | "STOPPED" | "FINISHED";

export interface BookEditionSummary {
  id: string;
  title: string;
  titleOverride: string | null;
  translator: string | null;
  publisher: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  isbn: string | null;
  isbn10: string | null;
  isbn13: string | null;
  editionLabel: string | null;
  editionDescription: string | null;
  coverImage: string | null;
  language: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  isPrimary: boolean;
}

export interface BookDetailMeta {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  originalTitle: string | null;
  description: string | null;
  author: string;
  authorSlug?: string | null;
  genres: Array<{ name: string; slug: string | null }>;
  country: string | null;
  countrySlug?: string | null;
  language: string | null;
  firstPublishedYear: number | null;
  displayCoverImage: string | null;
  coverImage: string | null;
}

export interface ViewerLibraryEntry {
  id: string;
  status: BookStatus;
  rating: number | null;
  isFavorite: boolean;
  privateNote: string | null;
  moodTags: string[];
  editionId: string | null;
  catalogBookId: string | null;
  pageCount: number | null;
  currentPage: number;
  progress: number | null;
  readingUpdatedAt: Date | null;
}

export interface BookStats {
  wantToReadCount: number;
  readingCount: number;
  finishedCount: number;
  averageRating: number | null;
  ratingCount: number;
}

export type BookDetailResult =
  | { found: false }
  | {
      found: true;
      book: BookDetailMeta;
      presentation: ReturnType<typeof resolveBookPresentation>;
      selectedEdition: BookEditionSummary | null;
      editions: BookEditionSummary[];
      viewer: ViewerLibraryEntry | null;
      stats: BookStats;
      topMoods: string[];
      refLinks: BookReferenceLinks;
      refImages: BookReferenceImages;
      authorChip: ReferenceChipData;
      authorChips: ReferenceChipData[];
      translatorChip: ReferenceChipData | null;
      translatorChips: ReferenceChipData[];
      publisherChip: ReferenceChipData | null;
      quotes: PublicQuote[];
      quoteCount: number;
      bookNotes: PublicNote[];
      bookNotesCount: number;
      editionNotes: PublicNote[];
      editionNotesCount: number;
      externalLinks: PublicBookExternalLink[];
    };

type SubjectRow = {
  catalogBookId: string;
  primaryEditionId: string | null;
  slug: string | null;
  title: string;
  subtitle: string | null;
  originalTitle: string | null;
  description: string | null;
  author: string;
  genre: string | null;
  country: string | null;
  language: string | null;
  firstPublishedYear: number | null;
  catalogCoverImage: string | null;
  legacyBookCoverImage: string | null;
};

async function loadBookSubjectRow(ref: string): Promise<SubjectRow | undefined> {
  const normalizedRef = slugify(ref);
  const [book] = await db
    .select({
      catalogBookId: CatalogBook.id,
      primaryEditionId: CatalogBook.primaryEditionId,
      slug: CatalogBook.slug,
      title: CatalogBook.title,
      subtitle: CatalogBook.subtitle,
      originalTitle: CatalogBook.originalTitle,
      description: CatalogBook.description,
      author: CatalogBook.author,
      genre: CatalogBook.genre,
      country: CatalogBook.country,
      language: CatalogBook.language,
      firstPublishedYear: CatalogBook.firstPublishedYear,
      catalogCoverImage: CatalogBook.coverImage,
      legacyBookCoverImage: sampleLegacyBookFieldSql<string | null>("cover_image"),
    })
    .from(CatalogBook)
    .where(
      and(
        eq(CatalogBook.status, "APPROVED"),
        or(
          eq(CatalogBook.id, ref),
          eq(CatalogBook.slug, ref),
        ),
      ),
    )
    .limit(1);

  if (book) return book;

  if (normalizedRef) {
    const normalizedMatches = await db
      .select()
      .from(CatalogBook)
      .where(and(eq(CatalogBook.status, "APPROVED"), eq(CatalogBook.slugNormalized, normalizedRef)))
      .limit(2);
    // Existing data can contain equivalent Arabic/Persian keys. A normalized
    // request is accepted only when it still identifies one canonical book.
    if (normalizedMatches.length === 1) {
      const match = normalizedMatches[0];
      return {
        catalogBookId: match.id,
        primaryEditionId: match.primaryEditionId,
        slug: match.slug,
        title: match.title,
        subtitle: match.subtitle,
        originalTitle: match.originalTitle,
        description: match.description,
        author: match.author,
        genre: match.genre,
        country: match.country,
        language: match.language,
        firstPublishedYear: match.firstPublishedYear,
        catalogCoverImage: match.coverImage,
        legacyBookCoverImage: null,
      };
    }
  }

  // Pre-normalization URLs used title-like paths. A title fallback is safe only
  // when it selects exactly one approved canonical book; duplicate titles must
  // never be guessed because they can be different works/editions.
  const titleCandidate = ref.replace(/-/g, " ").trim();
  if (normalizedRef && titleCandidate) {
    const titleMatches = await db
      .select({
        catalogBookId: CatalogBook.id,
        primaryEditionId: CatalogBook.primaryEditionId,
        slug: CatalogBook.slug,
        title: CatalogBook.title,
        subtitle: CatalogBook.subtitle,
        originalTitle: CatalogBook.originalTitle,
        description: CatalogBook.description,
        author: CatalogBook.author,
        genre: CatalogBook.genre,
        country: CatalogBook.country,
        language: CatalogBook.language,
        firstPublishedYear: CatalogBook.firstPublishedYear,
        catalogCoverImage: CatalogBook.coverImage,
        legacyBookCoverImage: sampleLegacyBookFieldSql<string | null>("cover_image"),
      })
      .from(CatalogBook)
      .where(and(eq(CatalogBook.status, "APPROVED"), sql`lower(${CatalogBook.title}) = lower(${titleCandidate})`))
      .limit(2);
    if (titleMatches.length === 1 && slugify(titleMatches[0].title) === normalizedRef) {
      return titleMatches[0];
    }
  }

  const [legacy] = await db
    .select({
      catalogBookId: CatalogBook.id,
      primaryEditionId: CatalogBook.primaryEditionId,
      slug: CatalogBook.slug,
      title: CatalogBook.title,
      subtitle: CatalogBook.subtitle,
      originalTitle: CatalogBook.originalTitle,
      description: CatalogBook.description,
      author: CatalogBook.author,
      genre: CatalogBook.genre,
      country: CatalogBook.country,
      language: CatalogBook.language,
      firstPublishedYear: CatalogBook.firstPublishedYear,
      catalogCoverImage: CatalogBook.coverImage,
      legacyBookCoverImage: Book.coverImage,
    })
    .from(Book)
    .innerJoin(CatalogBook, eq(Book.catalogBookId, CatalogBook.id))
    .where(or(eq(Book.id, ref), eq(Book.slug, ref)))
    .limit(1);

  return legacy;
}

const loadSubjectRow = cache(async (ref: string): Promise<SubjectRow | undefined> => {
  const subject = await loadBookSubjectRow(ref);
  if (subject) return subject;

  const catalogBookId =
    extractCatalogBookIdFromSlug(ref) ??
    (/^[0-9a-f-]{36}$/i.test(ref) ? ref : null);

  if (!catalogBookId) return undefined;
  return loadBookSubjectRow(catalogBookId);
});

const loadApprovedEditions = cache(async (catalogBookId: string): Promise<BookEditionSummary[]> => {
  const rows = await db
    .select({
      id: BookEdition.id,
      title: CatalogBook.title,
      titleOverride: BookEdition.titleOverride,
      translator: BookEdition.translator,
      publisher: BookEdition.publisher,
      publishedYear: BookEdition.publishedYear,
      pageCount: BookEdition.pageCount,
      isbn: BookEdition.isbn,
      isbn10: BookEdition.isbn10,
      isbn13: BookEdition.isbn13,
      editionLabel: BookEdition.editionLabel,
      editionDescription: BookEdition.editionDescription,
      coverImage: BookEdition.coverImage,
      language: BookEdition.language,
      status: BookEdition.status,
      isPrimary: sql<boolean>`${CatalogBook.primaryEditionId} = ${BookEdition.id}`,
    })
    .from(BookEdition)
    .innerJoin(CatalogBook, eq(BookEdition.catalogBookId, CatalogBook.id))
    .where(
      and(
        eq(BookEdition.catalogBookId, catalogBookId),
        eq(BookEdition.status, "APPROVED"),
      ),
    )
    .orderBy(
      ...primaryEditionOrderBy(CatalogBook.primaryEditionId),
    );

  return rows.map((row) => ({
    ...row,
    coverImage: coalesceCoverImage(row.coverImage),
  }));
});

async function loadViewerEntry(
  viewerId: string | undefined,
  catalogBookId: string,
  selectedEditionId: string | null,
): Promise<ViewerLibraryEntry | null> {
  if (!viewerId) return null;

  const [entry] = await db
    .select({
      id: Book.id,
      status: Book.status,
      rating: Book.rating,
      isFavorite: Book.isFavorite,
      review: Book.review,
      moodTags: Book.moodTags,
      editionId: Book.editionId,
      catalogBookId: Book.catalogBookId,
      pageCount: Book.pageCount,
      currentPage: Book.currentPage,
      progress: Book.progress,
      readingUpdatedAt: Book.readingUpdatedAt,
    })
    .from(Book)
    .where(and(eq(Book.userId, viewerId), eq(Book.catalogBookId, catalogBookId)))
    .orderBy(sql`case when ${Book.editionId} = ${selectedEditionId} then 0 else 1 end`)
    .limit(1);

  if (entry) {
    return {
      id: entry.id,
      status: entry.status,
      rating: entry.rating,
      isFavorite: entry.isFavorite,
      privateNote: entry.review,
      moodTags: entry.moodTags ?? [],
      editionId: entry.editionId,
      catalogBookId: entry.catalogBookId,
      pageCount: entry.pageCount,
      currentPage: entry.currentPage,
      progress: entry.progress,
      readingUpdatedAt: entry.readingUpdatedAt,
    };
  }
  return null;
}

async function loadBookStats(catalogBookId: string): Promise<BookStats> {
  const [row] = await db
    .select({
      wantToReadCount: sql<number>`count(*) filter (where ${Book.status} = 'UNREAD')::int`,
      readingCount: sql<number>`count(*) filter (where ${Book.status} = 'READING')::int`,
      finishedCount: sql<number>`count(*) filter (where ${Book.status} = 'FINISHED')::int`,
      ratingCount: sql<number>`count(*) filter (where ${Book.rating} is not null and ${Book.rating} > 0)::int`,
      averageRating: sql<string | null>`round(avg(${Book.rating}) filter (where ${Book.rating} is not null and ${Book.rating} > 0), 1)`,
    })
    .from(Book)
    .where(eq(Book.catalogBookId, catalogBookId));

  return {
    wantToReadCount: row?.wantToReadCount ?? 0,
    readingCount: row?.readingCount ?? 0,
    finishedCount: row?.finishedCount ?? 0,
    ratingCount: row?.ratingCount ?? 0,
    averageRating: row?.averageRating != null ? Number(row.averageRating) : null,
  };
}

async function loadTopMoods(catalogBookId: string): Promise<string[]> {
  const result = await db.execute<{ mood: string }>(sql`
    select mood from ${Book}
    cross join lateral unnest(${Book.moodTags}) as tags(mood)
    where ${Book.catalogBookId} = ${catalogBookId}
    group by mood order by count(*) desc, mood asc limit 3
  `);
  return result.rows.map((row) => row.mood);
}

async function loadReferenceLinks(subject: {
  catalogBookId: string;
  editionId: string | null;
  author: string;
  genres: string[];
  translator: string | null;
  publisher: string | null;
  country: string | null;
}): Promise<{
  links: BookReferenceLinks;
  images: BookReferenceImages;
  genres: Array<{ name: string; slug: string | null }>;
  authors: ReferenceChipData[];
  translators: ReferenceChipData[];
  publisher: ReferenceChipData | null;
}> {
  const pairs: { key: keyof BookReferenceLinks; type: ReferenceTypeValue; name: string }[] = [
    { key: "author", type: "AUTHOR", name: subject.author },
  ];

  if (subject.translator) {
    pairs.push({ key: "translator", type: "TRANSLATOR", name: subject.translator });
  }
  if (subject.publisher) {
    pairs.push({ key: "publisher", type: "PUBLISHER", name: subject.publisher });
  }
  if (subject.country) {
    pairs.push({ key: "country", type: "COUNTRY", name: subject.country });
  }

  const conds = pairs.map((pair) =>
    and(
      pair.type === "AUTHOR" || pair.type === "TRANSLATOR"
        ? arrayContains(ReferenceItem.roles, [pair.type])
        : eq(ReferenceItem.type, pair.type),
      isNull(ReferenceItem.canonicalReferenceId),
      sql`lower(${ReferenceItem.name}) = lower(${pair.name})`,
    ),
  );
  for (const genre of subject.genres) {
    conds.push(
      and(eq(ReferenceItem.type, "GENRE"), sql`lower(${ReferenceItem.name}) = lower(${genre})`),
    );
  }

  if (conds.length === 0) {
    return { links: {}, images: {}, genres: [], authors: [], translators: [], publisher: null };
  }

  const rowsQuery = db
    .select({
      type: ReferenceItem.type,
      roles: ReferenceItem.roles,
      name: ReferenceItem.name,
      slug: ReferenceItem.slug,
      coverImage: ReferenceItem.coverImage,
    })
    .from(ReferenceItem)
    .where(and(eq(ReferenceItem.status, "APPROVED"), or(...conds)));

  const [rows, authorRows, translatorRows, publisherRows] = await Promise.all([
    rowsQuery,
    db.select({ name: ReferenceItem.name, slug: ReferenceItem.slug, image: ReferenceItem.coverImage })
      .from(CatalogBookContributor)
      .innerJoin(ReferenceItem, eq(ReferenceItem.id, CatalogBookContributor.referenceItemId))
      .where(and(eq(CatalogBookContributor.catalogBookId, subject.catalogBookId), eq(CatalogBookContributor.role, "AUTHOR"), eq(ReferenceItem.status, "APPROVED")))
      .orderBy(CatalogBookContributor.sortOrder),
    subject.editionId
      ? db.select({ name: ReferenceItem.name, slug: ReferenceItem.slug, image: ReferenceItem.coverImage })
          .from(BookEditionContributor)
          .innerJoin(ReferenceItem, eq(ReferenceItem.id, BookEditionContributor.referenceItemId))
          .where(and(eq(BookEditionContributor.bookEditionId, subject.editionId), eq(BookEditionContributor.role, "TRANSLATOR"), eq(ReferenceItem.status, "APPROVED")))
          .orderBy(BookEditionContributor.sortOrder)
      : Promise.resolve([]),
    subject.editionId
      ? db.select({ name: ReferenceItem.name, slug: ReferenceItem.slug, image: ReferenceItem.coverImage })
          .from(BookEditionPublisher)
          .innerJoin(ReferenceItem, eq(ReferenceItem.id, BookEditionPublisher.referenceItemId))
          .where(and(eq(BookEditionPublisher.bookEditionId, subject.editionId), eq(ReferenceItem.status, "APPROVED")))
          .orderBy(BookEditionPublisher.sortOrder)
      : Promise.resolve([]),
  ]);

  const links: BookReferenceLinks = {};
  const images: BookReferenceImages = {};
  for (const pair of pairs) {
    const match = rows.find(
      (row) => row.roles.includes(pair.type) && row.slug && row.name.toLowerCase() === pair.name.toLowerCase(),
    );
    if (match?.slug) links[pair.key] = match.slug;
    if (match) images[pair.key] = coalesceCoverImage(match.coverImage);
  }

  return {
    links,
    images,
    genres: subject.genres.map((genre) => {
      const match = rows.find(
        (row) => row.type === "GENRE" && row.name.toLowerCase() === genre.toLowerCase(),
      );
      return { name: genre, slug: match?.slug ?? null };
    }),
    authors: authorRows.map((row) => ({ name: row.name, href: row.slug ? `/authors/${encodeURIComponent(row.slug)}` : null, image: coalesceCoverImage(row.image) })),
    translators: translatorRows.map((row) => ({ name: row.name, href: row.slug ? `/translators/${encodeURIComponent(row.slug)}` : null, image: coalesceCoverImage(row.image) })),
    publisher: publisherRows[0] ? { name: publisherRows[0].name, href: publisherRows[0].slug ? `/publishers/${encodeURIComponent(publisherRows[0].slug)}` : null, image: coalesceCoverImage(publisherRows[0].image) } : null,
  };
}

const BOOK_QUOTES_PAGE_SIZE = 12;

async function loadPublicQuotes(
  catalogBookId: string,
  subject: {
    title: string;
    author: string;
    coverImage: string | null;
    slug: string;
  },
  viewerId?: string,
  options: { limit?: number; offset?: number } = {},
): Promise<{ quotes: PublicQuote[]; total: number }> {
  const visibility = viewerId
    ? or(eq(User.profileVisibility, "PUBLIC"), eq(User.id, viewerId))
    : eq(User.profileVisibility, "PUBLIC");
  const where = and(inArray(Quote.bookId,
    db.select({ id: Book.id }).from(Book).where(eq(Book.catalogBookId, catalogBookId))), visibility);

  const query = db
    .select({
      id: Quote.id,
      content: Quote.content,
      imageKey: Quote.imageKey,
      background: Quote.background,
      page: Quote.page,
      bookId: Quote.bookId,
      canEdit: sql<boolean>`coalesce(${Quote.userId} = ${viewerId ?? null}, false)`,
      authorUsername: User.username,
      authorName: User.name,
      authorImage: User.image,
      likeCount: sql<number>`(select count(*)::int from ${QuoteLike} where ${QuoteLike.quoteId} = ${Quote.id})`,
      commentCount: sql<number>`(select count(*)::int from ${SocialComment}
        where ${SocialComment.targetType} = 'QUOTE' and ${SocialComment.targetId} = ${Quote.id})`,
      likedByViewer: sql<boolean>`exists (select 1 from ${QuoteLike}
        where ${QuoteLike.quoteId} = ${Quote.id} and ${QuoteLike.userId} = ${viewerId ?? null})`,
    })
    .from(Quote)
    .innerJoin(User, eq(Quote.userId, User.id))
    .where(where)
    .orderBy(desc(Quote.createdAt), desc(Quote.id))
    .limit(Math.min(options.limit ?? 10, 50))
    .offset(Math.max(options.offset ?? 0, 0));

  const [rows, [{ total }]] = await Promise.all([
    query,
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(Quote)
      .innerJoin(User, eq(Quote.userId, User.id))
      .where(where),
  ]);

  return { quotes: rows.map((row) => ({
    id: row.id,
    content: row.content,
    imageKey: row.imageKey,
    background: normalizeQuoteBackground(row.background),
    page: row.page,
    bookId: row.bookId,
    bookSlug: subject.slug,
    bookTitle: subject.title,
    bookAuthor: subject.author,
    bookCover: subject.coverImage,
    likeCount: row.likeCount,
    commentCount: row.commentCount,
    likedByViewer: Boolean(row.likedByViewer),
    canEdit: Boolean(row.canEdit),
    authorUsername: row.authorUsername,
    authorName: row.authorName,
    authorImage: row.authorImage,
  })), total };
}

const DETAIL_QUOTE_LIMIT = 10;

export async function getBookMetadata(ref: string) {
  const subject = await loadSubjectRow(ref);
  if (!subject) return null;

  const [slug, editions] = await Promise.all([
    ensureCatalogBookSlug({
      id: subject.catalogBookId,
      title: subject.title,
      slug: subject.slug,
    }),
    loadApprovedEditions(subject.catalogBookId),
  ]);
  const display = resolveBookDisplayData({
    title: subject.title,
    subtitle: subject.subtitle,
    author: subject.author,
    editions,
    primaryEditionId: subject.primaryEditionId,
    catalogBookCover: subject.catalogCoverImage,
    legacyBookCover: subject.legacyBookCoverImage,
  });

  return {
    id: subject.catalogBookId,
    slug,
    title: subject.title,
    author: subject.author,
    description: subject.description,
    genres: subject.genre ? splitStoredGenres(subject.genre) : [],
    displayCoverImage: display.displayCoverImage,
  };
}

type BookCommunity = Pick<Extract<BookDetailResult, { found: true }>,
  "quotes" | "quoteCount" | "bookNotes" | "bookNotesCount" | "editionNotes" | "editionNotesCount">;

export type BookOverviewResult = { found: false } |
  Omit<Extract<BookDetailResult, { found: true }>, keyof BookCommunity>;

export async function getBookOverview(
  ref: string,
  viewerId?: string,
  preferredEditionId?: string | null,
): Promise<BookOverviewResult> {
  const subject = await loadSubjectRow(ref);
  if (!subject) return { found: false };

  const [slug, editions] = await Promise.all([
    ensureCatalogBookSlug({ id: subject.catalogBookId, title: subject.title, slug: subject.slug }),
    loadApprovedEditions(subject.catalogBookId),
  ]);
  const display = resolveBookDisplayData({
    title: subject.title,
    subtitle: subject.subtitle,
    author: subject.author,
    editions,
    primaryEditionId: subject.primaryEditionId,
    selectedEditionId: preferredEditionId ?? null,
    catalogBookCover: subject.catalogCoverImage,
    legacyBookCover: subject.legacyBookCoverImage,
  });
  const selectedEdition = display.displayEdition;
  const displayCoverImage = display.displayCoverImage;

  if (process.env.NODE_ENV !== "production") {
    console.debug("[book-cover-resolution]", {
      catalogBookId: subject.catalogBookId,
      primaryEditionId: subject.primaryEditionId,
      selectedEditionId: selectedEdition?.id ?? null,
      selectedEditionCover: selectedEdition?.coverImage ?? null,
      primaryEditionCover: display.primaryEdition?.coverImage ?? null,
      fallbackEditionCover: display.fallbackEdition?.coverImage ?? null,
      catalogCover: subject.catalogCoverImage,
      legacyBookCover: subject.legacyBookCoverImage,
      finalDisplayCover: displayCoverImage,
    });
  }

  const genreNames = subject.genre ? splitStoredGenres(subject.genre) : [];
  const [viewer, stats, topMoods, refData, externalLinks] = await Promise.all([
    loadViewerEntry(viewerId, subject.catalogBookId, selectedEdition?.id ?? null),
    loadBookStats(subject.catalogBookId),
    loadTopMoods(subject.catalogBookId),
    loadReferenceLinks({
      catalogBookId: subject.catalogBookId,
      editionId: selectedEdition?.id ?? null,
      author: subject.author,
      genres: genreNames,
      translator: selectedEdition?.translator ?? null,
      publisher: selectedEdition?.publisher ?? null,
      country: subject.country,
    }),
    getPublicBookExternalLinks(subject.catalogBookId),
  ]);

  const authorChip: ReferenceChipData = {
    name: subject.author,
    href: refData.links.author ? `/authors/${encodeURIComponent(refData.links.author)}` : null,
    image: refData.images.author ?? null,
  };
  const authorChips = refData.authors.length > 0 ? refData.authors : [authorChip];

  const translatorChip: ReferenceChipData | null = selectedEdition?.translator
    ? {
        name: selectedEdition.translator,
        href: refData.links.translator
          ? `/translators/${encodeURIComponent(refData.links.translator)}`
          : null,
        image: refData.images.translator ?? null,
      }
    : null;
  const translatorChips = refData.translators.length > 0 ? refData.translators : (translatorChip ? [translatorChip] : []);

  const book: BookDetailMeta = {
    id: subject.catalogBookId,
    slug,
    title: subject.title,
    subtitle: subject.subtitle,
    originalTitle: subject.originalTitle,
    description: subject.description,
    author: subject.author,
    authorSlug: refData.links.author ?? null,
    genres: refData.genres,
    country: subject.country,
    countrySlug: refData.links.country ?? null,
    language: subject.language ?? selectedEdition?.language ?? "fa",
    firstPublishedYear: subject.firstPublishedYear,
    displayCoverImage,
    coverImage: displayCoverImage,
  };
  const presentation = resolveBookPresentation(
    book,
    selectedEdition as BookPresentationEdition | null,
  );

  return {
    found: true,
    book,
    presentation,
    selectedEdition,
    editions,
    viewer,
    stats,
    topMoods,
    refLinks: refData.links,
    refImages: refData.images,
    authorChip,
    authorChips,
    translatorChip,
    translatorChips,
    publisherChip: refData.publisher,
    externalLinks,
  };
}

export async function getBookCommunity(
  book: Pick<BookDetailMeta, "id" | "title" | "author" | "coverImage" | "slug">,
  viewerId?: string,
  editionId?: string | null,
): Promise<BookCommunity> {
  const [{ quotes, total: quoteCount }, notes] = await Promise.all([
    loadPublicQuotes(book.id, book, viewerId, { limit: DETAIL_QUOTE_LIMIT }),
    listPublishedNotesForBook({ catalogBookId: book.id, viewerId, editionId }).catch((error) => {
      if (!isToastCorruptionError(error)) throw error;
      return { bookNotes: [], bookNotesCount: 0, editionNotes: [], editionNotesCount: 0 };
    }),
  ]);
  return { quotes, quoteCount, ...notes };
}

export async function getBookDetail(
  ref: string,
  viewerId?: string,
  preferredEditionId?: string | null,
): Promise<BookDetailResult> {
  const overview = await getBookOverview(ref, viewerId, preferredEditionId);
  if (!overview.found) return overview;
  return { ...overview, ...await getBookCommunity(overview.book, viewerId, overview.selectedEdition?.id) };
}

export interface BookQuotesPageHeader {
  id: string;
  slug: string;
  title: string;
  author: string;
  coverImage: string | null;
}

export type BookQuotesPageResult =
  | { found: false }
  | {
      found: true;
      book: BookQuotesPageHeader;
      quotes: PublicQuote[];
      total: number;
      page: number;
      pageCount: number;
      viewerEntryId: string | null;
    };

export async function getBookQuotesPage(
  ref: string,
  viewerId?: string,
  page = 1,
): Promise<BookQuotesPageResult> {
  const subject = await loadSubjectRow(ref);
  if (!subject) return { found: false };

  const [slug, editions, viewer] = await Promise.all([
    ensureCatalogBookSlug({ id: subject.catalogBookId, title: subject.title, slug: subject.slug }),
    loadApprovedEditions(subject.catalogBookId),
    loadViewerEntry(viewerId, subject.catalogBookId, null),
  ]);
  const display = resolveBookDisplayData({
    title: subject.title,
    author: subject.author,
    editions,
    primaryEditionId: subject.primaryEditionId,
    catalogBookCover: subject.catalogCoverImage,
    legacyBookCover: subject.legacyBookCoverImage,
  });
  const coverImage = display.coverImage;

  const currentPage = Math.max(1, Math.floor(page));
  const { quotes, total } = await loadPublicQuotes(
    subject.catalogBookId,
    {
      title: subject.title,
      author: subject.author,
      coverImage,
      slug,
    },
    viewerId,
    { limit: BOOK_QUOTES_PAGE_SIZE, offset: (currentPage - 1) * BOOK_QUOTES_PAGE_SIZE },
  );
  return {
    found: true,
    book: {
      id: subject.catalogBookId,
      slug,
      title: subject.title,
      author: subject.author,
      coverImage,
    },
    quotes,
    total,
    page: currentPage,
    pageCount: Math.max(1, Math.ceil(total / BOOK_QUOTES_PAGE_SIZE)),
    viewerEntryId: viewer?.id ?? null,
  };
}

export type AddToLibraryResult =
  | { ok: false; reason: "NOT_FOUND" | "EDITION_NOT_FOUND" }
  | { ok: true; bookId: string; already: boolean };

export async function addBookToLibrary(
  viewerId: string,
  sourceBookId: string,
  status: BookStatus,
  editionId?: string,
): Promise<AddToLibraryResult> {
  if (editionId) {
    const [edition] = await db
      .select({
        editionId: BookEdition.id,
        catalogBookId: CatalogBook.id,
        title: CatalogBook.title,
        author: CatalogBook.author,
        description: CatalogBook.description,
        genre: CatalogBook.genre,
        country: CatalogBook.country,
        translator: BookEdition.translator,
        publisher: BookEdition.publisher,
        pageCount: BookEdition.pageCount,
        format: BookEdition.format,
        coverImage: sql<string | null>`coalesce(${BookEdition.coverImage}, ${CatalogBook.coverImage})`,
      })
      .from(BookEdition)
      .innerJoin(CatalogBook, eq(BookEdition.catalogBookId, CatalogBook.id))
      .where(
        and(
          eq(BookEdition.id, editionId),
          eq(CatalogBook.id, sourceBookId),
        ),
      )
      .limit(1);

    if (!edition) return { ok: false, reason: "EDITION_NOT_FOUND" };

    const [existing] = await db
      .select({ id: Book.id })
      .from(Book)
      .where(
        and(eq(Book.userId, viewerId), eq(Book.catalogBookId, edition.catalogBookId), eq(Book.editionId, edition.editionId)),
      )
      .limit(1);

    if (existing) return { ok: true, bookId: existing.id, already: true };

    const created = await db.transaction(async (tx) => {
      const [book] = await tx
        .insert(Book)
        .values({
          title: edition.title,
          author: edition.author,
          description: edition.description,
          genre: edition.genre ?? "نامشخص",
          country: edition.country,
          translator: edition.translator,
          publisher: edition.publisher,
          pageCount: edition.pageCount,
          format: edition.format,
          coverImage: edition.coverImage,
          userId: viewerId,
          status,
          catalogBookId: edition.catalogBookId,
          editionId: edition.editionId,
        })
        .returning({ id: Book.id });

      if (status === "READING") {
        await tx.insert(ReadingEvent).values({
          userId: viewerId,
          bookId: book.id,
          type: "START",
          pageTo: 0,
        });
      }

      await recordReadingActivity(tx, viewerId, book.id, null, status);

      return book;
    });

    return { ok: true, bookId: created.id, already: false };
  }

  const [catalog] = await db
    .select({ id: CatalogBook.id })
    .from(CatalogBook)
    .where(eq(CatalogBook.id, sourceBookId))
    .limit(1);

  if (catalog) {
    const [bestEdition] = await db
      .select({ id: BookEdition.id })
      .from(BookEdition)
      .where(and(eq(BookEdition.catalogBookId, sourceBookId), eq(BookEdition.status, "APPROVED")))
      .orderBy(desc(BookEdition.publishedYear), desc(BookEdition.createdAt))
      .limit(1);

    return addBookToLibrary(viewerId, sourceBookId, status, bestEdition?.id);
  }

  const [legacy] = await db
    .select({
      id: Book.id,
      title: Book.title,
      author: Book.author,
      translator: Book.translator,
      publisher: Book.publisher,
      genre: Book.genre,
      country: Book.country,
      description: Book.description,
      coverImage: Book.coverImage,
      pageCount: Book.pageCount,
      format: Book.format,
      catalogBookId: Book.catalogBookId,
      editionId: Book.editionId,
      userId: Book.userId,
    })
    .from(Book)
    .where(eq(Book.id, sourceBookId))
    .limit(1);

  if (!legacy) return { ok: false, reason: "NOT_FOUND" };
  if (legacy.userId === viewerId) return { ok: true, bookId: legacy.id, already: true };

  const existingWhere = legacy.editionId
    ? and(eq(Book.userId, viewerId), eq(Book.editionId, legacy.editionId))
    : legacy.catalogBookId
      ? and(eq(Book.userId, viewerId), eq(Book.catalogBookId, legacy.catalogBookId))
      : null;

  if (existingWhere) {
    const [existing] = await db.select({ id: Book.id }).from(Book).where(existingWhere).limit(1);
    if (existing) return { ok: true, bookId: existing.id, already: true };
  }

  const created = await db.transaction(async (tx) => {
    const [book] = await tx
      .insert(Book)
      .values({
        title: legacy.title,
        author: legacy.author,
        translator: legacy.translator,
        publisher: legacy.publisher,
        genre: legacy.genre,
        country: legacy.country,
        description: legacy.description,
        coverImage: legacy.coverImage,
        pageCount: legacy.pageCount,
        format: legacy.format,
        userId: viewerId,
        status,
        catalogBookId: legacy.catalogBookId,
        editionId: legacy.editionId,
      })
      .returning({ id: Book.id });

    if (status === "READING") {
      await tx.insert(ReadingEvent).values({
        userId: viewerId,
        bookId: book.id,
        type: "START",
        pageTo: 0,
      });
    }

    await recordReadingActivity(tx, viewerId, book.id, null, status);

    return book;
  });

  return { ok: true, bookId: created.id, already: false };
}

export async function ensurePublicBookSlug(ref: string): Promise<string | null> {
  const subject = await loadSubjectRow(ref);
  if (!subject) return null;
  return ensureCatalogBookSlug({
    id: subject.catalogBookId,
    title: subject.title,
    slug: subject.slug,
  });
}
