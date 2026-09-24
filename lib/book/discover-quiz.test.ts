import assert from "node:assert/strict";
import test from "node:test";

import { scoreQuizBook, selectQuizBooks, type QuizCandidate } from "./discover-quiz";

const book = (id: string, slug: string, author = id, extras: Partial<QuizCandidate> = {}): QuizCandidate => ({
  id, slug, title: slug, author, coverImage: null, ...extras,
});

test("exact matches score above partial matches", () => {
  const answers = { kind: "exciting", mood: "dark", commitment: "medium" };
  assert.equal(scoreQuizBook(book("a", "دیزی-دارکر"), answers).score, 7);
  assert.equal(scoreQuizBook(book("b", "جناح-چهارم"), answers).score, 2);
});

test("missing traits fall back to the nearest three valid books", () => {
  const candidates = [book("a", "بادام"), book("b", "کوچک-هوگا"), book("c", "ژرمینال"), book("d", "گامبی-وزیر")];
  const results = selectQuizBooks(candidates, { kind: "literary", mood: "calm", commitment: "short" });
  assert.equal(results.length, 3);
  assert.deepEqual(new Set(results.map((item) => item.id)).size, 3);
  assert.equal(results[0].id, "b");
});

test("reroll excludes the currently shown books", () => {
  const candidates = ["بادام", "کوچک-هوگا", "ژرمینال", "گامبی-وزیر", "دیزی-دارکر", "جناح-چهارم"]
    .map((slug, index) => book(String(index), slug));
  const answers = { kind: "any", mood: "any", commitment: "any" };
  const first = selectQuizBooks(candidates, answers);
  const next = selectQuizBooks(candidates, answers, first.map((item) => item.id));
  assert.equal(first.length, 3);
  assert.equal(next.length, 3);
  assert.equal(next.some((item) => first.some((prior) => prior.id === item.id)), false);
});

test("unapproved, private, test, and duplicate canonical books are excluded", () => {
  const candidates = [
    book("a", "بادام"), book("a", "بادام"),
    book("b", "دیزی-دارکر"), book("c", "ژرمینال"),
    book("d", "گامبی-وزیر", "d", { status: "PENDING" }),
    book("e", "کوچک-هوگا", "e", { visibility: "PRIVATE" }),
    book("f", "test-pagination-book-001", "f", { title: "[TEST:pagination] fake" }),
  ];
  assert.deepEqual(new Set(selectQuizBooks(candidates, { kind: "any", mood: "any", commitment: "any" }).map((item) => item.id)), new Set(["a", "b", "c"]));
});

test("equal scores have stable order and prefer distinct authors", () => {
  const candidates = [
    book("a", "دیزی-دارکر", "آلیس فینی"),
    book("b", "سنگ-کاغذ-قیچی", "آلیس فینی"),
    book("c", "جناح-چهارم", "ربکا یاروس"),
    book("d", "گامبی-وزیر", "والتر تویس"),
  ];
  const answers = { kind: "exciting", mood: "any", commitment: "any" };
  const chosen = selectQuizBooks(candidates, answers);
  assert.deepEqual(chosen.map((item) => item.id), selectQuizBooks([...candidates].reverse(), answers).map((item) => item.id));
  assert.equal(new Set(chosen.map((item) => candidates.find((book) => book.id === item.id)!.author)).size, 3);
});
