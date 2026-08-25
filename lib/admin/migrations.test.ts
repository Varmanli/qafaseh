import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { PRODUCTION_MIGRATION_BASELINE, assertUnchangedTargetFingerprint, validatePreflight } from "../../scripts/migration-preflight.mjs";
import { formatMissingForeignKeyDiagnostics, missingRequiredForeignKeys, normalizeDeleteAction, normalizeForeignKeyColumns } from "../../scripts/run-production-migrations.mjs";
import { classifyMigration, expectedEvidence, formatAuditLogSummary } from "../../scripts/audit-production-migration-baseline.mjs";
import { validateRepairPreconditions } from "../../scripts/repair-production-migration-ledger.mjs";
import { oneTimeRecoveryState, validateFinalRepairPreconditions } from "../../scripts/repair-final-production-migration-ledger.mjs";

const migration = readFileSync("drizzle/0027_admin_content_timestamps.sql", "utf8");
const importerMigration = readFileSync(
  "drizzle/0028_iranketab_import_sessions.sql",
  "utf8",
);
const journal = JSON.parse(
  readFileSync("drizzle/meta/_journal.json", "utf8"),
) as { entries: Array<{ idx: number; tag: string; when: number }> };

test("quote timestamp and owner migration backfills before NOT NULL", () => {
  const update = migration.indexOf('UPDATE "Quote"');
  assert.ok(update > migration.indexOf('ADD COLUMN IF NOT EXISTS "created_at"'));
  assert.ok(migration.indexOf('ALTER COLUMN "created_at" SET NOT NULL') > update);
  assert.ok(migration.indexOf('ALTER COLUMN "user_id" SET NOT NULL') > migration.indexOf('SET "user_id" = b."user_id"'));
});

test("quote migration is additive and carries query indexes", () => {
  assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE|DELETE FROM/i);
  assert.match(migration, /Quote_user_id_idx/);
  assert.match(migration, /Quote_created_at_idx/);
  assert.match(migration, /PublishedBookNote_updated_at_idx/);
});

test("IranKetab session migration follows the journal without a duplicate sequence", () => {
  const indexes = journal.entries.map((entry) => entry.idx);
  const tags = journal.entries.map((entry) => entry.tag);
  assert.equal(new Set(indexes).size, indexes.length);
  assert.equal(new Set(tags).size, tags.length);
  assert.deepEqual(indexes, indexes.map((_, index) => index));
  assert.equal(tags[indexes.indexOf(28)], "0028_iranketab_import_sessions");
  assert.ok(tags.indexOf("0028_iranketab_import_sessions") >= 0);
});

test("IranKetab session migration is additive and defines recovery indexes", () => {
  assert.doesNotMatch(importerMigration, /DROP\s|TRUNCATE\s|DELETE\s+FROM/i);
  assert.match(importerMigration, /IranKetabImportSession_admin_idx/);
  assert.match(importerMigration, /IranKetabImportSession_canonical_idx/);
  assert.match(importerMigration, /IranKetabImportEvent_session_idx/);
});

test("IranKetab preview-operation migration is journaled and has durable identity indexes", () => {
  const previewMigration = readFileSync("drizzle/0033_iranketab_preview_operations.sql", "utf8");
  assert.ok(journal.entries.some((entry) => entry.tag === "0033_iranketab_preview_operations"));
  assert.match(previewMigration, /IranKetabPreviewOperation_source_identity_unique/);
  assert.match(previewMigration, /IranKetabPreviewOperation_reclaim_idx/);
  assert.doesNotMatch(previewMigration, /DROP\s|TRUNCATE\s|DELETE\s+FROM/i);
});

test("every committed SQL migration is represented exactly once in the Drizzle journal", () => {
  const tags = journal.entries.map((entry) => entry.tag);
  assert.equal(new Set(tags).size, tags.length);
  for (const tag of tags) {
    assert.ok(existsSync(`drizzle/${tag}.sql`), `missing SQL file for ${tag}`);
  }

  const sqlMigrationTags = readdirSync("drizzle")
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .map((name) => name.slice(0, -".sql".length));
  assert.deepEqual(sqlMigrationTags.sort(), [...tags].sort());
});

