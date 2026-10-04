import assert from "node:assert/strict";
import { test } from "node:test";

import { getSafeRedirectPath, isProtectedPagePath } from "@/lib/auth/routes";

test("keeps public browsing routes accessible to guests", () => {
  for (const path of ["/", "/books", "/book/example", "/authors", "/authors/example", "/blog", "/blog/example", "/books/reader"]) {
    assert.equal(isProtectedPagePath(path), false, path);
  }
});

test("protects private account workspaces only", () => {
  for (const path of ["/dashboard", "/feed", "/settings/profile", "/wishlist", "/loans", "/reading", "/account", "/admin", "/books/add"]) {
    assert.equal(isProtectedPagePath(path), true, path);
  }
});

test("accepts only internal post-login destinations", () => {
  assert.equal(getSafeRedirectPath("/book/example"), "/book/example");
  assert.equal(getSafeRedirectPath("https://evil.example"), "/dashboard");
  assert.equal(getSafeRedirectPath("//evil.example"), "/dashboard");
});
