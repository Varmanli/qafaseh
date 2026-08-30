import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAuthorProfileHref,
  getSafeAuthorArchiveReturnPath,
} from "./author-navigation";

test("author profile links carry the complete archive query", () => {
  assert.equal(
    buildAuthorProfileHref("test-author", "page=5&sort=MOST_BOOKS&country=%D8%A7%DB%8C%D8%B1%D8%A7%D9%86"),
    "/authors/test-author?from=%2Fauthors%3Fpage%3D5%26sort%3DMOST_BOOKS%26country%3D%25D8%25A7%25DB%258C%25D8%25B1%25D8%25A7%25D9%2586",
  );
});

test("only authors archive return paths are accepted", () => {
  assert.equal(getSafeAuthorArchiveReturnPath("/authors?page=5&sort=MOST_BOOKS"), "/authors?page=5&sort=MOST_BOOKS");
  assert.equal(getSafeAuthorArchiveReturnPath("https://example.com"), null);
  assert.equal(getSafeAuthorArchiveReturnPath("//example.com"), null);
  assert.equal(getSafeAuthorArchiveReturnPath("/authors/example-author"), null);
  assert.equal(getSafeAuthorArchiveReturnPath("javascript:alert(1)"), null);
});
