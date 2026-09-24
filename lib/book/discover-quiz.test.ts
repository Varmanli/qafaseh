import assert from "node:assert/strict";
import test from "node:test";

import { moods, topics } from "./discover-config";
import { selectDiscoveryIds } from "./discovery-signals";
import { scoreQuizBook, selectQuizBooks, type QuizCandidate } from "./discover-quiz";

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
  const newBook = book("new", { genre: "داستان معمایی" });
  const answers = { kind: "any", mood: "dark", commitment: "any" };
  assert(scoreQuizBook(curated, answers).editorialScore > 0);
  assert(scoreQuizBook(newBook, answers).score > scoreQuizBook(curated, answers).score);
  assert.deepEqual(selectDiscoveryIds([curated, newBook], moods[0]), ["new", "curated"]);
});

test("commitment uses edition length and missing length stays eligible", () => {
  const answers = { kind: "any", mood: "any", commitment: "short" };
  assert.equal(scoreQuizBook(book("short", { pageCount: 200 }), answers).score, 2);
  assert.equal(scoreQuizBook(book("medium", { pageCount: 350 }), answers).score, 0);
  assert.equal(scoreQuizBook(book("unknown"), answers).score, 0);
  assert.equal(scoreQuizBook(book("medium", { pageCount: 350 }), { ...answers, commitment: "medium" }).score, 2);
  assert.equal(scoreQuizBook(book("long", { pageCount: 500 }), { ...answers, commitment: "long" }).score, 2);
});

test("reroll, fallback and canonical de-duplication return three public books", () => {
  const candidates = Array.from({ length: 9 }, (_, index) => book(String(index)));
  candidates.push(book("0"), book("hidden", { status: "PENDING" }), book("private", { visibility: "PRIVATE" }), book("test", { title: "[TEST:fixture]" }));
  const answers = { kind: "reflective", mood: "calm", commitment: "long" };
  const first = selectQuizBooks(candidates, answers);
  const next = selectQuizBooks(candidates, answers, first.map((item) => item.id));
  assert.equal(first.length, 3);
  assert.equal(next.length, 3);
  assert.equal(new Set([...first, ...next].map((item) => item.id)).size, 6);
  assert(![...first, ...next].some((item) => ["hidden", "private", "test"].includes(item.id)));
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
