import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { commentContentSchema, commentQuerySchema, createCommentSchema } from "./comment-contract";

test("comment inputs reject empty text, excessive length and invalid identifiers", () => {
  assert.equal(commentContentSchema.safeParse(" \n\t ").success, false);
  assert.equal(commentContentSchema.safeParse("a".repeat(2001)).success, false);
  assert.equal(commentContentSchema.parse("  ایول!  "), "ایول!");
  assert.equal(commentQuerySchema.safeParse({ targetType: "PRIVATE_NOTE", targetId: "book" }).success, false);
  assert.equal(createCommentSchema.safeParse({ targetType: "QUOTE", targetId: "quote", content: "Hello", requestId: "bad" }).success, false);
});

test("comments workflow: visibility, shared threads, retries, pagination, ownership and database integrity", { skip: !process.env.DATABASE_URL }, async (t) => {
  const { db, pool } = await import("../../db");
  const { Activity, Book, CatalogBook, PublishedBookNote, PublishedBookNoteLike, Quote, QuoteLike, SocialComment, User } = await import("../../db/schema");
  const { and, eq, inArray, sql } = await import("drizzle-orm");
  const { CommentError, createSocialComment, deleteSocialComment, getSocialComments, updateSocialComment } = await import("./comments");
  const { getVisibleActivityById } = await import("./activity");
  const { getVisibleQuoteById } = await import("../quotes/service");
  const ids = Array.from({ length: 5 }, () => randomUUID());
  const [ownerId, authorId, otherId, rateUserId, adminId] = ids;
  const pendingCatalogId = randomUUID();
  const owner = { id: ownerId }, author = { id: authorId }, other = { id: otherId };
  const failsWith = (status: number) => (error: unknown) => error instanceof CommentError && error.status === status;
  let rootId = "", readingRootId = "";
  try {
    await db.insert(User).values(ids.map((id, index) => ({ id, name: "Comments regression", username: `comment_${randomUUID().slice(0, 8)}_${index}` })));
    const [book] = await db.insert(Book).values({ userId: ownerId, title: "[TEST:comments]", author: "Writer", genre: "Novel", format: "PHYSICAL" }).returning();
    const [quote, paginatedQuote] = await db.insert(Quote).values([0, 1].map(() => ({ userId: ownerId, bookId: book.id, content: "A quote", background: "default" }))).returning();
    const [note] = await db.insert(PublishedBookNote).values({ userId: ownerId, bookId: book.id, content: "<p>A note</p>" }).returning();
    const [reading, publication, notePublication, likedQuote, likedNote] = await db.insert(Activity).values([
      { actorUserId: ownerId, bookId: book.id, type: "STARTED_READING" },
      { actorUserId: ownerId, bookId: book.id, type: "PUBLISHED_QUOTE", quoteId: quote.id },
      { actorUserId: ownerId, bookId: book.id, type: "PUBLISHED_NOTE", noteId: note.id },
      { actorUserId: authorId, bookId: book.id, type: "LIKED_QUOTE", quoteId: quote.id },
      { actorUserId: authorId, bookId: book.id, type: "LIKED_NOTE", noteId: note.id },
    ]).returning();
    await db.insert(QuoteLike).values({ userId: authorId, quoteId: quote.id });
    await db.insert(PublishedBookNoteLike).values({ userId: authorId, noteId: note.id });
    const input = (targetType: "QUOTE" | "NOTE" | "ACTIVITY", targetId: string, content = "ایول!", parentId?: string) => ({ targetType, targetId, content, requestId: randomUUID(), ...(parentId ? { parentId } : {}) });

    await t.test("concurrent retries save exactly once and return the same stored comment", async () => {
      const data = input("ACTIVITY", publication.id);
      const results = await Promise.all(Array.from({ length: 4 }, () => createSocialComment(data, author)));
      assert.equal(results.filter((result) => result.created).length, 1);
      assert.equal(new Set(results.map((result) => result.comment.id)).size, 1);
      rootId = results[0].comment.id;
      assert.equal(results[0].comment.canEdit, true);
      const direct = await getSocialComments("QUOTE", quote.id, author);
      assert.deepEqual(await getSocialComments("ACTIVITY", publication.id, author), direct);
      assert.equal(direct.totalCount, 1);
      await assert.rejects(createSocialComment({ ...data, content: "Different content" }, author), failsWith(409));
    });

    await t.test("quotes, notes and reading activities accept replies without mixing conversations", async () => {
      const response = await createSocialComment(input("QUOTE", quote.id, "پاسخ", rootId), owner);
      assert.equal(response.comment.parentId, rootId);
      const first = await getSocialComments("QUOTE", quote.id, other);
      assert.equal(first.comments.length, 1);
      assert.equal(first.comments[0].replyCount, 1);
      assert.equal(first.totalCount, 2);
      assert.equal(first.comments[0].canEdit, false);
      assert.equal(first.comments[0].canDelete, false);
      const replies = await getSocialComments("ACTIVITY", publication.id, other, { parentId: rootId });
      assert.equal(replies.comments[0].id, response.comment.id);
      assert.equal(replies.totalCount, undefined);
      await assert.rejects(createSocialComment(input("NOTE", note.id, "Wrong target", rootId), author), failsWith(404));
      await assert.rejects(createSocialComment(input("QUOTE", quote.id, "Nested", response.comment.id), author), failsWith(404));
      await createSocialComment(input("ACTIVITY", notePublication.id), author);
      assert.equal((await getSocialComments("NOTE", note.id)).totalCount, 1);
      readingRootId = (await createSocialComment(input("ACTIVITY", reading.id), author)).comment.id;
      await createSocialComment(input("ACTIVITY", reading.id, "جواب صاحب فعالیت", readingRootId), owner);
      assert.equal((await getSocialComments("ACTIVITY", reading.id)).totalCount, 2);
    });

    await t.test("published and liked content use one comment target; reading keeps its own thread", async () => {
      for (const [event, type, contentId] of [[likedQuote, "QUOTE", quote.id], [likedNote, "NOTE", note.id]] as const) {
        const added = await createSocialComment(input("ACTIVITY", event.id), other);
        const direct = await getSocialComments(type, contentId, author);
        assert.deepEqual(await getSocialComments("ACTIVITY", event.id, author), direct);
        const activity = await getVisibleActivityById(event.id, authorId);
        assert.deepEqual(activity?.commentTarget, { type, id: contentId });
        assert.equal(activity?.commentCount, direct.totalCount);
        assert.equal(direct.comments.find((comment) => comment.id === added.comment.id)?.canDelete, false);
        assert.equal((await db.select().from(SocialComment).where(eq(SocialComment.activityId, event.id))).length, 0);
        await db.delete(Activity).where(eq(Activity.id, event.id));
        assert.ok((await getSocialComments(type, contentId, owner)).comments.some((comment) => comment.id === added.comment.id));
        await deleteSocialComment(added.comment.id, owner);
      }
      assert.deepEqual((await getVisibleActivityById(publication.id))?.commentTarget, { type: "QUOTE", id: quote.id });
      assert.deepEqual((await getVisibleActivityById(notePublication.id))?.commentTarget, { type: "NOTE", id: note.id });
      assert.deepEqual((await getVisibleActivityById(reading.id))?.commentTarget, { type: "ACTIVITY", id: reading.id });
    });

    await t.test("private content cannot be read or commented on by other users or guests", async () => {
      await db.insert(CatalogBook).values({ id: pendingCatalogId, title: "[TEST:pending-comment-book]", author: "Writer", status: "PENDING" });
      await db.update(Book).set({ catalogBookId: pendingCatalogId }).where(eq(Book.id, book.id));
      // A quote intentionally published on a public profile remains reachable.
      assert.ok(await getVisibleQuoteById(quote.id));
      await db.update(User).set({ profileVisibility: "PRIVATE" }).where(eq(User.id, ownerId));
      for (const [type, id] of [["QUOTE", quote.id], ["NOTE", note.id], ["ACTIVITY", reading.id]] as const) {
        await assert.rejects(getSocialComments(type, id), failsWith(404));
        await assert.rejects(getSocialComments(type, id, author), failsWith(404));
        await assert.rejects(createSocialComment(input(type, id), author), failsWith(404));
        assert.ok((await getSocialComments(type, id, owner)).comments.length > 0);
      }
      await assert.rejects(updateSocialComment(rootId, "Forbidden", author), failsWith(404));
      assert.equal(await getVisibleActivityById(reading.id), null);
      assert.ok(await getVisibleActivityById(reading.id, ownerId));
      assert.equal(await getVisibleQuoteById(quote.id), null);
      assert.ok(await getVisibleQuoteById(quote.id, ownerId));
      await db.update(User).set({ profileVisibility: "PUBLIC" }).where(eq(User.id, ownerId));
    });

    await t.test("only authors can edit; authors, content owners and admins can delete", async () => {
      await assert.rejects(updateSocialComment(rootId, "Forbidden", owner), failsWith(403));
      await assert.rejects(deleteSocialComment(rootId, other), failsWith(403));
      await assert.rejects(updateSocialComment(rootId, "  ", author), failsWith(422));
      const edited = await updateSocialComment(rootId, "  Updated text  ", author);
      assert.equal(edited.comment.content, "Updated text");
      assert.equal(edited.comment.replyCount, 1);
      assert.equal((await getSocialComments("QUOTE", quote.id, owner)).comments[0].canDelete, true);
      const deleted = await deleteSocialComment(rootId, owner);
      assert.equal(deleted.deletedCount, 2);
      assert.equal((await getSocialComments("QUOTE", quote.id)).totalCount, 0);
      const adminRoot = await createSocialComment(input("NOTE", note.id), other);
      assert.equal((await deleteSocialComment(adminRoot.comment.id, { id: adminId, role: "ADMIN" })).deletedCount, 1);
    });

    await t.test("root and reply cursors preserve microsecond order and never drop older comments", async () => {
      const comments = await db.insert(SocialComment).values(Array.from({ length: 45 }, (_, index) => ({
        targetType: "QUOTE" as const, targetId: paginatedQuote.id, quoteId: paginatedQuote.id,
        authorUserId: otherId, content: `Root ${index}`,
        createdAt: sql`timestamp '2026-01-01 12:00:00' + ${index} * interval '1 microsecond'`,
        updatedAt: sql`timestamp '2026-01-01 12:00:00' + ${index} * interval '1 microsecond'`,
      }))).returning();
      const first = await getSocialComments("QUOTE", paginatedQuote.id);
      assert.equal(first.totalCount, 45);
      assert.equal(first.comments.length, 20);
      assert.ok(first.nextCursor);
      await createSocialComment(input("QUOTE", paginatedQuote.id, "New while paging"), other);
      const second = await getSocialComments("QUOTE", paginatedQuote.id, undefined, { cursor: first.nextCursor! });
      const third = await getSocialComments("QUOTE", paginatedQuote.id, undefined, { cursor: second.nextCursor! });
      const all = [...first.comments, ...second.comments, ...third.comments];
      assert.equal(all.length, 45);
      assert.equal(new Set(all.map((item) => item.id)).size, 45);
      assert.deepEqual(all.map((item) => item.content), Array.from({ length: 45 }, (_, i) => `Root ${44 - i}`));
      assert.equal(third.nextCursor, null);
      assert.equal(second.totalCount, undefined);
      await assert.rejects(getSocialComments("QUOTE", paginatedQuote.id, undefined, { cursor: "invalid" }), failsWith(400));
      const parentId = comments[0].id;
      await db.insert(SocialComment).values(Array.from({ length: 45 }, (_, index) => ({
        targetType: "QUOTE" as const, targetId: paginatedQuote.id, quoteId: paginatedQuote.id,
        authorUserId: otherId, parentId, content: `Reply ${index}`,
        createdAt: sql`timestamp '2026-01-01 13:00:00' + ${index} * interval '1 microsecond'`,
      })));
      const page1 = await getSocialComments("QUOTE", paginatedQuote.id, undefined, { parentId });
      const page2 = await getSocialComments("QUOTE", paginatedQuote.id, undefined, { parentId, cursor: page1.nextCursor! });
      const page3 = await getSocialComments("QUOTE", paginatedQuote.id, undefined, { parentId, cursor: page2.nextCursor! });
      assert.deepEqual([...page1.comments, ...page2.comments, ...page3.comments].map((item) => item.content), Array.from({ length: 45 }, (_, i) => `Reply ${i}`));
      assert.equal(page3.nextCursor, null);
      assert.equal((await getSocialComments("QUOTE", paginatedQuote.id)).totalCount, 91);
      // Give the planner realistic selectivity across unrelated conversations.
      await db.insert(SocialComment).values(Array.from({ length: 1000 }, () => ({
        targetType: "ACTIVITY" as const, targetId: reading.id, activityId: reading.id,
        authorUserId: otherId, content: "Unrelated thread",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      })));
      await db.transaction(async (tx) => {
        await tx.execute(sql`ANALYZE "SocialComment"`);
        await tx.execute(sql`SET LOCAL enable_seqscan = off`);
        const plan = await tx.execute(sql`EXPLAIN SELECT id FROM "SocialComment" WHERE target_type = 'QUOTE' AND target_id = ${paginatedQuote.id} AND parent_id IS NULL ORDER BY created_at DESC, id DESC LIMIT 21`);
        assert.match(JSON.stringify(plan.rows), /SocialComment_root_created_idx/);
        assert.doesNotMatch(JSON.stringify(plan.rows), /Sort/);
        const replyPlan = await tx.execute(sql`EXPLAIN SELECT id FROM "SocialComment" WHERE parent_id = ${parentId} ORDER BY created_at, id LIMIT 21`);
        assert.match(JSON.stringify(replyPlan.rows), /SocialComment_parent_idx/);
        assert.doesNotMatch(JSON.stringify(replyPlan.rows), /Sort/);
      });
    });

    await t.test("database rejects missing objects, cross-target replies and nested replies", async () => {
      const base = { targetType: "QUOTE" as const, targetId: paginatedQuote.id, quoteId: paginatedQuote.id, authorUserId: otherId, content: "Bad relationship" };
      await assert.rejects(db.insert(SocialComment).values({ ...base, parentId: readingRootId }));
      await assert.rejects(db.insert(SocialComment).values({ ...base, quoteId: randomUUID() }));
      const [reply] = await db.select().from(SocialComment).where(and(eq(SocialComment.targetId, paginatedQuote.id), sql`${SocialComment.parentId} IS NOT NULL`)).limit(1);
      await assert.rejects(db.insert(SocialComment).values({ ...base, parentId: reply.id }));
    });

    await t.test("concurrent writers cannot bypass the per-user send limit", async () => {
      const results = await Promise.allSettled(Array.from({ length: 12 }, () => createSocialComment(input("ACTIVITY", reading.id), { id: rateUserId })));
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 10);
      const rejected = results.filter((result) => result.status === "rejected");
      assert.equal(rejected.length, 2);
      for (const result of rejected) if (result.status === "rejected") assert.ok(failsWith(429)(result.reason));
    });

    await t.test("reply creation concurrent with root deletion cannot leave an orphan", async () => {
      const root = await createSocialComment(input("NOTE", note.id), other);
      const results = await Promise.allSettled([
        createSocialComment(input("NOTE", note.id, "Concurrent reply", root.comment.id), owner),
        deleteSocialComment(root.comment.id, other),
      ]);
      assert.equal(results[1].status, "fulfilled");
      if (results[0].status === "rejected") assert.ok(failsWith(404)(results[0].reason));
      assert.equal((await db.select().from(SocialComment).where(orRoot(root.comment.id))).length, 0);
      function orRoot(id: string) { return sql`${SocialComment.id} = ${id} OR ${SocialComment.parentId} = ${id}`; }
    });

    await t.test("deleting events, notes and quotes has the correct comment lifecycle", async () => {
      await db.delete(Activity).where(eq(Activity.id, notePublication.id));
      assert.equal((await getSocialComments("NOTE", note.id)).totalCount, 1);
      await db.delete(PublishedBookNote).where(eq(PublishedBookNote.id, note.id));
      await db.delete(Quote).where(eq(Quote.id, paginatedQuote.id));
      await db.delete(Activity).where(eq(Activity.id, reading.id));
      assert.equal((await db.select().from(SocialComment).where(inArray(SocialComment.targetId, [note.id, paginatedQuote.id, reading.id]))).length, 0);
    });
  } finally {
    await db.delete(User).where(inArray(User.id, ids));
    await db.delete(CatalogBook).where(eq(CatalogBook.id, pendingCatalogId));
    await pool.end();
  }
});
