import assert from "node:assert/strict";
import test from "node:test";

import { buildPaginationHref, getPaginationItems } from "./pagination";

test("pagination links preserve every existing search parameter", () => {
  assert.equal(
    buildPaginationHref("/books", "q=novel&category=fiction&sort=popular&page=3&tag=a&tag=b", 4),
    "/books?q=novel&category=fiction&sort=popular&page=4&tag=a&tag=b",
  );
  assert.equal(
    buildPaginationHref("/books", { q: "novel", tag: ["a", "b"], page: "3" }, 1),
    "/books?q=novel&tag=a&tag=b",
  );
});

test("pagination items show every page when small and ellipses when large", () => {
  assert.deepEqual(getPaginationItems(3, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(getPaginationItems(6, 24), [1, "ellipsis", 5, 6, 7, "ellipsis", 24]);
});
