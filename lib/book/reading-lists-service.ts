import { and, eq, inArray, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { CatalogBook, ReadingList, ReadingListItem, ReadingListRelated } from "@/db/schema";
import { publicCatalogBookCondition } from "@/lib/book/discover-service";
import { displayCoverFieldSql } from "@/lib/book/display-cover";

export type PublicListBook = {
  id: string;
  slug: string | null;
  title: string;
  author: string;
  coverImage: string | null;
};

export type ReadingListPreview = {
  slug: string;
  title: string;
  description: string;
  category: string;
  hubGroup: string;
  mode: "ORDERED" | "UNORDERED";
  featured: boolean;
  bookCount: number;
  previewBooks: Pick<PublicListBook, "id" | "title" | "coverImage">[];
};

type ListItemRow = PublicListBook & {
  listId: string;
  position: number;
  note: string | null;
  difficulty: "EASY" | "MEDIUM" | "HARD" | null;
};

const publicBookFields = {
  id: CatalogBook.id,
  slug: CatalogBook.slug,
  title: CatalogBook.title,
  author: CatalogBook.author,
  coverImage: displayCoverFieldSql(),
};

export function selectPublicListItems(rows: ListItemRow[]) {
  const seen = new Set<string>();
  return [...rows].sort((a, b) => a.position - b.position).filter((row) => {
    if (!row.slug || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  }).map(({ listId, position, note, difficulty, ...book }) => ({
    book: book as PublicListBook & { slug: string }, note, difficulty,
  }));
}

async function loadPublicItems(listIds: string[]) {
  if (!listIds.length) return [];
  return db.select({
    ...publicBookFields,
    listId: ReadingListItem.listId,
    position: ReadingListItem.position,
    note: ReadingListItem.note,
    difficulty: ReadingListItem.difficulty,
  }).from(ReadingListItem)
    .innerJoin(CatalogBook, eq(ReadingListItem.bookId, CatalogBook.id))
    .where(and(inArray(ReadingListItem.listId, listIds), publicCatalogBookCondition))
    .orderBy(ReadingListItem.listId, ReadingListItem.position);
}

export async function getReadingListsOverview(): Promise<ReadingListPreview[]> {
  // ponytail: 200 published lists per hub; add pagination when editorial volume reaches that ceiling.
  const lists = await db.select().from(ReadingList)
    .where(eq(ReadingList.status, "PUBLISHED"))
    .orderBy(sql`${ReadingList.featured} desc`, ReadingList.createdAt)
    .limit(200);
  if (!lists.length) return [];
  const ranked = db.select({
    listId: ReadingListItem.listId,
    id: CatalogBook.id,
    title: CatalogBook.title,
    coverImage: displayCoverFieldSql().as("cover_image"),
    bookCount: sql<number>`(count(*) over (partition by ${ReadingListItem.listId}))::int`.as("book_count"),
    rank: sql<number>`row_number() over (partition by ${ReadingListItem.listId} order by ${ReadingListItem.position})`.as("preview_rank"),
  }).from(ReadingListItem).innerJoin(CatalogBook, eq(ReadingListItem.bookId, CatalogBook.id))
    .where(and(inArray(ReadingListItem.listId, lists.map((list) => list.id)), publicCatalogBookCondition))
    .as("ranked_list_books");
  const rows = await db.select().from(ranked).where(lte(ranked.rank, 3))
    .orderBy(ranked.listId, ranked.rank);
  const byList = new Map<string, typeof rows>();
  for (const row of rows) byList.set(row.listId, [...(byList.get(row.listId) ?? []), row]);
  return lists.flatMap((list) => {
    const previews = byList.get(list.id) ?? [];
    if (!previews.length) return [];
    return [{
      slug: list.slug, title: list.title, description: list.description,
      category: list.category, hubGroup: list.hubGroup, mode: list.mode,
      featured: list.featured, bookCount: previews[0].bookCount,
      previewBooks: previews.map((book) => ({
        id: book.id, title: book.title, coverImage: book.coverImage,
      })),
    }];
  });
}

export async function getReadingListBySlug(slug: string) {
  const [list] = await db.select().from(ReadingList)
    .where(and(eq(ReadingList.slug, slug), eq(ReadingList.status, "PUBLISHED"))).limit(1);
  if (!list) return null;
  const resolved = selectPublicListItems(await loadPublicItems([list.id]));
  const items = list.mode === "ORDERED" ? resolved : resolved.map((item) => ({ ...item, difficulty: null }));
  if (!items.length) return null;

  const edges = await db.select({ list: ReadingList }).from(ReadingListRelated)
    .innerJoin(ReadingList, eq(ReadingListRelated.relatedListId, ReadingList.id))
    .where(and(eq(ReadingListRelated.sourceListId, list.id), eq(ReadingList.status, "PUBLISHED")))
    .orderBy(ReadingListRelated.position).limit(20);
  const relatedItems = await loadPublicItems(edges.map(({ list: related }) => related.id));
  const validRelatedIds = new Set(relatedItems.map((item) => item.listId));
  const relatedLists = edges.filter(({ list: related }) => validRelatedIds.has(related.id))
    .map(({ list: related }) => related).slice(0, 4);
  return { ...list, items, relatedLists };
}

export async function getDiscoverReadingPaths() {
  return (await getReadingListsOverview()).filter((list) => list.mode === "ORDERED");
}
