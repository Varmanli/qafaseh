import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = process.cwd();

test("publisher controls are durable, serialized, and exposed to admins", async () => {
  const [sourceService, controlRoute, client] = await Promise.all([
    readFile(`${root}/lib/discovery/iranketab/source-service.ts`, "utf8"),
    readFile(`${root}/app/api/admin/iranketab-discovery/publisher/control/route.ts`, "utf8"),
    readFile(`${root}/components/admin/IranKetabDiscoverySourcesClient.tsx`, "utf8"),
  ]);
  assert.match(sourceService, /pg_advisory_xact_lock/);
  assert.match(sourceService, /publisherImportStatus: "PAUSED"/);
  assert.match(sourceService, /publisherImportStatus: "RUNNING"/);
  assert.match(controlRoute, /"PAUSE"/);
  assert.match(controlRoute, /retryPublisherImportFailures/);
  assert.match(client, /تلاش مجدد خطاها/);
});

test("publisher worker repairs the queue, finishes explicitly, and is run by the cron tick", async () => {
  const [queue, tick] = await Promise.all([
    readFile(`${root}/lib/discovery/iranketab/import-queue.ts`, "utf8"),
    readFile(`${root}/app/api/internal/iranketab-discovery/tick/route.ts`, "utf8"),
  ]);
  assert.match(queue, /reconcilePublisherImportQueue/);
  assert.match(queue, /completePublisherImportWhenIdle/);
  assert.match(queue, /publisherImportStatus: "COMPLETED"/);
  assert.match(tick, /getActiveIranKetabPublisherImport/);
  assert.match(tick, /processPublisherImportQueue/);
});
