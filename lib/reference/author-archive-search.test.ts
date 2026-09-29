import assert from "node:assert/strict";
import test from "node:test";

import {
  hasAuthorArchiveSearchChanged,
  parseAuthorArchiveSearchParams,
  toAuthorArchiveSearchParams,
} from "@/lib/reference/author-archive-search";

test("authors archive defaults to top authors", () => {
  const filters = parseAuthorArchiveSearchParams({});
  assert.equal(filters.sort, "TOP");
  assert.equal(toAuthorArchiveSearchParams(filters).toString(), "");
});

test("authors archive accepts valid sort and filter URL state", () => {
  const filters = parseAuthorArchiveSearchParams({
    q: "زولا", country: "فرانسه", minRating: "4.5", sort: "HIGHEST_RATED", page: "3",
  });
  assert.deepEqual(filters, { q: "زولا", country: "فرانسه", minRating: 4.5, sort: "HIGHEST_RATED", page: 3 });
  assert.equal(toAuthorArchiveSearchParams(filters).toString(), "q=%D8%B2%D9%88%D9%84%D8%A7&country=%D9%81%D8%B1%D8%A7%D9%86%D8%B3%D9%87&minRating=4.5&sort=HIGHEST_RATED&page=3");
});

test("authors archive rejects unsupported ratings and sort values and ignores old book-count filters", () => {
  const filters = parseAuthorArchiveSearchParams({ minBooks: "7", minRating: "2", sort: "NAME" });
  assert.equal(filters.minRating, null);
  assert.equal(filters.sort, "TOP");
  assert.equal(toAuthorArchiveSearchParams(filters).toString(), "");
});

test("most-books remains an explicit sort option", () => {
  const filters = parseAuthorArchiveSearchParams({ sort: "MOST_BOOKS" });
  assert.equal(toAuthorArchiveSearchParams(filters).toString(), "sort=MOST_BOOKS");
});

test("initial URL state does not count as a search change and reset its page", () => {
  const filters = parseAuthorArchiveSearchParams({ q: "زولا", page: "5" });
  assert.equal(hasAuthorArchiveSearchChanged(filters, "زولا"), false);
  assert.equal(hasAuthorArchiveSearchChanged(filters, "بالزاک"), true);
});
