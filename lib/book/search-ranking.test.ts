import assert from "node:assert/strict";
import test from "node:test";

import { deterministicSearchRank } from "@/lib/book/search-ranking";

test("edition titles remain discoverable while canonical titles rank first", () => {
  assert.equal(deterministicSearchRank("آنا کارنینا", "آناکارنینا", "CANONICAL_TITLE"), 0);
  assert.equal(deterministicSearchRank("آنا کارنینا", "آنا کارنینا (ترجمهٔ سروش حبیبی)", "EDITION_TITLE"), 4);
  assert.equal(deterministicSearchRank("سروش حبیبی", "سروش حبیبی", "METADATA"), 2);
  assert.equal(deterministicSearchRank("نشر چشمه", "نشر چشمه", "METADATA"), 2);
  assert.equal(deterministicSearchRank("تولستوی", "لئو تولستوی", "AUTHOR"), null);
});
