# Reading-list database rollout

The public list pages, Discover reading paths, and sitemap now read `ReadingList`, `ReadingListItem`, and `ReadingListRelated`. The old `reading-lists-config.ts` is retained only as the one-time import source and test fixture; it is not used at runtime.

For each environment, deploy the schema migration before the application code starts serving public list routes:

1. Back up the PostgreSQL database using the normal deployment backup process.
2. Run `npm run db:migrate` with that environment's `DATABASE_URL`.
3. Run `npm run lists:import` with the same `DATABASE_URL` before switching traffic to the new code.
4. Confirm `/lists`, all eight existing slugs, `/discover/paths`, and `/sitemap.xml`.

The import runs in one transaction, checks that every configured canonical book slug exists, inserts only missing list slugs, and then inserts their items and directed relations. Repeating it does not duplicate rows or overwrite Admin edits. It reports the number inserted; the first run should report 8 and a repeat run 0. If a required CatalogBook slug is absent, the import stops before writing any lists so the catalog can be repaired first.

New editorial lists are managed at `/admin/reading-lists`. Publishing requires at least one currently public CatalogBook. A later book status change is reflected automatically in public list counts; a list with no remaining public books returns 404 and is omitted from the hub, Discover, and sitemap.
