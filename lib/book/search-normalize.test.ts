import assert from "node:assert/strict";
import test from "node:test";

import { compactSearchText, normalizeSearchText } from "@/lib/book/search-normalize";

test("Persian book queries normalize spacing, half-spaces, and Arabic letters", () => {
  assert.equal(compactSearchText("آنا کارنینا"), "آناکارنینا");
  assert.equal(compactSearchText("آنا‌کارنینا"), "آناکارنینا");
  assert.equal(compactSearchText("آناکارنینا"), "آناکارنینا");
  assert.equal(compactSearchText("كليد يک داستان"), "کلیدیكدستان");
  assert.equal(normalizeSearchText("«می‌رود»، [جلد ۲]"), "می رود جلد 2");
});
