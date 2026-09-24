import assert from "node:assert/strict";
import { test } from "node:test";
import pg from "pg";
import { PgDialect } from "drizzle-orm/pg-core";

import { publicPersonBookRoles } from "@/lib/reference/book-contributions";
import { normalizeContributorRoles } from "@/lib/reference/contributor-roles";

test("public bibliography, roles, counts and ordering share distinct canonical books", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL is required");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TEMP TABLE "ReferenceItem" (id text, name text, type text, status text) ON COMMIT DROP;
      CREATE TEMP TABLE "CatalogBook" (id text, author text, status text, created_at integer) ON COMMIT DROP;
      CREATE TEMP TABLE "CatalogBookContributor" (reference_item_id text, catalog_book_id text, role text) ON COMMIT DROP;
      CREATE TEMP TABLE "BookEdition" (id text, catalog_book_id text, translator text, status text) ON COMMIT DROP;
      CREATE TEMP TABLE "BookEditionContributor" (reference_item_id text, book_edition_id text, role text) ON COMMIT DROP;
      INSERT INTO "ReferenceItem" VALUES
        ('a','A','AUTHOR','APPROVED'), ('b','B','TRANSLATOR','APPROVED'),
        ('c','C','AUTHOR','APPROVED'), ('t','T','TRANSLATOR','APPROVED');
      INSERT INTO "CatalogBook" VALUES
        ('a1','C','APPROVED',1), ('a2','A','APPROVED',2),
        ('a3','Other','APPROVED',3), ('a4','Other','APPROVED',4),
        ('a5','A','REJECTED',5), ('b1','Other','APPROVED',6),
        ('b2','Other','APPROVED',7), ('b3','Other','APPROVED',8),
        ('b4','Other','APPROVED',9), ('b5','Other','APPROVED',10),
        ('t1','Other','APPROVED',11);
      INSERT INTO "CatalogBookContributor" VALUES
        ('a','a1','AUTHOR'), ('a','a4','AUTHOR'), ('a','a4','AUTHOR'),
        ('a','a5','AUTHOR'), ('b','b1','TRANSLATOR'), ('b','b2','TRANSLATOR'),
        ('b','b3','TRANSLATOR'), ('b','b4','TRANSLATOR'), ('b','b5','TRANSLATOR');
      INSERT INTO "BookEdition" VALUES
        ('e3','a3','A','APPROVED'), ('e4','a4','A','APPROVED'),
        ('et','t1','T','APPROVED');
      INSERT INTO "BookEditionContributor" VALUES
        ('a','e3','TRANSLATOR'), ('a','e4','TRANSLATOR');
    `);
    const relation = new PgDialect().sqlToQuery(publicPersonBookRoles);
    assert.deepEqual(relation.params, []);
    const query = `WITH person_books AS (${relation.sql})`;
    const counts = await client.query(`${query}
      SELECT reference_item_id AS id, count(DISTINCT catalog_book_id)::int AS books
      FROM person_books GROUP BY reference_item_id ORDER BY books DESC, id`);
    assert.deepEqual(counts.rows, [
      { id: "b", books: 5 }, { id: "a", books: 4 }, { id: "t", books: 1 },
    ]);
    const page = await client.query(`${query}
      SELECT cb.id, array_agg(DISTINCT pb.role ORDER BY pb.role) AS roles
      FROM "CatalogBook" cb JOIN person_books pb ON pb.catalog_book_id = cb.id
      WHERE pb.reference_item_id = 'a'
      GROUP BY cb.id, cb.created_at ORDER BY cb.created_at DESC, cb.id
      LIMIT 2 OFFSET 0`);
    assert.deepEqual(page.rows.map((row) => row.id), ["a4", "a3"]);
    assert.deepEqual(normalizeContributorRoles(page.rows[0].roles), ["AUTHOR", "TRANSLATOR"]);
    const nextPage = await client.query(`${query}
      SELECT DISTINCT cb.id, cb.created_at
      FROM "CatalogBook" cb JOIN person_books pb ON pb.catalog_book_id = cb.id
      WHERE pb.reference_item_id = 'a'
      ORDER BY cb.created_at DESC, cb.id LIMIT 2 OFFSET 2`);
    assert.deepEqual(nextPage.rows.map((row) => row.id), ["a2", "a1"]);
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
});
