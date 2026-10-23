import assert from "node:assert/strict";
import test from "node:test";
import { buildBlogArchiveHref } from "@/components/blog/blog-archive";

test("main magazine filters retain their existing URL format", () => {
  assert.equal(buildBlogArchiveHref({}), "/blog");
  assert.equal(buildBlogArchiveHref({ category: "reading-guide", sort: "oldest" }), "/blog?category=reading-guide&sort=oldest");
});

test("category search, sort and clearing stay on the category page", () => {
  const pathname = "/blog/category/book-recommendation";
  const href = buildBlogArchiveHref({ pathname, q: " کتاب ", sort: "shortest" });
  const url = new URL(href, "http://localhost:3000");
  assert.equal(url.pathname, pathname);
  assert.equal(url.searchParams.get("q"), "کتاب");
  assert.equal(url.searchParams.get("sort"), "shortest");
  assert.equal(url.searchParams.has("category"), false);
  assert.equal(url.searchParams.has("page"), false);
  assert.equal(buildBlogArchiveHref({ pathname }), pathname);
  assert.equal(buildBlogArchiveHref({ pathname, sort: "oldest" }), `${pathname}?sort=oldest`);
});
