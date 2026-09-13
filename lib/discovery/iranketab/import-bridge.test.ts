import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const bridgePath = path.join(process.cwd(), "lib/discovery/iranketab/import-bridge.ts");

test("approved candidate starts the shared importer preview and records its linked session", async () => {
  const bridge = await readFile(bridgePath, "utf8");
  assert.match(bridge, /export async function startDiscoveryImport\(discoveryItemId: string, actorId: string\)/);
  assert.match(bridge, /eq\(IranKetabDiscoveryItem\.status, "QUEUED"\)/);
  assert.match(bridge, /createIranKetabPreviewPost/);
  assert.match(bridge, /importSessionId: session\.id/);
  assert.match(bridge, /status: "IMPORTING"/);
  assert.match(bridge, /candidate_lookup_started/);
  assert.match(bridge, /candidate_lookup_succeeded/);
  assert.match(bridge, /databaseTarget: databaseDiagnosticTarget\(\)/);
});

test("bridge lookup uses only the candidate ID and logs missing or rejected candidates clearly", async () => {
  const bridge = await readFile(bridgePath, "utf8");
  assert.match(bridge, /where\(eq\(IranKetabDiscoveryItem\.id, itemId\)\)/);
  assert.match(bridge, /candidate_lookup_missing/);
  assert.match(bridge, /candidate_rejected/);
  assert.match(bridge, /reason: "DISCOVERY_ITEM_NOT_QUEUED"/);
});

test("bridge reuses an active linked import instead of creating a duplicate session", async () => {
  const bridge = await readFile(bridgePath, "utf8");
  assert.match(bridge, /item\.importSessionId && item\.status === "IMPORTING"/);
  assert.match(bridge, /getImportSession\(item\.importSessionId\)/);
  assert.match(bridge, /reused: true/);
  assert.match(bridge, /DISCOVERY_IMPORT_ALREADY_RUNNING/);
});

test("preview failures persist failure state and retry information on the discovery item", async () => {
  const bridge = await readFile(bridgePath, "utf8");
  assert.match(bridge, /markDiscoveryItemFailed\(item\.id, code, message, createdSessionId\)/);
  assert.match(bridge, /status: "FAILED"/);
  assert.match(bridge, /retryCount: sql`\$\{IranKetabDiscoveryItem\.retryCount\} \+ 1`/);
  assert.match(bridge, /failureCode,/);
  assert.match(bridge, /failureReason,/);
});

test("an active preview is treated as a temporary queue collision", async () => {
  const bridge = await readFile(bridgePath, "utf8");
  assert.match(bridge, /code === "IRANKETAB_IMPORT_IN_PROGRESS"/);
  assert.match(bridge, /DISCOVERY_IMPORT_ALREADY_RUNNING/);
});

test("a successful preview leaves IMPORTING and awaits explicit importer review", async () => {
  const bridge = await readFile(bridgePath, "utf8");
  assert.match(bridge, /await markDiscoveryItemPreviewReady\(item\.id, sessionId\)/);
  assert.match(bridge, /status: "NEEDS_REVIEW"/);
  assert.match(bridge, /PREVIEW_READY awaits explicit manual review\/commit/);
});
