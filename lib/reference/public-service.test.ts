import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("public reference projection never selects stored biography columns", async () => {
  const source = await readFile(new URL("./public-service.ts", import.meta.url), "utf8");

  assert.match(source, /export const PUBLIC_REFERENCE_COLUMNS/);
  assert.match(source, /description:\s*sql<string \| null>`null`/);
  assert.match(source, /shortDescription:\s*sql<string \| null>`null`/);
  assert.equal(source.includes(".select()"), false);
});

test("public profile note query returns published note content", async () => {
  const source = await readFile(new URL("../notes/service.ts", import.meta.url), "utf8");
  const profileStart = source.indexOf("export async function getPublishedNotesByUsername");
  const bookStart = source.indexOf("export async function listPublishedNotesForBook");
  assert.ok(profileStart >= 0 && bookStart > profileStart);
  const profileQuery = source.slice(profileStart, bookStart);
  assert.equal(profileQuery.includes("content: PublishedBookNote.content"), true);
  assert.equal(profileQuery.includes("PROFILE_NOTE_PLACEHOLDER"), false);
});
