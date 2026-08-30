import assert from "node:assert/strict";
import test from "node:test";

import {
  hasAuthorArchiveSearchChanged,
  parseAuthorArchiveSearchParams,
  toAuthorArchiveSearchParams,
} from "@/lib/reference/author-archive-search";

test("authors archive defaults to TOP rather than alphabetical order", () => {
  const filters = parseAuthorArchiveSearchParams({});
  assert.equal(filters.sort, "TOP");
  assert.equal(toAuthorArchiveSearchParams(filters).toString(), "");
});

test("authors archive accepts valid sort and filter URL state", () => {
  const filters = parseAuthorArchiveSearchParams({
    q: "زولا", country: "فرانسه", minBooks: "10", minRating: "4.5", sort: "HIGHEST_RATED", page: "3",
  });
  assert.deepEqual(filters, { q: "زولا", country: "فرانسه", minBooks: 10, minRating: 4.5, sort: "HIGHEST_RATED", page: 3 });
  assert.equal(toAuthorArchiveSearchParams(filters).toString(), "q=%D8%B2%D9%88%D9%84%D8%A7&country=%D9%81%D8%B1%D8%A7%D9%86%D8%B3%D9%87&minBooks=10&minRating=4.5&sort=HIGHEST_RATED&page=3");
});

test("authors archive rejects unsupported thresholds and sort values", () => {
  const filters = parseAuthorArchiveSearchParams({ minBooks: "7", minRating: "2", sort: "NAME" });
  assert.equal(filters.minBooks, null);
  assert.equal(filters.minRating, null);
  assert.equal(filters.sort, "TOP");
});

test("initial URL state does not count as a search change and reset its page", () => {
  const filters = parseAuthorArchiveSearchParams({ q: "زولا", page: "5" });
  assert.equal(hasAuthorArchiveSearchChanged(filters, "زولا"), false);
  assert.equal(hasAuthorArchiveSearchChanged(filters, "بالزاک"), true);
});
