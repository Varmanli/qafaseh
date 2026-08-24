import { asc, eq } from "drizzle-orm";

import { db, pool } from "@/db";
import { CatalogBook, ReferenceItem } from "@/db/schema";
import { slugify } from "@/lib/book/slug";

const apply = process.argv.includes("--apply");

function uniqueSlug(base: string, taken: Set<string>, fallback: string) {
  const safeBase = base || `item-${fallback.slice(0, 8)}`;
  for (let index = 1; index < 10000; index += 1) {
    const candidate = index === 1 ? safeBase : `${safeBase}-${index}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${safeBase}-${fallback}`;
}

async function main() {
  const [books, references] = await Promise.all([
    db.select().from(CatalogBook).orderBy(asc(CatalogBook.createdAt)),
    db.select().from(ReferenceItem).orderBy(asc(ReferenceItem.createdAt)),
  ]);

  const bookTaken = new Set(books.map((book) => book.slug).filter((slug): slug is string => Boolean(slug?.trim())));
  const referenceTaken = new Map<string, Set<string>>();
  for (const reference of references) {
    if (!reference.slug?.trim()) continue;
    const taken = referenceTaken.get(reference.type) ?? new Set<string>();
    taken.add(reference.slug);
    referenceTaken.set(reference.type, taken);
  }

  let bookUpdates = 0;
  let referenceUpdates = 0;
  for (const book of books) {
    const slug = book.slug?.trim() || uniqueSlug(slugify(book.title), bookTaken, book.id);
    bookTaken.add(slug);
    const slugNormalized = slugify(slug);
    if (book.slug === slug && book.slugNormalized === slugNormalized) continue;
    bookUpdates += 1;
    if (apply) {
      await db.update(CatalogBook).set({ slug, slugNormalized, updatedAt: new Date() }).where(eq(CatalogBook.id, book.id));
    }
  }

  for (const reference of references) {
    const taken = referenceTaken.get(reference.type) ?? new Set<string>();
    const slug = reference.slug?.trim() || uniqueSlug(slugify(reference.name), taken, reference.id);
    taken.add(slug);
    referenceTaken.set(reference.type, taken);
    const slugNormalized = slugify(slug);
    if (reference.slug === slug && reference.slugNormalized === slugNormalized) continue;
    referenceUpdates += 1;
    if (apply) {
      await db.update(ReferenceItem).set({ slug, slugNormalized, updatedAt: new Date() }).where(eq(ReferenceItem.id, reference.id));
    }
  }

  console.log(JSON.stringify({ mode: apply ? "applied" : "dry-run", bookUpdates, referenceUpdates }));
  if (!apply && bookUpdates + referenceUpdates > 0) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => pool.end());
