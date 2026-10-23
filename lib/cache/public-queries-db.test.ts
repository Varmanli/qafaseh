import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

test("public search includes publishers and profile aggregates preserve private viewer semantics", {
  skip: !process.env.PERFORMANCE_TEST_DATABASE_URL,
}, async (t) => {
  const url = new URL(process.env.PERFORMANCE_TEST_DATABASE_URL!);
  assert(["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname.includes("perf_audit"));
  process.env.DATABASE_URL = url.toString();
  const { db, pool } = await import("@/db");
  const { User, Book, ReferenceItem } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const { searchGlobal } = await import("@/lib/search/global-service");
  const { getReadingStats, getPublicProfile } = await import("@/lib/profile/service");
  const userId = randomUUID(), publisherId = randomUUID();
  const name = `PerfPublisher${publisherId.replaceAll("-", "")}`;
  const username = `perf_${userId.replaceAll("-", "").slice(0, 15)}`;
  try {
    await db.insert(User).values({ id: userId, username, profileVisibility: "PRIVATE" });
    await db.insert(ReferenceItem).values({ id: publisherId, type: "PUBLISHER", name, slug: name.toLowerCase(), status: "APPROVED" });
    await t.test("publisher search returns the existing response shape", async () => {
      const result = await searchGlobal(name);
      assert(result.publishers.some((item) => item.id === publisherId));
      assert(!("bookCount" in result.publishers.find((item) => item.id === publisherId)!));
    });
    await t.test("status, favorites and rating aggregates do not mix users", async () => {
      assert.deepEqual(await getReadingStats(userId), { total: 0, reading: 0, finished: 0, wantToRead: 0, favorites: 0, averageRating: null });
      await db.insert(Book).values([
        { userId, title: "perf", author: "perf", genre: "perf", format: "PHYSICAL", status: "READING", rating: 8, isFavorite: true },
        { userId, title: "perf", author: "perf", genre: "perf", format: "PHYSICAL", status: "FINISHED", rating: 6 },
        { userId, title: "perf", author: "perf", genre: "perf", format: "PHYSICAL", status: "UNREAD", rating: 0 },
        { userId, title: "perf", author: "perf", genre: "perf", format: "PHYSICAL", status: "PAUSED" },
      ]);
      assert.deepEqual(await getReadingStats(userId), { total: 4, reading: 1, finished: 1, wantToRead: 1, favorites: 1, averageRating: 7 });
      const guest = await getPublicProfile(username);
      assert(guest.found && guest.isPrivate);
      const owner = await getPublicProfile(username, userId);
      assert(owner.found && !owner.isPrivate && owner.books.length === 4);
    });
  } finally {
    await db.delete(User).where(eq(User.id, userId));
    await db.delete(ReferenceItem).where(eq(ReferenceItem.id, publisherId));
    await pool.end();
  }
});
