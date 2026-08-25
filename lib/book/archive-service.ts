import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { Book, BookEdition, CatalogBook, ReferenceItem } from "@/db/schema";
import { coalesceCoverImage } from "@/lib/book/cover";
import {
  displayCoverFieldSql,
  sampleLegacyBookFieldSql,
} from "@/lib/book/display-cover";
import { preferredEditionFieldSql } from "@/lib/book/primary-edition";
import { ensureCatalogBookSlug } from "@/lib/book/public-slug";
import { splitStoredGenres, STORED_GENRE_SEPARATOR } from "@/lib/book/genres";
import type { BookPresentationEdition } from "@/lib/book/presentation";
import { compactSearchText } from "@/lib/book/search-normalize";
import {
  BOOK_ARCHIVE_PAGE_SIZE,
  parseBookArchiveSearchParams,
  type BookArchiveFilterOptions,
  type BookArchiveFilters,
  type BookArchiveSort,
} from "@/lib/book/archive-search";

export interface BookArchiveItem {
  id: string;
  slug: string | null;
  title: string;
  originalTitle: string | null;
  author: string;
  genre: string | null;
  country: string | null;
  description: string | null;
  language: string | null;
  translator: string | null;
  publisher: string | null;
  coverImage: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  /** Set only when the archive query originated from a specific edition. */
  editionId: string | null;
  editionLabel: string | null;
  /** Explicit only for edition-originating scopes such as translator/publisher. */
  displayEdition: BookPresentationEdition | null;
  popularityCount: number;
  wantedCount: number;
  averageRating: number | null;
  ratingCount: number;
}

