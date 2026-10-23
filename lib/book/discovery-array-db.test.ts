import assert from "node:assert/strict";
import test from "node:test";

test("discovery author arrays preserve empty arrays, role filtering and order at 20k scale", {
  skip: !process.env.PERFORMANCE_TEST_DATABASE_URL,
}, async () => {
  const url = new URL(process.env.PERFORMANCE_TEST_DATABASE_URL!);
  assert(["localhost", "127.0.0.1"].includes(url.hostname));
  assert(url.pathname.includes("perf_audit"), "Use an isolated performance database");
  process.env.DATABASE_URL = url.toString();
  const { db, pool } = await import("@/db");
  const { sql } = await import("drizzle-orm");
  const { CatalogBook } = await import("@/db/schema");
  const { discoverySignalFields } = await import("./discover-service");
  const old = sql<string[]>`coalesce((select array_agg(c.reference_item_id order by c.reference_item_id)
    from "CatalogBookContributor" c where c.catalog_book_id = "CatalogBook"."id" and c.role = 'AUTHOR'), array[]::varchar[])`;
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`create temp table "CatalogBook" (id varchar primary key) on commit drop`);
      await tx.execute(sql`create temp table "CatalogBookContributor" (catalog_book_id varchar, reference_item_id varchar, role varchar) on commit drop`);
      await tx.execute(sql`insert into "CatalogBook" select 'perf-' || n from generate_series(1, 20000) n`);
      await tx.execute(sql`insert into "CatalogBookContributor"
        select 'perf-' || n, 'author-' || a, 'AUTHOR' from generate_series(2, 20000) n cross join generate_series(1, 3) a`);
      await tx.execute(sql`insert into "CatalogBookContributor" values ('perf-1', 'translator', 'TRANSLATOR')`);
      await tx.execute(sql`create unique index on "CatalogBookContributor" (catalog_book_id, reference_item_id, role)`);
      await tx.execute(sql`analyze "CatalogBookContributor"`);
      const rows = await tx.select({ id: CatalogBook.id, before: old, after: discoverySignalFields.contributorIds }).from(CatalogBook);
      assert.equal(rows.length, 20000);
      for (const row of rows) assert.deepEqual(row.after, row.before);
      assert.deepEqual(rows.find((row) => row.id === "perf-1")?.after, []);
      const plans: Record<string, unknown> = {};
      for (const [name, projection] of [["before", old], ["after", discoverySignalFields.contributorIds]] as const) {
        const timings: number[] = [];
        for (let run = 0; run < 5; run++) {
          const result = await tx.execute<{ "QUERY PLAN": { "Execution Time": number }[] }>(sql`explain (analyze, buffers, format json) select ${projection} from "CatalogBook"`);
          timings.push(result.rows[0]["QUERY PLAN"][0]["Execution Time"]);
        }
        plans[name] = timings.sort((a, b) => a - b)[2];
      }
      console.log(JSON.stringify({ syntheticCatalogRows: rows.length, arrayQueryMedianMs: plans }));
    });
  } finally { await pool.end(); }
});
