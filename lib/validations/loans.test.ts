import assert from "node:assert/strict";
import { test } from "node:test";
import { loanSchema } from "@/lib/validations/loans";

test("loan dates and borrower are validated at the API boundary", () => {
  const valid = { bookId: "11111111-1111-4111-8111-111111111111", borrowerName: "مریم", loanedAt: "2026-09-29", dueAt: "2026-10-01", note: null };
  assert.equal(loanSchema.safeParse(valid).success, true);
  assert.equal(loanSchema.safeParse({ ...valid, dueAt: "2026-09-28" }).success, false);
  assert.equal(loanSchema.safeParse({ ...valid, borrowerName: "  " }).success, false);
});
