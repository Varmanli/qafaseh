import assert from "node:assert/strict";
import test from "node:test";
import { getPoolConfig } from "@/db/pool-config";

test("pool defaults are bounded and invalid overrides cannot remove timeouts", () => {
  assert.deepEqual(getPoolConfig({}), { max: 4, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000, statement_timeout: 30000 });
  for (const value of ["", "0", "-1", "NaN", "Infinity", "1.5", "9999999"]) {
    assert.deepEqual(getPoolConfig({ DB_POOL_MAX: value, DB_CONNECTION_TIMEOUT_MS: value, DB_STATEMENT_TIMEOUT_MS: value }), getPoolConfig({}));
  }
  assert.equal(getPoolConfig({ DB_POOL_MAX: "6" }).max, 6);
});
