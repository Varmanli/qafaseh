// Run with: npx tsx --env-file=.env scripts/benchmark-social.ts
// Scale fixtures live in temporary tables and are rolled back.
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { randomUUID } from "node:crypto";
import { db, pool } from "@/db";
import { getFollowingFeed, getProfileActivityPage, getProfileRecentActivity } from "@/lib/social/activity";
import { getSocialComments } from "@/lib/social/comments";
import { getFollowState } from "@/lib/social/follow";
import { getLatestPublicQuotes } from "@/lib/quotes/service";
import { sql } from "drizzle-orm";
import { signJwt } from "@/lib/jwt";
import { AUTH_COOKIE } from "@/lib/auth/constants";

async function main() {
  const client = await pool.connect();
  const originalQuery = pool.query;
  let queries: Array<{ text: string; values: unknown[] }> = [];
  let useFixtures = false;
  pool.query = new Proxy(originalQuery, {
    apply(target, context, args) {
      const query = args[0];
      queries.push({ text: typeof query === "string" ? query : query.text, values: query.values || args[1] || [] });
      return Reflect.apply(useFixtures ? client.query : target, useFixtures ? client : context, args);
    },
  });
  async function measure(name: string, operation: () => Promise<unknown>) {
    await operation();
    const samples: number[] = [];
    let payload = "", count = 0;
    for (let i = 0; i < 7; i++) {
      queries = [];
      const start = performance.now();
      payload = JSON.stringify(await operation());
      samples.push(performance.now() - start);
      count = queries.length;
    }
    samples.sort((a, b) => a - b);
    console.log(JSON.stringify({ name, medianMs: Math.round(samples[3] * 10) / 10, maxMs: Math.round(samples[6] * 10) / 10, queries: count, payloadBytes: Buffer.byteLength(payload), gzipBytes: gzipSync(payload).length }));
    if (useFixtures) for (const query of queries) {
      const plan = (await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query.text}`, query.values)).rows[0]["QUERY PLAN"][0];
      console.log(JSON.stringify({ name, sqlMs: plan["Execution Time"], plan: plan.Plan }));
    }
  }
  try {
    const { rows } = await db.execute<{ id: string }>(sql`select id from "User" where username = 'varmanli'`);
    const actor = rows[0]?.id;
    if (actor) {
      await measure("live/profile-3", () => getProfileRecentActivity(actor, undefined, 3));
      await measure("live/follow-state", () => getFollowState(actor));
      await measure("live/latest-quotes", () => getLatestPublicQuotes(10));
      if (process.env.PERF_BASE_URL) {
        const base = process.env.PERF_BASE_URL;
        assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
        const viewer = randomUUID();
        try {
          await pool.query(`INSERT INTO "User" (id,name,username,profile_visibility) VALUES ($1,'Performance check',$2,'PRIVATE')`, [viewer, `perf_${viewer.slice(0, 8)}`]);
          await pool.query(`INSERT INTO "Follow" (follower_id,following_id) VALUES ($1,$2)`, [viewer, actor]);
          const headers = { Cookie: `${AUTH_COOKIE}=${signJwt({ id: viewer, sessionVersion: 0 })}` };
          const quote = (await pool.query(`SELECT id FROM "Quote" WHERE user_id = $1 LIMIT 1`, [actor])).rows[0]?.id;
          const note = (await pool.query(`SELECT id FROM "PublishedBookNote" WHERE user_id = $1 LIMIT 1`, [actor])).rows[0]?.id;
          for (const route of ["/", "/feed", "/varmanli", "/api/feed", quote ? `/quote/${quote}` : null, note ? `/note/${note}` : null, note ? `/api/comments?targetType=NOTE&targetId=${note}` : null].filter((route): route is string => !!route)) {
            const samples: number[] = [], starts: number[] = [];
            let html = "";
            for (let i = 0; i < 8; i++) {
              const start = performance.now();
              const response = await fetch(base + route, { headers, signal: AbortSignal.timeout(30000) });
              const ttfb = performance.now() - start;
              assert.equal(response.status, 200, route);
              html = await response.text();
              if (i) { samples.push(performance.now() - start); starts.push(ttfb); }
            }
            samples.sort((a,b) => a-b); starts.sort((a,b) => a-b);
            const scripts = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]))];
            let jsGzipBytes = 0, eagerRichEditor = false;
            for (const src of scripts) {
              const response = await fetch(new URL(src, base));
              assert.equal(response.status, 200, src);
              const source = Buffer.from(await response.arrayBuffer());
              jsGzipBytes += gzipSync(source).length;
              eagerRichEditor ||= /ProseMirror|tiptap/i.test(source.toString());
            }
            console.log(JSON.stringify({ name: "http" + route.split("?")[0], ttfbMedianMs: Math.round(starts[3]), medianMs: Math.round(samples[3]), maxMs: Math.round(samples[6]), gzipBytes: gzipSync(html).length, jsGzipBytes, scriptCount:scripts.length, eagerRichEditor }));
          }
        } finally { await pool.query(`DELETE FROM "User" WHERE id = $1`, [viewer]); }
      }
    }
    await client.query("BEGIN");
    for (const table of ["User", "Book", "BookEdition", "CatalogBook", "Follow", "Quote", "PublishedBookNote", "Activity", "ActivityLike", "QuoteLike", "PublishedBookNoteLike", "SocialComment"]) {
      await client.query(`CREATE TEMP TABLE "${table}" (LIKE public."${table}" INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING INDEXES) ON COMMIT DROP`);
    }
    await client.query(`
      INSERT INTO "User" (id,username,name) VALUES ('perf-viewer','perf-viewer','Viewer'), ('perf-actor','perf-actor','Actor');
      INSERT INTO "Book" (id,user_id,title,author,genre,format) VALUES ('perf-book','perf-actor','Performance book','Writer','Novel','PHYSICAL');
      INSERT INTO "Follow" (follower_id,following_id) VALUES ('perf-viewer','perf-actor');
      INSERT INTO "Activity" (id,actor_user_id,type,book_id,created_at)
        SELECT gen_random_uuid(), 'perf-actor','STARTED_READING','perf-book', timestamp '2026-01-01' + n * interval '1 second' FROM generate_series(1,50000) n;
      INSERT INTO "PublishedBookNote" (id,user_id,book_id,content) VALUES ('perf-note','perf-actor','perf-book',repeat('<p>A long note about reading.</p>',2000));
      INSERT INTO "Activity" (actor_user_id,type,book_id,note_id,created_at) VALUES ('perf-actor','PUBLISHED_NOTE','perf-book','perf-note','2026-06-01');
      INSERT INTO "SocialComment" (target_type,target_id,note_id,author_user_id,content,created_at)
        SELECT 'NOTE','perf-note','perf-note','perf-viewer','Comment ' || n, timestamp '2026-01-01' + n * interval '1 second' FROM generate_series(1,100000) n;
    `);
    for (const table of ["User", "Book", "BookEdition", "CatalogBook", "Follow", "Quote", "PublishedBookNote", "Activity", "ActivityLike", "QuoteLike", "PublishedBookNoteLike", "SocialComment"]) await client.query(`ANALYZE "${table}"`);
    useFixtures = true;
    await measure("scale/feed-20", () => getFollowingFeed("perf-viewer", null));
    await measure("scale/home-3", () => getFollowingFeed("perf-viewer", null, 3, false));
    const summary = await getFollowingFeed("perf-viewer", null, 3, false);
    assert.equal(summary.items[0].note, null);
    assert.equal(summary.items[0].commentCount, 100000);
    assert.equal(summary.items.length, 3);
    await measure("scale/profile-3", () => getProfileRecentActivity("perf-actor", undefined, 3));
    const first = await getProfileActivityPage("perf-actor", undefined);
    assert.equal(first.items.length, 12);
    await measure("scale/profile-page-2", () => getProfileActivityPage("perf-actor", undefined, first.nextCursor));
    await measure("scale/comments-20", () => getSocialComments("NOTE", "perf-note"));
    await measure("scale/follow-state", () => getFollowState("perf-actor", "perf-viewer"));
  } finally {
    pool.query = originalQuery;
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
