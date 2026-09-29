import assert from "node:assert/strict";
import test from "node:test";

import { parseBookArchiveSearchParams, toBookArchiveSearchParams } from "@/lib/book/archive-search";

test("search defaults to relevance without changing archive or explicit sorts", () => {
  assert.equal(parseBookArchiveSearchParams({}).sort, "POPULAR");
  const searched = parseBookArchiveSearchParams({ q: "  مريخي  ", genre: "علمی", page: "2" });
  assert.equal(searched.sort, "RELEVANCE");
  assert.equal(searched.q, "  مريخي  ");
  assert.equal(searched.genre, "علمی");
  assert.equal(searched.page, 2);
  assert.equal(toBookArchiveSearchParams(searched).get("sort"), null);
  assert.equal(parseBookArchiveSearchParams({ q: "مریخی", sort: "NEWEST" }).sort, "NEWEST");
  assert.equal(toBookArchiveSearchParams(parseBookArchiveSearchParams({ q: "مریخی", sort: "POPULAR" })).get("sort"), "POPULAR");
  assert.equal(parseBookArchiveSearchParams({ q: "  " }).sort, "POPULAR");
  assert.equal(parseBookArchiveSearchParams({ sort: "RELEVANCE" }).sort, "POPULAR");
});
