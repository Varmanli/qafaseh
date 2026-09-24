import assert from "node:assert/strict";
import test from "node:test";

import type { CatalogDiscoverySignals } from "./discovery-signals";

process.env.DATABASE_URL ??= "postgres://localhost/unused";
const service = import("./similar-books-service");

const book = (id: string, extras: Partial<CatalogDiscoverySignals> = {}): CatalogDiscoverySignals => ({
  id, slug: `new-${id}`, title: `Book ${id}`, author: `Author ${id}`,
  contributorIds: [], genre: null, country: null, language: null, firstPublishedYear: null, pageCount: null, ...extras,
});

test("curated relations keep priority/order, then metadata fills remaining slots", async () => {
  const { selectSimilarBookIds } = await service;
  const source = book("source", { genre: "داستان فانتزی" });
  const rows = [book("new", { genre: "داستان فانتزی" }), book("b"), book("a"), book("unrelated")];
  assert.deepEqual(selectSimilarBookIds(source, ["b", "missing", "a"], rows), ["b", "a", "new"]);
});

test("new books work in both directions without curated config", async () => {
  const { selectSimilarBookIds } = await service;
  const oldBook = book("old", { genre: "داستان معمایی" });
  const newBook = book("new", { genre: "داستان معمایی" });
  assert.deepEqual(selectSimilarBookIds(newBook, [], [oldBook]), ["old"]);
  assert.deepEqual(selectSimilarBookIds(oldBook, [], [newBook]), ["new"]);
});

test("shared genre and same author increase similarity", async () => {
  const { selectSimilarBookIds } = await service;
  const source = book("source", { genre: "داستان معمایی", author: "A" });
  const related = book("related", { genre: "داستان معمایی" });
  const author = book("author", { author: "A" });
  const generic = book("generic", { genre: "داستان" });
  assert.deepEqual(new Set(selectSimilarBookIds(source, [], [generic, related, author])), new Set(["author", "related"]));
});

test("structured author identity works across display-name variants", async () => {
  const { selectSimilarBookIds } = await service;
  const source = book("source", { author: "A", contributorIds: ["person-1"] });
  const translatedName = book("target", { author: "A variant", contributorIds: ["person-1"] });
  assert.deepEqual(selectSimilarBookIds(source, [], [translatedName]), ["target"]);
});

test("self, duplicate canonical rows, hidden books and test books are excluded", async () => {
  const { selectSimilarBookIds } = await service;
  const source = book("source", { genre: "داستان فانتزی" });
  const related = book("related", { genre: "داستان فانتزی" });
  const rows = [source, related, related, book("pending", { genre: "داستان فانتزی", status: "PENDING" }),
    book("test", { genre: "داستان فانتزی", title: "[TEST:fixture]" })];
  assert.deepEqual(selectSimilarBookIds(source, ["source", "pending"], rows), ["related"]);
});

test("results are bounded to six canonical works", async () => {
  const { selectSimilarBookIds } = await service;
  const source = book("source", { genre: "داستان فانتزی" });
  const rows = Array.from({ length: 20 }, (_, index) => book(String(index), { genre: "داستان فانتزی" }));
  assert.equal(selectSimilarBookIds(source, [], rows).length, 6);
});

test("a broad fiction label alone does not imply similarity", async () => {
  const { selectSimilarBookIds } = await service;
  const source = book("source", { genre: "ادبیات داستانی" });
  const generic = book("generic", { genre: "ادبیات داستانی" });
  assert.deepEqual(selectSimilarBookIds(source, [], [generic]), []);
});

test("automatic results prefer specific taxonomy and diversify near-equal authors", async () => {
  const { selectSimilarBookIds } = await service;
  const source = book("source", { genre: "داستان فانتزی", author: "Source" });
  const candidates = [
    ...Array.from({ length: 5 }, (_, index) => book(`same-${index}`, { genre: "داستان فانتزی", author: "Prolific" })),
    book("other", { genre: "داستان فانتزی", author: "Other" }),
    book("weak", { genre: "ادبیات داستانی", author: "Other" }),
  ];
  const selected = selectSimilarBookIds(source, [], candidates, "2026-09-24");
  assert(selected.includes("other"));
  assert(!selected.includes("weak"));
});
