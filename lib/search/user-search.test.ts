import assert from "node:assert/strict";
import test from "node:test";

// Query construction is read-only; Pool initialization needs a URL but never connects.
process.env.DATABASE_URL ||= "postgres://localhost/qafaseh_query_test";
const userSearch = import("@/lib/search/user-search");

test("user queries strip one leading @ and keep username spelling", async () => {
  const { normalizeUserSearchQuery } = await userSearch;
  assert.equal(normalizeUserSearchQuery("  @Amir_42  "), "amir_42");
  assert.equal(normalizeUserSearchQuery("  امیر  "), "امیر");
  assert.equal(normalizeUserSearchQuery(" @ "), "");
});

test("public user query selects only display fields and ranks strong matches first", async () => {
  const { buildPublicUserSearchQuery } = await userSearch;
  const { sql, params } = buildPublicUserSearchQuery("@amir", 6).toSQL();
  const projection = sql.slice(0, sql.toLowerCase().indexOf(" from ")).toLowerCase();
  assert.match(projection, /username/);
  assert.match(projection, /name/);
  assert.match(projection, /image/);
  assert.doesNotMatch(projection, /email|password|google_id|session_version|role/);
  assert.match(sql, /profile_visibility/);
  assert.match(sql, /is not null/);
  assert.match(sql, /trim\(/);
  assert.match(sql, /then 0[\s\S]*then 1[\s\S]*then 2[\s\S]*then 3[\s\S]*then 4[\s\S]*else 5/);
  assert.ok(params.includes("PUBLIC"));
  assert.ok(params.includes("amir"));
  assert.ok(params.includes(6));
});

test("user preview query is bounded before results reach the client", async () => {
  const { buildPublicUserSearchQuery } = await userSearch;
  const { params } = buildPublicUserSearchQuery("amir", 500, 20).toSQL();
  assert.ok(params.includes(50));
  assert.ok(params.includes(20));
});