test("production image backs up, migrates, verifies, then starts Next.js", () => {
  const dockerfile = readFileSync("Dockerfile", "utf8");
  const entrypoint = readFileSync("docker-entrypoint.sh", "utf8");

  assert.match(entrypoint, /set -eu/);
  assert.match(entrypoint, /DATABASE_URL is required/);
  assert.match(entrypoint, /JWT_SECRET is required/);
  assert.match(dockerfile, /postgresql-client su-exec/);
  assert.doesNotMatch(dockerfile, /\nUSER nextjs\n/);
  assert.match(entrypoint, /mkdir -p "\$DATABASE_BACKUP_DIR"/);
  assert.match(entrypoint, /chown nextjs:nodejs "\$DATABASE_BACKUP_DIR"/);
  assert.match(entrypoint, /exec su-exec nextjs "\$@"/);
  assert.match(entrypoint, /run-production-migrations\.mjs preflight/);
  assert.match(entrypoint, /backup-production-db\.mjs/);
  assert.match(entrypoint, /npm run db:migrate/);
  assert.match(entrypoint, /run-production-migrations\.mjs postflight/);
  assert.match(entrypoint, /RUN_MIGRATION_BASELINE/);
  assert.match(entrypoint, /baseline-production-migrations\.mjs/);
  assert.match(entrypoint, /baseline-production-migrations\.mjs --if-needed/);
  assert.match(entrypoint, /migration-baseline-attempt-guard\.mjs preflight/);
  assert.match(entrypoint, /migration-baseline-attempt-guard\.mjs record/);
  assert.match(entrypoint, /RUN_MIGRATION_AUDIT_ONCE/);
  assert.match(entrypoint, /RUN_MIGRATION_AUDIT_LOG_SUMMARY/);
  assert.match(entrypoint, /RUN_MIGRATION_LEDGER_REPAIR/);
  assert.match(entrypoint, /RUN_ONE_TIME_PRODUCTION_RECOVERY/);
  assert.match(entrypoint, /repair-production-migration-ledger\.mjs/);
  assert.match(entrypoint, /migration-baseline-attempt-guard\.mjs preflight ledger-repair/);
  assert.match(entrypoint, /migration-baseline-attempt-guard\.mjs record ledger-repair/);
  assert.match(entrypoint, /audit-production-migration-baseline\.mjs/);
  assert.match(entrypoint, /exec su-exec nextjs "\$@"/);
  const normalPreflight = entrypoint.lastIndexOf("preflight");
  const normalBackup = entrypoint.lastIndexOf("backup-production-db");
  assert.ok(normalPreflight < normalBackup);
  assert.ok(normalBackup < entrypoint.indexOf("npm run db:migrate"));
  assert.ok(entrypoint.indexOf("npm run db:migrate") < entrypoint.indexOf("postflight"));
  assert.ok(entrypoint.indexOf("postflight") < entrypoint.indexOf('exec su-exec nextjs "$@"'));
  assert.match(dockerfile, /http:\/\/127\.0\.0\.1:3000\//);
  assert.match(dockerfile, /\/app\/scripts\/run-production-migrations\.mjs/);
  assert.match(dockerfile, /\/app\/drizzle/);
  assert.match(dockerfile, /postgresql-client/);
  assert.match(dockerfile, /\/app\/node_modules/);
  assert.doesNotMatch(entrypoint, /db:push/);
  assert.doesNotMatch(entrypoint, /baseline-production-migrations\.mjs\n\s*exit 0/);
  assert.match(dockerfile, /migration-manifest/);
  assert.match(dockerfile, /audit-production-migration-baseline\.mjs/);
  assert.match(dockerfile, /migration-baseline-attempt-guard\.mjs/);
  assert.match(dockerfile, /repair-final-production-migration-ledger\.mjs/);
  const audit = entrypoint.indexOf("Running read-only migration audit");
  assert.ok(audit > -1);
  assert.ok(audit < entrypoint.lastIndexOf("Running guarded migration preflight"));
  assert.ok(entrypoint.indexOf("repair-production-migration-ledger.mjs") < entrypoint.lastIndexOf("Running guarded migration preflight"));
  assert.match(entrypoint, /if mkdir -p "\$audit_dir" && node \.\/scripts\/audit-production-migration-baseline\.mjs/);
  assert.match(entrypoint, /WARNING: migration audit failed; continuing to guarded migration preflight/);
});

test("final ledger repair records exactly the audited legacy prefix and leaves 0038 pending", () => {
  const entries = journal.entries.slice(0, 38).map((entry) => ({ ...entry }));
  assert.doesNotThrow(() => validateFinalRepairPreconditions({ entries, ledgerRows: [], canonicalTablesExist: true }));
  assert.throws(() => validateFinalRepairPreconditions({ entries: entries.slice(0, 37), ledgerRows: [], canonicalTablesExist: true }), /expected exactly/);
  assert.throws(() => validateFinalRepairPreconditions({ entries, ledgerRows: [{ id: 1 }], canonicalTablesExist: true }), /ledger is not empty/);
  const allEntries = [...entries, { ...journal.entries[38], hash: "0038" }];
  const hashedEntries = entries.map((entry) => ({ ...entry, hash: `hash-${entry.idx}` }));
  assert.equal(oneTimeRecoveryState({ entries: hashedEntries, pendingAfterRepair: [{ ...allEntries.at(-1), hash: "0038" }], ledgerRows: [], canonicalTablesExist: true }), "repair");
  assert.equal(oneTimeRecoveryState({ entries: hashedEntries, pendingAfterRepair: [{ ...allEntries.at(-1), hash: "0038" }], ledgerRows: hashedEntries.map((entry, index) => ({ id: index, hash: entry.hash, created_at: entry.when })), canonicalTablesExist: true }), "resume");
  const repair = readFileSync("scripts/repair-final-production-migration-ledger.mjs", "utf8");
  assert.match(repair, /pending_before=/);
  assert.match(repair, /inserted_range=/);
  assert.match(repair, /pending_after=0038_production_schema_reconciliation/);
  assert.match(repair, /RUN_ONE_TIME_PRODUCTION_RECOVERY/);
  assert.doesNotMatch(repair, /drizzle-kit|ALTER TABLE|CREATE TABLE|DROP TABLE/i);
});

test("0038 reconciliation is additive and restores the reading schema without data rewrites", () => {
  const migration0038 = readFileSync("drizzle/0038_production_schema_reconciliation.sql", "utf8");
  assert.match(migration0038, /ADD COLUMN IF NOT EXISTS "current_page"/);
  assert.match(migration0038, /CREATE TABLE IF NOT EXISTS "PersonalBookNote"/);
  assert.match(migration0038, /CREATE TABLE IF NOT EXISTS "ReadingEvent"/);
  assert.match(migration0038, /CREATE TABLE IF NOT EXISTS "PublicBookThought"/);
  assert.match(migration0038, /CREATE INDEX IF NOT EXISTS "ReadingEvent_user_book_created_idx"/);
  for (const table of ["PersonalBookNote", "ReadingEvent", "PublicBookThought"]) {
    assert.ok(migration0038.indexOf(`CREATE TABLE IF NOT EXISTS "${table}"`) < migration0038.indexOf(`ALTER TABLE "${table}"`), `${table} must be created before its partial-table ALTER`);
  }
  assert.match(migration0038, /pg_constraint WHERE conrelid = 'public\."CatalogBook"'::regclass AND conname = 'CatalogBook_slug_unique'/);
  assert.match(migration0038, /to_regclass\('public\."CatalogBook_slug_unique"'\) IS NULL/);
  assert.match(migration0038, /CREATE UNIQUE INDEX IF NOT EXISTS "ReferenceItem_type_name_unique"/);
  assert.doesNotMatch(migration0038, /\b(DROP\s+(?:TABLE|TYPE|INDEX|COLUMN)|TRUNCATE|DELETE\s+FROM|UPDATE\s+(?:"|[A-Za-z]))\b/i);
});

test("0039 expands note capacity without rewriting existing notes", () => {
  const migration = readFileSync("drizzle/0039_expand_published_book_note_capacity.sql", "utf8");
  assert.match(migration, /ADD CONSTRAINT "PublishedBookNote_content_length_check"/);
  assert.match(migration, /char_length\("content"\) <= 50000/);
  assert.match(migration, /NOT VALID/);
  assert.doesNotMatch(migration, /\b(DROP|TRUNCATE|DELETE\s+FROM)\b/i);
});

test("postflight foreign-key verification is structural and ignores constraint names", () => {
  const foreignKeys = [
    ["PersonalBookNote", ["book_id"], "Book", ["id"], "c"], ["PersonalBookNote", ["user_id"], "User", ["id"], "c"],
    ["ReadingEvent", ["user_id"], "User", ["id"], "c"], ["ReadingEvent", ["book_id"], "Book", ["id"], "c"],
    ["PublicBookThought", ["catalog_book_id"], "CatalogBook", ["id"], "c"], ["PublicBookThought", ["user_id"], "User", ["id"], "c"],
    ["PublicBookThought", ["source_personal_note_id"], "PersonalBookNote", ["id"], "n"],
  ].map(([table, columns, referencedTable, referencedColumns, onDelete], index) => ({ name: `production_fk_${index}`, table, columns, referencedTable, referencedColumns, onDelete: normalizeDeleteAction(onDelete) }));
  assert.deepEqual(missingRequiredForeignKeys(foreignKeys), []);
  assert.equal(normalizeDeleteAction("c"), "CASCADE");
  assert.equal(normalizeDeleteAction("n"), "SET NULL");
  assert.equal(normalizeDeleteAction("r"), "RESTRICT");
  assert.equal(normalizeDeleteAction("a"), "NO ACTION");
  assert.equal(normalizeDeleteAction("x"), null);
  assert.deepEqual(normalizeForeignKeyColumns('{book_id}'), ["book_id"]);
  assert.deepEqual(normalizeForeignKeyColumns('["book_id"]'), ["book_id"]);
  assert.equal(missingRequiredForeignKeys([{ ...foreignKeys[0], onDelete: "NO ACTION" }]).length, 7);
  const diagnostics = formatMissingForeignKeyDiagnostics([{ ...foreignKeys[0], onDelete: "NO ACTION" }]);
  assert.match(diagnostics[0], /expected=PersonalBookNote\(book_id\)→Book\(id\) on_delete=CASCADE/);
  assert.match(diagnostics[0], /actual_candidates=PersonalBookNote\(book_id\)→Book\(id\) on_delete=NO ACTION/);
  const verifier = readFileSync("scripts/run-production-migrations.mjs", "utf8");
  assert.match(verifier, /from pg_constraint fk/);
  assert.match(verifier, /unnest\(fk\.conkey\) with ordinality/);
  assert.doesNotMatch(verifier, /from pg_constraint constraint/);
  assert.doesNotMatch(verifier, /pg_constraint\s+(?:as\s+)?constraint\b|\bas\s+constraint\b|\bjoin\s+constraint\b/i);
  assert.doesNotMatch(verifier, /pg_get_constraintdef/);
  assert.match(verifier, /json_agg\(source_column\.attname order by key_column\.ordinality\)/);
});

test("migration audit log summary prints complete diagnostics without target fingerprints", () => {
  const lines = formatAuditLogSummary({
    target: { sanitized: "production.example:5432/qafaseh", fingerprint: "do-not-log" },
    ledgerState: "empty",
    migrations: [
      { index: 0, tag: "0000_fixture", status: "applied", checked: ["table:Book"], missing: [], superseded: [], reason: null },
      { index: 1, tag: "0001_fixture", status: "unverifiable", checked: [], missing: [], superseded: [], reason: "no durable schema evidence" },
    ],
    finalSchema: { checked: ["table:Book"], missing: ["index:Book_title_idx"] },
  }).join("\n");
  assert.match(lines, /ledger_state=empty/);
  assert.match(lines, /highest_verified_contiguous_prefix=0000_fixture/);
  assert.match(lines, /migration index=1 name=0001_fixture status=unverifiable/);
  assert.match(lines, /final_schema_missing=index:Book_title_idx/);
  assert.match(lines, /unverifiable_checks=0001_fixture:no durable schema evidence/);
  assert.doesNotMatch(lines, /production\.example|do-not-log|fingerprint/i);
});

test("ledger repair permits an empty ledger only for an existing canonical schema", () => {
  assert.doesNotThrow(() => validateRepairPreconditions({ journalEntries: [{ tag: "0000", when: 1 }], ledgerRows: [], canonicalTablesExist: true }));
});

test("ledger repair refuses a populated ledger or missing canonical schema", () => {
  assert.throws(() => validateRepairPreconditions({ journalEntries: [{ tag: "0000", when: 1 }], ledgerRows: [{ id: 1 }], canonicalTablesExist: true }), /ledger is not empty/);
  assert.throws(() => validateRepairPreconditions({ journalEntries: [{ tag: "0000", when: 1 }], ledgerRows: [], canonicalTablesExist: false }), /canonical application tables are absent/);
});

test("ledger repair writes only the Drizzle ledger and normal startup still reaches preflight", () => {
  const repair = readFileSync("scripts/repair-production-migration-ledger.mjs", "utf8");
  const entrypoint = readFileSync("docker-entrypoint.sh", "utf8");
  assert.match(repair, /ALLOW_MIGRATION_LEDGER_REPAIR/);
  assert.match(repair, /RUN_MIGRATION_LEDGER_REPAIR/);
  assert.match(repair, /backup-production-db\.mjs/);
  assert.match(repair, /insert into drizzle\.__drizzle_migrations/i);
  assert.doesNotMatch(repair, /drizzle-kit|CREATE TABLE|ALTER TABLE|DROP TABLE/i);
  assert.ok(entrypoint.indexOf("repair-production-migration-ledger.mjs") < entrypoint.lastIndexOf("run-production-migrations.mjs preflight"));
});

function emptyAuditState() {
  return { tables: new Set<string>(), columns: new Map(), enums: new Map(), indexes: new Map(), constraints: new Map(), functions: new Set<string>(), triggers: new Set<string>() };
}

function stateFor(sql: string) {
  const evidence = expectedEvidence(sql);
  const state = emptyAuditState();
  for (const item of evidence.tables) state.tables.add(item);
  for (const item of evidence.columns) state.columns.set(item, {});
  for (const [name, labels] of evidence.enums) state.enums.set(name, labels);
  for (const item of evidence.indexes) state.indexes.set(item, "");
  for (const item of evidence.constraints) state.constraints.set(item, "");
  for (const item of evidence.functions) state.functions.add(item);
  for (const item of evidence.triggers) state.triggers.add(item);
  return state;
}

test("baseline audit classifies a clean historical schema as applied", () => {
  const sql = 'CREATE TABLE "AuditBook" ("id" varchar NOT NULL); CREATE INDEX "AuditBook_id_idx" ON "AuditBook" ("id");';
  const entry = { tag: "0000_fixture", evidence: expectedEvidence(sql), sql };
  assert.equal(classifyMigration(entry, stateFor(sql), []).status, "applied");
});

test("baseline audit requires explicit later SQL before calling absent evidence superseded", () => {
  const entry = { tag: "0001_fixture", evidence: expectedEvidence('CREATE INDEX "legacy_idx" ON "AuditBook" ("id");'), sql: 'CREATE INDEX "legacy_idx" ON "AuditBook" ("id");' };
  const later = { tag: "0002_fixture", evidence: expectedEvidence('DROP INDEX "legacy_idx"; CREATE INDEX "replacement_idx" ON "AuditBook" ("id");'), sql: 'DROP INDEX "legacy_idx"; CREATE INDEX "replacement_idx" ON "AuditBook" ("id");' };
  assert.equal(classifyMigration(entry, emptyAuditState(), [later]).status, "superseded");
});

test("baseline audit reports genuinely missing historical evidence and later inconsistency", () => {
  const earlySql = 'CREATE TABLE "MissingHistory" ("id" varchar NOT NULL);';
  const laterSql = 'CREATE TABLE "LaterObject" ("id" varchar NOT NULL);';
  const state = stateFor(laterSql);
  const early = classifyMigration({ tag: "0001_fixture", evidence: expectedEvidence(earlySql), sql: earlySql }, state, []);
  const later = classifyMigration({ tag: "0007_fixture", evidence: expectedEvidence(laterSql), sql: laterSql }, state, []);
  assert.equal(early.status, "missing");
  assert.match(early.reason ?? "", /MissingHistory/);
  assert.equal(later.status, "applied");
});

test("baseline audit identifies empty schemas and exposes populated-ledger handling without writes", () => {
  const sql = 'CREATE TABLE "AuditBook" ("id" varchar NOT NULL);';
  assert.equal(classifyMigration({ tag: "0000_fixture", evidence: expectedEvidence(sql), sql }, emptyAuditState(), []).status, "missing");
  const audit = readFileSync("scripts/audit-production-migration-baseline.mjs", "utf8");
  assert.match(audit, /BEGIN READ ONLY/);
  assert.match(audit, /populated:/);
  assert.doesNotMatch(audit, /insert into drizzle\.__drizzle_migrations/i);
});

test("a failed baseline is recorded so the next identical startup stops before backup", () => {
  const guard = readFileSync("scripts/migration-baseline-attempt-guard.mjs", "utf8");
  const entrypoint = readFileSync("docker-entrypoint.sh", "utf8");
  assert.match(guard, /migration-\$\{operation\}-failed-/);
  assert.match(guard, /suppressed duplicate \$\{operation\} attempt/);
  assert.ok(entrypoint.indexOf("migration-baseline-attempt-guard.mjs preflight") < entrypoint.indexOf("Baseline mode detected; creating a pre-baseline backup"));
});

function preflightFixture(overrides: Partial<{ ledgerRows: Array<{ id: number; hash: string; created_at: number }> }> = {}) {
  const entries = journal.entries.map((entry) => ({ ...entry, hash: `hash-${entry.idx}` }));
  return {
    journalEntries: entries,
    ledgerRows: entries.slice(0, journal.entries.findIndex((entry) => entry.tag === PRODUCTION_MIGRATION_BASELINE) + 1).map((entry, index) => ({ id: index + 1, hash: entry.hash, created_at: entry.when })),
    canonicalTablesExist: true,
    ...overrides,
  };
}

test("production preflight permits only migrations newer than the production baseline", () => {
  const result = validatePreflight(preflightFixture());
  assert.equal(result.latestEntry.tag, PRODUCTION_MIGRATION_BASELINE);
  assert.deepEqual(result.pending.map((entry: { tag: string }) => entry.tag), ["0034_reading_progress", "0035_personal_book_notes", "0036_reading_history", "0037_public_book_thoughts", "0038_production_schema_reconciliation", "0039_expand_published_book_note_capacity", "0040_curved_the_stranger", "0041_quote_backgrounds", "0042_add_stopped_book_status", "0043_iranketab_discovery", "0044_iranketab_discovery_import_queue", "0045_iranketab_discovery_scheduler", "0046_iranketab_discovery_scheduler_lease", "0047_iranketab_discovery_review_approval", "0048_iranketab_discovery_auto_import_policy", "0049_first_party_analytics", "0050_magazine_phase1", "0051_magazine_content_graph", "0052_public_route_normalized_keys", "0053_book_search_index"]);
});

test("magazine migration is journaled, additive, and seeds the editorial taxonomy", () => {
  const migration = readFileSync("drizzle/0050_magazine_phase1.sql", "utf8");
  assert.ok(journal.entries.some((entry) => entry.tag === "0050_magazine_phase1"));
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "canonical_url"/);
  assert.match(migration, /'reading-guide'/);
  assert.doesNotMatch(migration, /\b(DROP|TRUNCATE|DELETE\s+FROM)\b/i);
});

test("content graph migration has unique bidirectional relation indexes", () => {
  const migration = readFileSync("drizzle/0051_magazine_content_graph.sql", "utf8");
  assert.ok(journal.entries.some((entry) => entry.tag === "0051_magazine_content_graph"));
  assert.match(migration, /BlogPostBook_unique/);
  assert.match(migration, /BlogPostAuthor_author_idx/);
  assert.match(migration, /BlogPostGenre_genre_idx/);
  assert.doesNotMatch(migration, /\b(DROP|TRUNCATE|DELETE\s+FROM)\b/i);
});

test("first-party analytics migration is additive and indexed for reporting", () => {
  const migration = readFileSync("drizzle/0049_first_party_analytics.sql", "utf8");
  assert.ok(journal.entries.some((entry) => entry.tag === "0049_first_party_analytics"));
  assert.match(migration, /CREATE TABLE "AnalyticsPageView"/);
  assert.match(migration, /AnalyticsPageView_visitor_created_idx/);
  assert.match(migration, /AnalyticsPageView_content_created_idx/);
  // The foreign key intentionally uses PostgreSQL's `ON UPDATE no action`.
  assert.doesNotMatch(migration, /\b(DROP|TRUNCATE|DELETE\s+FROM)\b/i);
});

test("STOPPED book status migration is journaled and preserves existing data", () => {
  const migration = readFileSync("drizzle/0042_add_stopped_book_status.sql", "utf8");
  assert.ok(journal.entries.some((entry) => entry.tag === "0042_add_stopped_book_status"));
  assert.match(migration, /ALTER TYPE "public"\."BookStatus" ADD VALUE IF NOT EXISTS 'STOPPED' BEFORE 'FINISHED'/);
  assert.doesNotMatch(migration, /\b(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+)\b/i);
});

test("IranKetab discovery review and auto-import migrations are ordered, additive, and indexed", () => {
  const [review, autoImport] = [
    readFileSync("drizzle/0047_iranketab_discovery_review_approval.sql", "utf8"),
    readFileSync("drizzle/0048_iranketab_discovery_auto_import_policy.sql", "utf8"),
  ];
  const tags = journal.entries.map((entry) => entry.tag);
  assert.ok(tags.indexOf("0047_iranketab_discovery_review_approval") < tags.indexOf("0048_iranketab_discovery_auto_import_policy"));
  assert.match(review, /ADD VALUE IF NOT EXISTS 'APPROVED'/);
  assert.match(autoImport, /ADD COLUMN "import_mode"/);
  assert.match(autoImport, /ADD COLUMN "discovery_source_id" varchar REFERENCES "IranKetabDiscoverySource"\("id"\) ON DELETE SET NULL/);
  assert.match(autoImport, /IranKetabDiscoveryImportJob_source_idx/);
  for (const migration of [review, autoImport]) assert.doesNotMatch(migration, /\b(DROP|TRUNCATE|DELETE\s+FROM)\b/i);
});

test("production preflight refuses empty or incomplete historical ledgers", () => {
  assert.throws(() => validatePreflight(preflightFixture({ ledgerRows: [] })), /ledger is empty/);
  assert.throws(() => validatePreflight(preflightFixture({ ledgerRows: preflightFixture().ledgerRows.slice(0, 1) })), /historical migration is unexpectedly pending/);
});

test("production preflight refuses historical hash mismatches and a missing baseline", () => {
  const mismatch = preflightFixture();
  mismatch.ledgerRows[0].hash = "wrong";
  assert.throws(() => validatePreflight(mismatch), /not an exact runtime migration match/);
  const noBaseline = preflightFixture();
  noBaseline.journalEntries = noBaseline.journalEntries.filter((entry) => entry.tag !== PRODUCTION_MIGRATION_BASELINE);
  assert.throws(() => validatePreflight(noBaseline), /0033_iranketab_preview_operations is missing/);
});

test("production preflight refuses a database target that changes before execution", () => {
  assert.doesNotThrow(() => assertUnchangedTargetFingerprint("same", "same"));
  assert.throws(() => assertUnchangedTargetFingerprint("first", "second"), /DATABASE_URL changed/);
});

test("migration-history inspection derives the same hash and timestamp semantics as Drizzle", () => {
  const inspector = readFileSync("scripts/inspect-drizzle-migration-history.mjs", "utf8");
  const drizzleMigrator = readFileSync("node_modules/drizzle-orm/migrator.js", "utf8");
  const pgDialect = readFileSync("node_modules/drizzle-orm/pg-core/dialect.js", "utf8");

  assert.match(inspector, /createHash\("sha256"\)\.update\(sql\)\.digest\("hex"\)/);
  assert.match(inspector, /BEGIN READ ONLY/);
  assert.match(inspector, /safeToMarkApplied: false/);
  assert.match(drizzleMigrator, /createHash\("sha256"\)\.update\(query\)\.digest\("hex"\)/);
  assert.match(pgDialect, /order by created_at desc limit 1/);
  assert.match(pgDialect, /lastDbMigration\.created_at\) < migration\.folderMillis/);
});
