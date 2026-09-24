# Recommendation quality pass (local catalog, 2026-09-24)

Run the read-only snapshot with `npx tsx --env-file=.env scripts/recommendation-quality-audit.ts`. The figures below describe the connected **local** database, not production. The audit is a diagnostic, not a fairness quota.

## Why the same books won

The old quiz added full-strength broad genre hits, metadata hits and multiple editorial boosts, then settled all equal scores by canonical ID. It had no daily rotation, and its diversity step only avoided the same author within an *exact* score tie. `ادبیات داستانی` occurs on 40/50 books, `ادبیات معاصر` on 31, and `رمان` on 18. These labels made many books appear equally relevant to the literary choice; early ID ordering then kept the same winners. Four quiz answer sets can also stack two curated boosts and a starting-book bonus. Semantic topics had only three curated slugs each, so repetition there reflects a genuine metadata gap. Similar Books' old SQL `LIMIT 400` ordered by broad genre overlap before complete scoring; it did not truncate this 50-book database, but could exclude a stronger later book as the catalog grows. The old UUID-cursor random pick was not uniform across existing UUIDs because unequal key-space gaps give books unequal chances.

## Local catalog distribution

There are **50 public canonical works**, **40 stored genre labels**, **36 displayed authors**, and **5 known country values**. The largest genres are `ادبیات داستانی` 40, `ادبیات معاصر` 31, `دهه 2020 میلادی` 29, `ادبیات آمریکا` 20, `داستان فانتزی` 18, `رمان` 18, `ادبیات نوجوان` 16, `داستان معمایی` 8, `داستان عاشقانه` 7, and `داستان تریلر` 6. All other labels have five or fewer books. The most prolific authors (آلیس فینی, سو لین تن, صبا طاهر) have three works each; eight others have two, and the rest have one.

Country: آمریکا 19, انگلیس 10, فرانسه 3, ژاپن 1, کانادا 1, unknown 16. Publication decade: 2020s 28, 2010s 12, 1990s 3, 1980s/1930s/1890s/1880s/1810s 1 each, unknown 2. Language is `fa` on all 50. Genre and structured author IDs are present on all 50; publication year is present on 48; approved-edition page count on 49. Page-count bins: 100–199 7, 200–299 7, 300–399 17, 400–499 11, 500–599 4, 600–699 3, unknown 1. Six-field completeness (genre, country, language, year, page count, contributor IDs) is 6/6 for 31 and 5/6 for 19. User library data supplies only two ratings on linked public works and three tracked works; there is no catalog view-count signal. Ratings and popularity therefore have no recommendation weight.

Editorial coverage: 20 public books have at least one discovery trait; 24 participate in curated Similar Books relationships; 26 have neither. These sets overlap. Ordered Reading Lists are editorial and were left unchanged.

## Scoring and selection

| Signal | Before | After |
| --- | ---: | ---: |
| Exact collection genre | 4, including broad labels | 4 specific; 1.5 broad |
| Collection editorial trait | 2 | 1.5 |
| Quiz kind/mood | additive collection scores | additive, but broad genres are weaker |
| Quiz matching page count | +2 | +1.5 |
| Quiz conflicting known length | 0 | −0.5 |
| Quiz unknown length | 0 | 0 |
| Starting-book preference | +0.25 | +0.15 |
| Similar shared specific genre | +5 per label | +4 per label, at most two |
| Similar same author | +5 | +3 |
| Similar broad shared genre | +1 | +0.75 only with country or era support |
| Similar country / era / length | +1 / +0.5 / +0.5 | +0.5 / +0.25 / +0.25, only after a real similarity signal |
| Rotation | none | deterministic 0–0.3 |

`recommendation-ranking.ts` is the shared final selector. It compares only candidates within 0.75 score of the best remaining candidate. Within that near-equal window it applies a 0.6 same-author and 0.2 shared-specific-genre soft penalty, then a 0–0.3 deterministic hash value. It never admits a weak match solely to diversify. The seed contains the Tehran calendar day, surface, selected options, and candidate ID. Same input and day produce the same results; a new day can rotate equals. Different feature scorers still have their own semantics. The quiz exposes score factors for tests and debugging; a later semantic score can be composed into each feature scorer before this common selector, without changing eligibility or adding AI infrastructure now.

The quiz keeps unknown length eligible and only explains a length preference when the edition length is known and matches. Reroll excludes up to 30 already shown canonical IDs in the current interaction and keeps ranking the remaining matches. If reliable matches run out, it returns fewer books instead of filling with unrelated zero-score books; the UI shows the actual count. The all-`any` quiz is exploratory and uses all public books. Random Book separately uses a uniform random offset over the public count, with no `ORDER BY RANDOM()`.

## Mood and topic precision

