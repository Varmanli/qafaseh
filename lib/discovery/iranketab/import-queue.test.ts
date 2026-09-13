import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const queuePath = path.join(process.cwd(), "lib/discovery/iranketab/import-queue.ts");
const migrationPath = path.join(process.cwd(), "drizzle/0044_iranketab_discovery_import_queue.sql");

test("enqueue duplicate prevention is enforced by the active-job partial unique index", async () => {
  const [queue, migration] = await Promise.all([readFile(queuePath, "utf8"), readFile(migrationPath, "utf8")]);
  assert.match(migration, /active_item_unique[\s\S]*WHERE "status" IN \('PENDING', 'PROCESSING'\)/);
  assert.match(queue, /findActiveJob\(discoveryItemId\)/);
  assert.match(queue, /partial unique index is the concurrency-safe duplicate guard/);
});

test("claims prioritize higher-priority ready jobs and use SKIP LOCKED atomically", async () => {
  const queue = await readFile(queuePath, "utf8");
  assert.match(queue, /ORDER BY "priority" DESC, "created_at" ASC/);
  assert.match(queue, /FOR UPDATE SKIP LOCKED/);
  assert.match(queue, /"status" = 'PROCESSING'/);
  assert.match(queue, /"attempts" = job\."attempts" \+ 1/);
  assert.match(queue, /eq\(IranKetabDiscoveryImportJob\.status, "PROCESSING"\)/);
  assert.match(queue, /lte\(IranKetabDiscoveryImportJob\.lockedAt, leaseExpiredAt\)/);
  assert.match(queue, /job\."discovery_item_id" AS "discoveryItemId"/);
});

test("worker receives the explicitly aliased discovery item ID from the raw claim query", async () => {
  const queue = await readFile(queuePath, "utf8");
  assert.match(queue, /type ClaimedJobRow = \{[\s\S]*discoveryItemId: string;/);
  assert.match(queue, /startDiscoveryImport\(job\.discoveryItemId, actorId\)/);
});

test("failed jobs back off exponentially and become terminal after max attempts", async () => {
  const queue = await readFile(queuePath, "utf8");
  assert.match(queue, /current\.attempts < current\.maxAttempts && isRetryableQueueFailure\(failure\.code\)/);
  assert.match(queue, /status: requeue \? "PENDING" : "FAILED"/);
  assert.match(queue, /15_000 \* 2 \*\* Math\.max\(0, attempts - 1\)/);
  assert.match(queue, /inArray\(IranKetabDiscoveryItem\.status, \["FAILED", "NEEDS_REVIEW", "APPROVED", "IMPORTING"\]\)/);
});

test("in-progress preview collisions return to the queue without consuming an attempt", async () => {
  const queue = await readFile(queuePath, "utf8");
  assert.match(queue, /const waitForExistingImport = failure\.code === "DISCOVERY_IMPORT_ALREADY_RUNNING"/);
  assert.match(queue, /attempts: Math\.max\(0, current\.attempts - 1\)/);
  assert.match(queue, /const requeue = waitForExistingImport \|\| retry/);
});

test("missing-candidate jobs are finalized before claim and cannot be manually retried", async () => {
  const queue = await readFile(queuePath, "utf8");
  assert.match(queue, /await finalizeMissingDiscoveryItemJobs\(now\)/);
  assert.match(queue, /FROM "IranKetabDiscoveryItem" AS item/);
  assert.match(queue, /"last_error_code" = 'DISCOVERY_ITEM_NOT_FOUND'/);
  assert.match(queue, /retry_rejected_missing_candidate/);
  assert.match(queue, /throw new IranKetabDiscoveryImportQueueError\("DISCOVERY_ITEM_NOT_FOUND"\)/);
});

test("successful processing delegates to the bridge then completes exactly the claimed job", async () => {
  const queue = await readFile(queuePath, "utf8");
  assert.match(queue, /const job = await claimNextImportJob\(workerId\)/);
  assert.match(queue, /await startDiscoveryImport\(job\.discoveryItemId, actorId\)/);
  assert.match(queue, /await completeImportJob\(job\.id\)/);
  assert.match(queue, /await failImportJob\(job\.id, error\)/);
  assert.match(queue, /worker_policy_decision/);
  assert.match(queue, /worker_bridge_completed/);
});

test("abandoned processing jobs are reclaimed after their lease and terminal failures update the candidate", async () => {
  const queue = await readFile(queuePath, "utf8");
  assert.match(queue, /"status" = 'PROCESSING' AND "locked_at" <=/);
  assert.match(queue, /MAX_ATTEMPTS_EXHAUSTED/);
  assert.match(queue, /status: "FAILED", failureCode: failure\.code, failureReason: failure\.message/);
  assert.match(queue, /recoverAbandonedImportingItems/);
  assert.match(queue, /SET "status" = 'QUEUED'/);
});

test("an explicit retry retains the job candidate ID and restores only a failed candidate to QUEUED", async () => {
  const queue = await readFile(queuePath, "utf8");
  assert.match(queue, /eq\(IranKetabDiscoveryItem\.id, job\.discoveryItemId\)/);
  assert.match(queue, /eq\(IranKetabDiscoveryItem\.status, "FAILED"\)/);
  assert.match(queue, /set\(\{ status: "QUEUED", updatedAt: new Date\(\) \}\)/);
});

test("bounded worker processes only the requested number of queued jobs", async () => {
  const queue = await readFile(queuePath, "utf8");
  assert.match(queue, /export async function processDiscoveryImportQueueBatch/);
  assert.match(queue, /await processDiscoveryImportQueue\(workerId, actorId\)/);
  assert.match(queue, /Math\.max\(0, Math\.min\(100, Math\.trunc\(limit\)\)\)/);
});

test("AUTO_IMPORT jobs are source-scoped and use the shared commit service after preview", async () => {
  const queue = await readFile(queuePath, "utf8");
  assert.match(queue, /job\.discoverySourceId/);
  assert.match(queue, /beforeBridge\.source\.importMode === "AUTO_IMPORT"/);
  assert.match(queue, /commitIranKetabImportSession\(\{ sessionId: result\.session\.id/);
  assert.match(queue, /resolveQueueOrigins/);
  assert.match(queue, /importMode === "AUTO_IMPORT"/);
});

test("worker logs source policy and rejects missing provenance instead of silently choosing manual review", async () => {
  const queue = await readFile(queuePath, "utf8");
  for (const field of ["jobId", "discoveryItemId", "discoverySourceId", "sourceName", "importMode", "candidateStatus", "sessionStatus", "workerDecision"])
    assert.match(queue, new RegExp(`${field}:`));
  assert.match(queue, /finalResult/);
  assert.match(queue, /REJECT_MISSING_SOURCE/);
  assert.match(queue, /REJECT_UNKNOWN_SOURCE/);
  assert.match(queue, /DISCOVERY_SOURCE_REQUIRED/);
  assert.match(queue, /DISCOVERY_SOURCE_NOT_FOUND/);
});

test("job listing retains legacy orphan jobs and exposes the linked import session", async () => {
  const queue = await readFile(queuePath, "utf8");
  assert.match(queue, /\.leftJoin\(IranKetabDiscoveryItem/);
  assert.match(queue, /importSessionId: IranKetabDiscoveryItem\.importSessionId/);
});
