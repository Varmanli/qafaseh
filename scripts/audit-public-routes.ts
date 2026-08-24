import { sql } from "drizzle-orm";

import { db, pool } from "@/db";

type AuditRow = { check: string; count: number };

async function main() {
  const result = await db.execute(sql<AuditRow>`
    select 'books_without_slug' as "check", count(*)::int as count
      from "CatalogBook" where slug is null or btrim(slug) = ''
    union all
    select 'duplicate_book_slugs', count(*)::int
      from (select slug from "CatalogBook" where slug is not null group by slug having count(*) > 1) duplicates
    union all
    select 'duplicate_normalized_book_keys', count(*)::int
      from (select slug_normalized from "CatalogBook" where slug_normalized is not null group by slug_normalized having count(*) > 1) duplicates
    union all
    select 'duplicate_book_titles', count(*)::int
      from (select lower(title) from "CatalogBook" group by lower(title) having count(*) > 1) duplicates
    union all
    select 'authors_without_slug', count(*)::int
      from "ReferenceItem" where type = 'AUTHOR' and (slug is null or btrim(slug) = '')
    union all
    select 'duplicate_author_slugs', count(*)::int
      from (select slug from "ReferenceItem" where type = 'AUTHOR' and slug is not null group by slug having count(*) > 1) duplicates
    union all
    select 'duplicate_normalized_author_keys', count(*)::int
      from (select slug_normalized from "ReferenceItem" where type = 'AUTHOR' and slug_normalized is not null group by slug_normalized having count(*) > 1) duplicates
    union all
    select 'orphan_user_books', count(*)::int
      from "Book" b left join "CatalogBook" c on c.id = b.catalog_book_id
      where b.catalog_book_id is not null and c.id is null
    union all
    select 'orphan_editions', count(*)::int
      from "BookEdition" e left join "CatalogBook" c on c.id = e.catalog_book_id
      where c.id is null
    union all
    select 'invalid_primary_editions', count(*)::int
      from "CatalogBook" c left join "BookEdition" e on e.id = c.primary_edition_id and e.catalog_book_id = c.id
      where c.primary_edition_id is not null and e.id is null
    order by "check"
  `);

  console.table(result.rows);
  const failures = result.rows.filter((row) => row.count > 0);
  process.exitCode = failures.length ? 2 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => pool.end());
