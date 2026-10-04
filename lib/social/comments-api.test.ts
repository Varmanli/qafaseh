import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

test("comment API handles authentication, malformed bodies, retries, privacy and CRUD", { skip: !process.env.COMMENTS_TEST_BASE_URL || !process.env.DATABASE_URL }, async () => {
  const base = process.env.COMMENTS_TEST_BASE_URL!;
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "API tests require a local server");
  const { db, pool } = await import("../../db");
  const { Activity, Book, PublishedBookNote, Quote, QuoteLike, User } = await import("../../db/schema");
  const { eq, inArray } = await import("drizzle-orm");
  const { signJwt } = await import("../jwt");
  const { AUTH_COOKIE } = await import("../auth/constants");
  const ownerId = randomUUID(), authorId = randomUUID();
  const cookie = (id: string) => `${AUTH_COOKIE}=${signJwt({ id, sessionVersion: 0 })}`;
  const fetchApi = (path: string, init?: RequestInit) => fetch(`${base}${path}`, { signal: AbortSignal.timeout(45_000), ...init });
  try {
    await db.insert(User).values([ownerId, authorId].map((id) => ({ id, name: "Comments API regression", username: `api_${randomUUID().slice(0, 8)}` })));
    const [book] = await db.insert(Book).values({ userId: ownerId, title: "[TEST:comment-api]", author: "Writer", genre: "Novel", format: "PHYSICAL" }).returning();
    const [quote] = await db.insert(Quote).values({ bookId: book.id, userId: ownerId, content: "Test quote", background: "default" }).returning();
    const [note] = await db.insert(PublishedBookNote).values({ bookId: book.id, userId: ownerId, content: "<p>Test note</p>" }).returning();
    await db.insert(QuoteLike).values({ userId: authorId, quoteId: quote.id });
    const [publication, liked, reading, notePublication] = await db.insert(Activity).values([
      { actorUserId: ownerId, bookId: book.id, type: "PUBLISHED_QUOTE", quoteId: quote.id },
      { actorUserId: authorId, bookId: book.id, type: "LIKED_QUOTE", quoteId: quote.id },
      { actorUserId: ownerId, bookId: book.id, type: "STARTED_READING" },
      { actorUserId: ownerId, bookId: book.id, type: "PUBLISHED_NOTE", noteId: note.id },
    ]).returning();
    const query = `/api/comments?targetType=QUOTE&targetId=${quote.id}`;
    const payload = { targetType: "QUOTE", targetId: quote.id, content: "ایول! <script>literal text</script>", requestId: randomUUID() };
    const headers = { Cookie: cookie(authorId), "Content-Type": "application/json", Origin: base };
    const ownerHeaders = { ...headers, Cookie: cookie(ownerId) };
    const quoteApi = `/api/quotes/${quote.id}`;
    const publicQuote = await fetchApi(quoteApi);
    assert.equal(publicQuote.status, 200);
    assert.match(publicQuote.headers.get("cache-control") || "", /private, no-store/);
    assert.equal((await publicQuote.json()).quote.canEdit, false);
    assert.equal((await (await fetchApi(quoteApi, { headers: ownerHeaders })).json()).quote.canEdit, true);
    for (const [path, body, deniedStatus] of [
      [quoteApi, { content: "Updated quote", imageKey: null, page: 12, background: "default" }, 403],
      [`/api/notes/${note.id}`, { content: "<p>Updated note</p>" }, 404],
    ] as const) {
      assert.equal((await fetchApi(path, { method: "PUT", headers, body: JSON.stringify(body) })).status, deniedStatus);
      const edited = await fetchApi(path, { method: "PUT", headers: ownerHeaders, body: JSON.stringify(body) });
      assert.equal(edited.status, 200);
      const result = await edited.json();
      assert.equal((result.quote || result.note).content, body.content);
    }
    assert.equal((await fetchApi("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })).status, 401);
    assert.equal((await fetchApi("/api/comments", { method: "POST", headers: { ...headers, Origin: "https://other.example" }, body: JSON.stringify(payload) })).status, 403);
    assert.equal((await fetchApi("/api/comments", { method: "POST", headers, body: "{" })).status, 400);
    assert.equal((await fetchApi("/api/comments", { method: "POST", headers: { ...headers, "Content-Type": "text/plain" }, body: "test" })).status, 415);
    assert.equal((await fetchApi("/api/comments", { method: "POST", headers, body: JSON.stringify({ ...payload, content: "x".repeat(17_000) }) })).status, 413);
    assert.equal((await fetchApi("/api/comments", { method: "POST", headers, body: JSON.stringify({ ...payload, content: " \n " }) })).status, 422);
    assert.equal((await fetchApi(`${query}&cursor=invalid`)).status, 400);

    const [first, retry] = await Promise.all([0, 1].map(() => fetchApi("/api/comments", { method: "POST", headers, body: JSON.stringify(payload) })));
    assert.deepEqual([first.status, retry.status].sort(), [200, 201]);
    const saved = await first.json();
    assert.equal((await retry.json()).comment.id, saved.comment.id);
    const publicResponse = await fetchApi(query);
    assert.match(publicResponse.headers.get("cache-control") || "", /private, no-store/);
    const publicPage = await publicResponse.json();
    assert.equal(publicPage.totalCount, 1);
    assert.equal(publicPage.comments[0].canEdit, false);
    assert.equal(publicPage.comments[0].content, payload.content);

    for (const event of [publication, liked]) {
      const legacyQuery = `targetType=ACTIVITY&targetId=${event.id}`;
      assert.deepEqual(await (await fetchApi(`/api/comments?${legacyQuery}`)).json(), publicPage);
      const page = await fetchApi(`/comments?${legacyQuery}`);
      assert.equal(page.status, 200);
      assert.equal(new URL(page.url).pathname, `/quote/${quote.id}`);
      const activityPage = await fetchApi(`/activity/${event.id}`);
      assert.equal(activityPage.status, 200);
      assert.equal(new URL(activityPage.url).pathname, `/quote/${quote.id}`);
    }
    for (const path of [`/note/${note.id}`, `/comments?targetType=NOTE&targetId=${note.id}`, `/activity/${notePublication.id}`, `/comments?targetType=ACTIVITY&targetId=${notePublication.id}`]) {
      const page = await fetchApi(path);
      assert.equal(page.status, 200);
      assert.equal(new URL(page.url).pathname, `/note/${note.id}`);
    }
    const aliasRetry = await fetchApi("/api/comments", { method: "POST", headers, body: JSON.stringify({ ...payload, targetType: "ACTIVITY", targetId: liked.id }) });
    assert.equal(aliasRetry.status, 200);
    assert.equal((await aliasRetry.json()).comment.id, saved.comment.id);
    const readingPage = await fetchApi(`/comments?targetType=ACTIVITY&targetId=${reading.id}`);
    assert.equal(readingPage.status, 200);
    assert.equal(new URL(readingPage.url).pathname, `/activity/${reading.id}`);
    for (const target of [{ targetType: "NOTE", targetId: note.id }, { targetType: "ACTIVITY", targetId: reading.id }]) {
      const created = await fetchApi("/api/comments", { method: "POST", headers, body: JSON.stringify({ ...target, content: "Detail page comment", requestId: randomUUID() }) });
      assert.equal(created.status, 201);
      const { comment } = await created.json();
      const comments = await (await fetchApi(`/api/comments?${new URLSearchParams(target)}`)).json();
      assert.equal(comments.totalCount, 1);
      assert.equal(comments.comments[0].id, comment.id);
      assert.equal((await fetchApi(`/api/comments/${comment.id}`, { method: "DELETE", headers })).status, 200);
    }

    const likeHeaders = { Cookie: cookie(ownerId), Origin: base };
    assert.equal((await fetchApi(`/api/activity/${publication.id}/like`, { method: "POST" })).status, 401);
    for (const event of [publication, liked]) {
      const reaction = await fetchApi(`/api/activity/${event.id}/like`, { method: "POST", headers: likeHeaders });
      assert.equal(reaction.status, 200);
      assert.deepEqual(await reaction.json(), { liked: true, likeCount: 2 });
      const direct = await fetchApi(`/api/quotes/${quote.id}/like`, { method: "POST", headers: likeHeaders });
      assert.equal(direct.status, 200);
      assert.deepEqual(await direct.json(), { liked: false, likeCount: 1 });
    }
    for (const expected of [true, false]) {
      const reaction = await fetchApi(`/api/activity/${reading.id}/like`, { method: "POST", headers: likeHeaders });
      assert.deepEqual(await reaction.json(), { liked: expected, likeCount: expected ? 1 : 0 });
    }

    assert.equal((await fetchApi(`/api/comments/${saved.comment.id}`, { method: "PATCH", headers: { ...headers, Cookie: cookie(ownerId) }, body: JSON.stringify({ content: "Forbidden" }) })).status, 403);
    const edit = await fetchApi(`/api/comments/${saved.comment.id}`, { method: "PATCH", headers, body: JSON.stringify({ content: "Updated" }) });
    assert.equal(edit.status, 200);
    assert.equal((await edit.json()).comment.content, "Updated");
    await db.update(User).set({ profileVisibility: "PRIVATE" }).where(eq(User.id, ownerId));
    assert.equal((await fetchApi(quoteApi)).status, 404);
    assert.equal((await fetchApi(quoteApi, { headers })).status, 404);
    assert.equal((await fetchApi(quoteApi, { headers: ownerHeaders })).status, 200);
    assert.equal((await fetchApi(`/note/${note.id}`)).status, 404);
    assert.equal((await fetchApi(`/note/${note.id}`, { headers: { Cookie: cookie(ownerId) } })).status, 200);
    assert.equal((await fetchApi(`/api/activity/${publication.id}/like`, { method: "POST", headers })).status, 404);
    assert.equal((await fetchApi(query)).status, 404);
    assert.equal((await fetchApi(query, { headers: { Cookie: cookie(authorId) } })).status, 404);
    assert.equal((await fetchApi(query, { headers: { Cookie: cookie(ownerId) } })).status, 200);
    await db.update(User).set({ profileVisibility: "PUBLIC" }).where(eq(User.id, ownerId));
    const deletion = await fetchApi(`/api/comments/${saved.comment.id}`, { method: "DELETE", headers: { Cookie: cookie(ownerId), Origin: base } });
    assert.equal(deletion.status, 200);
    assert.equal((await deletion.json()).deletedCount, 1);
    assert.equal((await (await fetchApi(query)).json()).totalCount, 0);
    assert.equal((await fetchApi(`/quote/${quote.id}`)).status, 200);
  } finally {
    await db.delete(User).where(inArray(User.id, [ownerId, authorId]));
    await pool.end();
  }
});
