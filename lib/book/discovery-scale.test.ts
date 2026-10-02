import assert from "node:assert/strict";
import test from "node:test";

test("indexed discovery covers 20,000 works without a pre-ranking cutoff", {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const { db, pool } = await import("@/db");
  const { sql } = await import("drizzle-orm");
  const { getDiscoveryCandidates } = await import("./discover-service");
  const { selectQuizBooks } = await import("./discover-quiz");
  const { selectDiscoveryIds, genresOf } = await import("./discovery-signals");
  const { moods, topics } = await import("./discover-config");
  try {
    await db.transaction(async (tx) => {
      // Temporary tables shadow the real catalog only on this transaction's connection.
      // No application rows, triggers or reading histories are modified.
      await tx.execute(sql`create temp table "CatalogBook" (like public."CatalogBook" including defaults including generated including indexes) on commit drop`);
      await tx.execute(sql`create temp table "BookEdition" (like public."BookEdition" including defaults including indexes) on commit drop`);
      await tx.execute(sql`create temp table "CatalogBookContributor" (like public."CatalogBookContributor" including defaults including indexes) on commit drop`);
      await tx.execute(sql`insert into "CatalogBook" (id, slug, title, author, genre, description, status)
        select 'scale-' || n, 'scale-' || n, 'Scale book ' || n, 'Author ' || (n % 400),
          case n % 6 when 0 then 'داستان تریلر' when 1 then 'داستان فانتزی'
            when 2 then 'داستان روانشناسانه' when 3 then 'داستان عاشقانه'
            when 4 then 'فلسفه' else 'ادبیات داستانی' end,
          case n % 6 when 0 then 'رمانی با فضای تاریک و تعلیق.'
            when 1 then 'ماجراجویی در یک دنیای جادویی.'
            when 2 then 'داستانی درباره هویت، تنهایی و معنای زندگی.'
            when 3 then 'رمانی درباره روابط انسانی و دوستی.'
            when 4 then 'پرسش های بنیادی و نقد اجتماعی.'
            else 'متنی آرامش بخش برای زندگی ساده.' end ||
            repeat(' نویسنده روایت خود را با نگاهی به تجربه شخصیت ها و اتفاقات روزمره دنبال می کند. این معرفی اطلاعاتی از ساختار اثر و شیوه روایت آن در اختیار خواننده قرار می دهد.', 8), 'APPROVED'
        from generate_series(1, 20000) n`);
      await tx.execute(sql`insert into "BookEdition" (id, catalog_book_id, page_count, status, cover_image)
        select 'edition-' || n, 'scale-' || n, case n % 3 when 0 then 180 when 1 then 320 else 520 end,
          'APPROVED', '/scale-cover.webp' from generate_series(1, 20000) n`);
      await tx.execute(sql`update "CatalogBook" set genre = 'فلسفه • ذهن آگاهی',
        description = '<p>راهنمایی آرامش‌بخش برای زندگی ساده و آرامش درونی، با پرسش های بنیادی.</p>'
        where id = 'scale-20000'`);
      await tx.execute(sql`update "BookEdition" set page_count = 180 where catalog_book_id = 'scale-20000'`);
      await tx.execute(sql`update "CatalogBook" set status = 'PENDING' where id = 'scale-19999'`);
      await tx.execute(sql`analyze "CatalogBook"`);
      await tx.execute(sql`analyze "BookEdition"`);

      const started = performance.now();
      const all = await getDiscoveryCandidates([], [], tx);
      assert.equal(all.length, 19999);
      assert(!all.some(({ id }) => id === "scale-19999"));
      let maxQueryMs = 0;
      for (const collection of [...moods, ...topics]) {
        const queryStart = performance.now();
        const indexed = await getDiscoveryCandidates([collection], [], tx);
        maxQueryMs = Math.max(maxQueryMs, performance.now() - queryStart);
        assert.deepEqual(selectDiscoveryIds(indexed, collection, 20, "2026-10-02"),
          selectDiscoveryIds(all, collection, 20, "2026-10-02"), `Prefilter lost a match for ${collection.slug}`);
      }
      const calm = moods.find(({ slug }) => slug === "calm")!;
      const candidates = await getDiscoveryCandidates([calm], [], tx);
      const quizStart = performance.now();
      const answers = { kind: "reflective", mood: "calm", commitment: "short" };
      const selected = selectQuizBooks(candidates, answers, [], "2026-10-02", 96);
      const rankingMs = Math.round(performance.now() - quizStart);
      assert.equal(selected[0].id, "scale-20000");
      assert(!selected.some(({ id }) => id === "scale-19999"));
      const excluded = await getDiscoveryCandidates([calm], ["scale-20000"], tx);
      assert(!excluded.some(({ id }) => id === "scale-20000"));
      assert(candidates.every((book) => book.id === "scale-20000" || !genresOf(book).includes("داستان تریلر")));
      const plan = await tx.execute<{ "QUERY PLAN": string }>(sql`explain (analyze, buffers)
        select id from "CatalogBook" where status = 'APPROVED'
          and discovery_text like '%آرامش درونی%'`);
      assert(plan.rows.some((row) => /Index Scan/.test(row["QUERY PLAN"])), "Rare description phrase must use the trigram index");
      console.log(JSON.stringify({ scaleCatalog: all.length, calmCandidates: candidates.length,
        maxCandidateQueryMs: Math.round(maxQueryMs), ranking96Ms: rankingMs,
        totalCheckMs: Math.round(performance.now() - started), usesTextIndex: true }));
    });
  } finally { await pool.end(); }
});
