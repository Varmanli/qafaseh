// Read-only catalog and recommendation distribution snapshot.
import { pool } from "../db";
import { getCatalogDiscoverySignals, getRandomDiscoveryBook } from "../lib/book/discover-service";
import { moods, quizCommitments, quizKinds, quizMoodOptions, topics } from "../lib/book/discover-config";
import { genresOf, selectDiscoveryIds } from "../lib/book/discovery-signals";
import { selectQuizBooks } from "../lib/book/discover-quiz";
import { similarBooksById } from "../lib/book/similar-books-config";
import { getSimilarBooks, selectSimilarBookIds } from "../lib/book/similar-books-service";

function distribution(values: (string | null)[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value ?? "unknown", (counts.get(value ?? "unknown") ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function summary(name: string, ids: string[], names: Map<string, string>, authors: Map<string, string>, curated: Set<string>) {
  const counts = distribution(ids);
  const authorCounts = distribution(ids.map((id) => authors.get(id) ?? null));
  console.log(JSON.stringify({ name, slots: ids.length, unique: counts.length,
    topFiveShare: ids.length ? Number((counts.slice(0, 5).reduce((sum, [, count]) => sum + count, 0) / ids.length).toFixed(3)) : 0,
    topAuthorShare: ids.length ? Number(((authorCounts[0]?.[1] ?? 0) / ids.length).toFixed(3)) : 0,
    nonCuratedSlots: ids.filter((id) => !curated.has(id)).length,
    top: counts.slice(0, 12).map(([id, count]) => ({ title: names.get(id) ?? id, count })) }));
}

async function main() {
  const started = performance.now();
  const books = await getCatalogDiscoverySignals();
  const names = new Map(books.map(({ id, title }) => [id, title]));
  const authors = new Map(books.map(({ id, author }) => [id, author]));
  const curated = new Set([...moods, ...topics, ...quizKinds].flatMap((item) => item.editorialBookSlugs ?? []));
  const curatedIds = new Set(books.filter((book) => book.slug && curated.has(book.slug)).map((book) => book.id));
  const curatedSimilar = new Set(Object.entries(similarBooksById).flatMap(([id, related]) => [id, ...related]));
  const [{ rows: [engagement] }] = await Promise.all([pool.query<{
    rated_books: string; ratings: string; tracked_books: string; finished_books: string;
  }>(`select count(distinct catalog_book_id) filter (where rating is not null)::text as rated_books,
    count(*) filter (where rating is not null)::text as ratings,
    count(distinct catalog_book_id)::text as tracked_books,
    count(distinct catalog_book_id) filter (where b.status = 'FINISHED')::text as finished_books
    from "Book" b join "CatalogBook" c on c.id = b.catalog_book_id
    where c.status = 'APPROVED' and c.slug is not null and trim(c.slug) <> ''
      and trim(c.title) <> '' and c.title not like '[TEST:%'`)]);
  console.log(JSON.stringify({ publicBooks: books.length, signalReadMs: Math.round(performance.now() - started),
    engagement,
    metadataCoverage: { genre: books.filter((book) => book.genre).length, country: books.filter((book) => book.country).length,
      language: books.filter((book) => book.language).length, firstPublishedYear: books.filter((book) => book.firstPublishedYear).length,
      pageCount: books.filter((book) => book.pageCount).length, contributorIds: books.filter((book) => book.contributorIds.length).length },
    genres: distribution(books.flatMap(genresOf)),
    authors: distribution(books.map((book) => book.author)),
    countries: distribution(books.map((book) => book.country)),
    languages: distribution(books.map((book) => book.language)),
    decades: distribution(books.map((book) => book.firstPublishedYear ? `${Math.floor(book.firstPublishedYear / 10) * 10}s` : null)),
    pageCoverage: books.filter((book) => book.pageCount != null).length,
    pageCounts: distribution(books.map((book) => book.pageCount == null ? null : `${Math.floor(book.pageCount / 100) * 100}-${Math.floor(book.pageCount / 100) * 100 + 99}`)),
    curatedTraits: books.filter((book) => book.slug && curated.has(book.slug)).length,
    curatedSimilar: books.filter((book) => curatedSimilar.has(book.id)).length,
    noCuratedEnrichment: books.filter((book) => !((book.slug && curated.has(book.slug)) || curatedSimilar.has(book.id))).length,
    metadataCompleteness: distribution(books.map((book) => String([book.genre, book.country, book.language, book.firstPublishedYear, book.pageCount, book.contributorIds.length].filter(Boolean).length))),
  }));
  console.log(JSON.stringify({ collectionCounts: [...moods, ...topics].map((item) => ({ slug: item.slug,
    count: selectDiscoveryIds(books, item).length, exactGenreMatches: books.filter((book) => item.genres.some((genre) => genresOf(book).includes(genre.toLocaleLowerCase("fa")))).length,
    curatedMatches: books.filter((book) => book.slug && item.editorialBookSlugs?.includes(book.slug)).length })) }));
  summary("moods", moods.flatMap((item) => selectDiscoveryIds(books, item)), names, authors, curatedIds);
  summary("topics", topics.flatMap((item) => selectDiscoveryIds(books, item)), names, authors, curatedIds);
  const quizIds = [];
  for (const kind of ["any", ...quizKinds.map((item) => item.slug)])
    for (const mood of ["any", ...quizMoodOptions.map((item) => item.slug)])
      for (const commitment of ["any", ...quizCommitments.map((item) => item.slug)])
        quizIds.push(...selectQuizBooks(books, { kind, mood, commitment }).map((item) => item.id));
  summary("quiz", quizIds, names, authors, curatedIds);
  summary("similar-all-sources", books.flatMap((source) => selectSimilarBookIds(source, similarBooksById[source.id] ?? [], books)), names, authors, curatedIds);
  const quiz = (kind: string, mood: string, commitment: string, day = "2026-09-24") =>
    selectQuizBooks(books, { kind, mood, commitment }, [], day).map((item) => item.id);
  const choices = { kind: ["any", ...quizKinds.map((item) => item.slug)],
    mood: ["any", ...quizMoodOptions.map((item) => item.slug)],
    commitment: ["any", ...quizCommitments.map((item) => item.slug)] };
  const sensitivity: Record<string, number> = {};
  for (const dimension of ["kind", "mood", "commitment"] as const) {
    let difference = 0; let pairs = 0;
    const other = (Object.keys(choices) as (keyof typeof choices)[]).filter((key) => key !== dimension);
    for (const first of choices[other[0]]) for (const second of choices[other[1]])
      for (let a = 0; a < choices[dimension].length; a++) for (let b = a + 1; b < choices[dimension].length; b++) {
        const inputs = [
          { kind: "any", mood: "any", commitment: "any", [other[0]]: first, [other[1]]: second, [dimension]: choices[dimension][a] },
          { kind: "any", mood: "any", commitment: "any", [other[0]]: first, [other[1]]: second, [dimension]: choices[dimension][b] },
        ];
        const x = quiz(inputs[0].kind, inputs[0].mood, inputs[0].commitment);
        const y = new Set(quiz(inputs[1].kind, inputs[1].mood, inputs[1].commitment));
        difference += x.filter((id) => !y.has(id)).length / 3;
        pairs++;
      }
    sensitivity[dimension] = Number((difference / pairs).toFixed(3));
  }
  const dayOne = quiz("exciting", "dark", "short");
  const dayTwo = quiz("exciting", "dark", "short", "2026-09-25");
  console.log(JSON.stringify({ quizSensitivityChangedSlotFraction: sensitivity, dailyExample: { dayOne, dayTwo } }));
  for (const source of [books.find((book) => similarBooksById[book.id]), books.find((book) => !similarBooksById[book.id])]) {
    if (!source) continue;
    const start = performance.now();
    const results = await getSimilarBooks(source.id);
    console.log(JSON.stringify({ similarQuery: source.title, resultCount: results.length, elapsedMs: Math.round(performance.now() - start) }));
  }
  const randomStart = performance.now();
  console.log(JSON.stringify({ randomBook: (await getRandomDiscoveryBook())?.title, elapsedMs: Math.round(performance.now() - randomStart) }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
