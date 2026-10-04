import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const hasDatabase = !!process.env.DATABASE_URL;
process.env.DATABASE_URL ||= "postgres://localhost/qafaseh_query_test";

test("reading activities are emitted only on real transitions and cursors round-trip", async () => {
  const { readingActivityType, encodeFeedCursor, decodeFeedCursor } = await import("./activity");
  assert.equal(readingActivityType("UNREAD", "READING"), "STARTED_READING");
  assert.equal(readingActivityType("READING", "READING"), null);
  assert.equal(readingActivityType("READING", "FINISHED"), "FINISHED_READING");
  assert.equal(readingActivityType("FINISHED", "FINISHED"), null);
  const at = new Date("2026-10-03T12:34:56.000Z");
  const id = randomUUID();
  assert.deepEqual(decodeFeedCursor(encodeFeedCursor(at, id)), { createdAt: at, id });
  assert.equal(decodeFeedCursor("invalid"), null);
});

test("following graph, feed visibility and stable pagination", { skip: !hasDatabase }, async () => {
  const { db, pool } = await import("../../db");
  const { Activity, Book, Follow, PublishedBookNote, Quote, User } = await import("../../db/schema");
  const { eq } = await import("drizzle-orm");
  const { followUser, unfollowUser, getFollowState } = await import("./follow");
  const { getFollowingFeed, getProfileRecentActivity, recordReadingActivity, recordPublishedActivity } = await import("./activity");
  const suffix = randomUUID().slice(0, 8);
  const viewerId = randomUUID(), actorId = randomUUID(), strangerId = randomUUID();
  const actorName = `social_actor_${suffix}`;

  try {
    await db.insert(User).values([
      { id: viewerId, username: `social_viewer_${suffix}`, name: "Viewer" },
      { id: actorId, username: actorName, name: "Actor" },
      { id: strangerId, username: `social_stranger_${suffix}`, name: "Stranger" },
    ]);

    assert.deepEqual(await Promise.all([followUser(viewerId, actorName), followUser(viewerId, actorName)]), ["OK", "OK"]);
    assert.equal(await followUser(actorId, actorName), "SELF");
    assert.deepEqual(await getFollowState(actorId, viewerId), { followerCount: 1, followingCount: 0, isFollowing: true });
    await assert.rejects(db.insert(Follow).values({ followerId: actorId, followingId: actorId }));

    const [book] = await db.insert(Book).values({ userId: actorId, title: "Test book", author: "Writer", genre: "Novel", format: "PHYSICAL" }).returning({ id: Book.id });
    const [transitionBook] = await db.insert(Book).values({ userId: actorId, title: "Transition book", author: "Writer", genre: "Novel", format: "PHYSICAL" }).returning({ id: Book.id });
    await recordReadingActivity(db, actorId, transitionBook.id, "UNREAD", "READING");
    await recordReadingActivity(db, actorId, transitionBook.id, "READING", "READING");
    await recordReadingActivity(db, actorId, transitionBook.id, "READING", "FINISHED");
    assert.deepEqual((await db.select({ type: Activity.type }).from(Activity).where(eq(Activity.bookId, transitionBook.id))).map((row) => row.type).sort(), ["FINISHED_READING", "STARTED_READING"]);
    await db.delete(Book).where(eq(Book.id, transitionBook.id));
    const [strangerBook] = await db.insert(Book).values({ userId: strangerId, title: "Hidden book", author: "Writer", genre: "Novel", format: "PHYSICAL" }).returning({ id: Book.id });
    const [note] = await db.insert(PublishedBookNote).values({ userId: actorId, bookId: book.id, content: "<p>A public note</p>" }).returning({ id: PublishedBookNote.id });
    const [quote] = await db.insert(Quote).values({ userId: actorId, bookId: book.id, content: "A public quote", background: "default" }).returning({ id: Quote.id });
    await db.insert(Activity).values([
      { actorUserId: actorId, type: "STARTED_READING", bookId: book.id },
      { actorUserId: actorId, type: "PUBLISHED_NOTE", bookId: book.id, noteId: note.id },
      { actorUserId: actorId, type: "PUBLISHED_QUOTE", bookId: book.id, quoteId: quote.id },
      { actorUserId: actorId, type: "FINISHED_READING", bookId: book.id },
      { actorUserId: strangerId, type: "STARTED_READING", bookId: strangerBook.id },
    ]);
    let feed = await getFollowingFeed(viewerId, null);
    assert.equal(feed.items.length, 4);
    assert.deepEqual(new Set(feed.items.map((item) => item.type)), new Set(["STARTED_READING", "FINISHED_READING", "PUBLISHED_NOTE", "PUBLISHED_QUOTE"]));
    assert.ok(feed.items.every((item) => item.actorUsername === actorName));
    assert.deepEqual((await getProfileRecentActivity(actorId)).map((item) => item.id), feed.items.map((item) => item.id));
    const strangerActivity = await getProfileRecentActivity(strangerId);
    assert.equal(strangerActivity.length, 1);
    assert.equal(strangerActivity[0].bookId, strangerBook.id);
    assert.deepEqual(await getProfileRecentActivity(randomUUID()), []);

    await db.delete(PublishedBookNote).where(eq(PublishedBookNote.id, note.id));
    await db.delete(Quote).where(eq(Quote.id, quote.id));
    feed = await getFollowingFeed(viewerId, null);
    assert.equal(feed.items.length, 2);
    assert.equal((await getProfileRecentActivity(actorId)).length, 2);
    await db.update(User).set({ profileVisibility: "PRIVATE" }).where(eq(User.id, actorId));
    assert.equal((await getFollowingFeed(viewerId, null)).items.length, 0);
    assert.deepEqual(await getProfileRecentActivity(actorId), []);
    assert.deepEqual(await getProfileRecentActivity(actorId, viewerId), []);
    assert.equal((await getProfileRecentActivity(actorId, actorId)).length, 2);
    const [privateBook] = await db.insert(Book).values({ userId: actorId, title: "Private-time book", author: "Writer", genre: "Novel", format: "PHYSICAL" }).returning({ id: Book.id });
    const [privateNote] = await db.insert(PublishedBookNote).values({ userId: actorId, bookId: privateBook.id, content: "<p>Private-time note</p>" }).returning({ id: PublishedBookNote.id });
    const [privateQuote] = await db.insert(Quote).values({ userId: actorId, bookId: privateBook.id, content: "Private-time quote", background: "default" }).returning({ id: Quote.id });
    await recordReadingActivity(db, actorId, privateBook.id, "UNREAD", "READING");
    await recordPublishedActivity(db, actorId, privateBook.id, { noteId: privateNote.id });
    await recordPublishedActivity(db, actorId, privateBook.id, { quoteId: privateQuote.id });
    assert.equal((await db.select({ id: Activity.id }).from(Activity).where(eq(Activity.bookId, privateBook.id))).length, 0);
    assert.equal(await followUser(strangerId, actorName), "NOT_FOUND");
    assert.equal(await unfollowUser(viewerId, actorName), "OK");
    assert.equal((await getFollowState(actorId, viewerId)).isFollowing, false);
    await db.update(User).set({ profileVisibility: "PUBLIC" }).where(eq(User.id, actorId));
    assert.equal(await followUser(viewerId, actorName), "OK");
    assert.equal((await getFollowingFeed(viewerId, null)).items.length, 2);

    const base = Date.now() - 60_000;
    await db.insert(Activity).values(Array.from({ length: 23 }, () => ({
      actorUserId: actorId, type: "STARTED_READING" as const, bookId: book.id,
      createdAt: new Date(base),
    })));
    const first = await getFollowingFeed(viewerId, null);
    const second = await getFollowingFeed(viewerId, first.nextCursor);
    assert.equal(first.items.length, 20);
    assert.equal(second.items.length, 5);
    assert.equal(new Set([...first.items, ...second.items].map((item) => item.id)).size, 25);
    const ordered = [...first.items, ...second.items];
    assert.ok(ordered.every((item, index) => index === 0 || item.createdAt < ordered[index - 1].createdAt || (item.createdAt === ordered[index - 1].createdAt && item.id < ordered[index - 1].id)));
    assert.deepEqual((await getProfileRecentActivity(actorId)).map((item) => item.id), first.items.slice(0, 5).map((item) => item.id));

    assert.equal(await unfollowUser(viewerId, actorName), "OK");
    assert.equal((await getFollowingFeed(viewerId, null)).items.length, 0);
    assert.deepEqual(await getFollowState(actorId, viewerId), { followerCount: 0, followingCount: 0, isFollowing: false });
  } finally {
    await db.delete(User).where(eq(User.id, viewerId));
    await db.delete(User).where(eq(User.id, actorId));
    await db.delete(User).where(eq(User.id, strangerId));
    await pool.end();
  }
});
