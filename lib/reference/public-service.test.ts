import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { isToastCorruptionError } from "@/lib/notes/service";

test("public reference projection never selects stored biography columns", async () => {
  const source = await readFile(new URL("./public-service.ts", import.meta.url), "utf8");

  assert.match(source, /export const PUBLIC_REFERENCE_COLUMNS/);
  assert.match(source, /description:\s*sql<string \| null>`null`/);
  assert.match(source, /shortDescription:\s*sql<string \| null>`null`/);
  assert.equal(source.includes(".select()"), false);
});

test("note fallback only recognizes PostgreSQL TOAST corruption", () => {
  assert.equal(isToastCorruptionError({ code: "XX001", message: "missing chunk number 0" }), true);
  assert.equal(isToastCorruptionError({ code: "23505", message: "duplicate key" }), false);
});
