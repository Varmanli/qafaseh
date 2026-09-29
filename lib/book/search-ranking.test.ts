import assert from "node:assert/strict";
import test from "node:test";

import { deterministicSearchRank } from "@/lib/book/search-ranking";

test("edition titles remain discoverable while canonical titles rank first", () => {
  assert.equal(deterministicSearchRank("آنا کارنینا", "آناکارنینا", "CANONICAL_TITLE"), 0);
  assert.equal(deterministicSearchRank("آنا کارنینا", "آنا کارنینا (ترجمهٔ سروش حبیبی)", "EDITION_TITLE"), 3);
  assert.equal(deterministicSearchRank("سروش حبیبی", "سروش حبیبی", "TRANSLATOR"), 9);
  assert.equal(deterministicSearchRank("نشر چشمه", "نشر چشمه", "PUBLISHER"), 12);
  assert.equal(deterministicSearchRank("تولستوی", "لئو تولستوی", "AUTHOR"), 8);
});

test("title ranks ahead of author and metadata for Persian variants", () => {
  const query = "  مريخي  ";
  assert.equal(deterministicSearchRank(query, "مریخی", "CANONICAL_TITLE"), 0);
  assert.equal(deterministicSearchRank(query, "مریخی‌ها", "CANONICAL_TITLE"), 2);
  assert.equal(deterministicSearchRank(query, "داستان مریخی", "CANONICAL_TITLE"), 4);
  assert.equal(deterministicSearchRank(query, "مریخی", "AUTHOR"), 6);
  assert.equal(deterministicSearchRank(query, "داستان مریخی", "AUTHOR"), 8);
  assert.equal(deterministicSearchRank(query, "مریخی", "GENRE"), 15);
  assert.equal(deterministicSearchRank("كتاب", "کتاب", "CANONICAL_TITLE"), 0);
  assert.equal(deterministicSearchRank("martian", "THE MARTIAN", "CANONICAL_TITLE"), 4);
  assert.equal(deterministicSearchRank("  ", "مریخی", "CANONICAL_TITLE"), null);
});
