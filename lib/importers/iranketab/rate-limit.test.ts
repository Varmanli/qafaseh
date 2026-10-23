import assert from "node:assert/strict";
import test from "node:test";
import { acquireIranKetabPreviewSlot, resetIranKetabPreviewLimiterForTests } from "./rate-limit";

test("preview limiter blocks concurrent and short-window duplicate requests",()=>{
  resetIranKetabPreviewLimiterForTests(); const first=acquireIranKetabPreviewSlot("admin","https://iranketab.ir/book/1-test",1000); assert.ok("release" in first);
  const concurrent=acquireIranKetabPreviewSlot("admin","https://iranketab.ir/book/2-test",1001); assert.deepEqual("release" in concurrent?null:concurrent.code,"ALREADY_RUNNING");
  if("release" in first) first.release(); const duplicate=acquireIranKetabPreviewSlot("admin","https://iranketab.ir/book/1-test",1002); assert.deepEqual("release" in duplicate?null:duplicate.code,"DUPLICATE_REQUEST");
});

test("preview limiter bounds retained admins and expires idle entries without releasing active work", () => {
  resetIranKetabPreviewLimiterForTests();
  const active = acquireIranKetabPreviewSlot("active", "active-url", 1000);
  assert("release" in active);
  for (let index = 0; index < 999; index++) {
    const slot = acquireIranKetabPreviewSlot(`admin-${index}`, "url", 1000);
    assert("release" in slot);
    slot.release();
    slot.release();
  }
  const overflow = acquireIranKetabPreviewSlot("overflow", "url", 1001);
  assert.equal("code" in overflow ? overflow.code : null, "RATE_LIMITED");
  const renewed = acquireIranKetabPreviewSlot("renewed", "url", 61001);
  assert("release" in renewed);
  renewed.release();
  const stillActive = acquireIranKetabPreviewSlot("active", "other-url", 61002);
  assert.equal("code" in stillActive ? stillActive.code : null, "ALREADY_RUNNING");
  active.release();
  resetIranKetabPreviewLimiterForTests();
});
