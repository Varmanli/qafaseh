import { inArray } from "drizzle-orm";
import { db, pool, databaseDiagnosticTarget } from "../db";
import { CatalogBook, ReadingList, ReadingListItem, ReadingListRelated } from "../db/schema";
import { readingLists } from "../lib/book/reading-lists-config";

async function main() {
  const slugs = [...new Set(readingLists.flatMap((list) => list.items.map((item) => item.bookSlug)))];
  const books = await db.select({ id: CatalogBook.id, slug: CatalogBook.slug, status: CatalogBook.status })
    .from(CatalogBook).where(inArray(CatalogBook.slug, slugs));
  const bySlug = new Map(books.map((book) => [book.slug, book]));
  const missing = slugs.filter((slug) => !bySlug.has(slug));
  if (missing.length) throw new Error(`Import stopped: missing canonical CatalogBook slugs: ${missing.join(", ")}`);

  const inserted = await db.transaction(async (tx) => {
    const added = new Set<string>();
    for (const source of readingLists) {
      const publicCount = source.items.filter((item) => bySlug.get(item.bookSlug)?.status === "APPROVED").length;
      const [list] = await tx.insert(ReadingList).values({
        title: source.title, slug: source.slug, description: source.description,
        audience: source.audience, category: source.category, hubGroup: source.hubGroup,
        mode: "ORDERED", status: publicCount ? "PUBLISHED" : "DRAFT",
        publishedAt: publicCount ? new Date() : null, featured: false,
      }).onConflictDoNothing({ target: ReadingList.slug })
        .returning({ id: ReadingList.id, slug: ReadingList.slug });
      if (!list) continue; // Existing Admin edits are never overwritten by a repeat import.
      added.add(list.slug);
      await tx.insert(ReadingListItem).values(source.items.map((item, index) => ({
        listId: list.id, bookId: bySlug.get(item.bookSlug)!.id,
        position: index + 1, note: item.note,
        difficulty: item.difficulty?.toUpperCase() as "EASY" | "MEDIUM" | "HARD" | undefined,
      })));
    }
    const lists = await tx.select({ id: ReadingList.id, slug: ReadingList.slug })
      .from(ReadingList).where(inArray(ReadingList.slug, readingLists.map((list) => list.slug)));
    const ids = new Map(lists.map((list) => [list.slug, list.id]));
    for (const source of readingLists.filter((list) => added.has(list.slug))) {
      const sourceListId = ids.get(source.slug)!;
      if (source.relatedLists.length) await tx.insert(ReadingListRelated).values(source.relatedLists.map((slug, index) => ({
        sourceListId, relatedListId: ids.get(slug)!, position: index + 1,
      })));
    }
    return added.size;
  });
  console.log(`Reading-list import on ${databaseDiagnosticTarget()}: ${inserted} inserted; ${readingLists.length} configured slugs present.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