| Mood | Objective signal | Editorial signal / fallback |
| --- | --- | --- |
| dark | horror, thriller | 3 explicit books; no generic crime or mystery inference |
| calm | none | 3 explicit books only |
| thoughtful | psychological fiction | 3 explicit books; no generic magical-realism inference |
| thrilling | mystery, thriller, adventure, crime | 3 explicit books |
| elsewhere | fantasy, science fiction, magical realism | 3 explicit books |
| weighty | none | 3 explicit books only; no generic classic/historical/social inference |

Topics identity, life, power, war and solitude have no defensible topic column or narrow topic taxonomy in this catalog. They use three explicit editorial books each, with no title-based inference. Relationships uses the romance genre plus three explicit books. The UI already supports variable result counts. Future admin-managed semantic traits/topics would improve these sparse surfaces, but that is outside this pass.

Similar Books preserves curated **directed order and absolute priority** (the existing editorial contract). Automatic results then use specific taxonomy, compatible same-author works, and weak contextual tie-breaks. With at least three curated results, automatic fill requires a score of 4.5 or more; this avoids padding a strong four-book curated path with a single weak shared genre. A non-curated source needs no config. Similar Books now scores the complete lightweight public signal scan in keyset pages before resolving at most six cards; no pre-score 400-row cutoff remains. If the catalog becomes large, add an indexed taxonomy candidate query that preserves complete-score opportunity within each relevance tier.

## Before / after simulation

| Surface | Before: slots / unique / top-five share | After: slots / unique / top-five share |
| --- | --- | --- |
| Six moods | 60 / 37 / 26.7% | 51 / 37 / 23.5% |
| Six topics | 27 / 21 / 37.0% | 25 / 21 / 36.0% |
| All 112 quiz combinations | 336 / 27 / 54.8% | 336 / 39 / 45.5% |
| Similar Books for all 50 sources | 300 / 48 / 25.0% | 276 / 48 / 23.2% |

The quiz's five most frequent books went from 45, 44, 39, 31 and 25 appearances to 37, 35, 30, 26 and 25. Quiz slots occupied by books without a curated discovery trait increased from 66 to 96; the largest single author's share fell from 13.4% to 11.0%. Changing just one answer changes, on average, 69.4% of quiz slots for kind (was 52.8%), 57.2% for mood (was 61.7%), and 50.8% for commitment (was 37.7%). The mood decline reflects the removal of unsupported broad mood inferences. In the seeded `exciting/dark/short` example, the first result stayed strong while two near-equal results changed the following day. Fewer slots on moods, topics and Similar Books reflect stricter precision, so concentration percentages across those surfaces have different denominators.

This remains a small, skewed catalog. Semantic-only collections cannot rotate beyond their three documented books until editorial coverage or reliable semantic data expands. More unique books is not itself the optimization target.

## Files changed

Ranking and signals: `lib/book/recommendation-ranking.ts`, `lib/book/discovery-signals.ts`, `lib/book/discover-quiz.ts`, `lib/book/discover-config.ts`, `lib/book/similar-books-service.ts`, `lib/book/discover-service.ts`. Quiz result handling: `app/discover/actions.ts`, `components/discover/ThreeQuestions.tsx`. Tests: `lib/book/discover-quiz.test.ts`, `lib/book/discovery-db.test.ts`, `lib/book/similar-books-service.test.ts`. Diagnostic and report: `scripts/recommendation-quality-audit.ts`, this document. The curated Similar Books config and all Reading Lists files were preserved.

## Validation and performance

The complete signal read took 59 ms in one local diagnostic run. Two representative Similar Books lookups took 7 ms each; Random Book took 3 ms. These are local timings, not production latency claims. The route is `force-dynamic`, and no service cache freezes the daily seed. Two queries resolve only selected card fields after scoring. The diagnostic script is read-only and can be rerun as catalog content changes.

Typecheck, targeted ESLint, full ESLint (zero errors and six existing unrelated warnings), the DB-enabled full test suite (362 passed, zero skipped), and production build passed. The Reading Lists DB assertion initially found two local `contemporary-lives` notes that had been saved after import with prose about unrelated books. The checked-in `reading-lists-config.ts` is the canonical seed source for that exact-content regression test; only those two notes were restored in the local database. No Reading Lists source or test was changed. All eight lists, item order, notes and directed edges now match the fixture, and two repeat imports each inserted zero lists or items. The importer intentionally preserves existing CMS edits, so a repeat import alone could not repair the local fixture drift. Browser checks covered `/discover`, all six moods and six topics, quiz, same-day repeat, reroll, random pick, curated and non-curated Similar Books, Home and `/books`; at 390px and 320px the checked pages had no horizontal overflow. A newly inserted public unconfigured book with a lexically late ID appeared in the dark mood and had automatic Similar Books immediately; the temporary record was removed and verified absent. The DB regression separately inserts and cleans up a late-ID book, confirms it reaches a full-catalog quiz result and both Similar Books directions, and excludes a pending book.
