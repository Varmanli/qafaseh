import assert from "node:assert/strict";
import test from "node:test";

import { decodeShortBookKey, encodeShortBookKey } from "@/lib/book/short-link";

test("short book keys round-trip without URL escaping", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  const key = encodeShortBookKey(id);

  assert.equal(decodeShortBookKey(key), id);
  assert.match(key, /^[A-Za-z0-9_-]+$/);
  assert.ok(key.length < id.length);
});
