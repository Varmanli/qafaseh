import { performance } from "node:perf_hooks";
import { pool } from "@/db";
import { getBookDetail, getBookMetadata } from "@/lib/book/detail-service";
import { getSimilarBooks } from "@/lib/book/similar-books-service";
import { getMagazineArticlesForBook } from "@/lib/blog/service";

// Run with: npx tsx --env-file=.env scripts/profile-book-detail.ts [slug]
// React's request memoization requires an actual Next.js render; this CLI measures service queries.
async function main() {
  if (process.argv.includes("--indexes")) {
    const result = await pool.query(`select tablename, indexdef from pg_indexes
      where schemaname = 'public' and tablename in ('Book', 'BookEdition', 'Quote', 'PublishedBookNote', 'ReferenceItem')
      order by tablename, indexname`);
    console.log(JSON.stringify(result.rows, null, 2));
    return;
  }
  const { rows } = await pool.query<{ id: string; slug: string }>(
    `select id, slug from "CatalogBook" where status = 'APPROVED'
      and slug is not null and trim(slug) <> ''
      order by (select count(*) from "Book" where catalog_book_id = "CatalogBook".id) desc
      limit 1`,
  );
  const ref = process.argv[2] ?? rows[0]?.slug;
  if (!ref) throw new Error("No public book available to profile");
  console.log(JSON.stringify({ ref }));
  let phase = "";
  let queries = 0;
  pool.query = new Proxy(pool.query, {
    apply(target, thisArg, args) {
      const started = performance.now();
      const label = phase;
      const query = typeof args[0] === "string" ? args[0] : args[0]?.text ?? "";
      queries++;
      const result = Reflect.apply(target, thisArg, args);
      return result.then((value: { rowCount: number }) => {
        console.log(JSON.stringify({ phase: label, ms: Math.round(performance.now() - started),
          rows: value.rowCount, tables: [...query.matchAll(/(?:from|join)\s+"([^"]+)"/gi)].map((m) => m[1]) }));
        return value;
      });
    },
  });
  for (let run = 1; run <= 3; run++) {
    phase = `detail-${run}`;
    queries = 0;
    const started = performance.now();
    const [, detail] = await Promise.all([getBookMetadata(ref), getBookDetail(ref)]);
    console.log(JSON.stringify({ phase, totalMs: Math.round(performance.now() - started), queries }));
    if (!detail.found) throw new Error("Book not found");
    phase = `related-${run}`;
    queries = 0;
    const relatedStarted = performance.now();
    await Promise.all([getSimilarBooks(detail.book.id), getMagazineArticlesForBook(detail.book.id)]);
    console.log(JSON.stringify({ phase, totalMs: Math.round(performance.now() - relatedStarted), queries }));
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
