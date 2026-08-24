import { eq, like, or } from "drizzle-orm";

import { db } from "@/db";
import { Book, CatalogBook } from "@/db/schema";
import { slugify } from "@/lib/book/slug";

const UUID_SUFFIX_RE =
  /--([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

function buildSlugCandidate(base: string, index: number) {
  return index === 1 ? base : `${base}-${index}`;
}

async function generateUniqueSlug(
  rows: Array<{ slug: string | null }>,
  title: string,
  fallback: string,
) {
  const base = slugify(title) || slugify(fallback) || "book";
  const taken = new Set(
    rows.map((row) => row.slug?.trim()).filter((slug): slug is string => Boolean(slug)),
  );

  for (let index = 1; index < 10000; index += 1) {
    const candidate = buildSlugCandidate(base, index);
    if (!taken.has(candidate)) return candidate;
  }

  return `${base}-${fallback.slice(0, 6)}`;
}

export async function generateUniqueBookSlug(
  title: string,
  fallbackId: string,
): Promise<string> {
  const base = slugify(title) || `book-${fallbackId.slice(0, 6)}`;
  const rows = await db
    .select({ slug: Book.slug })
    .from(Book)
    .where(or(eq(Book.slug, base), like(Book.slug, `${base}-%`)));

  return generateUniqueSlug(rows, title, fallbackId);
}

export async function generateUniqueCatalogBookSlug(
  title: string,
  fallbackId: string,
  currentId?: string,
): Promise<string> {
  const base = slugify(title) || `book-${fallbackId.slice(0, 6)}`;
  const rows = await db
    .select({ id: CatalogBook.id, slug: CatalogBook.slug })
    .from(CatalogBook)
    .where(
      or(eq(CatalogBook.slug, base), like(CatalogBook.slug, `${base}-%`)),
    );

  return generateUniqueSlug(
    rows.filter((row) => row.id !== currentId).map((row) => ({ slug: row.slug })),
    title,
    fallbackId,
  );
}

export async function ensureBookSlug(book: {
  id: string;
  title: string;
  slug: string | null;
}): Promise<string> {
  if (book.slug?.trim()) return book.slug.trim();

  const slug = await generateUniqueBookSlug(book.title, book.id);
  await db.update(Book).set({ slug }).where(eq(Book.id, book.id));
  return slug;
}

export async function ensureCatalogBookSlug(book: {
  id: string;
  title: string;
  slug: string | null;
}): Promise<string> {
  if (book.slug?.trim()) return book.slug.trim();

  const slug = await generateUniqueCatalogBookSlug(book.title, book.id, book.id);
  await db
    .update(CatalogBook)
    .set({ slug, slugNormalized: slugify(slug) })
    .where(eq(CatalogBook.id, book.id));
  return slug;
}

export function isLegacyCatalogSlug(ref: string): boolean {
  return UUID_SUFFIX_RE.test(ref);
}

export function extractCatalogBookIdFromSlug(ref: string): string | null {
  const match = ref.match(UUID_SUFFIX_RE);
  return match?.[1] ?? null;
}
