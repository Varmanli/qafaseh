import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("reference image downloads have a bounded request and body lifetime", async () => {
  const source = await readFile(path.join(process.cwd(), "lib/importers/iranketab/reference-image-preparation.ts"), "utf8");
  assert.match(source, /const FETCH_TIMEOUT_MS = 10_000/);
  assert.match(source, /signal: controller\.signal/);
  assert.match(source, /finally \{\n\s+clearTimeout\(timer\);/);
});
