# Discovery recommendations — 2026-10-02

## Matching and reader experience

- Both the three-question quiz and mood/topic collections use approved canonical works, normalized genres and explicit phrases from descriptions. Titles and author names do not establish a mood match.
- Editorial selections provide a modest boost. They no longer define the entire calm, thoughtful or topic collection.
- Conflicting descriptions/genres are excluded from calm recommendations; immediate phrase negations do not create positive evidence.
- The quiz requires the selected mood (or the selected kind when mood is unrestricted). Full matches come before disclosed partial kind matches.
- Known lengths obey fixed boundaries: short ≤200 pages, medium 201–400, long >400. Unknown lengths are disclosed and ranked later. Explicit multi-volume sets without a known length cannot satisfy short/medium choices.
- Duplicate title/author works are collapsed; relevance, author/genre diversity and a stable daily rotation determine ordering. Reasons explain the actual matching evidence.
- Signed-in readers exclude books marked FINISHED, READING, PAUSED or STOPPED. UNREAD books remain eligible. Quiz rerolls also exclude recently displayed IDs.
- Mood/topic results retain the choice controls and offer successive pages of 20 suggestions, up to five pages.

## Catalog and cache

An indexed SQL prefilter selects potential matches before application scoring, with no pre-ranking LIMIT that could hide relevant works late in the catalog. Normalized discovery text is stored as a generated column so description normalization is performed when content changes.

Next's Data Cache stores at most 96 public IDs/reasons per answer set or collection for five minutes. Cache keys include the Tehran calendar day. Reading histories never enter the shared cache. Cards are hydrated with approval/public-route checks on every request. If personal exclusions exhaust a full cached pool, selection continues outside that pool.

## Verification

- Full application suite: 363 passed, six skipped, zero failed; subsequent quiz changes also passed all 15 targeted checks.
- Typecheck, changed-file ESLint, production build and diff whitespace checks passed.
- Database regression checks covered public eligibility, later catalog entries, private reading histories and existing similar-book behavior.
- An isolated temporary-table test used 20,000 works (19,999 approved), with descriptions around 1,200 characters. All 12 mood/topic prefilters returned the same top IDs as full-catalog scoring. The strongest matching work was the last inserted work, and a rare description phrase used the trigram index.
- In that synthetic run, the slowest candidate query was 1,298 ms; ranking 96 calm picks took 492 ms. These are local cold-query measurements, not production latency guarantees.
- A browser/account fixture with 96 read books verified fallback outside the cache, isolation from guest recommendations, and removal of a cached book after approval was revoked.
- Browser checks at 1440, 390 and 320 pixels verified quiz rerolls, collection pagination, no horizontal overflow and no JavaScript errors.
- Production-mode local requests verified a persistent five-minute cache containing only IDs/reasons. A cold calm request took 393 ms and the next request 24 ms on the small local catalog; three further requests left the cache timestamp unchanged.

## Local quality audit

The local catalog contains 50 eligible public canonical works, so some restrictive combinations cannot honestly yield three recommendations. Forcing unrelated books into those combinations would violate the choices.

| Collection | Before | After |
| --- | ---: | ---: |
| Dark | 9 | 11 |
| Calm | 3 | 4 |
| Thoughtful | 3 | 8 |
| Thrilling | 13 | 20 |
| Elsewhere | 20 | 20 |
| Weighty | 3 | 5 |
| Identity | 3 | 14 |
| Life | 3 | 5 |
| Power | 3 | 9 |
| Relationships | 10 | 17 |
| War | 3 | 7 |
| Solitude | 3 | 6 |

Counts describe the first result page, not human-rated recommendation quality. Matching remains dependent on the catalog's genres, descriptions and edition page counts.

## Deployment

Apply migrations 0066–0068 before starting the updated application. They add the normalization function, stored discovery text/trigram index, and the user/status/catalog reading-history index. The migrations were applied locally; production has not been modified by this work.

Runnable scale check after migrations: `node --env-file=.env --import tsx --test lib/book/discovery-scale.test.ts`.
