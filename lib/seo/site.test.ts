import assert from "node:assert/strict";
import { test } from "node:test";

import { getSiteOrigin, toAbsoluteUrl } from "@/lib/seo/site";

const ENV_KEYS = ["NODE_ENV", "APP_URL", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_BASE_URL"] as const;

function withEnvironment(values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>, run: () => void) {
  const environment = process.env as Record<string, string | undefined>;
  const before = Object.fromEntries(ENV_KEYS.map((key) => [key, environment[key]]));
  try {
    for (const key of ENV_KEYS) {
      const value = values[key];
      if (value === undefined) delete environment[key];
      else environment[key] = value;
    }
    run();
  } finally {
    for (const key of ENV_KEYS) {
      const value = before[key];
      if (value === undefined) delete environment[key];
      else environment[key] = value;
    }
  }
}

test("production canonical URLs never fall back to localhost", () => {
  withEnvironment({ NODE_ENV: "production" }, () => {
    assert.equal(getSiteOrigin(), "https://qafasehman.ir");
    assert.equal(toAbsoluteUrl("/book/example"), "https://qafasehman.ir/book/example");
  });
});

test("configured public origin continues to take precedence", () => {
  withEnvironment({ NODE_ENV: "production", APP_URL: "https://example.test/" }, () => {
    assert.equal(getSiteOrigin(), "https://example.test");
  });
});
