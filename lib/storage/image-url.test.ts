import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isAllowedPersistedImageUrl,
  isLocalUploadPath,
} from "@/lib/storage/image-url";
import { normalizeMediaUrl } from "@/lib/book/cover";

test("recognizes local upload path forms and rejects them in production", () => {
  const env = process.env as Record<string, string | undefined>;
  const previousNodeEnv = process.env.NODE_ENV;
  env.NODE_ENV = "production";
  for (const value of [
    "/uploads/books/a.jpg",
    "uploads/books/a.jpg",
    "public/uploads/books/a.jpg",
    "/app/public/uploads/books/a.jpg",
    "\\uploads\\books\\a.jpg",
  ]) {
    assert.equal(isLocalUploadPath(value), true, value);
    assert.equal(isAllowedPersistedImageUrl(value), false, value);
  }
  if (previousNodeEnv === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = previousNodeEnv;
});

test("allows local upload URLs in development", () => {
  const env = process.env as Record<string, string | undefined>;
  const previousNodeEnv = process.env.NODE_ENV;
  env.NODE_ENV = "development";
  assert.equal(isAllowedPersistedImageUrl("/uploads/blog/example.webp"), true);
  if (previousNodeEnv === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = previousNodeEnv;
});

test("allows public S3 and external image URLs", () => {
  assert.equal(
    isAllowedPersistedImageUrl("https://qafaseh-prod.s3.ir-thr-at1.arvanstorage.ir/covers/a.jpg"),
    true,
  );
  assert.equal(isAllowedPersistedImageUrl("https://example.com/cover.jpg"), true);
  assert.equal(isAllowedPersistedImageUrl(null), true);
});

test("normalizes contributor media keys and preserves full URLs", () => {
  const old = process.env.S3_PUBLIC_BASE_URL;
  process.env.S3_PUBLIC_BASE_URL =
    "https://qafaseh-prod.s3.ir-thr-at1.arvanstorage.ir";

  assert.equal(
    normalizeMediaUrl(
      "references/iranketab-author-abcdef0123456789abcd-profile.webp",
    ),
    "https://qafaseh-prod.s3.ir-thr-at1.arvanstorage.ir/references/iranketab-author-abcdef0123456789abcd-profile.webp",
  );
  assert.equal(
    normalizeMediaUrl(
      "https://qafaseh-prod.s3.ir-thr-at1.arvanstorage.ir/references/profile.webp",
    ),
    "https://qafaseh-prod.s3.ir-thr-at1.arvanstorage.ir/references/profile.webp",
  );
  assert.equal(normalizeMediaUrl(null), null);

  if (old === undefined) delete process.env.S3_PUBLIC_BASE_URL;
  else process.env.S3_PUBLIC_BASE_URL = old;
});

test("normalizes managed media keys to local uploads during development", () => {
  const env = process.env as Record<string, string | undefined>;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDriver = process.env.UPLOAD_DRIVER;
  env.NODE_ENV = "development";
  delete env.UPLOAD_DRIVER;
  assert.equal(
    normalizeMediaUrl("references/iranketab-author-abcdef0123456789abcd-profile.webp"),
    "/uploads/references/iranketab-author-abcdef0123456789abcd-profile.webp",
  );
  if (previousNodeEnv === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = previousNodeEnv;
  if (previousDriver === undefined) delete env.UPLOAD_DRIVER;
  else env.UPLOAD_DRIVER = previousDriver;
});
