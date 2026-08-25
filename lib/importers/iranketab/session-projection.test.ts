import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const sessionSource = () =>
  readFile(new URL("./session.ts", import.meta.url), "utf8");

test("IranKetab history projection excludes large session payloads", async () => {
  const source = await sessionSource();
  const listStart = source.indexOf("export async function listImportSessions");
  assert.ok(listStart >= 0);
  const list = source.slice(listStart);

  for (const field of ["draft", "extraction", "preparedCovers", "resultSummary", "metadata"]) {
    assert.equal(list.includes(`IranKetabImportSession.${field}`), false, field);
  }
  for (const field of ["id", "adminId", "canonicalSourceUrl", "status", "createdAt", "errorCode"]) {
    assert.match(source, new RegExp(`${field}: IranKetabImportSession\\.`));
  }
});

test("IranKetab detail degradation only handles TOAST corruption", async () => {
  const source = await sessionSource();
  const detailStart = source.indexOf("export async function getImportSessionDetail");
  assert.ok(detailStart >= 0);
  const detail = source.slice(detailStart, source.indexOf("export async function listImportSessions", detailStart));
  assert.match(detail, /if \(!isToastCorruptionError\(error\)\) throw error/);
  assert.match(detail, /resultSummary: IranKetabImportSession\.resultSummary/);
  assert.match(detail, /errorMessage: IranKetabImportSession\.errorMessage/);
});

test("IranKetab history API keeps admin authorization", async () => {
  const route = await readFile(
    new URL("../../../app/api/admin/books/import-history/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /assertAdminApi\(\)/);
});