export interface BookArchiveResult {
  items: BookArchiveItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface BookArchivePageData {
  filters: BookArchiveFilters;
  options: BookArchiveFilterOptions;
  archive: BookArchiveResult;
}

export interface BookArchiveScope {
  fixedAuthor?: string;
  fixedGenre?: string;
  fixedPublisher?: string;
  fixedTranslator?: string;
  fixedCountry?: string;
}

function lowerEquals(column: unknown, value: string) {
  return sql`lower(${column}) = lower(${value})`;
}

function genreContains(column: unknown, value: string) {
  return sql`exists (
    select 1
    from unnest(string_to_array(coalesce(${column}, ''), ${STORED_GENRE_SEPARATOR})) as genre_value
    where lower(trim(genre_value)) = lower(${value})
  )`;
}

function bestEditionField<T>(fieldName: string) {
  return preferredEditionFieldSql<T>(fieldName);
}

const ALLOWED_EDITION_COLUMNS = new Set([
  "id",
  "catalog_book_id",
  "title_override",
  "status",
  "cover_image",
  "edition_label",
  "publisher",
  "translator",
  "isbn",
  "isbn10",
  "isbn13",
  "page_count",
  "publish_year",
  "price",
  "published_year",
  "language",
  "created_at",
  "updated_at",
]);

function presentationEditionField<T>(
  fieldName: string,
  scope: BookArchiveScope,
) {
  if (!scope.fixedTranslator && !scope.fixedPublisher) {
    return bestEditionField<T>(fieldName);
  }

  const normalized = fieldName.trim().toLowerCase();
  if (!ALLOWED_EDITION_COLUMNS.has(normalized)) {
    throw new Error(`Disallowed column identifier for edition archive subquery: ${fieldName}`);
  }

  const conditions = [
    sql`be.catalog_book_id = ${CatalogBook.id}`,
    sql`be.status = 'APPROVED'`,
    scope.fixedTranslator
      ? sql`lower(be.translator) = lower(${scope.fixedTranslator})`
      : undefined,
    scope.fixedPublisher
      ? sql`lower(be.publisher) = lower(${scope.fixedPublisher})`
      : undefined,
  ].filter(Boolean);

  return sql<T>`(
    select be.${sql.identifier(normalized)}
    from "BookEdition" be
    where ${sql.join(conditions, sql` and `)}
    order by be.created_at desc, be.id asc
    limit 1
  )`;
}

function sampleBookField<T>(fieldName: string) {
  return sampleLegacyBookFieldSql<T>(fieldName);
}

function archiveCoverField() {
  return displayCoverFieldSql();
}

function buildEditionExists(
  filters: BookArchiveFilters,
  scope: BookArchiveScope = {},
) {
  const conditions = [
    sql`be.catalog_book_id = ${CatalogBook.id}`,
    sql`be.status = 'APPROVED'`,
  ];

  if (scope.fixedTranslator) {
    conditions.push(sql`lower(be.translator) = lower(${scope.fixedTranslator})`);
  }
  if (scope.fixedPublisher) {
    conditions.push(sql`lower(be.publisher) = lower(${scope.fixedPublisher})`);
  }

  if (filters.translator) {
    conditions.push(sql`lower(be.translator) = lower(${filters.translator})`);
  }
  if (filters.publisher) {
    conditions.push(sql`lower(be.publisher) = lower(${filters.publisher})`);
  }
  if (filters.language) {
    conditions.push(sql`lower(be.language) = lower(${filters.language})`);
  }
  if (filters.hasCover === "with") {
    conditions.push(sql`be.cover_image is not null and trim(be.cover_image) <> ''`);
  }
  if (filters.hasCover === "without") {
    conditions.push(sql`(be.cover_image is null or trim(be.cover_image) = '')`);
  }
  if (filters.minPages !== null) {
    conditions.push(sql`be.page_count >= ${filters.minPages}`);
  }
  if (filters.maxPages !== null) {
    conditions.push(sql`be.page_count <= ${filters.maxPages}`);
  }
  if (filters.minYear !== null) {
    conditions.push(sql`be.published_year >= ${filters.minYear}`);
  }
  if (filters.maxYear !== null) {
    conditions.push(sql`be.published_year <= ${filters.maxYear}`);
  }

  return sql`exists (
    select 1
    from "BookEdition" be
    where ${sql.join(conditions, sql` and `)}
  )`;
}

function buildCatalogConditions(
  filters: BookArchiveFilters,
  scope: BookArchiveScope = {},
) {
  const conditions = [eq(CatalogBook.status, "APPROVED")];
  if (scope.fixedAuthor) {
    conditions.push(lowerEquals(CatalogBook.author, scope.fixedAuthor));
  }
  if (scope.fixedCountry) {
    conditions.push(lowerEquals(CatalogBook.country, scope.fixedCountry));
  }
  if (scope.fixedGenre) {
    conditions.push(genreContains(CatalogBook.genre, scope.fixedGenre));
  }

  if (filters.q) {
    const compact = compactSearchText(filters.q);
    conditions.push(
      sql`(
        exists (
          select 1 from "BookSearchIndex" si
          where si.catalog_book_id = ${CatalogBook.id}
            and (
              si.value_compact = ${compact}
              or si.value_compact like ${`${compact}%`}
              or (length(${compact}) >= 4 and si.value_compact % ${compact})
            )
        )
      )`,
    );
  }

  // Rating filters use the same per-catalog average that powers the archive
  // cards and rating sort.  Keeping this in the shared condition list means
  // the page query and COUNT(*) always describe the exact same result set.
  if (filters.minRating !== null) {
    conditions.push(sql`(
      select avg(b.rating)
      from "Book" b
      where b.catalog_book_id = ${CatalogBook.id}
        and b.rating is not null
        and b.rating > 0
    ) >= ${filters.minRating}`);
  }
  if (filters.maxRating !== null) {
    conditions.push(sql`(
      select avg(b.rating)
      from "Book" b
      where b.catalog_book_id = ${CatalogBook.id}
        and b.rating is not null
        and b.rating > 0
    ) <= ${filters.maxRating}`);
  }

  if (!scope.fixedGenre && filters.genre) {
    conditions.push(genreContains(CatalogBook.genre, filters.genre));
  }
  if (!scope.fixedAuthor && filters.author) {
    conditions.push(lowerEquals(CatalogBook.author, filters.author));
  }
  if (!scope.fixedCountry && filters.country) {
    conditions.push(lowerEquals(CatalogBook.country, filters.country));
  }

  if (filters.language) {
    conditions.push(
      sql`(
        lower(${CatalogBook.language}) = lower(${filters.language})
        or exists (
          select 1
          from "BookEdition" be
          where be.catalog_book_id = ${CatalogBook.id}
            and be.status = 'APPROVED'
            and lower(be.language) = lower(${filters.language})
        )
      )`,
    );
  }

  if (
    filters.translator ||
    filters.publisher ||
    filters.hasCover !== "any" ||
    filters.minPages !== null ||
    filters.maxPages !== null ||
    filters.minYear !== null ||
    filters.maxYear !== null
  ) {
    conditions.push(buildEditionExists(filters, scope));
  }

  if (scope.fixedTranslator || scope.fixedPublisher) {
    conditions.push(buildEditionExists(filters, scope));
  }

  return conditions;
}

function buildStatsJoin() {
  return db
    .select({
      catalogBookId: Book.catalogBookId,
      popularityCount: sql<number>`count(*)::int`.as("popularityCount"),
      wantedCount:
        sql<number>`count(*) filter (where ${Book.status} = 'UNREAD')::int`.as(
          "wantedCount",
        ),
      ratingCount:
        sql<number>`count(*) filter (where ${Book.rating} is not null and ${Book.rating} > 0)::int`.as(
          "ratingCount",
        ),
      averageRating:
        sql<string | null>`round(avg(${Book.rating}) filter (where ${Book.rating} is not null and ${Book.rating} > 0), 1)`.as(
          "averageRating",
        ),
    })
    .from(Book)
    .where(sql`${Book.catalogBookId} is not null`)
    .groupBy(Book.catalogBookId)
    .as("book_archive_stats");
}

function sortOrder(sort: BookArchiveSort, stats: ReturnType<typeof buildStatsJoin>) {
  const titleAsc = asc(CatalogBook.title);
  const titleDesc = desc(CatalogBook.title);
  const newest = desc(CatalogBook.createdAt);
  const oldest = asc(CatalogBook.createdAt);
  const popularity = desc(sql<number>`coalesce(${stats.popularityCount}, 0)`);
  const wanted = desc(sql<number>`coalesce(${stats.wantedCount}, 0)`);
  const rating = desc(
    sql<number>`coalesce(${stats.averageRating}::numeric, 0)`,
  );
  const ratingCount = desc(sql<number>`coalesce(${stats.ratingCount}, 0)`);
  const pagesAsc = asc(sql<number>`coalesce(${bestEditionField<number | null>("page_count")}, 999999)`);
  const pagesDesc = desc(sql<number>`coalesce(${bestEditionField<number | null>("page_count")}, 0)`);

  switch (sort) {
    case "OLDEST":
      return [oldest, titleAsc];
    case "TITLE_ASC":
      return [titleAsc];
    case "TITLE_DESC":
      return [titleDesc];
    case "POPULAR":
      return [popularity, wanted, newest];
    case "RATING_DESC":
      return [rating, ratingCount, popularity, newest];
    case "PAGES_ASC":
      return [pagesAsc, titleAsc];
    case "PAGES_DESC":
      return [pagesDesc, titleAsc];
    case "NEWEST":
    default:
      return [newest, popularity];
  }
}

function mapOptions(rows: Array<{ name: string | null }>) {
  return rows
    .map((row) => row.name?.trim())
    .filter((value): value is string => Boolean(value))
    .filter((value, index, arr) => arr.indexOf(value) === index);
}

async function getBookArchiveOptions(
  scope: BookArchiveScope = {},
): Promise<BookArchiveFilterOptions> {
  const [authors, genreRows, translators, publishers, countries, catalogLanguages, editionLanguages] =
    await Promise.all([
      scope.fixedAuthor
        ? Promise.resolve([])
        : db
            .select({ name: ReferenceItem.name })
            .from(ReferenceItem)
            .where(
              and(
                eq(ReferenceItem.type, "AUTHOR"),
                eq(ReferenceItem.status, "APPROVED"),
              ),
            )
            .orderBy(ReferenceItem.name)
            .limit(120),
      db
        .select({ name: CatalogBook.genre })
        .from(CatalogBook)
        .where(
          and(
            eq(CatalogBook.status, "APPROVED"),
            scope.fixedAuthor
              ? lowerEquals(CatalogBook.author, scope.fixedAuthor)
              : undefined,
            scope.fixedGenre
              ? genreContains(CatalogBook.genre, scope.fixedGenre)
              : undefined,
            scope.fixedCountry
              ? lowerEquals(CatalogBook.country, scope.fixedCountry)
              : undefined,
            sql`${CatalogBook.genre} is not null`,
          ),
        )
        .orderBy(CatalogBook.genre)
        .limit(250),
      db
        .select({ name: sql<string | null>`distinct ${BookEdition.translator}` })
        .from(BookEdition)
        .innerJoin(CatalogBook, eq(BookEdition.catalogBookId, CatalogBook.id))
        .where(
          and(
            eq(BookEdition.status, "APPROVED"),
            eq(CatalogBook.status, "APPROVED"),
            scope.fixedAuthor
              ? lowerEquals(CatalogBook.author, scope.fixedAuthor)
              : undefined,
            scope.fixedGenre
              ? genreContains(CatalogBook.genre, scope.fixedGenre)
              : undefined,
            scope.fixedCountry
              ? lowerEquals(CatalogBook.country, scope.fixedCountry)
              : undefined,
            scope.fixedTranslator
              ? lowerEquals(BookEdition.translator, scope.fixedTranslator)
              : undefined,
            scope.fixedPublisher
              ? lowerEquals(BookEdition.publisher, scope.fixedPublisher)
              : undefined,
            sql`${BookEdition.translator} is not null`,
          ),
        )
        .orderBy(BookEdition.translator)
        .limit(120),
      db
        .select({ name: sql<string | null>`distinct ${BookEdition.publisher}` })
        .from(BookEdition)
        .innerJoin(CatalogBook, eq(BookEdition.catalogBookId, CatalogBook.id))
        .where(
          and(
            eq(BookEdition.status, "APPROVED"),
            eq(CatalogBook.status, "APPROVED"),
            scope.fixedAuthor
              ? lowerEquals(CatalogBook.author, scope.fixedAuthor)
              : undefined,
            scope.fixedGenre
              ? genreContains(CatalogBook.genre, scope.fixedGenre)
              : undefined,
            scope.fixedCountry
              ? lowerEquals(CatalogBook.country, scope.fixedCountry)
              : undefined,
            scope.fixedTranslator
              ? lowerEquals(BookEdition.translator, scope.fixedTranslator)
              : undefined,
            scope.fixedPublisher
              ? lowerEquals(BookEdition.publisher, scope.fixedPublisher)
              : undefined,
            sql`${BookEdition.publisher} is not null`,
          ),
        )
        .orderBy(BookEdition.publisher)
        .limit(120),
      db
        .select({ name: sql<string | null>`distinct ${CatalogBook.country}` })
        .from(CatalogBook)
        .where(
          and(
            eq(CatalogBook.status, "APPROVED"),
            scope.fixedAuthor
              ? lowerEquals(CatalogBook.author, scope.fixedAuthor)
              : undefined,
            scope.fixedGenre
              ? genreContains(CatalogBook.genre, scope.fixedGenre)
              : undefined,
            scope.fixedCountry
              ? lowerEquals(CatalogBook.country, scope.fixedCountry)
              : undefined,
            sql`${CatalogBook.country} is not null`,
          ),
        )
        .orderBy(CatalogBook.country)
        .limit(80),
      db
        .select({ name: sql<string | null>`distinct ${CatalogBook.language}` })
        .from(CatalogBook)
        .where(
          and(
            eq(CatalogBook.status, "APPROVED"),
            scope.fixedAuthor
              ? lowerEquals(CatalogBook.author, scope.fixedAuthor)
              : undefined,
            scope.fixedGenre
              ? genreContains(CatalogBook.genre, scope.fixedGenre)
              : undefined,
            scope.fixedCountry
              ? lowerEquals(CatalogBook.country, scope.fixedCountry)
              : undefined,
            sql`${CatalogBook.language} is not null`,
          ),
        )
        .orderBy(CatalogBook.language)
        .limit(40),
      db
        .select({ name: sql<string | null>`distinct ${BookEdition.language}` })
        .from(BookEdition)
        .innerJoin(CatalogBook, eq(BookEdition.catalogBookId, CatalogBook.id))
        .where(
          and(
            eq(BookEdition.status, "APPROVED"),
            eq(CatalogBook.status, "APPROVED"),
            scope.fixedAuthor
              ? lowerEquals(CatalogBook.author, scope.fixedAuthor)
              : undefined,
            scope.fixedGenre
              ? genreContains(CatalogBook.genre, scope.fixedGenre)
              : undefined,
            scope.fixedCountry
              ? lowerEquals(CatalogBook.country, scope.fixedCountry)
              : undefined,
            scope.fixedTranslator
              ? lowerEquals(BookEdition.translator, scope.fixedTranslator)
              : undefined,
            scope.fixedPublisher
              ? lowerEquals(BookEdition.publisher, scope.fixedPublisher)
              : undefined,
            sql`${BookEdition.language} is not null`,
          ),
        )
        .orderBy(BookEdition.language)
        .limit(40),
    ]);

  const genres = genreRows
    .flatMap((row) => splitStoredGenres(row.name))
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .sort((a, b) => a.localeCompare(b, "fa"));

  const languages = [...mapOptions(catalogLanguages), ...mapOptions(editionLanguages)]
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .sort((a, b) => a.localeCompare(b, "fa"));

  return {
    authors: mapOptions(authors),
    genres,
    translators: mapOptions(translators),
    publishers: mapOptions(publishers),
    countries: mapOptions(countries),
    languages,
  };
}

export async function getBookArchivePageData(
  searchParams: Record<string, string | string[] | undefined>,
  scope: BookArchiveScope = {},
): Promise<BookArchivePageData> {
  const parsedFilters = parseBookArchiveSearchParams(searchParams);
  const filters: BookArchiveFilters = {
    ...parsedFilters,
    genre: scope.fixedGenre ? "" : parsedFilters.genre,
    author: scope.fixedAuthor ? "" : parsedFilters.author,
    publisher: scope.fixedPublisher ? "" : parsedFilters.publisher,
    translator: scope.fixedTranslator ? "" : parsedFilters.translator,
    country: scope.fixedCountry ? "" : parsedFilters.country,
  };
  const conditions = buildCatalogConditions(filters, scope);
  const stats = buildStatsJoin();

  const [options, countRows] = await Promise.all([
    getBookArchiveOptions(scope),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(CatalogBook)
      .where(and(...conditions)),
  ]);

  const totalCount = countRows[0]?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / BOOK_ARCHIVE_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const offset = (page - 1) * BOOK_ARCHIVE_PAGE_SIZE;

  const rows = totalCount === 0
    ? []
    : await db
      .select({
        id: CatalogBook.id,
        slug: CatalogBook.slug,
        title: sql<string>`coalesce(
          nullif(trim(${presentationEditionField<string | null>("title_override", scope)}), ''),
          ${CatalogBook.title}
        )`,
        originalTitle: CatalogBook.originalTitle,
        author: CatalogBook.author,
        genre: CatalogBook.genre,
        country: CatalogBook.country,
        description: CatalogBook.description,
        language: sql<string | null>`coalesce(
          ${presentationEditionField<string | null>("language", scope)},
          ${CatalogBook.language}
        )`,
        translator: presentationEditionField<string | null>("translator", scope),
        publisher: presentationEditionField<string | null>("publisher", scope),
        coverImage: sql<string | null>`coalesce(
          ${presentationEditionField<string | null>("cover_image", scope)},
          ${CatalogBook.coverImage}
        )`,
        publishedYear: presentationEditionField<number | null>("published_year", scope),
        pageCount: presentationEditionField<number | null>("page_count", scope),
        editionId: scope.fixedTranslator || scope.fixedPublisher
          ? presentationEditionField<string | null>("id", scope)
          : sql<string | null>`null`,
        editionLabel: presentationEditionField<string | null>("edition_label", scope),
        popularityCount: sql<number>`coalesce(${stats.popularityCount}, 0)`,
        wantedCount: sql<number>`coalesce(${stats.wantedCount}, 0)`,
        ratingCount: sql<number>`coalesce(${stats.ratingCount}, 0)`,
        averageRating: sql<string | null>`${stats.averageRating}`,
      })
      .from(CatalogBook)
      .leftJoin(stats, eq(stats.catalogBookId, CatalogBook.id))
      .where(and(...conditions))
      .orderBy(...sortOrder(filters.sort, stats))
      .limit(BOOK_ARCHIVE_PAGE_SIZE)
      .offset(offset);
  const normalizedRows = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      slug: await ensureCatalogBookSlug({
        id: row.id,
        title: row.title,
        slug: row.slug,
      }),
      coverImage: coalesceCoverImage(row.coverImage),
    }))
  );

  return {
    filters: { ...filters, page },
    options,
    archive: {
      items: normalizedRows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        originalTitle: row.originalTitle,
        author: row.author,
        genre: row.genre,
        country: row.country,
        description: row.description,
        language: row.language,
        translator: row.translator,
        publisher: row.publisher,
        coverImage: row.coverImage,
        publishedYear: row.publishedYear,
        pageCount: row.pageCount,
        editionId: row.editionId,
        editionLabel: row.editionLabel,
        displayEdition: row.editionId
          ? {
              id: row.editionId,
              // The scoped SQL already resolves title_override ?? catalog title.
              titleOverride: row.title,
              coverImage: row.coverImage,
              translator: row.translator,
              publisher: row.publisher,
              editionLabel: row.editionLabel,
              language: row.language,
              publishedYear: row.publishedYear,
              pageCount: row.pageCount,
            }
          : null,
        popularityCount: row.popularityCount,
        wantedCount: row.wantedCount,
        ratingCount: row.ratingCount,
        averageRating:
          row.averageRating === null ? null : Number.parseFloat(row.averageRating),
      })),
      totalCount,
      page,
      pageSize: BOOK_ARCHIVE_PAGE_SIZE,
      pageCount,
    },
  };
}

export async function getBookArchiveScopeCount(
  scope: BookArchiveScope = {},
): Promise<number> {
  const conditions = buildCatalogConditions(
    {
      q: "",
      genre: "",
      author: "",
      translator: "",
      publisher: "",
      country: "",
      language: "",
      hasCover: "any",
      minPages: null,
      maxPages: null,
      minRating: null,
      maxRating: null,
      minYear: null,
      maxYear: null,
      sort: "NEWEST",
      page: 1,
    },
    scope,
  );

  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(CatalogBook)
    .where(and(...conditions));

  return rows[0]?.count ?? 0;
}
