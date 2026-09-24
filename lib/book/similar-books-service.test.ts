import assert from "node:assert/strict";
import test from "node:test";

// The selector and no-config path never connect, but the db module requires a URL at import time.
process.env.DATABASE_URL ??= "postgres://localhost/unused";
const service = import("./similar-books-service");

const book = (id: string, extras: Record<string, unknown> = {}) => ({
  id, slug: `book-${id}`, title: `Book ${id}`, author: `Author ${id}`, coverImage: null, ...extras,
});

test("curated order survives unordered rows and missing references", async () => {
  const { selectSimilarBooks } = await service;
  const results = selectSimilarBooks("source", ["b", "missing", "a", "c"], [book("c"), book("a"), book("b")]);
  assert.deepEqual(results.map((item) => item.id), ["b", "a", "c"]);
});

test("source, duplicate works, and invalid public records are excluded", async () => {
  const { selectSimilarBooks } = await service;
  const results = selectSimilarBooks(
    "source",
    ["source", "a", "a", "pending", "no-slug", "test", "b"],
    [book("source"), book("a"), book("pending", { status: "PENDING" }),
      book("no-slug", { slug: null }), book("test", { title: "[TEST:pagination]" }), book("b")],
  );
  assert.deepEqual(results.map((item) => item.id), ["a", "b"]);
});

test("results are bounded to six canonical works", async () => {
  const { selectSimilarBooks } = await service;
  const ids = Array.from({ length: 9 }, (_, index) => String(index));
  assert.deepEqual(selectSimilarBooks("source", ids, ids.map((id) => book(id))).map((item) => item.id), ids.slice(0, 6));
});

test("a book without curated relations returns nothing without querying", async () => {
  const { getSimilarBooks } = await service;
  assert.deepEqual(await getSimilarBooks("unconfigured-book"), []);
});
