import test from "node:test";
import assert from "node:assert/strict";
import { ExternalRequestThrottler } from "./external-request-throttle";

test("externalRequestThrottler executes requests serially and enforces delay", async () => {
  const throttler = new ExternalRequestThrottler(50);
  const timestamps: number[] = [];

  const task1 = throttler.schedule(async () => {
    timestamps.push(Date.now());
    return "task1";
  });

  const task2 = throttler.schedule(async () => {
    timestamps.push(Date.now());
    return "task2";
  });

  const [res1, res2] = await Promise.all([task1, task2]);

  assert.equal(res1, "task1");
  assert.equal(res2, "task2");
  assert.equal(timestamps.length, 2);

  const diff = timestamps[1]! - timestamps[0]!;
  assert.ok(diff >= 40, `Expected delay of ~50ms between requests, got ${diff}ms`);
});
