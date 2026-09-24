import assert from "node:assert/strict";
import test from "node:test";

import { moods, topics } from "./discover-config";
import { selectDiscoveryIds } from "./discovery-signals";
import { scoreQuizBook, selectQuizBooks, type QuizCandidate } from "./discover-quiz";
import { discoveryDay } from "./recommendation-ranking";

const book = (id: string, extras: Partial<QuizCandidate> = {}): QuizCandidate => ({
  id, slug: `new-${id}`, title: `Book ${id}`, author: `Author ${id}`,
  contributorIds: [], genre: null, country: null, language: null, firstPublishedYear: null, pageCount: null, ...extras,
});

test("new non-curated books enter Discover and quiz through real genres", () => {
  const newBook = book("new", { genre: "داستان معمایی، داستان تریلر" });
  assert.deepEqual(selectDiscoveryIds([newBook], moods[0]), ["new"]);
  assert.equal(selectDiscoveryIds([newBook], topics[0]).length, 0); // No invented identity topic.
  const scored = scoreQuizBook(newBook, { kind: "exciting", mood: "dark", commitment: "any" });
  assert.equal(scored.metadataScore, 8);
  assert.equal(scored.editorialScore, 0);
  assert.equal(selectQuizBooks([newBook, book("other"), book("third")], { kind: "exciting", mood: "dark", commitment: "any" })[0].id, "new");
});

test("curated traits boost but never restrict candidates", () => {
  const curated = book("curated", { slug: "دیزی-دارکر" });
  const newBook = book("new", { genre: "داستان تریلر" });
  const answers = { kind: "any", mood: "dark", commitment: "any" };
  assert(scoreQuizBook(curated, answers).editorialScore > 0);
  assert(scoreQuizBook(newBook, answers).score > scoreQuizBook(curated, answers).score);
  assert.deepEqual(selectDiscoveryIds([curated, newBook], moods[0]), ["new", "curated"]);
});

test("commitment uses edition length and missing length stays eligible", () => {
  const answers = { kind: "any", mood: "any", commitment: "short" };
  assert.equal(scoreQuizBook(book("short", { pageCount: 200 }), answers).score, 1.5);
  assert.equal(scoreQuizBook(book("medium", { pageCount: 350 }), answers).score, -0.5);
  assert.equal(scoreQuizBook(book("unknown"), answers).score, 0);
  assert.equal(scoreQuizBook(book("invalid", { pageCount: 0 }), answers).score, 0);
  assert.equal(scoreQuizBook(book("medium", { pageCount: 350 }), { ...answers, commitment: "medium" }).score, 1.5);
  assert.equal(scoreQuizBook(book("long", { pageCount: 500 }), { ...answers, commitment: "long" }).score, 1.5);
});

test("reroll keeps relevant books, excludes shown IDs and deduplicates canonical works", () => {
  const candidates = Array.from({ length: 9 }, (_, index) => book(String(index), { genre: "داستان تریلر" }));
  candidates.push(book("0"), book("hidden", { status: "PENDING" }), book("private", { visibility: "PRIVATE" }), book("test", { title: "[TEST:fixture]" }));
  const answers = { kind: "exciting", mood: "dark", commitment: "any" };
  const first = selectQuizBooks(candidates, answers);
  const next = selectQuizBooks(candidates, answers, first.map((item) => item.id));
  assert.equal(first.length, 3);
  assert.equal(next.length, 3);
  assert.equal(new Set([...first, ...next].map((item) => item.id)).size, 6);
  assert(![...first, ...next].some((item) => ["hidden", "private", "test"].includes(item.id)));
});

test("reroll may return fewer books without padding with weak matches", () => {
  const answers = { kind: "any", mood: "dark", commitment: "any" };
  const candidates = [book("a", { genre: "داستان تریلر" }), book("b", { genre: "داستان تریلر" }), book("irrelevant")];
  assert.equal(selectQuizBooks(candidates, answers, ["a"], "2026-09-24").length, 1);
  assert.deepEqual(selectQuizBooks(candidates, answers, ["a", "b"], "2026-09-24"), []);
});

test("the daily seed changes at Tehran midnight, not UTC midnight", () => {
  assert.equal(discoveryDay(new Date("2026-09-24T20:29:59Z")), "2026-09-24");
  assert.equal(discoveryDay(new Date("2026-09-24T20:30:00Z")), "2026-09-25");
  assert.equal(discoveryDay(new Date("2026-09-25T00:00:00Z")), "2026-09-25");
});

test("exact metadata outranks weak curation and seeded rotation", () => {
  const curated = book("a-old", { slug: "دیزی-دارکر" });
  const strong = book("z-new", { genre: "داستان تریلر" });
  const answers = { kind: "any", mood: "dark", commitment: "any" };
  for (const day of ["2026-09-24", "2026-09-25"]) {
    assert.equal(selectQuizBooks([curated, strong], answers, [], day)[0].id, "z-new");
    assert.equal(selectDiscoveryIds([curated, strong], moods[0], 2, day)[0], "z-new");
  }
  assert(scoreQuizBook(strong, answers).score > scoreQuizBook(curated, answers).score);
});

test("curation wins a relevance tie, but unknown page count is still eligible", () => {
  const ordinary = book("ordinary", { genre: "داستان تریلر" });
  const curated = book("curated", { slug: "دیزی-دارکر", genre: "داستان تریلر" });
  const answers = { kind: "exciting", mood: "dark", commitment: "short" };
  assert.equal(selectQuizBooks([ordinary, curated], answers)[0].id, "curated");
  assert(selectQuizBooks([ordinary], answers).some((item) => item.id === "ordinary"));
  assert(!scoreQuizBook(ordinary, answers).reason?.includes("کوتاه"));
});

test("equal matches rotate by day but stay fixed for the same seed and input order", () => {
  const candidates = Array.from({ length: 24 }, (_, index) => book(`id-${index}`, { genre: "داستان تریلر" }));
  const answers = { kind: "any", mood: "dark", commitment: "any" };
  const first = selectQuizBooks(candidates, answers, [], "2026-09-24");
  assert.deepEqual(first, selectQuizBooks([...candidates].reverse(), answers, [], "2026-09-24"));
  const rotated = selectQuizBooks(candidates, answers, [], "2026-09-25");
  assert.notDeepEqual(first.map((item) => item.id), rotated.map((item) => item.id));
});

test("similarly relevant alternatives prevent one author filling the quiz", () => {
  const candidates = [
    ...Array.from({ length: 5 }, (_, index) => book(`same-${index}`, { author: "One", genre: "داستان تریلر" })),
    book("other-1", { author: "Two", genre: "داستان تریلر" }),
    book("other-2", { author: "Three", genre: "داستان تریلر" }),
  ];
  const selected = selectQuizBooks(candidates, { kind: "any", mood: "dark", commitment: "any" });
  assert.equal(new Set(selected.map(({ id }) => candidates.find((item) => item.id === id)?.author)).size, 3);
});

test("same-score selection is deterministic and diversifies authors", () => {
  const candidates = [
    book("a", { author: "One" }), book("b", { author: "One" }),
    book("c", { author: "Two" }), book("d", { author: "Three" }),
  ];
  const answers = { kind: "any", mood: "any", commitment: "any" };
  const selected = selectQuizBooks(candidates, answers);
  assert.deepEqual(selected, selectQuizBooks([...candidates].reverse(), answers));
  assert.equal(new Set(selected.map(({ id }) => candidates.find((item) => item.id === id)!.author)).size, 3);
});
