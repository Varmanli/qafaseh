import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

test("database-backed list workflow and imported paths", { skip: !process.env.DATABASE_URL }, async (t) => {
  const { db, pool } = await import("../../db");
  const { CatalogBook, ReadingList, ReadingListItem, ReadingListRelated } = await import("../../db/schema");
  const { and, eq, inArray } = await import("drizzle-orm");
  const { readingLists } = await import("./reading-lists-config");
  const { getReadingListBySlug, getReadingListsOverview } = await import("./reading-lists-service");
  const { deleteReadingList, getAdminReadingList, saveReadingList, setReadingListStatus } = await import("../admin/reading-lists");
  const { publicCatalogBookCondition } = await import("./discover-service");
  const books = await db.select({ id: CatalogBook.id }).from(CatalogBook).where(publicCatalogBookCondition).limit(2);
  assert.equal(books.length, 2, "integration database needs two public books");
  const privateId = randomUUID();
  const suffix = randomUUID().slice(0, 8);
  const created: string[] = [];
  const orderedSlug = `codex-ordered-${suffix}`;
  const unorderedSlug = `codex-unordered-${suffix}`;
  const input = (slug: string, mode: "ORDERED" | "UNORDERED", status: "DRAFT" | "PUBLISHED") => ({
    title: slug, slug, description: "Test editorial list", audience: null,
    category: "Test", hubGroup: "Test", mode, status, featured: false,
    seoTitle: null, seoDescription: null, relatedListIds: [] as string[],
    items: [
      { bookId: books[1].id, note: "Second first", difficulty: "EASY" as const },
      { bookId: books[0].id, note: "First second", difficulty: null },
    ],
  });

  try {
    await db.insert(CatalogBook).values({ id: privateId, title: "Private list check", author: "Test", slug: `private-list-check-${suffix}`, status: "PENDING" });

    await t.test("all eight imported slugs, notes, order, and directed edges survive", async () => {
      const imported = await db.select({ id: ReadingList.id, slug: ReadingList.slug }).from(ReadingList)
        .where(inArray(ReadingList.slug, readingLists.map((list) => list.slug)));
      assert.equal(imported.length, readingLists.length);
      for (const source of readingLists) {
        const list = imported.find((row) => row.slug === source.slug)!;
        const rows = await db.select({ note: ReadingListItem.note, position: ReadingListItem.position, slug: CatalogBook.slug })
          .from(ReadingListItem).innerJoin(CatalogBook, eq(ReadingListItem.bookId, CatalogBook.id))
          .where(eq(ReadingListItem.listId, list.id)).orderBy(ReadingListItem.position);
        assert.deepEqual(rows.map((row) => [row.slug, row.note, row.position]), source.items.map((item, index) => [item.bookSlug, item.note, index + 1]));
        const related = await db.select({ slug: ReadingList.slug }).from(ReadingListRelated)
          .innerJoin(ReadingList, eq(ReadingListRelated.relatedListId, ReadingList.id))
          .where(eq(ReadingListRelated.sourceListId, list.id)).orderBy(ReadingListRelated.position);
        assert.deepEqual(related.map((row) => row.slug), source.relatedLists);
      }
    });

    const ordered = await saveReadingList(input(orderedSlug, "ORDERED", "DRAFT"));
    created.push(ordered.id);
    await t.test("ordered draft is editable, ordered, and not public", async () => {
      const admin = await getAdminReadingList(ordered.id);
      assert.deepEqual(admin?.items.map((item) => [item.bookId, item.position, item.note]), [[books[1].id, 1, "Second first"], [books[0].id, 2, "First second"]]);
      assert.equal(await getReadingListBySlug(orderedSlug), null);
      assert.equal((await getReadingListsOverview()).some((list) => list.slug === orderedSlug), false);
    });
    await t.test("duplicate slug and self-related edge are rejected", async () => {
      await assert.rejects(saveReadingList(input(orderedSlug, "UNORDERED", "DRAFT")), /اسلاگ/);
      await assert.rejects(saveReadingList({ ...input(orderedSlug, "ORDERED", "DRAFT"), relatedListIds: [ordered.id] }, ordered.id), /خودش/);
    });
    await t.test("duplicate books, missing related lists, and empty publication are rejected", async () => {
      const duplicate = input(`codex-duplicate-${suffix}`, "ORDERED", "DRAFT");
      duplicate.items = [duplicate.items[0], duplicate.items[0]];
      await assert.rejects(saveReadingList(duplicate));
      await assert.rejects(saveReadingList({ ...input(`codex-related-${suffix}`, "ORDERED", "DRAFT"), relatedListIds: [randomUUID()] }), /مرتبط/);
      await assert.rejects(saveReadingList({ ...input(`codex-empty-${suffix}`, "ORDERED", "PUBLISHED"), items: [] }), /حداقل یک کتاب عمومی/);
      await assert.rejects(saveReadingList({ ...input(`codex-private-${suffix}`, "ORDERED", "PUBLISHED"), items: [{ bookId: privateId, note: null, difficulty: null }] }), /حداقل یک کتاب عمومی/);
    });
    await t.test("hub previews stay bounded while public counts reflect all valid books", async () => {
      const preview = (await getReadingListsOverview()).find((list) => list.slug === "enter-fantasy-worlds");
      assert.ok(preview);
      assert.equal(preview.bookCount, 4);
      assert.equal(preview.previewBooks.length, 3);
    });

    const unordered = await saveReadingList(input(unorderedSlug, "UNORDERED", "PUBLISHED"));
    created.push(unordered.id);
    await t.test("unordered collection publishes in display order without public difficulty", async () => {
      const publicList = await getReadingListBySlug(unorderedSlug);
      assert.equal(publicList?.mode, "UNORDERED");
      assert.deepEqual(publicList?.items.map((item) => item.book.id), [books[1].id, books[0].id]);
      assert.equal(publicList?.items[0].difficulty, null);
      assert.equal("position" in (publicList?.items[0] ?? {}), false);
    });

    await t.test("reorder normalizes positions, private books are hidden, directed related list is public", async () => {
      const payload = input(orderedSlug, "ORDERED", "PUBLISHED");
      payload.items = [payload.items[1], payload.items[0], { bookId: privateId, note: "Private", difficulty: null }];
      payload.relatedListIds = [unordered.id];
      await saveReadingList(payload, ordered.id);
      const admin = await getAdminReadingList(ordered.id);
      assert.deepEqual(admin?.items.map((item) => item.position), [1, 2, 3]);
      const publicList = await getReadingListBySlug(orderedSlug);
      assert.deepEqual(publicList?.items.map((item) => item.book.id), [books[0].id, books[1].id]);
      assert.deepEqual(publicList?.relatedLists.map((list) => list.id), [unordered.id]);
      assert.deepEqual((await getReadingListBySlug(unorderedSlug))?.relatedLists, []);
      assert.equal((await getReadingListsOverview()).find((list) => list.slug === orderedSlug)?.bookCount, 2);
    });

    await t.test("unpublished related list disappears, then returns when republished", async () => {
      await setReadingListStatus(unordered.id, "DRAFT");
      assert.deepEqual((await getReadingListBySlug(orderedSlug))?.relatedLists, []);
      await setReadingListStatus(unordered.id, "PUBLISHED");
      assert.deepEqual((await getReadingListBySlug(orderedSlug))?.relatedLists.map((list) => list.id), [unordered.id]);
    });

    await t.test("deleting list cascades items and incoming/outgoing edges without deleting books", async () => {
      await deleteReadingList(unordered.id);
      created.splice(created.indexOf(unordered.id), 1);
      const edges = await db.select().from(ReadingListRelated).where(eq(ReadingListRelated.sourceListId, ordered.id));
      assert.equal(edges.length, 0);
      assert.equal((await db.select().from(CatalogBook).where(eq(CatalogBook.id, books[0].id))).length, 1);
      await deleteReadingList(ordered.id);
      created.splice(created.indexOf(ordered.id), 1);
      assert.equal((await db.select().from(ReadingListItem).where(eq(ReadingListItem.listId, ordered.id))).length, 0);
    });
  } finally {
    for (const id of created) await db.delete(ReadingList).where(eq(ReadingList.id, id));
    await db.delete(CatalogBook).where(eq(CatalogBook.id, privateId));
    await pool.end();
  }
});
