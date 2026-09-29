import { and, arrayContains, asc, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { BlogCategory, BlogPost, Book, ReferenceItem, User } from "@/db/schema";
import { searchPublicBooks } from "@/lib/book/search-service";
import { normalizeSearchText } from "@/lib/book/search-normalize";
import { publicPersonBookRoles } from "@/lib/reference/book-contributions";
import { searchPublicUsers, type PublicUserSearchResult } from "@/lib/search/user-search";

export interface GlobalSearchBook {
  id: string;
  slug: string;
  title: string;
  author: string;
  coverImage: string | null;
  translator: string | null;
  publisher: string | null;
  matchedEditionId: string | null;
  matchedEditionLabel: string | null;
}

export interface GlobalSearchReference {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  bookCount?: number;
}

export interface GlobalSearchResponse {
  books: GlobalSearchBook[];
  authors: GlobalSearchReference[];
  publishers: GlobalSearchReference[];
  magazine: GlobalSearchMagazine[];
  users: PublicUserSearchResult[];
  hasMore: { books: boolean; authors: boolean; publishers: boolean; magazine: boolean; users: boolean };
}

export interface GlobalSearchMagazine {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
}

const REFERENCE_FIELD_BY_TYPE = {
  AUTHOR: Book.author,
  PUBLISHER: Book.publisher,
} as const;

type SearchableReferenceType = keyof typeof REFERENCE_FIELD_BY_TYPE;

function referenceBookCount(type: SearchableReferenceType) {
  if (type !== "PUBLISHER") return sql<number>`(
    select count(distinct person_books.catalog_book_id)::int
    from (${publicPersonBookRoles}) person_books
    where person_books.reference_item_id = ${ReferenceItem.id}
  )`;
  const field = REFERENCE_FIELD_BY_TYPE[type];
  return sql<number>`(
    select count(distinct coalesce(${Book.catalogBookId}, ${Book.id}))::int
    from "Book" b
    where lower(b.${sql.raw(field.name)}) = lower(${ReferenceItem.name})
  )`;
}

async function searchReferences(
  type: SearchableReferenceType,
  query: string,
  limit: number,
): Promise<GlobalSearchReference[]> {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  const name = sql`qafaseh_search_normalize(${ReferenceItem.name})`;

  const rows = await db
    .select({
      id: ReferenceItem.id,
      name: ReferenceItem.name,
      slug: ReferenceItem.slug,
      image: ReferenceItem.coverImage,
      bookCount: referenceBookCount(type),
    })
    .from(ReferenceItem)
    .where(
      and(
        type === "AUTHOR"
          ? arrayContains(ReferenceItem.roles, [type])
          : eq(ReferenceItem.type, type),
        isNull(ReferenceItem.canonicalReferenceId),
        eq(ReferenceItem.status, "APPROVED"),
        sql`${ReferenceItem.slug} is not null`,
        sql`strpos(${name}, ${normalized}) > 0`,
      ),
    )
    .orderBy(
      sql`case when ${name} = ${normalized} then 0 when strpos(${name}, ${normalized}) = 1 then 1 else 2 end`,
      asc(ReferenceItem.name),
    )
    .limit(limit);

  return rows
    .filter((row): row is typeof row & { slug: string } => Boolean(row.slug))
    .map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      image: row.image,
      ...(type === "AUTHOR" ? { bookCount: row.bookCount ?? 0 } : {}),
    }));
}

async function searchBooks(query: string, limit: number): Promise<GlobalSearchBook[]> {
  return searchPublicBooks(query, limit);
}

async function searchMagazine(query: string, limit: number): Promise<GlobalSearchMagazine[]> {
  const escapedQuery = query.replace(/[\\%_]/g, "\\$&");
  const term = `%${escapedQuery}%`;
  const prefix = `${escapedQuery}%`;
  return db.select({ id: BlogPost.id, slug: BlogPost.slug, title: BlogPost.title, excerpt: BlogPost.excerpt })
    .from(BlogPost)
    .leftJoin(User, eq(BlogPost.createdById, User.id))
    .leftJoin(BlogCategory, eq(BlogPost.categoryId, BlogCategory.id))
    .where(and(
      eq(BlogPost.status, "PUBLISHED"),
      isNotNull(BlogPost.publishedAt),
      or(
        ilike(BlogPost.title, term), ilike(BlogPost.excerpt, term), ilike(BlogPost.content, term),
        ilike(User.name, term), ilike(BlogCategory.name, term),
        sql`exists (select 1 from "BlogPostBook" article_book inner join "CatalogBook" book on book.id = article_book.book_id where article_book.post_id = ${BlogPost.id} and (book.title ilike ${term} or book.author ilike ${term}))`,
      ),
    ))
    .orderBy(
      sql`case when lower(trim(${BlogPost.title})) = lower(${query}) then 0 when ${BlogPost.title} ilike ${prefix} then 1 when ${BlogPost.title} ilike ${term} then 2 when ${BlogPost.excerpt} ilike ${term} then 3 else 4 end`,
      desc(BlogPost.publishedAt), desc(BlogPost.id),
    )
    .limit(limit);
}

export async function searchGlobal(
  rawQuery: string,
  { limitPerGroup = 4 }: { limitPerGroup?: number } = {},
): Promise<GlobalSearchResponse> {
  const query = rawQuery.trim();
  const safeLimit = Math.max(1, Math.min(5, Math.trunc(limitPerGroup)));

  if (query.length === 0) {
    return {
      books: [],
      authors: [],
      publishers: [],
      magazine: [],
      users: [],
      hasMore: { books: false, authors: false, publishers: false, magazine: false, users: false },
    };
  }

  const [books, authors, publishers, magazine, users] = await Promise.all([
    searchBooks(query, safeLimit + 1),
    searchReferences("AUTHOR", query, safeLimit + 1),
    searchReferences("PUBLISHER", query, safeLimit + 1),
    searchMagazine(query, safeLimit + 1),
    searchPublicUsers(query, safeLimit + 1),
  ]);

  return {
    books: books.slice(0, safeLimit),
    authors: authors.slice(0, safeLimit),
    publishers: publishers.slice(0, safeLimit),
    magazine: magazine.slice(0, safeLimit),
    users: users.slice(0, safeLimit),
    hasMore: { books: books.length > safeLimit, authors: authors.length > safeLimit, publishers: publishers.length > safeLimit, magazine: magazine.length > safeLimit, users: users.length > safeLimit },
  };
}
