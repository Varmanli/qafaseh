import { and, asc, eq, ilike, sql } from "drizzle-orm";

import { db } from "@/db";
import { Book, ReferenceItem } from "@/db/schema";
import { searchPublicBooks } from "@/lib/book/search-service";

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
  translators: GlobalSearchReference[];
  publishers: GlobalSearchReference[];
}

const REFERENCE_FIELD_BY_TYPE = {
  AUTHOR: Book.author,
  TRANSLATOR: Book.translator,
  PUBLISHER: Book.publisher,
} as const;

type SearchableReferenceType = keyof typeof REFERENCE_FIELD_BY_TYPE;

function referenceBookCount(type: SearchableReferenceType) {
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
  const term = `%${query}%`;
  const prefix = `${query}%`;

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
        eq(ReferenceItem.type, type),
        eq(ReferenceItem.status, "APPROVED"),
        sql`${ReferenceItem.slug} is not null`,
        ilike(ReferenceItem.name, term),
      ),
    )
    .orderBy(
      sql`case when lower(${ReferenceItem.name}) like lower(${prefix}) then 0 else 1 end`,
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
      translators: [],
      publishers: [],
    };
  }

  const [books, authors, translators, publishers] = await Promise.all([
    searchBooks(query, safeLimit),
    searchReferences("AUTHOR", query, safeLimit),
    searchReferences("TRANSLATOR", query, safeLimit),
    searchReferences("PUBLISHER", query, safeLimit),
  ]);

  return {
    books,
    authors,
    translators,
    publishers,
  };
}
