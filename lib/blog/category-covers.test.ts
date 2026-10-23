import assert from "node:assert/strict";
import test from "node:test";
import { blogCategoryInputSchema } from "@/lib/validations/blog";

test("category covers accept uploaded media and support removal and older clients", () => {
  for (const coverImage of [undefined, null, "", "/uploads/blog/cover.webp", "blog/cover.webp", "https://example.com/cover.webp"]) {
    assert.equal(blogCategoryInputSchema.safeParse({ name: "راهنمای مطالعه", coverImage }).success, true);
  }
  assert.equal(blogCategoryInputSchema.parse({ name: "مطالعه", coverImage: " /magazine/cover.webp " }).coverImage, "/magazine/cover.webp");
});

test("category covers reject unsafe schemes, protocol-relative paths, and oversized input", () => {
  for (const coverImage of ["javascript:alert(1)", "data:image/svg+xml,test", "//example.com/cover.webp", "file:///tmp/cover.png", "blob:example", "x".repeat(5001)]) {
    assert.equal(blogCategoryInputSchema.safeParse({ name: "مطالعه", coverImage }).success, false, coverImage.slice(0, 60));
  }
});
