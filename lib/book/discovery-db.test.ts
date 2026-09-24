import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

test("new public catalog books participate without config edits", { skip: !process.env.DATABASE_URL }, async () => {
  const { db, pool } = await import("../../db");
  const { CatalogBook, BookEdition } = await import("../../db/schema");
  const { inArray } = await import("drizzle-orm");
  const { getCatalogDiscoverySignals } = await import("./discover-service");
  const { selectDiscoveryIds } = await import("./discovery-signals");
  const { selectQuizBooks } = await import("./discover-quiz");
  const { moods } = await import("./discover-config");
  const { getSimilarBooks } = await import("./similar-books-service");
  const suffix = randomUUID().slice(0, 8);
  const ids: string[] = [`zzzz-discovery-regression-${suffix}`, ...Array.from({ length: 4 }, () => randomUUID())];
  try {
    await db.insert(CatalogBook).values(ids.map((id, index) => ({
      id, slug: `discovery-regression-${suffix}-${index}`,
      title: `Discovery regression ${suffix} ${index}`,
      author: index >= 3 ? `Genreless author ${suffix}` : `Regression author ${suffix}`,
      genre: index >= 3 ? null : "داستان معمایی، داستان وحشت", language: "فارسی",
      status: index === 2 ? "PENDING" as const : "APPROVED" as const,
    })));
    await db.insert(BookEdition).values(ids.slice(0, 2).map((catalogBookId) => ({
      catalogBookId, pageCount: 200, status: "APPROVED" as const,
    })));
    const signals = await getCatalogDiscoverySignals();
    assert(signals.some((book) => book.id === ids[0]));
    assert.equal(signals.find((book) => book.id === ids[0])?.pageCount, 200);
    assert(!signals.some((book) => book.id === ids[2]));
    assert(selectDiscoveryIds(signals, moods[0]).includes(ids[0]));
    const answers = { kind: "exciting", mood: "dark", commitment: "short" };
    assert(selectQuizBooks(signals.filter((book) => ids.includes(book.id)), answers).some((book) => book.id === ids[0]));
    assert(selectQuizBooks(signals, answers, [], "2026-09-24").some((book) => book.id === ids[0]));
    const related = await getSimilarBooks(ids[0]);
    assert(related.some((book) => book.id === ids[1]));
    assert(!related.some((book) => book.id === ids[2]));
    assert.deepEqual(await getSimilarBooks(ids[2]), []);
    assert((await getSimilarBooks(ids[1])).some((book) => book.id === ids[0]));
    assert((await getSimilarBooks(ids[3])).some((book) => book.id === ids[4]));
  } finally {
    try {
      await db.delete(CatalogBook).where(inArray(CatalogBook.id, ids));
      assert.equal((await db.select({ id: CatalogBook.id }).from(CatalogBook).where(inArray(CatalogBook.id, ids))).length, 0);
    } finally { await pool.end(); }
  }
});
