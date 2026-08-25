import assert from "node:assert/strict";
import { test } from "node:test";
import { preferredEditionFieldSql } from "./primary-edition";

test("language is an allowlisted edition field", () => {
  assert.doesNotThrow(() => preferredEditionFieldSql<string | null>("language"));
});

test("edition field validation still rejects arbitrary identifiers", () => {
  assert.throws(
    () => preferredEditionFieldSql<string | null>("language; drop table BookEdition"),
    /Disallowed column identifier/,
  );
});
