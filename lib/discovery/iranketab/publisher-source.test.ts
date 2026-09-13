import assert from "node:assert/strict";
import test from "node:test";

import { parseIranKetabPublisherSource } from "./publisher-source";

test("normalizes a publisher link to one stable source", () => {
  assert.deepEqual(
    parseIranKetabPublisherSource(
      "https://www.iranketab.ir/publisher/1800-%D8%AE%D9%88%D8%A8?page=2#books",
    ),
    {
      name: "انتشارات خوب",
      sourceKey: "publisher:1800",
      sourceUrl: "https://www.iranketab.ir/publisher/1800-%D8%AE%D9%88%D8%A8",
    },
  );
});
