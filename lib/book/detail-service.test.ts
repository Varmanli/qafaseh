import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

test("book loading preserves editions, privacy, ratings, likes and pagination", {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const { db, pool } = await import("@/db");
  const { eq, inArray } = await import("drizzle-orm");
  const { User, CatalogBook, BookEdition, Book, Quote, QuoteLike, PublishedBookNote,
    PublishedBookNoteLike } = await import("@/db/schema");
  const { getBookMetadata, getBookOverview, getBookCommunity, getBookDetail,
    getBookQuotesPage } = await import("./detail-service");
  const catalogId = randomUUID();
  const slug = `detail-regression-${catalogId}`;
  const userIds = Array.from({ length: 3 }, () => randomUUID());
  const editionIds = Array.from({ length: 2 }, () => randomUUID());
  const bookIds = Array.from({ length: 4 }, () => randomUUID());
  const quoteIds = Array.from({ length: 18 }, () => randomUUID());
  const noteIds = Array.from({ length: 8 }, () => randomUUID());
  const date = (index: number) => new Date(Date.UTC(2026, 0, 1, 0, index));
  try {
    await db.insert(User).values(userIds.map((id, index) => ({
      id, name: "Detail regression", profileVisibility: index === 0 ? "PUBLIC" as const : "PRIVATE" as const,
    })));
    await db.insert(CatalogBook).values({ id: catalogId, slug, title: "[TEST:detail]",
      author: "Test author", status: "APPROVED" });
    await db.insert(BookEdition).values(editionIds.map((id, index) => ({
      id, catalogBookId: catalogId, status: "APPROVED" as const,
      coverImage: `/test-cover-${index}.webp`, pageCount: 100 + index,
    })));
    await db.update(CatalogBook).set({ primaryEditionId: editionIds[0] }).where(eq(CatalogBook.id, catalogId));
    await db.insert(Book).values(bookIds.map((id, index) => ({
      id, catalogBookId: catalogId, userId: userIds[index === 3 ? 2 : index === 0 ? 0 : 1],
      editionId: editionIds[index === 2 ? 1 : 0], title: "[TEST:detail]", author: "Test author",
      genre: "Test", format: "PHYSICAL" as const,
      status: index === 0 ? "FINISHED" as const : index === 3 ? "UNREAD" as const : "READING" as const,
      rating: index === 0 ? 8 : index === 1 ? 6 : null,
      review: index === 2 ? "Private reading note" : null,
      moodTags: index < 3 ? ["alpha", index === 0 ? "beta" : "gamma"] : null,
    })));
    await db.insert(Quote).values(quoteIds.map((id, index) => ({
      id, bookId: bookIds[index < 16 ? 0 : index === 16 ? 1 : 3],
      userId: userIds[index < 16 ? 0 : index === 16 ? 1 : 2],
      content: `Quote ${index}`, createdAt: date(index),
    })));
    await db.insert(QuoteLike).values({ quoteId: quoteIds[15], userId: userIds[1] });
    await db.insert(PublishedBookNote).values(noteIds.map((id, index) => ({
      id, catalogBookId: catalogId, bookId: bookIds[index < 6 ? 0 : index === 6 ? 1 : 3],
      userId: userIds[index < 6 ? 0 : index === 6 ? 1 : 2],
      scope: index === 5 ? "edition" as const : "book" as const,
      bookEditionId: index === 5 ? editionIds[1] : null,
      content: `<p>Note ${index}</p>`, createdAt: date(index),
    })));
    await db.insert(PublishedBookNoteLike).values({ noteId: noteIds[4], userId: userIds[1] });

    const metadata = await getBookMetadata(slug);
    assert.equal(metadata?.displayCoverImage, "/test-cover-0.webp");
    const overview = await getBookOverview(slug, userIds[1], editionIds[1]);
    assert(overview.found);
    assert.equal(overview.selectedEdition?.id, editionIds[1]);
    assert.equal(overview.book.displayCoverImage, "/test-cover-1.webp");
    assert.equal(overview.viewer?.id, bookIds[2]);
    assert.equal(overview.viewer?.privateNote, "Private reading note");
    assert.deepEqual(overview.stats, { wantToReadCount: 1, readingCount: 2,
      finishedCount: 1, averageRating: 7, ratingCount: 2 });
    assert.deepEqual(overview.topMoods, ["alpha", "gamma", "beta"]);
    assert(!("quotes" in overview));
    assert(!("bookNotes" in overview));

    const guest = await getBookCommunity(overview.book, undefined, editionIds[1]);
    assert.equal(guest.quoteCount, 16);
    assert.equal(guest.quotes.length, 10);
    assert.equal(guest.quotes[0].id, quoteIds[15]);
    assert.equal(guest.quotes[0].likeCount, 1);
    assert.equal(guest.quotes[0].likedByViewer, false);
    assert.equal(guest.bookNotesCount, 5);
    assert.equal(guest.editionNotesCount, 1);
    assert.equal(guest.bookNotes.length, 3);
    assert.equal(guest.bookNotes[0].likeCount, 1);
    assert.equal(guest.bookNotes[0].likedByViewer, false);

    const owner = await getBookCommunity(overview.book, userIds[1], editionIds[1]);
    assert.equal(owner.quoteCount, 17);
    assert(owner.quotes.some((quote) => quote.id === quoteIds[16]));
    assert(!owner.quotes.some((quote) => quote.id === quoteIds[17]));
    assert.equal(owner.quotes.find((quote) => quote.id === quoteIds[15])?.likedByViewer, true);
    assert.equal(owner.bookNotesCount, 6);
    assert.equal(owner.bookNotes.find((note) => note.id === noteIds[4])?.likedByViewer, true);
    assert(!owner.bookNotes.some((note) => note.id === noteIds[7]));

    const full = await getBookDetail(slug, userIds[1], editionIds[1]);
    assert.deepEqual(full, { ...overview, ...owner });
    const fallback = await getBookOverview(slug, userIds[1], "missing-edition");
    assert(fallback.found);
    assert.equal(fallback.selectedEdition?.id, editionIds[0]);
    assert.equal(fallback.viewer?.id, bookIds[1]);
    const page = await getBookQuotesPage(slug, undefined, 2);
    assert(page.found);
    assert.equal(page.pageCount, 2);
    assert.equal(page.total, 16);
    assert.equal(page.quotes.length, 4);
    assert.deepEqual(await getBookOverview(`missing-${catalogId}`), { found: false });
  } finally {
    try {
      await db.delete(User).where(inArray(User.id, userIds));
      await db.delete(CatalogBook).where(eq(CatalogBook.id, catalogId));
    } finally { await pool.end(); }
  }
});
