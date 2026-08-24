import assert from "node:assert/strict";
import test from "node:test";

import { slugify, uniqueSlug } from "@/lib/book/slug";

test("Persian and Arabic forms share the same public route key", () => {
  assert.equal(slugify("بیماری به سوی مرگ"), "بیماری-به-سوی-مرگ");
  assert.equal(slugify("بيماری‌به سوی مرگ"), "بیماری-به-سوی-مرگ");
  assert.equal(slugify("كافهٔ دوستان"), "کافه-دوستان");
});

test("punctuation and spacing normalize without joining words", () => {
  assert.equal(slugify("  می‌شود؛ کتابِ خوب! "), "می-شود-کتاب-خوب");
  assert.equal(slugify("کتاب — نسخهٔ دوم"), "کتاب-نسخه-دوم");
});

test("duplicate titles receive distinct canonical slugs", () => {
  const taken = new Set(["بیماری-به-سوی-مرگ", "بیماری-به-سوی-مرگ-2"]);
  assert.equal(
    uniqueSlug("بیماری به سوی مرگ", taken, "book-id"),
    "بیماری-به-سوی-مرگ-3",
  );
});
