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

test("public profile note query does not reference note content", async () => {
  const source = await readFile(new URL("../notes/service.ts", import.meta.url), "utf8");
  const profileStart = source.indexOf("export async function getPublishedNotesByUsername");
  const bookStart = source.indexOf("export async function listPublishedNotesForBook");
  assert.ok(profileStart >= 0 && bookStart > profileStart);
  assert.equal(source.slice(profileStart, bookStart).includes("PublishedBookNote.content"), false);
});
