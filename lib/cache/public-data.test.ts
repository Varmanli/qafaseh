import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("public cache reuses JSON data, isolates arguments and expires after successful writes", async () => {
  // Exercise the installed Next cache, including its actual JSON serialization.
  Object.assign(globalThis, { AsyncLocalStorage });
  const { IncrementalCache } = await import("next/dist/server/lib/incremental-cache");
  const { nodeFs } = await import("next/dist/server/lib/node-fs-methods");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { cachePublicData, PUBLIC_CONTENT_TAG, withPublicContentInvalidation } = await import("./public-data");
  const directory = await mkdtemp(join(tmpdir(), "qafaseh-cache-test-"));
  const previous = { nodeEnv: process.env.NODE_ENV, disabled: process.env.PUBLIC_DATA_CACHE_DISABLED };
  const globals = globalThis as typeof globalThis & { __incrementalCache?: InstanceType<typeof IncrementalCache> };
  const previousCache = globals.__incrementalCache;
  const previewProps = { previewModeId: "test", previewModeEncryptionKey: "test", previewModeSigningKey: "test" };
  const incrementalCache = new IncrementalCache({
    fs: nodeFs, dev: false, flushToDisk: true, serverDistDir: join(directory, "server"),
    requestHeaders: {}, maxMemoryCacheSize: 1024 * 1024,
    previewProps,
    prerenderManifest: { version: 4, routes: {}, dynamicRoutes: {}, notFoundRoutes: [],
      preview: previewProps },
  });
  Object.assign(process.env, { NODE_ENV: "production", PUBLIC_DATA_CACHE_DISABLED: "0" });
  globals.__incrementalCache = incrementalCache;
  try {
    let calls = 0;
    const read = cachePublicData(async (id: string) => ({ id, version: ++calls }), "cache-regression", 60);
    assert.deepEqual(await read("book-a"), await read("book-a"));
    assert.equal(calls, 1);
    await read("book-b");
    assert.equal(calls, 2);
    const simultaneous = await Promise.all(Array.from({ length: 20 }, () => read("book-c")));
    assert(simultaneous.every((result) => result.version === 3));
    assert.equal(calls, 3);
    const missing = cachePublicData(async () => undefined, "cache-missing", 60);
    assert.equal(await missing(), undefined);
    assert.equal(await missing(), undefined);

    const store = { incrementalCache, route: "/api/admin/books/test", pendingRevalidatedTags: [] } as unknown as NonNullable<ReturnType<typeof workAsyncStorage.getStore>>;
    await workAsyncStorage.run(store, async () => {
      const denied = withPublicContentInvalidation(async () => new Response(null, { status: 403 }));
      assert.equal((await denied()).status, 403);
      assert.equal(store.pendingRevalidatedTags?.length, 0);
      const failed = withPublicContentInvalidation(async () => { throw new Error("write failed"); });
      await assert.rejects(failed, /write failed/);
      assert.equal(store.pendingRevalidatedTags?.length, 0);
      let committed = false;
      const success = withPublicContentInvalidation(async () => { committed = true; return Response.json({ ok: true }); });
      await success();
      assert(committed);
      assert.equal(store.pendingRevalidatedTags?.[0].tag, PUBLIC_CONTENT_TAG);
      assert.deepEqual(store.pendingRevalidatedTags?.[0].profile, { expire: 0 });
    });
    await incrementalCache.revalidateTag(PUBLIC_CONTENT_TAG, { expire: 0 });
    assert.equal((await read("book-a")).version, 4);
    process.env.PUBLIC_DATA_CACHE_DISABLED = "1";
    await read("book-a");
    await read("book-a");
    assert.equal(calls, 6);
  } finally {
    if (previous.nodeEnv === undefined) delete (process.env as Record<string, string | undefined>).NODE_ENV; else Object.assign(process.env, { NODE_ENV: previous.nodeEnv });
    if (previous.disabled === undefined) delete process.env.PUBLIC_DATA_CACHE_DISABLED; else process.env.PUBLIC_DATA_CACHE_DISABLED = previous.disabled;
    globals.__incrementalCache = previousCache;
    assert(directory.startsWith(join(tmpdir(), "qafaseh-cache-test-")));
    await rm(directory, { recursive: true, force: true });
  }
});
