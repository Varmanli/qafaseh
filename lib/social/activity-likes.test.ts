import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Pool } from "pg";

test("content activity likes share storage, counts and state; cards render one reaction row", { skip: !process.env.DATABASE_URL }, async () => {
  const { db, pool } = await import("../../db");
  const { Activity, ActivityLike, Book, PublishedBookNote, PublishedBookNoteLike, Quote, QuoteLike, User } = await import("../../db/schema");
  const { and, eq, inArray } = await import("drizzle-orm");
  const { getVisibleActivityById, toggleActivityLike } = await import("./activity");
  const { getVisibleQuoteById, toggleQuoteLike } = await import("../quotes/service");
  const { getVisiblePublishedNoteById, togglePublishedNoteLike } = await import("../notes/service");
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { ActivityCard } = await import("../../components/feed/FeedTimeline");
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  const [owner, viewer, other] = ids;
  try {
    await db.insert(User).values(ids.map((id) => ({ id, name: "Likes regression", username: `likes_${randomUUID().slice(0, 8)}` })));
    const [book] = await db.insert(Book).values({ userId: owner, title: "[TEST:activity-likes]", author: "Writer", genre: "Novel", format: "PHYSICAL" }).returning();
    const [quote] = await db.insert(Quote).values({ userId: owner, bookId: book.id, content: "Quote", background: "default" }).returning();
    const [note] = await db.insert(PublishedBookNote).values({ userId: owner, bookId: book.id, content: "<p>Note</p>" }).returning();
    const [quoteEvent, noteEvent, reading] = await db.insert(Activity).values([
      { actorUserId: owner, type: "PUBLISHED_QUOTE", bookId: book.id, quoteId: quote.id },
      { actorUserId: owner, type: "PUBLISHED_NOTE", bookId: book.id, noteId: note.id },
      { actorUserId: owner, type: "STARTED_READING", bookId: book.id },
    ]).returning();

    for (const [id, getContent] of [[quote.id, getVisibleQuoteById], [note.id, getVisiblePublishedNoteById]] as const) {
      assert.equal((await getContent(id, owner))?.canEdit, true);
      assert.equal((await getContent(id, viewer))?.canEdit, false);
      assert.equal((await getContent(id))?.canEdit, false);
    }

    for (const [event, contentId, source, directToggle, likedType] of [
      [quoteEvent, quote.id, QuoteLike, toggleQuoteLike, "LIKED_QUOTE"],
      [noteEvent, note.id, PublishedBookNoteLike, togglePublishedNoteLike, "LIKED_NOTE"],
    ] as const) {
      assert.deepEqual(await toggleActivityLike(event.id, viewer), { liked: true, likeCount: 1 });
      const item = (await getVisibleActivityById(event.id, viewer))!;
      assert.equal((item.quote || item.note)?.canEdit, false);
      const ownerItem = (await getVisibleActivityById(event.id, owner))!;
      assert.equal((ownerItem.quote || ownerItem.note)?.canEdit, true);
      assert.equal(item.likeCount, 1);
      assert.equal(item.likedByViewer, true);
      assert.equal((await db.select().from(source).where(eq(source.userId, viewer))).length, 1);
      assert.equal((await db.select().from(ActivityLike).where(eq(ActivityLike.activityId, event.id))).length, 0);
      for (const options of [{}, { preview: true }, { detailPage: true }]) {
        const html = renderToStaticMarkup(createElement(ActivityCard, { item, ...options }));
        assert.equal((html.match(/aria-pressed=/g) || []).length, 1);
        assert.equal((html.match(/aria-label="دیدگاه‌ها،/g) || []).length, 1);
      }
      assert.deepEqual(await directToggle(contentId, viewer), { liked: false, likeCount: 0 });
      assert.equal((await getVisibleActivityById(event.id, viewer))?.likedByViewer, false);
      await toggleActivityLike(event.id, viewer);
      const [likedEvent] = await db.select().from(Activity).where(and(eq(Activity.actorUserId, viewer), eq(Activity.type, likedType)));
      const actorItem = (await getVisibleActivityById(likedEvent.id, viewer))!;
      assert.equal((actorItem.quote || actorItem.note)?.canEdit, false, "liking content does not grant editing rights");
      assert.deepEqual(await toggleActivityLike(likedEvent.id, other), { liked: true, likeCount: 2 });
      assert.equal((await getVisibleActivityById(likedEvent.id, other))?.likeCount, 2);
      assert.deepEqual(await toggleActivityLike(likedEvent.id, viewer), { liked: false, likeCount: 1 });
      assert.equal(await getVisibleActivityById(likedEvent.id, viewer), null);
      assert.equal((await db.select().from(ActivityLike).where(eq(ActivityLike.userId, other))).length, 0);
    }
    assert.deepEqual(await toggleActivityLike(reading.id, viewer), { liked: true, likeCount: 1 });
    assert.equal((await db.select().from(ActivityLike).where(eq(ActivityLike.activityId, reading.id))).length, 1);
    assert.deepEqual(await toggleActivityLike(reading.id, viewer), { liked: false, likeCount: 0 });
    await db.update(User).set({ profileVisibility: "PRIVATE" }).where(eq(User.id, owner));
    assert.equal(await toggleActivityLike(quoteEvent.id, other), null);
    assert.equal(await toggleActivityLike(noteEvent.id, other), null);
  } finally {
    await db.delete(User).where(inArray(User.id, ids));
    await pool.end();
  }
});

test("like migration merges duplicates without losing reactions or timestamps", { skip: !process.env.DATABASE_URL }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const schema = `likes_migration_${randomUUID().replaceAll("-", "")}`;
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}", public`);
    for (const name of ["User", "Quote", "PublishedBookNote", "Activity", "ActivityLike", "QuoteLike", "PublishedBookNoteLike"]) {
      await client.query(`CREATE TABLE "${name}" (LIKE public."${name}" INCLUDING ALL)`);
    }
    await client.query(`INSERT INTO "User" (id, name, username) VALUES ('owner','Owner','owner'),('one','One','one'),('two','Two','two')`);
    await client.query(`INSERT INTO "Quote" (id, user_id, book_id, content, background) VALUES ('quote','owner','book','Quote','default')`);
    await client.query(`INSERT INTO "PublishedBookNote" (id, user_id, book_id, content) VALUES ('note','owner','book','Note')`);
    await client.query(`INSERT INTO "Activity" (id, actor_user_id, type, book_id, quote_id, note_id) VALUES
      ('pub','owner','PUBLISHED_QUOTE','book','quote',NULL),('liked','two','LIKED_QUOTE','book','quote',NULL),
      ('note-pub','owner','PUBLISHED_NOTE','book',NULL,'note'),('reading','owner','STARTED_READING','book',NULL,NULL)`);
    await client.query(`INSERT INTO "QuoteLike" (quote_id,user_id,created_at) VALUES ('quote','one','2000-01-03')`);
    await client.query(`INSERT INTO "ActivityLike" (activity_id,user_id,created_at) VALUES ('pub','one','2000-01-01'),('liked','one','2000-01-02'),('pub','two','2000-01-04'),('note-pub','two','2000-01-05'),('reading','one','2000-01-06')`);
    const migration = readFileSync("drizzle/0075_content_activity_likes.sql", "utf8");
    await client.query(migration);
    assert.deepEqual((await client.query(`SELECT quote_id, user_id, created_at::text AS at FROM "QuoteLike" ORDER BY user_id`)).rows, [
      { quote_id: "quote", user_id: "one", at: "2000-01-01 00:00:00" },
      { quote_id: "quote", user_id: "two", at: "2000-01-04 00:00:00" },
    ]);
    assert.deepEqual((await client.query(`SELECT note_id, user_id FROM "PublishedBookNoteLike"`)).rows, [{ note_id: "note", user_id: "two" }]);
    assert.deepEqual((await client.query(`SELECT activity_id, user_id FROM "ActivityLike"`)).rows, [{ activity_id: "reading", user_id: "one" }]);
    assert.equal((await client.query(`SELECT count(*)::int AS count FROM "Activity" WHERE type IN ('LIKED_QUOTE','LIKED_NOTE')`)).rows[0].count, 3);
    await client.query(migration);
    assert.equal((await client.query(`SELECT count(*)::int AS count FROM "QuoteLike"`)).rows[0].count, 2);
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
