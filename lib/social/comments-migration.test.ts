import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Pool } from "pg";

test("comment migration preserves publication threads, removes orphans and enforces cascades", { skip: !process.env.DATABASE_URL }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const schema = `comments_migration_${randomUUID().replaceAll("-", "")}`;
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}", public`);
    await client.query('CREATE TABLE "User" (id varchar PRIMARY KEY); CREATE TABLE "Quote" (id varchar PRIMARY KEY); CREATE TABLE "PublishedBookNote" (id varchar PRIMARY KEY); CREATE TABLE "Activity" (id varchar PRIMARY KEY, quote_id varchar, note_id varchar)');
    await client.query(readFileSync("drizzle/0070_social_comments.sql", "utf8"));
    await client.query(`INSERT INTO "User" VALUES ('author'); INSERT INTO "Quote" VALUES ('quote'); INSERT INTO "PublishedBookNote" VALUES ('note'); INSERT INTO "Activity" VALUES ('publication', 'quote', NULL)`);
    await client.query(`INSERT INTO "SocialComment" (id, target_type, target_id, author_user_id, content) VALUES ('root','ACTIVITY','publication','author','Original root'), ('orphan','QUOTE','gone','author','Unreachable')`);
    await client.query(`INSERT INTO "SocialComment" (id, target_type, target_id, author_user_id, parent_id, content) VALUES ('reply','ACTIVITY','publication','author','root','Original reply')`);
    await client.query(readFileSync("drizzle/0071_social_comment_integrity.sql", "utf8"));
    await client.query(readFileSync("drizzle/0072_social_comment_pagination_indexes.sql", "utf8"));
    const rows = (await client.query('SELECT id, target_type, target_id, quote_id, content, created_at = updated_at AS untouched FROM "SocialComment" ORDER BY id')).rows;
    assert.deepEqual(rows, [
      { id: "reply", target_type: "QUOTE", target_id: "quote", quote_id: "quote", content: "Original reply", untouched: true },
      { id: "root", target_type: "QUOTE", target_id: "quote", quote_id: "quote", content: "Original root", untouched: true },
    ]);
    await client.query(`INSERT INTO "Activity" VALUES ('liked', 'quote', NULL), ('liked-note', NULL, 'note'), ('reading', NULL, NULL)`);
    await client.query(`INSERT INTO "SocialComment" (id, target_type, target_id, activity_id, author_user_id, content) VALUES
      ('liked-root','ACTIVITY','liked','liked','author','Liked root'),
      ('note-root','ACTIVITY','liked-note','liked-note','author','Note root'),
      ('reading-root','ACTIVITY','reading','reading','author','Reading root')`);
    await client.query(`INSERT INTO "SocialComment" (id, target_type, target_id, activity_id, author_user_id, parent_id, content) VALUES ('liked-reply','ACTIVITY','liked','liked','author','liked-root','Liked reply')`);
    await client.query(readFileSync("drizzle/0074_content_activity_comments.sql", "utf8"));
    assert.deepEqual((await client.query(`SELECT id, target_type, target_id, quote_id, note_id, activity_id, parent_id, created_at = updated_at AS untouched FROM "SocialComment" WHERE id IN ('liked-root','liked-reply','note-root','reading-root') ORDER BY id`)).rows, [
      { id: "liked-reply", target_type: "QUOTE", target_id: "quote", quote_id: "quote", note_id: null, activity_id: null, parent_id: "liked-root", untouched: true },
      { id: "liked-root", target_type: "QUOTE", target_id: "quote", quote_id: "quote", note_id: null, activity_id: null, parent_id: null, untouched: true },
      { id: "note-root", target_type: "NOTE", target_id: "note", quote_id: null, note_id: "note", activity_id: null, parent_id: null, untouched: true },
      { id: "reading-root", target_type: "ACTIVITY", target_id: "reading", quote_id: null, note_id: null, activity_id: "reading", parent_id: null, untouched: true },
    ]);
    await client.query('DELETE FROM "Activity"');
    assert.equal((await client.query('SELECT count(*)::int AS count FROM "SocialComment"')).rows[0].count, 5);
    await client.query('DELETE FROM "Quote"');
    assert.equal((await client.query('SELECT count(*)::int AS count FROM "SocialComment"')).rows[0].count, 1);
    await client.query('DELETE FROM "PublishedBookNote"');
    assert.equal((await client.query('SELECT count(*)::int AS count FROM "SocialComment"')).rows[0].count, 0);
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
