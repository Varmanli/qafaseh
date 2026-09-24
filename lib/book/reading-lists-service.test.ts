import assert from "node:assert/strict";
import test from "node:test";
import { readingListInputSchema } from "@/lib/validations/reading-lists";

process.env.DATABASE_URL ??= "postgres://localhost/unused";
const service = import("./reading-lists-service");
const admin = import("../admin/reading-lists");

const id1 = "00000000-0000-4000-8000-000000000001";
const id2 = "00000000-0000-4000-8000-000000000002";
const base = {
  title: "لیست نمونه", slug: "sample-list", description: "توضیح", audience: null,
  category: "داستان", hubGroup: "ادبیات جهان", mode: "ORDERED", status: "DRAFT",
  featured: false, seoTitle: null, seoDescription: null, relatedListIds: [],
  items: [{ bookId: id1, note: "یادداشت", difficulty: null }],
};
const item = (id: string, position: number, slug: string | null = id) => ({
  id, slug, title: "Book", author: "Author", coverImage: null,
  listId: id1, position, note: null, difficulty: null,
});

test("public items preserve editorial order, not query order", async () => {
  const { selectPublicListItems } = await service;
  assert.deepEqual(selectPublicListItems([item(id2, 2), item(id1, 1)]).map((row) => row.book.id), [id1, id2]);
});

test("public items omit missing slugs and duplicate canonical IDs", async () => {
  const { selectPublicListItems } = await service;
  assert.deepEqual(selectPublicListItems([item(id1, 1, null), item(id2, 2), item(id2, 3)]).map((row) => row.book.id), [id2]);
});

test("reorder normalizes positions without gaps", async () => {
  const { normalizedItems } = await admin;
  assert.deepEqual(normalizedItems([{ bookId: id2, note: null, difficulty: null }, { bookId: id1, note: null, difficulty: null }]).map((row) => [row.bookId, row.position]), [[id2, 1], [id1, 2]]);
});

test("ordered and unordered payloads validate", () => {
  assert.equal(readingListInputSchema.safeParse(base).success, true);
  assert.equal(readingListInputSchema.safeParse({ ...base, mode: "UNORDERED" }).success, true);
});

test("slug, mode, status, duplicate books, and duplicate related IDs are rejected", () => {
  for (const bad of [
    { slug: "Bad Slug" }, { mode: "OTHER" }, { status: "OTHER" },
    { items: [base.items[0], base.items[0]] },
    { relatedListIds: [id1, id1] },
  ]) assert.equal(readingListInputSchema.safeParse({ ...base, ...bad }).success, false);
});
